import { Router, type IRouter, json } from "express";
import { v4 as uuid } from "uuid";
import db from "../db/index.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { paymentLimiter } from "../middleware/rateLimit.js";
import { createOrder, verifyWebhookSignature } from "../providers/paymentProvider.js";
import { adjustCredits } from "../services/credits.js";
import { notify } from "../services/notifications.js";

const router: IRouter = Router();

interface CreditPackRow {
  id: string;
  name: string;
  credits: number;
  amount_paise: number;
  currency: string;
  active: number;
  sort_order: number;
}

router.get("/credit-packs", (_req, res) => {
  const packs = db
    .prepare<[], CreditPackRow>(
      "SELECT id, name, credits, amount_paise, currency, sort_order FROM credit_packs WHERE active = 1 ORDER BY sort_order ASC",
    )
    .all();
  res.json(packs);
});

router.post("/create-order", requireAuth, paymentLimiter, async (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const packId = String((req.body || {}).packId || "");
  if (!packId) {
    res.status(400).json({ error: "packId is required" });
    return;
  }
  const pack = db
    .prepare<[string], CreditPackRow>("SELECT * FROM credit_packs WHERE id = ? AND active = 1")
    .get(packId);
  if (!pack) {
    res.status(404).json({ error: "Credit pack not found" });
    return;
  }
  try {
    const order = await createOrder({
      amountPaise: pack.amount_paise,
      currency: pack.currency,
      receipt: `cred_${u.sub}_${Date.now()}`,
      notes: { userId: u.sub, packId: pack.id, credits: String(pack.credits) },
    });
    const id = uuid();
    db.prepare(
      "INSERT INTO payment_orders (id, user_id, amount_paise, credits, currency, provider_order_id, status, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      id,
      u.sub,
      pack.amount_paise,
      pack.credits,
      pack.currency,
      order.id,
      "created",
      JSON.stringify({ packId: pack.id, packName: pack.name }),
    );
    res.json({
      orderId: order.id,
      paymentRecordId: id,
      amount: order.amount,
      currency: order.currency,
      credits: pack.credits,
      packName: pack.name,
      demo: order.demo,
    });
  } catch (err) {
    const e = err as Error & { response?: unknown; statusCode?: number };
    res.status(e.statusCode || 500).json({ error: e.message, details: e.response });
  }
});

router.post(
  "/webhook",
  json({ verify: (req, _res, buf) => { (req as unknown as { rawBody: string }).rawBody = buf.toString("utf8"); } }),
  (req, res) => {
    const signature = req.header("x-razorpay-signature") || "";
    const raw = (req as unknown as { rawBody: string }).rawBody || "";
    if (!verifyWebhookSignature(raw, signature)) {
      res.status(400).json({ error: "Invalid signature" });
      return;
    }
    const event = req.body as { event?: string; payload?: { payment?: { entity?: { order_id?: string; id?: string } } } };
    if (event?.event === "payment.captured") {
      const orderId = event.payload?.payment?.entity?.order_id;
      const paymentId = event.payload?.payment?.entity?.id;
      if (orderId) {
        const order = db
          .prepare<[string], { id: string; user_id: string; credits: number; status: string }>(
            "SELECT id, user_id, credits, status FROM payment_orders WHERE provider_order_id = ?",
          )
          .get(orderId);
        if (order && order.status !== "captured") {
          db.prepare("UPDATE payment_orders SET status='captured', provider_payment_id = ? WHERE id = ?").run(
            paymentId ?? null,
            order.id,
          );
          adjustCredits(order.user_id, order.credits, "razorpay_payment", { id: order.id, type: "payment_order" });
          notify(order.user_id, { type: "payment", title: "Payment received", body: `${order.credits} credits added` });
        }
      }
    }
    res.json({ ok: true });
  },
);

router.get("/history", requireAuth, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  const orders = db
    .prepare("SELECT * FROM payment_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 100")
    .all(u.sub);
  const ledger = db
    .prepare("SELECT * FROM credit_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT 200")
    .all(u.sub);
  res.json({ orders, ledger });
});

export default router;
