import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";

export function NetBadge({ socket }: { socket: Socket | null }) {
  if (!import.meta.env.VITE_FLAG_NETBADGE) return null;

  const [ws, setWs] = useState("⏳");
  const [http, setHttp] = useState("⏳");

  useEffect(() => {
    if (!socket) return;
    const update = () => setWs(socket.connected ? "🟢" : "🟠");
    socket.on("connect", update);
    socket.on("disconnect", update);
    update();
    return () => {
      socket.off("connect", update);
      socket.off("disconnect", update);
    };
  }, [socket]);

  useEffect(() => {
    // Optimized health check - less frequent and with abort controller
    let controller: AbortController;
    
    const checkHealth = async () => {
      try {
        controller?.abort();
        controller = new AbortController();
        const r = await fetch("/api/healthz", { 
          credentials: "include", 
          signal: controller.signal,
          cache: "no-store"
        });
        setHttp(r.ok ? "🟢" : "🔴");
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setHttp("🔴");
        }
      }
    };
    
    const t = setInterval(checkHealth, 15000); // Increased from 8s to 15s
    checkHealth(); // Initial check
    
    return () => {
      clearInterval(t);
      controller?.abort();
    };
  }, []);

  return (
    <div className="fixed bottom-3 right-3 px-2 py-1 rounded bg-black/70 text-white text-xs shadow-lg z-[9999]">
      WS {ws} · HTTP {http}
    </div>
  );
}