import os
import sys
import json
import subprocess
from pathlib import Path
from datetime import datetime


CONFIG_DIR = Path.home() / ".config" / "prelaunch-scripts"
SETTINGS_PATH = CONFIG_DIR / "settings.json"
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


def write_log(text):
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    LOG_PATH.write_text(text, encoding="utf-8")


def build_script_command(script: Path):
    if script.suffix == ".sh":
        return ["bash", str(script)]

    if script.suffix == ".py":
        return ["python3", str(script)]

    return [str(script)]


def run_prelaunch_script(settings):
    if not settings.get("enabled", True):
        return "Plugin disabled. Skipped script."

    script_path = settings.get("script_path", "").strip()

    if not script_path:
        return "No script path set. Skipped script."

    script = Path(script_path).expanduser()

    if not script.exists():
        return f"Script not found: {script}"

    result = subprocess.run(
        build_script_command(script),
        capture_output=True,
        text=True,
        timeout=int(settings.get("timeout_seconds", 60))
    )

    return (
        f"Script: {script}\n"
        f"Exit code: {result.returncode}\n\n"
        f"STDOUT:\n{result.stdout}\n\n"
        f"STDERR:\n{result.stderr}\n"
    )


def launch_game(args):
    if not args:
        sys.exit(1)

    os.execvpe(args[0], args, os.environ)


if __name__ == "__main__":
    original_args = sys.argv[1:]
    settings = read_settings()

    log = [
        "=== PRELAUNCH SCRIPTS ===",
        f"Time: {datetime.now().isoformat()}",
        f"Args: {original_args}",
        ""
    ]

    try:
        log.append(run_prelaunch_script(settings))
    except Exception as error:
        log.append(f"Script failed: {error}")

    try:
        write_log("\n".join(log))
    except Exception:
        pass

    launch_game(original_args)