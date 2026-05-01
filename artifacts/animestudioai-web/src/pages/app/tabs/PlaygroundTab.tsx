import { useEffect, useState, useRef } from "react";
import { Activity, BrainCircuit, Cpu, Database, Network, Loader2, Maximize2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { AgentLog, PlaygroundEvent, Project } from "@/types/api";

export default function PlaygroundTab({ project }: { project: Project }) {
  const { token } = useAuth();
  const [events, setEvents] = useState<PlaygroundEvent[]>([]);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [status, setStatus] = useState<"connecting" | "connected" | "reconnecting" | "error">("connecting");
  const eventsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    let retryCount = 0;
    let abortController: AbortController = new AbortController();

    const connect = async () => {
      if (!active) return;
      setStatus(retryCount === 0 ? "connecting" : "reconnecting");
      abortController = new AbortController();

      try {
        const url = import.meta.env.BASE_URL + `api/projects/${project.id}/playground/events`;
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: abortController.signal,
        });

        if (!res.ok) throw new Error("Failed to connect");

        setStatus("connected");
        retryCount = 0;

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || "";

            for (const chunk of lines) {
              const eventMatch = chunk.match(/^event:\s*(.+)$/m);
              const dataMatch = chunk.match(/^data:\s*(.+)$/m);

              if (eventMatch && dataMatch) {
                const eventName = eventMatch[1].trim();
                try {
                  const data = JSON.parse(dataMatch[1].trim()) as
                    | { events?: PlaygroundEvent[]; agentLogs?: AgentLog[] }
                    | PlaygroundEvent
                    | AgentLog;

                  if (eventName === "history") {
                    const h = data as { events?: PlaygroundEvent[]; agentLogs?: AgentLog[] };
                    if (h.events) setEvents(h.events);
                    if (h.agentLogs) setLogs(h.agentLogs);
                  } else if (eventName === "playground") {
                    setEvents(prev => [...prev, data as PlaygroundEvent].slice(-100));
                  } else if (eventName === "agent_log") {
                    setLogs(prev => [...prev, data as AgentLog].slice(-200));
                  }
                } catch (e) {
                  console.error("Failed to parse SSE data", e);
                }
              }
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setStatus("error");
        const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
        retryCount++;
        setTimeout(connect, delay);
      }
    };

    connect();

    return () => {
      active = false;
      abortController.abort();
    };
  }, [project.id, token]);

  useEffect(() => {
    if (eventsEndRef.current) {
      eventsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events, logs]);

  const AGENTS = [
    { id: "director", name: "AI Director", icon: BrainCircuit, color: "text-primary" },
    { id: "visual", name: "Visual Engine", icon: Maximize2, color: "text-blue-400" },
    { id: "production", name: "Production Engine", icon: Cpu, color: "text-amber-400" },
    { id: "validation", name: "Validation", icon: Activity, color: "text-green-400" },
  ];

  return (
    <div className="h-full flex gap-1 bg-background/50">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-1/2 p-6 border-b border-border/50 bg-card/20 flex flex-col relative overflow-hidden">
          <div className="flex justify-between items-center z-10 mb-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Network className="w-5 h-5 text-primary" />
              Agent Swarm
            </h3>
            {status !== "connected" && (
              <div className="flex items-center gap-2 text-xs font-medium text-amber-500 bg-amber-500/10 px-2 py-1 rounded-full border border-amber-500/20">
                <Loader2 className="w-3 h-3 animate-spin" />
                {status === "connecting" ? "Connecting…" : status === "reconnecting" ? "Reconnecting…" : "Disconnected"}
              </div>
            )}
          </div>

          <div className="flex-1 flex items-center justify-center relative">
            <div className="grid grid-cols-2 gap-12 relative z-10">
              {AGENTS.map((agent) => (
                <div key={agent.id} className="relative group">
                  <div className={`w-24 h-24 rounded-2xl border border-border/50 bg-card/80 backdrop-blur flex flex-col items-center justify-center gap-2 relative z-10 shadow-lg group-hover:border-${agent.color.split('-')[1]}/50 transition-colors`}>
                    <agent.icon className={`w-8 h-8 ${agent.color}`} />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase text-center leading-tight px-2">{agent.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="h-1/2 flex">
          <div className="flex-1 border-r border-border/50 p-4 flex flex-col bg-card/10">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Database className="w-4 h-4" /> Shared Memory Pulse
            </h4>
            <div className="flex-1 overflow-auto space-y-2 text-xs font-mono scrollbar-thin">
              {events.length === 0 && (
                <div className="text-muted-foreground">No events yet.</div>
              )}
              {events.slice(-20).reverse().map(e => (
                <div key={e.id} className="p-2 rounded bg-card/50 border border-border/50">
                  <div className="flex justify-between text-muted-foreground mb-1">
                    <span className="text-primary">{e.agent || "System"}</span>
                    <span>{new Date(e.created_at).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-foreground/80">{e.message}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 p-4 flex flex-col bg-card/10">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Agent Logs</h4>
            <div className="flex-1 overflow-auto space-y-1 text-xs font-mono scrollbar-thin">
              {logs.length === 0 && (
                <div className="text-muted-foreground">No agent logs yet.</div>
              )}
              {logs.slice(-50).reverse().map(l => (
                <div key={l.id} className={`flex gap-2 p-1 ${l.level === 'error' ? 'text-destructive' : l.level === 'warn' ? 'text-amber-500' : 'text-muted-foreground'}`}>
                  <span className="opacity-50 shrink-0">[{new Date(l.created_at).toLocaleTimeString()}]</span>
                  <span className="font-bold shrink-0">{l.agent_name}:</span>
                  <span className="break-all">{l.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="w-[400px] border-l border-border/50 bg-card/30 p-6 flex flex-col">
        <h3 className="font-bold text-lg mb-6">Current Execution</h3>

        <div className="flex-1 flex flex-col justify-center items-center text-center space-y-6">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
            <div className="w-32 h-32 rounded-full border-4 border-primary/30 flex items-center justify-center relative bg-background/50 backdrop-blur z-10">
              <Activity className="w-12 h-12 text-primary animate-pulse" />
            </div>
          </div>

          <div className="w-full bg-card border border-border/50 rounded-lg p-4 text-left">
            <div className="text-xs text-muted-foreground uppercase font-bold mb-2">Latest Output</div>
            <div className="font-mono text-xs text-green-400 line-clamp-3">
              {events[events.length - 1]?.message || "Waiting for stream…"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
