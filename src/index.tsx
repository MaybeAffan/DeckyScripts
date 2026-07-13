import { callable, definePlugin, toaster } from "@decky/api";
import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  SliderField,
  TextField,
  ToggleField,
} from "@decky/ui";
import { useEffect, useState } from "react";

type Settings = {
  enabled: boolean;
  script_path: string;
  timeout_seconds: number;
  existing_launch_options: string;
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

const defaultSettings: Settings = {
  enabled: true,
  script_path: "",
  timeout_seconds: 60,
  existing_launch_options: "",
};

const headingStyle = {
  fontSize: "14px",
  fontWeight: "bold",
  marginTop: "12px",
  marginBottom: "6px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.2)",
  paddingBottom: "3px",
  color: "white",
};

function SectionHeading({ children }: { children: string }) {
  return (
    <PanelSectionRow>
      <div style={headingStyle}>{children}</div>
    </PanelSectionRow>
  );
}

function buildMergedLaunchCommand(runnerCommand: string, existingOptions: string) {
  if (!runnerCommand) {
    return "";
  }

  const original = (existingOptions ?? "").trim();
  if (!original) {
    return `${runnerCommand} %command%`;
  }

  // Steam environment assignments must remain at the front of the command.
  const environmentPrefix = original.match(
    /^(?:(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|\S+))\s+)*/,
  )?.[0] ?? "";
  const commandPart = original.slice(environmentPrefix.length).trim();
  const commandWithPlaceholder = commandPart.includes("%command%")
    ? commandPart
    : `${commandPart} %command%`.trim();

  return [environmentPrefix.trim(), runnerCommand, commandWithPlaceholder]
    .filter(Boolean)
    .join(" ");
}

function Content() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [launchCommand, setLaunchCommand] = useState("");
  const [log, setLog] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);

    try {
      const [loadedSettings, command, latestLog] = await Promise.all([
        getSettings(),
        getLaunchCommand(),
        getLog(),
      ]);

      setSettings(loadedSettings);
      setLaunchCommand(command);
      setLog(latestLog);
    } catch (error) {
      console.error("DeckyScripts load error:", error);
      toaster.toast({
        title: "DeckyScripts",
        body: "Could not load the current settings.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function save() {
    setIsSaving(true);

    try {
      await saveSettings(settings);
      const [refreshedSettings, command] = await Promise.all([
        getSettings(),
        getLaunchCommand(),
      ]);

      setSettings(refreshedSettings);
      setLaunchCommand(command);
      toaster.toast({ title: "DeckyScripts", body: "Settings saved." });
    } catch (error) {
      console.error("Save failed:", error);
      toaster.toast({ title: "Save failed", body: "Check the console for details." });
    } finally {
      setIsSaving(false);
    }
  }

  async function runTest() {
    setIsTesting(true);

    try {
      await saveSettings(settings);
      const result = await testScript();
      setLog(await getLog());
      toaster.toast({
        title: result.ok ? "Script test passed" : "Script test failed",
        body: result.message,
      });
    } catch (error) {
      console.error("Test failed:", error);
      toaster.toast({ title: "Test failed", body: "Check the console for details." });
    } finally {
      setIsTesting(false);
    }
  }

  async function refreshLog() {
    try {
      setLog(await getLog());
    } catch (error) {
      console.error("Failed to refresh log:", error);
    }
  }

  async function copyLaunchCommand() {
    if (!mergedLaunchCommand) {
      return;
    }

    try {
      const input = document.createElement("textarea");
      input.value = mergedLaunchCommand;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);

      let copied = false;
      try {
        input.focus({ preventScroll: true });
        input.select();
        copied = document.execCommand("copy");

        if (!copied && navigator.clipboard) {
          await navigator.clipboard.writeText(mergedLaunchCommand);
          copied = true;
        }
      } finally {
        document.body.removeChild(input);
      }

      if (!copied) {
        throw new Error("Clipboard access was unavailable");
      }

      toaster.toast({
        title: "Launch command copied",
        body: "Paste it into the game's Steam launch options.",
      });
    } catch (error) {
      console.error("Copy failed:", error);
      toaster.toast({ title: "Copy failed", body: "Clipboard access was unavailable." });
    }
  }

  const busy = isLoading || isSaving || isTesting;
  const mergedLaunchCommand = buildMergedLaunchCommand(
    launchCommand,
    settings.existing_launch_options,
  );

  return (
    <PanelSection>
      <PanelSectionRow>
        <div style={{ fontSize: "12px", lineHeight: "1.4", opacity: "0.8" }}>
          Run one local script before a game starts. The game will still launch if the script fails
          or reaches its timeout.
        </div>
      </PanelSectionRow>

      <SectionHeading>Script</SectionHeading>
      <PanelSectionRow>
        <ToggleField
          label="Enable prelaunch script"
          description="Only the path shown below is run. No downloads and no root access."
          checked={settings.enabled}
          disabled={busy}
          onChange={(enabled: boolean) => setSettings({ ...settings, enabled })}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <TextField
          label="Script path"
          description="Use a local .sh or .py script. This path is also written to the log."
          value={settings.script_path}
          disabled={busy}
          bShowClearAction
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setSettings({ ...settings, script_path: event.currentTarget.value })
          }
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <SliderField
          label="Timeout"
          description="The game launches even if the script takes too long."
          value={settings.timeout_seconds}
          min={1}
          max={300}
          step={1}
          showValue
          valueSuffix=" seconds"
          disabled={busy}
          onChange={(timeout_seconds: number) => setSettings({ ...settings, timeout_seconds })}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={save}
          disabled={busy}
        >
          {isSaving ? "Saving settings..." : "Save settings"}
        </ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={runTest}
          disabled={busy || !settings.script_path.trim()}
        >
          {isTesting ? "Testing script..." : "Test script"}
        </ButtonItem>
      </PanelSectionRow>

      <SectionHeading>Launch Options</SectionHeading>
      <PanelSectionRow>
        <div style={{ fontSize: "12px", lineHeight: "1.4", opacity: "0.8" }}>
          Paste the game&apos;s current launch options below if it already has any. DeckyScripts
          creates a merged replacement but does not change Steam&apos;s setting automatically.
        </div>
      </PanelSectionRow>
      <PanelSectionRow>
        <TextField
          label="Existing launch options"
          value={settings.existing_launch_options}
          disabled={busy}
          bShowClearAction
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setSettings({
              ...settings,
              existing_launch_options: event.currentTarget.value,
            })
          }
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem layout="below" onClick={save} disabled={busy}>
          {isSaving ? "Saving settings..." : "Save existing launch options"}
        </ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <div
          style={{
            fontSize: "12px",
            lineHeight: "1.4",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            padding: "8px",
            borderRadius: "4px",
            fontFamily: "monospace",
            overflowWrap: "anywhere",
          }}
        >
          {mergedLaunchCommand || "Loading launch command..."}
        </div>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem layout="below" onClick={copyLaunchCommand} disabled={!mergedLaunchCommand || isLoading}>
          Copy merged launch option
        </ButtonItem>
      </PanelSectionRow>

      <SectionHeading>Last Run Log</SectionHeading>
      <PanelSectionRow>
        <div style={{ fontSize: "12px", lineHeight: "1.4", opacity: "0.8", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {log || "No script has been run yet."}
        </div>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem layout="below" onClick={refreshLog} disabled={isLoading}>
          Refresh log
        </ButtonItem>
      </PanelSectionRow>
    </PanelSection>
  );
}

export default definePlugin(() => ({
  name: "DeckyScripts",
  titleView: <div>DeckyScripts</div>,
  alwaysRender: true,
  content: <Content />,
  icon: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M6 4.5L16 10L6 15.5V4.5Z" fill="currentColor" />
    </svg>
  ),
}));
