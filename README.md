# DeckyScripts

Decky Loader plugin for Steam Deck that runs a local script before a game launches.

## What it does

- Lets the user set a local `.sh` or `.py` script path.
- Saves the setting to `/home/deck/.config/prelaunch-scripts/settings.json`.
- Generates a Steam launch option like `/home/deck/.config/prelaunch-scripts/run %command%`.
- Runs the script with a timeout, writes `last-run.log`, and still launches the game if the script fails.
- Stays non-root and never downloads scripts.

## Development

```bash
pnpm install
pnpm run build
```

The frontend is a plain React UI on purpose. It avoids Decky UI components so it does not hit the SteamUI React crash path that was seen during earlier testing.

## Runtime files

The Steam Deck install only needs these files:

- `dist/`
- `package.json`
- `plugin.json`
- `main.py`
- `run.py`

Copy them into `/home/deck/homebrew/plugins/prelaunch-scripts` on the Deck.

## Notes

- The plugin always shows the configured script path.
- Script execution is bounded by a timeout.
- Output goes into `last-run.log` for troubleshooting.
- Launch continues even if the script errors or times out.
