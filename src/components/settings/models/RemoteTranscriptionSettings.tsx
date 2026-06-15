import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PlugZap, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "@/hooks/useSettings";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { Select, type SelectOption } from "../../ui/Select";
import { SettingContainer } from "../../ui/SettingContainer";

export const RemoteTranscriptionSettings: React.FC = () => {
  const { t } = useTranslation();
  const {
    settings,
    updateSetting,
    isUpdating,
    remoteTranscriptionModelOptions,
    fetchRemoteTranscriptionModels,
    testRemoteTranscriptionConnection,
  } = useSettings();

  const baseUrl = settings?.remote_transcription_base_url ?? "";
  const model = settings?.remote_transcription_model ?? "";
  const apiKey = settings?.remote_transcription_api_key ?? "";

  const [baseUrlInput, setBaseUrlInput] = useState(baseUrl);
  const [apiKeyInput, setApiKeyInput] = useState(apiKey);

  useEffect(() => {
    setBaseUrlInput(baseUrl);
  }, [baseUrl]);

  useEffect(() => {
    setApiKeyInput(apiKey);
  }, [apiKey]);

  const modelOptions = useMemo<SelectOption[]>(() => {
    const seen = new Set<string>();
    const options: SelectOption[] = [];

    const addOption = (value: string | undefined) => {
      const trimmed = value?.trim();
      if (!trimmed || seen.has(trimmed)) return;
      seen.add(trimmed);
      options.push({ value: trimmed, label: trimmed });
    };

    for (const option of remoteTranscriptionModelOptions) {
      addOption(option);
    }
    addOption(model);

    return options;
  }, [model, remoteTranscriptionModelOptions]);

  const isBaseUrlUpdating = isUpdating("remote_transcription_base_url");
  const isModelUpdating = isUpdating("remote_transcription_model");
  const isApiKeyUpdating = isUpdating("remote_transcription_api_key");
  const isFetchingModels = isUpdating("remote_transcription_models_fetch");
  const isTestingConnection = isUpdating(
    "remote_transcription_connection_test",
  );

  const handleBaseUrlBlur = () => {
    const trimmed = baseUrlInput.trim();
    if (trimmed !== baseUrl) {
      void updateSetting("remote_transcription_base_url", trimmed);
    }
  };

  const handleApiKeyBlur = () => {
    const trimmed = apiKeyInput.trim();
    if (trimmed !== apiKey) {
      void updateSetting("remote_transcription_api_key", trimmed);
    }
  };

  const handleModelChange = (value: string | null) => {
    void updateSetting("remote_transcription_model", value?.trim() ?? "");
  };

  const handleModelCreate = (value: string) => {
    const trimmed = value.trim();
    if (trimmed) {
      void updateSetting("remote_transcription_model", trimmed);
    }
  };

  const handleRefreshModels = async () => {
    try {
      await fetchRemoteTranscriptionModels();
    } catch {
      toast.error(t("settings.models.remote.connectionFailed"));
    }
  };

  const handleTestConnection = async () => {
    try {
      await testRemoteTranscriptionConnection();
      toast.success(t("settings.models.remote.connectionOk"));
    } catch {
      toast.error(t("settings.models.remote.connectionFailed"));
    }
  };

  const canRefreshModels = baseUrl.trim() !== "";
  const canTestConnection = baseUrl.trim() !== "" && model.trim() !== "";

  return (
    <div className="space-y-3">
      <SettingContainer
        title={t("settings.models.remote.baseUrl.title")}
        description={t("settings.models.remote.baseUrl.description")}
      >
        <Input
          type="text"
          value={baseUrlInput}
          onChange={(event) => setBaseUrlInput(event.target.value)}
          onBlur={handleBaseUrlBlur}
          placeholder={t("settings.models.remote.baseUrl.placeholder")}
          disabled={isBaseUrlUpdating}
          className="w-full min-w-0 sm:min-w-[360px]"
        />
      </SettingContainer>

      <SettingContainer
        title={t("settings.models.remote.model.title")}
        description={t("settings.models.remote.model.description")}
      >
        <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            className="w-full min-w-0 sm:min-w-[360px]"
            value={model || null}
            options={modelOptions}
            onChange={(value) => handleModelChange(value)}
            onCreateOption={handleModelCreate}
            placeholder={t("settings.models.remote.model.placeholder")}
            disabled={isModelUpdating}
            isLoading={isFetchingModels}
            isCreatable
            formatCreateLabel={(input) =>
              t("settings.models.remote.model.useModel", { model: input })
            }
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleRefreshModels}
            disabled={!canRefreshModels || isFetchingModels}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <RefreshCw
              className={`h-4 w-4 ${isFetchingModels ? "animate-spin" : ""}`}
            />
            {t("settings.models.remote.model.refreshModels")}
          </Button>
        </div>
      </SettingContainer>

      <SettingContainer
        title={t("settings.models.remote.apiKey.title")}
        description={t("settings.models.remote.apiKey.description")}
      >
        <Input
          type="password"
          value={apiKeyInput}
          onChange={(event) => setApiKeyInput(event.target.value)}
          onBlur={handleApiKeyBlur}
          placeholder={t("settings.models.remote.apiKey.placeholder")}
          disabled={isApiKeyUpdating}
          className="w-full min-w-0 sm:min-w-[320px]"
        />
      </SettingContainer>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="primary-soft"
          size="sm"
          onClick={handleTestConnection}
          disabled={!canTestConnection || isTestingConnection}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <PlugZap className="h-4 w-4" />
          {t("settings.models.remote.testConnection")}
        </Button>
      </div>
    </div>
  );
};
