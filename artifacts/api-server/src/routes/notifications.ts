import { Router, type IRouter } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { listForUser, markRead } from "../services/notifications.js";

const router: IRouter = Router();

router.get("/", requireAuth, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  res.json(listForUser(u.sub));
});

router.post("/:id/read", requireAuth, (req, res) => {
  const u = (req as AuthenticatedRequest).user!;
  markRead(u.sub, (req.params.id as string));
  res.json({ ok: true });
});

export default router;
