import os
import json
import stat
import asyncio
import subprocess
from pathlib import Path

import decky


CONFIG_DIR = Path(decky.DECKY_USER_HOME) / ".config" / "prelaunch-scripts"
SETTINGS_PATH = CONFIG_DIR / "settings.json"
RUNNER_PATH = CONFIG_DIR / "run"
LOG_PATH = CONFIG_DIR / "last-run.log"


DEFAULT_SETTINGS = {
    "enabled": True,
    "script_path": "",
    "timeout_seconds": 60
}


def read_settings():
    if not SETTINGS_PATH.exists():
        return DEFAULT_SETTINGS.copy()

    try:
        with open(SETTINGS_PATH, "r", encoding="utf-8") as file:
            data = json.load(file)
            return {**DEFAULT_SETTINGS, **data}
    except Exception:
        return DEFAULT_SETTINGS.copy()


def write_settings(settings):
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)

    with open(SETTINGS_PATH, "w", encoding="utf-8") as file:
        json.dump(settings, file, indent=4)


def build_script_command(script: Path):
    if script.suffix == ".sh":
        return ["bash", str(script)]

    if script.suffix == ".py":
        return ["python3", str(script)]

    return [str(script)]


class Plugin:
    async def _main(self):
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        await self.install_runner()
        decky.logger.info("PreLaunch Scripts loaded")

    async def get_settings(self):
        return read_settings()

    async def save_settings(self, settings):
        write_settings(settings)
        return True

    async def get_launch_command(self):
        return f"{RUNNER_PATH} %command%"

    async def install_runner(self):
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)

        runner_code = f'''#!/bin/bash
python3 "{Path(decky.DECKY_PLUGIN_DIR) / "run.py"}" "$@"
'''

        RUNNER_PATH.write_text(runner_code, encoding="utf-8")

        current = os.stat(RUNNER_PATH)
        os.chmod(
            RUNNER_PATH,
            current.st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH
        )

        return str(RUNNER_PATH)

    async def get_log(self):
        if not LOG_PATH.exists():
            return ""

        return LOG_PATH.read_text(encoding="utf-8", errors="replace")

    async def test_script(self):
        settings = read_settings()
        script_path = settings.get("script_path", "").strip()

        if not script_path:
            return {
                "ok": False,
                "message": "No script path set."
            }

        script = Path(script_path).expanduser()

        if not script.exists():
            return {
                "ok": False,
                "message": f"Script not found: {script}"
            }

        try:
            result = await asyncio.to_thread(
                subprocess.run,
                build_script_command(script),
                capture_output=True,
                text=True,
                timeout=int(settings.get("timeout_seconds", 60))
            )

            LOG_PATH.write_text(
                f"TEST RUN\n"
                f"Script: {script}\n"
                f"Exit code: {result.returncode}\n\n"
                f"STDOUT:\n{result.stdout}\n\n"
                f"STDERR:\n{result.stderr}\n",
                encoding="utf-8"
            )

            return {
                "ok": result.returncode == 0,
                "message": f"Exit code: {result.returncode}"
            }

        except Exception as error:
            return {
                "ok": False,
                "message": str(error)
            }

    async def _unload(self):
        decky.logger.info("PreLaunch Scripts unloaded")