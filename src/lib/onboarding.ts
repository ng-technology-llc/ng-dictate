export type TranscriptionProvider = "local" | "remote";

export const hasTranscriptionBackendConfigured = (
  hasLocalModels: boolean,
  provider: TranscriptionProvider | undefined,
): boolean => {
  return hasLocalModels || provider === "remote";
};
