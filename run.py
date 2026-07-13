import json
import os
import shlex
import subprocess
import sys
from datetime import datetime
from pathlib import Path


CONFIG_DIR = Path.home() / ".config" / "prelaunch-scripts"
SETTINGS_PATH = CONFIG_DIR / "settings.json"
LOG_PATH = CONFIG_DIR / "last-run.log"
MAX_TIMEOUT_SECONDS = 3600

DEFAULT_SETTINGS = {
    "enabled": True,
    "script_path": "",
    "timeout_seconds": 60,
    "existing_launch_options": "",
}


def normalize_settings(settings):
    raw_settings = settings if isinstance(settings, dict) else {}

    timeout_value = raw_settings.get("timeout_seconds", DEFAULT_SETTINGS["timeout_seconds"])
    try:
        timeout_seconds = int(timeout_value)
    except (TypeError, ValueError):
        timeout_seconds = DEFAULT_SETTINGS["timeout_seconds"]

    return {
        "enabled": bool(raw_settings.get("enabled", DEFAULT_SETTINGS["enabled"])),
        "script_path": str(raw_settings.get("script_path", "")).strip(),
        "timeout_seconds": max(1, min(timeout_seconds, MAX_TIMEOUT_SECONDS)),
        "existing_launch_options": str(
            raw_settings.get("existing_launch_options", "")
        ).strip(),
    }


def read_settings():
    if not SETTINGS_PATH.exists():
        return DEFAULT_SETTINGS.copy()

    try:
        with open(SETTINGS_PATH, "r", encoding="utf-8") as file:
            data = json.load(file)
            return normalize_settings(data)
    except Exception:
        return DEFAULT_SETTINGS.copy()


def write_log(text):
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    LOG_PATH.write_text(text, encoding="utf-8")


def build_script_command(script: Path):
    if script.suffix == ".sh":
        return ["/usr/bin/bash", str(script)]

    if script.suffix == ".py":
        return [sys.executable, str(script)]

    return [str(script)]


def format_stream(value):
    return (value or "").rstrip()


def script_environment():
    environment = os.environ.copy()
    environment.pop("LD_LIBRARY_PATH", None)
    environment.pop("LD_PRELOAD", None)
    return environment


def run_prelaunch_script(settings):
    if not settings.get("enabled", True):
        return "\n".join([
            "Plugin disabled. Skipped script.",
        ])

    script_path = settings.get("script_path", "").strip()
    timeout_seconds = settings.get("timeout_seconds", DEFAULT_SETTINGS["timeout_seconds"])

    if not script_path:
        return "\n".join([
            "No script path set. Skipped script.",
        ])

    script = Path(script_path).expanduser()

    if not script.exists():
        return "\n".join([
            f"Script not found: {script}",
        ])

    command = build_script_command(script)
    command_display = " ".join(shlex.quote(part) for part in command)

    log_lines = [
        f"Time: {datetime.now().isoformat(timespec='seconds')}",
        f"Script: {script}",
        f"Command: {command_display}",
        f"Timeout seconds: {timeout_seconds}",
    ]

    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            env=script_environment(),
        )
        stdout = format_stream(result.stdout)
        stderr = format_stream(result.stderr)
        log_lines.extend([
            f"Return code: {result.returncode}",
            "",
            "STDOUT:",
            stdout or "(empty)",
            "",
            "STDERR:",
            stderr or "(empty)",
        ])
    except subprocess.TimeoutExpired as error:
        stdout = format_stream(error.stdout)
        stderr = format_stream(error.stderr)
        log_lines.extend([
            f"Timed out after {timeout_seconds} seconds.",
            "",
            "STDOUT:",
            stdout or "(empty)",
            "",
            "STDERR:",
            stderr or "(empty)",
        ])
    except Exception as error:
        log_lines.extend([
            f"Script failed to run: {error}",
        ])

    return "\n".join(log_lines)


def launch_game(args):
    if not args:
        sys.exit(1)

    executable = os.path.expanduser(args[0])
    os.execvpe(executable, [executable, *args[1:]], os.environ)


if __name__ == "__main__":
    original_args = sys.argv[1:]
    settings = normalize_settings(read_settings())

    log = [
        "=== DECKYSCRIPTS ===",
        f"Time: {datetime.now().isoformat(timespec='seconds')}",
        f"Args: {original_args}",
        f"Enabled: {settings['enabled']}",
        f"Script path: {settings['script_path'] or '(not set)'}",
        f"Timeout seconds: {settings['timeout_seconds']}",
        "",
    ]

    try:
        log.append(run_prelaunch_script(settings))
    except Exception as error:
        log.append(f"Unexpected error while running script: {error}")
    finally:
        try:
            write_log("\n".join(log) + "\n")
        except Exception:
            pass

    launch_game(original_args)
