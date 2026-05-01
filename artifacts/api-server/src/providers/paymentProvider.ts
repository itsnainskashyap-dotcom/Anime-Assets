import crypto from "node:crypto";
import { DEMO_MODE, demoResponse, getActiveKey, notConfiguredError } from "./registry.js";

export interface CreateOrderRequest {
  amountPaise: number;
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface CreateOrderResponse {
  id: string;
  amount: number;
  currency: string;
  status: string;
  demo?: boolean;
}

export async function createOrder(req: CreateOrderRequest): Promise<CreateOrderResponse> {
  if (DEMO_MODE) {
    return {
      id: `demo_order_${Date.now()}`,
      amount: req.amountPaise,
      currency: req.currency || "INR",
      status: "created",
      ...demoResponse("payment_order"),
    };
  }
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = getActiveKey("razorpay");
  if (!keyId || !keySecret) {
    throw Object.assign(new Error("Payment provider not configured"), {
      response: notConfiguredError("razorpay", "create_order"),
      statusCode: 503,
    });
  }
  const auth = Buffer.from(`${keyId}:${keySecret.key}`).toString("base64");
  const resp = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: req.amountPaise,
      currency: req.currency || "INR",
      receipt: req.receipt,
      notes: req.notes,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Razorpay error ${resp.status}: ${text}`);
  }
  const data = (await resp.json()) as CreateOrderResponse;
  return data;
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
