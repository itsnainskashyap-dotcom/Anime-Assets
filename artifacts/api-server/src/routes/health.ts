import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { DEMO_MODE } from "../providers/registry.js";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    demoMode: DEMO_MODE,
    engineLabel: "Animax Ultra",
    serverTime: new Date().toISOString(),
  });
});

export default router;
