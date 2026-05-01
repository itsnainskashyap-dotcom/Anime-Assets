import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import projectsRouter from "./projects.js";
import chunksRouter from "./chunks.js";
import songRouter from "./song.js";
import notificationsRouter from "./notifications.js";
import paymentsRouter from "./payments.js";
import adminRouter from "./admin.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/projects", projectsRouter);
router.use("/chunks", chunksRouter);
router.use(songRouter);
router.use("/notifications", notificationsRouter);
router.use("/payments", paymentsRouter);
router.use("/admin", adminRouter);

export default router;
