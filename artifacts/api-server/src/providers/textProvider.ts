import { DEMO_MODE, demoResponse, getActiveKey, notConfiguredError } from "./registry.js";

export interface TextRequest {
  systemPrompt?: string;
  userPrompt: string;
  maxTokens?: number;
  schema?: string;
}

export interface TextResponse {
  text: string;
  raw?: unknown;
  demo?: boolean;
}

export async function generateText(req: TextRequest): Promise<TextResponse> {
  if (DEMO_MODE) {
    return {
      text: `[DEMO] ${req.userPrompt.slice(0, 200)}`,
      ...demoResponse("text"),
    };
  }
  const key = getActiveKey("anthropic");
  if (!key) {
    throw Object.assign(new Error("Text provider not configured"), {
      response: notConfiguredError("anthropic", "text"),
      statusCode: 503,
    });
  }
  return {
    text: "Anthropic call goes here. Stub — to be implemented in Task 3.",
    raw: { stub: true },
  };
}
