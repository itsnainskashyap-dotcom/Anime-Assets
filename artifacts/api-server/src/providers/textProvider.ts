import Anthropic from "@anthropic-ai/sdk";
import {
  DEMO_MODE,
  demoResponse,
  getActiveKey,
  notConfiguredError,
  withFailover,
  type ActiveKey,
} from "./registry.js";
import { logger } from "../lib/logger.js";

export interface TextRequest {
  systemPrompt?: string;
  userPrompt: string;
  maxTokens?: number;
  schema?: string;
  jsonOnly?: boolean;
  imageUrls?: string[];
}

export interface TextResponse {
  text: string;
  raw?: unknown;
  demo?: boolean;
}

const CLAUDE_MODEL = "claude-sonnet-4-6";

function buildClient(key: ActiveKey): Anthropic {
  const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  return new Anthropic({
    apiKey: key.key,
    ...(baseURL ? { baseURL } : {}),
  });
}

function ensureConfigured(): void {
  if (!getActiveKey("anthropic")) {
    throw Object.assign(new Error("Text provider (Anthropic) not configured"), {
      response: notConfiguredError("anthropic", "text"),
      statusCode: 503,
    });
  }
}

function extractText(message: Anthropic.Messages.Message): string {
  const parts: string[] = [];
  for (const block of message.content) {
    if (block.type === "text") parts.push(block.text);
  }
  return parts.join("\n");
}

export async function generateText(req: TextRequest): Promise<TextResponse> {
  if (DEMO_MODE) {
    return {
      text: `[DEMO] ${req.userPrompt.slice(0, 200)}`,
      ...demoResponse("text"),
    };
  }
  ensureConfigured();
  const system =
    (req.systemPrompt ?? "") +
    (req.jsonOnly
      ? "\n\nIMPORTANT: Respond with ONLY valid JSON (no markdown, no commentary). Begin your response with `{` and end with `}`."
      : "");

  const userContent: Anthropic.Messages.ContentBlockParam[] = [];
  if (req.imageUrls && req.imageUrls.length > 0) {
    for (const url of req.imageUrls) {
      userContent.push({
        type: "image",
        source: { type: "url", url },
      });
    }
  }
  userContent.push({ type: "text", text: req.userPrompt });

  return withFailover<TextResponse>("anthropic", async (key) => {
    const client = buildClient(key);
    try {
      // Anthropic requires streaming for long requests (>10 min). Use the
      // streaming API unconditionally and accumulate the final message —
      // safer than trying to predict request duration up front.
      const stream = client.messages.stream({
        model: CLAUDE_MODEL,
        max_tokens: req.maxTokens ?? 8192,
        system: system || undefined,
        messages: [{ role: "user", content: userContent }],
      });
      const message = await stream.finalMessage();
      const text = extractText(message);
      return { text, raw: { model: message.model, usage: message.usage } };
    } catch (err) {
      // Anthropic SDK errors expose `.status`; surface as `statusCode` so
      // withFailover can detect quota/auth conditions.
      const status =
        (err as { status?: number; statusCode?: number })?.status ??
        (err as { statusCode?: number })?.statusCode;
      if (status && !(err as { statusCode?: number }).statusCode) {
        (err as { statusCode?: number }).statusCode = status;
      }
      throw err;
    }
  });
}

export async function generateJson<T = unknown>(req: TextRequest): Promise<{ data: T; text: string; raw?: unknown }> {
  const out = await generateText({ ...req, jsonOnly: true });
  const cleaned = out.text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  // Find first `{` and last `}` to be resilient to leading/trailing prose.
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  try {
    return { data: JSON.parse(slice) as T, text: out.text, raw: out.raw };
  } catch (err) {
    logger.error({ err, sample: slice.slice(0, 500) }, "generateJson: failed to parse model output");
    throw new Error("Model did not return valid JSON");
  }
}
