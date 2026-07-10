import { callable, definePlugin, toaster } from "@decky/api";
import { useEffect, useState } from "react";

type Settings = {
  enabled: boolean;
  script_path: string;
  timeout_seconds: number;
};

type TestResult = {
  ok: boolean;
  message: string;
};

const getSettings = callable<[], Settings>("get_settings");
const saveSettings = callable<[settings: Settings], boolean>("save_settings");
const getLaunchCommand = callable<[], string>("get_launch_command");
const testScript = callable<[], TestResult>("test_script");
const getLog = callable<[], string>("get_log");

function Content() {
  const [settings, setSettings] = useState<Settings>({
    enabled: true,
    script_path: "",
    timeout_seconds: 60,
  });

  const [launchCommand, setLaunchCommand] = useState("");
  const [log, setLog] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const loadedSettings = await getSettings();
      const command = await getLaunchCommand();
      const latestLog = await getLog();

      setSettings(loadedSettings);
      setLaunchCommand(command);
      setLog(latestLog);
    } catch (error) {
      console.error("PreLaunch Scripts load error:", error);
    }
  }

  async function save() {
    try {
      await saveSettings(settings);

      toaster.toast({
        title: "PreLaunch Scripts",
        body: "Settings saved.",
      });
    } catch (error) {
      console.error("Save failed:", error);
    }
  }

  async function runTest() {
    try {
      await saveSettings(settings);

      const result = await testScript();
      const latestLog = await getLog();

      setLog(latestLog);

      toaster.toast({
        title: result.ok ? "Script test passed" : "Script test failed",
        body: result.message,
      });
    } catch (error) {
      console.error("Test failed:", error);
    }
  }

  async function refreshLog() {
    const latestLog = await getLog();
    setLog(latestLog);
  }

  return (
    <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>
      <h2>PreLaunch Scripts DEBUG 3</h2>

      <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(event) =>
            setSettings({
              ...settings,
              enabled: event.currentTarget.checked,
            })
          }
        />
        Enable prelaunch script
      </label>

      <div>
        <div>Script path</div>
        <input
          style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
          value={settings.script_path}
          placeholder="/home/deck/Scripts/before-game.sh"
          onChange={(event) =>
            setSettings({
              ...settings,
              script_path: event.currentTarget.value,
            })
          }
        />
      </div>

      <div>
        <div>Timeout seconds</div>
        <input
          style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
          type="number"
          value={settings.timeout_seconds}
          onChange={(event) =>
            setSettings({
              ...settings,
              timeout_seconds: Number(event.currentTarget.value),
            })
          }
        />
      </div>

      <button onClick={save}>Save Settings</button>
      <button onClick={runTest}>Test Script</button>

      <div>
        <div>Put this in a Steam game&apos;s launch options:</div>
        <textarea
          readOnly
          value={launchCommand}
          style={{ width: "100%", minHeight: "70px", padding: "8px", boxSizing: "border-box" }}
        />
      </div>

      <button onClick={refreshLog}>Refresh Log</button>

      <div>
        <div>Log</div>
        <textarea
          readOnly
          value={log}
          placeholder="No log yet."
          style={{ width: "100%", minHeight: "160px", padding: "8px", boxSizing: "border-box" }}
        />
      </div>
    </div>
  );
}

export default definePlugin(() => {
  return {
    name: "PreLaunch Scripts",
    titleView: <div>PreLaunch Scripts</div>,
    content: <Content />,
    icon: <div>▶</div>,
  };
});