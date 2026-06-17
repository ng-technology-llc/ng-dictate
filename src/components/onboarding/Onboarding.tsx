import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Server } from "lucide-react";
import type { ModelInfo } from "@/bindings";
import type { ModelCardStatus } from "./ModelCard";
import ModelCard from "./ModelCard";
import NGDictateTextLogo from "../icons/NGDictateTextLogo";
import { useModelStore } from "../../stores/modelStore";
import { useSettings } from "@/hooks/useSettings";

interface OnboardingProps {
  onModelSelected: (nextSection?: "models") => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onModelSelected }) => {
  const { t } = useTranslation();
  const { updateSetting, isUpdating } = useSettings();
  const {
    models,
    downloadModel,
    selectModel,
    downloadingModels,
    verifyingModels,
    extractingModels,
    downloadProgress,
    downloadStats,
  } = useModelStore();
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  const isDownloading = selectedModelId !== null;
  const isProviderUpdating = isUpdating("transcription_provider");

  // Watch for the selected model to finish downloading + verifying + extracting
  useEffect(() => {
    if (!selectedModelId) return;

    const model = models.find((m) => m.id === selectedModelId);
    const stillDownloading = selectedModelId in downloadingModels;
    const stillVerifying = selectedModelId in verifyingModels;
    const stillExtracting = selectedModelId in extractingModels;

    if (
      model?.is_downloaded &&
      !stillDownloading &&
      !stillVerifying &&
      !stillExtracting
    ) {
      // Model is ready — select it and transition
      selectModel(selectedModelId).then((success) => {
        if (success) {
          onModelSelected();
        } else {
          toast.error(t("onboarding.errors.selectModel"));
          setSelectedModelId(null);
        }
      });
    }
  }, [
    selectedModelId,
    models,
    downloadingModels,
    verifyingModels,
    extractingModels,
    selectModel,
    onModelSelected,
  ]);

  const handleDownloadModel = async (modelId: string) => {
    setSelectedModelId(modelId);

    // Error toast is handled centrally by the model-download-failed event listener
    // in modelStore — no toast here to avoid duplicates.
    const success = await downloadModel(modelId);
    if (!success) {
      setSelectedModelId(null);
    }
  };

  const handleUseRemoteServer = async () => {
    await updateSetting("transcription_provider", "remote");
    onModelSelected("models");
  };

  const getModelStatus = (modelId: string): ModelCardStatus => {
    if (modelId in extractingModels) return "extracting";
    if (modelId in verifyingModels) return "verifying";
    if (modelId in downloadingModels) return "downloading";
    return "downloadable";
  };

  const getModelDownloadProgress = (modelId: string): number | undefined => {
    return downloadProgress[modelId]?.percentage;
  };

  const getModelDownloadSpeed = (modelId: string): number | undefined => {
    return downloadStats[modelId]?.speed;
  };

  return (
    <div className="h-screen w-screen flex flex-col p-6 gap-4 inset-0">
      <div className="flex flex-col items-center gap-2 shrink-0">
        <NGDictateTextLogo width={200} />
        <p className="text-text/70 max-w-md font-medium mx-auto">
          {t("onboarding.subtitle")}
        </p>
      </div>

      <div className="max-w-[600px] w-full mx-auto text-center flex-1 flex flex-col min-h-0">
        <div className="flex flex-col gap-4 pb-6">
          <button
            type="button"
            onClick={handleUseRemoteServer}
            disabled={isDownloading || isProviderUpdating}
            className="flex flex-col rounded-xl px-4 py-3 gap-2 text-left transition-all duration-200 border-2 border-mid-gray/20 cursor-pointer hover:border-logo-primary/50 hover:bg-logo-primary/5 hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-mid-gray/20 disabled:hover:bg-transparent disabled:hover:shadow-none disabled:hover:scale-100"
          >
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-logo-primary" />
              <div>
                <h3 className="text-base font-semibold text-text">
                  {t("modelSelector.remoteServerMode")}
                </h3>
                <p className="text-text/60 text-sm leading-relaxed">
                  {t("settings.models.remote.baseUrl.description")}
                </p>
              </div>
            </div>
          </button>

          {models
            .filter((m: ModelInfo) => !m.is_downloaded)
            .filter((model: ModelInfo) => model.is_recommended)
            .map((model: ModelInfo) => (
              <ModelCard
                key={model.id}
                model={model}
                variant="featured"
                status={getModelStatus(model.id)}
                disabled={isDownloading}
                onSelect={handleDownloadModel}
                onDownload={handleDownloadModel}
                downloadProgress={getModelDownloadProgress(model.id)}
                downloadSpeed={getModelDownloadSpeed(model.id)}
              />
            ))}

          {models
            .filter((m: ModelInfo) => !m.is_downloaded)
            .filter((model: ModelInfo) => !model.is_recommended)
            .sort(
              (a: ModelInfo, b: ModelInfo) =>
                Number(a.size_mb) - Number(b.size_mb),
            )
            .map((model: ModelInfo) => (
              <ModelCard
                key={model.id}
                model={model}
                status={getModelStatus(model.id)}
                disabled={isDownloading}
                onSelect={handleDownloadModel}
                onDownload={handleDownloadModel}
                downloadProgress={getModelDownloadProgress(model.id)}
                downloadSpeed={getModelDownloadSpeed(model.id)}
              />
            ))}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
