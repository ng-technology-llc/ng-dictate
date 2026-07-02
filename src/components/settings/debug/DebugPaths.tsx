import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { commands } from "@/bindings";
import { SettingContainer } from "../../ui/SettingContainer";

interface DebugPathsProps {
  descriptionMode?: "tooltip" | "inline";
  grouped?: boolean;
}

export const DebugPaths: React.FC<DebugPathsProps> = ({
  descriptionMode = "inline",
  grouped = false,
}) => {
  const { t } = useTranslation();
  const [appDataDir, setAppDataDir] = useState("");

  useEffect(() => {
    const loadAppDataDir = async () => {
      try {
        const result = await commands.getAppDirPath();
        if (result.status === "ok") {
          setAppDataDir(result.data);
        }
      } catch (error) {
        console.error("Failed to load app data directory:", error);
      }
    };

    void loadAppDataDir();
  }, []);

  const pathSeparator = appDataDir.includes("\\") ? "\\" : "/";
  const appDataPath = appDataDir || t("common.loading");
  const modelsPath = appDataDir
    ? `${appDataDir}${pathSeparator}models`
    : t("common.loading");
  const settingsPath = appDataDir
    ? `${appDataDir}${pathSeparator}settings_store.json`
    : t("common.loading");

  return (
    <SettingContainer
      title="Debug Paths"
      description="Display internal file paths and directories for debugging purposes"
      descriptionMode={descriptionMode}
      grouped={grouped}
    >
      <div className="text-sm text-gray-600 space-y-2">
        <div>
          <span className="font-medium">
            {t("settings.debug.paths.appData")}
          </span>{" "}
          <span className="font-mono text-xs select-text">{appDataPath}</span>
        </div>
        <div>
          <span className="font-medium">
            {t("settings.debug.paths.models")}
          </span>{" "}
          <span className="font-mono text-xs select-text">{modelsPath}</span>
        </div>
        <div>
          <span className="font-medium">
            {t("settings.debug.paths.settings")}
          </span>{" "}
          <span className="font-mono text-xs select-text">
            {settingsPath}
          </span>
        </div>
      </div>
    </SettingContainer>
  );
};
