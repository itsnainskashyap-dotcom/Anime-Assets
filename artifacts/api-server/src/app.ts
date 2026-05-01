import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "node:path";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { STORAGE_ROOT_PATH } from "./providers/storageProvider.js";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);
app.use(cors());
app.use(cookieParser());
app.use((req, res, next) => {
  if (req.path === "/api/payments/webhook") return next();
  return express.json({ limit: "5mb" })(req, res, next);
});
app.use(express.urlencoded({ extended: true }));

app.use("/storage", express.static(STORAGE_ROOT_PATH, { maxAge: "1d", fallthrough: true }));

app.use("/api", router);

app.use(
  (
    err: Error & { statusCode?: number; response?: unknown },
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const status = err.statusCode || 500;
    if (status >= 500) logger.error({ err, path: req.path }, "Unhandled error");
    res.status(status).json({
      error: err.message || "Internal server error",
      details: err.response,
    });
  },
);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

export default app;
