export const MAGNIFIC_CAPABILITIES = {
  provider: "magnific" as const,
  visibleModelName: "Animax Ultra" as const,
  hiddenModelId: "kling-v3-omni-pro" as const,

  supportsTextToVideo: true,
  supportsImageToVideo: true,
  supportsVideoReference: true,

  standardVideoEndpoint: "/v1/ai/video/kling-v3-omni-pro" as const,
  referenceVideoEndpoint: "/v1/ai/reference-to-video/kling-v3-omni-pro" as const,

  referenceVideoPromptToken: "@Video1" as const,
  referenceVideoMinDurationSeconds: 3,
  referenceVideoMaxDurationSeconds: 10,

  outputDurationSeconds: 10,
  maxVideoDurationSeconds: 15,

  promptMaxChars: 2500,
  targetPromptChars: 2200,

  supportsStartImage: true,
  supportsReferenceStartImage: true,
  supportsImageUrlInReferenceMode: true,

  supportsElements: true,
  requiredExtraElementImageWhenUsingElements: true,

  supportsEndImageInStandardSingleScene: true,
  supportsEndImageWithMultiPrompt: false,
  supportsEndImageWithReferenceVideo: false,

  supportsMultiShot: true,
  maxMultiShots: 6,

  nativeAudio: true,
  aspectRatios: ["auto", "16:9", "9:16", "1:1"] as const,

  cfgScaleDefault: 0.5,
  cfgScaleMin: 0,
  cfgScaleMax: 1,
};

export type MagnificCapabilities = typeof MAGNIFIC_CAPABILITIES;
export default MAGNIFIC_CAPABILITIES;
