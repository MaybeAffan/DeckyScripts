# DeckyScripts

Decky Loader plugin for Steam Deck that executes a user-selected local script before Steam starts a game.

## How It Works

1. DeckyScripts stores its settings in `/home/deck/.config/prelaunch-scripts/settings.json`.
2. On load, the backend creates `/home/deck/.config/prelaunch-scripts/run`.
3. Steam launches `run` instead of the game command.
4. The runner executes the configured script, records its result in `last-run.log`, then replaces itself with Steam's original command.

The original game command is always executed after the script attempt, including when the script exits with an error or exceeds its timeout.

## Features

- Executes local `.sh` and `.py` scripts before a game launch.
- Uses `/usr/bin/bash` for shell scripts and the active Python interpreter for Python scripts.
- Stores a script path, enabled state, timeout, and optional existing launch option.
- Provides an in-plugin script test with captured stdout, stderr, and exit code.
- Writes test and launch results to `/home/deck/.config/prelaunch-scripts/last-run.log`.
- Generates a Steam launch option containing one `%command%` placeholder.
- Builds a replacement launch option that preserves existing environment-variable assignments and wrapper commands.
- Does not edit Steam launch options automatically.

## Launch Options

Without an existing launch option, DeckyScripts generates:

```text
/home/deck/.config/prelaunch-scripts/run %command%
```

If a game already has launch options, enter them in **Existing launch options**. DeckyScripts generates a replacement command that starts the pre-launch runner before the existing command chain.

Leading environment assignments remain at the start of the command. Wrapper commands and arguments remain after the runner. Review the generated result and replace the game's Steam launch options manually.

## Script Execution

Shell scripts are invoked as:

```text
/usr/bin/bash /path/to/script.sh
```

Python scripts are invoked with the Python interpreter that runs the plugin backend. Other file types are executed directly and must be executable.

Timeout values are clamped to 1 through 3600 seconds. The default is 60 seconds.


## Development Deployment

Development requires Node.js and pnpm. Install the project dependencies and build the frontend before deploying changes.

Deploy these files to `/home/deck/homebrew/plugins/DeckyScripts/` on the Steam Deck:

```text
dist/
package.json
plugin.json
main.py
run.py
```

Reload Decky Loader after replacing `main.py` or `run.py`; this also recreates the generated launch runner. Rebuild and redeploy `dist/` after frontend changes.

## Safety Boundaries

- No root permission is requested.
- No scripts are downloaded or modified.
- The configured script path is visible in the plugin and the run log.
- Script output and failures are logged.
- A failed or timed-out script does not block the game launch.
