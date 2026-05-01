import type { Response } from "express";
import { EventEmitter } from "node:events";

class SseBus extends EventEmitter {
  publish(projectId: string, event: { type: string; data: unknown }): void {
    this.emit(`project:${projectId}`, event);
    this.emit("all", { projectId, ...event });
  }
}

export const sseBus: SseBus = new SseBus();
sseBus.setMaxListeners(0);

export function attachSseClient(projectId: string, res: Response): () => void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const send = (event: { type: string; data: unknown }): void => {
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event.data)}\n\n`);
  };

  send({ type: "connected", data: { projectId, ts: new Date().toISOString() } });

  const channel = `project:${projectId}`;
  sseBus.on(channel, send);

  const heartbeat = setInterval(() => {
    res.write(`: heartbeat ${Date.now()}\n\n`);
  }, 15000);

  return (): void => {
    clearInterval(heartbeat);
    sseBus.off(channel, send);
  };
}
