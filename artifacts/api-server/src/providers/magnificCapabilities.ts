/**
 * Capabilities flags for the Magnific Kling-v3-Omni-Pro family. Mirrors the
 * official docs at https://docs.magnific.com/api-reference/video/kling-v3-omni
 *
 * NOTE: The published Omni Pro schema does NOT include `cfg_scale` or
 * `negative_prompt`. Older Kling versions accepted them but they have been
 * removed from the Omni Pro endpoint, so we never send them.
 */
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
  outputDurationMinSeconds: 3,
  outputDurationMaxSeconds: 15,

  promptMaxChars: 2500,
  targetPromptChars: 2200,

  supportsStartImage: true,
  supportsStartEndImagePair: true,
  supportsReferenceStartImage: true,
  supportsImageUrlInReferenceMode: true,

  supportsElements: true,
  // Total of `image_urls.length + elements.length` cannot exceed this.
  maxImageAndElementRefs: 4,

  supportsEndImageInStandardSingleScene: true,
  supportsEndImageWithMultiPrompt: false,
  supportsEndImageWithReferenceVideo: false,

  supportsMultiShot: true,
  maxMultiShots: 6,
  multiShotMaxTotalSeconds: 15,
  multiShotShotTypes: ["customize"] as const,

  supportsGenerateAudio: true,
  aspectRatios: ["auto", "16:9", "9:16", "1:1"] as const,
};

export type MagnificCapabilities = typeof MAGNIFIC_CAPABILITIES;
export default MAGNIFIC_CAPABILITIES;
