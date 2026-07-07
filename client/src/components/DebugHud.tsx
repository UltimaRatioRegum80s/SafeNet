import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { socket } from "@/lib/socketService";

export function DebugHud() {
  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.get("debug") !== "1") return null;
  const fetching = useIsFetching({ queryKey: ["incidents"] });
  const qc = useQueryClient();
  const count = (qc.getQueryData<any[]>(["incidents"]) || []).length;

  return (
    <div className="fixed bottom-2 right-2 bg-black/70 text-white text-xs p-2 rounded">
      <div>Socket: {socket.connected ? "connected" : "disconnected"}</div>
      <div>Incidents in cache: {count}</div>
      <div>Fetching: {fetching > 0 ? "yes" : "no"}</div>
    </div>
  );
}