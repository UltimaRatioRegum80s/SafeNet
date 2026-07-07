import { io, Socket } from "socket.io-client";
import { QueryClient } from "@tanstack/react-query";

export const socket = io("/", {
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  autoConnect: true,
});

// Call once at app bootstrap (e.g., in App.tsx) after you create queryClient
export function wireIncidentSocketToQueryCache(queryClient: QueryClient) {
  const upsert = (inc: any) => {
    // Prevent double handling if we already have this incident
    const addIncident = (window as any).__nnAddIncident;
    if (addIncident && typeof addIncident === 'function') {
      addIncident(inc); // Use unified marker management
    }
    
    queryClient.setQueryData<any[]>(["incidents"], (old = []) => {
      // de-dupe by id; put newest first
      const withoutDup = old.filter(i => i.id !== inc.id && i.id !== inc?.tempId && !i.__optimistic);
      return [inc, ...withoutDup];
    });
  };

  socket.on("incident:new", upsert);
  socket.on("incident:created", upsert); // Handle both event types
}

class SocketService {
  private socket: Socket | null = null;

  connect() {
    if (this.socket?.connected) return this.socket;
    this.socket = io(
      // Allow override for dev/prod; fallback to same origin
      (import.meta as any)?.env?.VITE_SOCKET_URL || window.location.origin,
      {
        path: "/socket.io",
        transports: ["websocket", "polling"],
        withCredentials: true,
        reconnection: true,
        reconnectionDelay: 500,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity,
        timeout: 8000,
        // keep mobile alive - removed pingInterval/pingTimeout as they're not valid SocketOptions
      }
    );
    return this.socket;
  }

  ensureConnected() {
    return this.socket?.connected ? this.socket : this.connect();
  }

  joinChat(room: string) {
    this.ensureConnected()?.emit("join:chat", room);
  }

  leaveChat(room: string) {
    this.socket?.emit("leave:chat", room);
  }

  /** Subscribe to an event; returns an unsubscribe to prevent double binding */
  on<T = any>(event: string, cb: (data: T) => void) {
    const s = this.ensureConnected();
    s?.on(event, cb);
    return () => s?.off(event, cb);
  }

  onMessage(cb: (msg: any) => void) { return this.on("message", cb); }

  emit(event: string, data?: any) {
    this.ensureConnected()?.emit(event, data);
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}

export const socketService = new SocketService();

// Socket instance getter for watchdog and badges
let __socketInstance: typeof socket | null = null;

export function setSocketInstance(s: typeof socket) {
  __socketInstance = s;
}

export function getSocket() {
  return __socketInstance || socket;
}