import React, { useState, useRef, useMemo, useEffect } from "react";
import { Camera, Paperclip, Send, Plus, Smile, AlertTriangle } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "../../components/ui/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../store/auth";
import { socketService } from "../../lib/socketService";
import MessageList from "../../components/chat/MessageList";
import type { UIMessage } from "../../components/chat/MessageItem";

// Chat feature is disabled until moderation tooling is production-ready
type Severity = "low" | "medium" | "high" | "critical";

type BaseItem = {
  id: string;
  createdAt: string;
};

type ChatItem = BaseItem & {
  kind: "chat";
  message: string;
  userId: string;
  mine?: boolean;
};

type User = {
  id: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
};

type IncidentItem = BaseItem & {
  kind: "incident";
  title: string;
  description?: string;
  severity: Severity;
  type: string;
  category: string;
  userId?: string;
  reportedBy?: string;
};

type FeedItem = ChatItem | IncidentItem;

const timeShort = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

const nameToInitials = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

const getUserDisplayName = (user: User | undefined) => 
  user?.name || user?.email?.split('@')[0] || 'User';

// Convert ChatItem to UIMessage for the new components
function convertChatToUIMessage(item: ChatItem): UIMessage {
  return {
    id: item.id,
    text: item.message,
    userId: item.userId,
    createdAt: item.createdAt,
  };
}


function IncidentCard({ item, currentUser }: { item: IncidentItem; currentUser: User | null }) {
  // Determine ownership (supports either reportedBy or userId)
  const mine = item.userId === currentUser?.id || item.reportedBy === currentUser?.id;

  // Badge colors (unchanged)
  const severityBadge =
    item.severity === "high" || item.severity === "critical"
      ? "bg-red-500 text-white"
      : item.severity === "medium"
      ? "bg-amber-500 text-black"
      : "bg-yellow-400 text-black";

  // Container styles:
  // - mine: blue-tinted card on the RIGHT
  // - others: neutral grey card on the LEFT
  const containerSide = mine ? "flex justify-end" : "flex justify-start";
  const containerCard = mine
    ? "bg-blue-600/20 border-blue-500/40"
    : "bg-zinc-900 border-zinc-700";

  const titleColor = mine ? "text-blue-100" : "text-zinc-100";
  const descColor = mine ? "text-blue-200" : "text-zinc-300";
  const timeColor = mine ? "text-blue-300" : "text-zinc-400";

  return (
    <div className={`px-2 mb-2 ${containerSide}`}>
      <div className={`max-w-[92%] rounded-2xl border p-3 ${containerCard}`}>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 opacity-80" />
          <div className={`font-semibold text-sm ${titleColor}`}>{item.title}</div>
          <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold ${severityBadge}`}>
            {item.severity.toUpperCase()}
          </span>
        </div>
        {item.description && <div className={`mt-1 text-sm ${descColor}`}>{item.description}</div>}
        <div className={`mt-1 text-[10px] ${timeColor}`}>{timeShort(item.createdAt)}</div>
      </div>
    </div>
  );
}

const ROOM = "general"; // same room used by /api/chat/general
const CHAT_KEY = ['/api/chat/general'];

export default function MobileCommunityFeed() {
  const [input, setInput] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // Socket.IO integration for live chat updates
  useEffect(() => {
    // 1) connect + join the chat room
    socketService.connect();
    socketService.joinChat(ROOM);

    // 2) live message handler: append to React Query cache
    const handleMessage = (msg: any) => {
      queryClient.setQueryData<any[]>(CHAT_KEY, (prev = []) => [...prev, msg]);
    };

    const unsubscribe = socketService.onMessage(handleMessage);

    return () => {
      unsubscribe?.();
      socketService.leaveChat(ROOM);
    };
  }, [queryClient]);

  // Create a users map from available data
  const users: Record<string, User> = {
    [user?.id || 'anonymous']: user || { id: 'anonymous', name: 'You' },
    // Add more users as they appear in chat messages
  };

  // Ensure we have a valid current user ID
  const currentUserId = user?.id || 'anonymous';

  // Fetch incidents
  const { data: incidentsData } = useQuery({
    queryKey: ['/api/incidents'],
    queryFn: async () => {
      const response = await fetch('/api/incidents?limit=20');
      if (!response.ok) throw new Error('Failed to fetch incidents');
      return response.json();
    }
  });

  // Fetch chat messages
  const { data: chatMessages } = useQuery({
    queryKey: CHAT_KEY,
    queryFn: async () => {
      const response = await fetch('/api/chat/general?limit=50');
      if (!response.ok) throw new Error('Failed to fetch chat messages');
      return response.json();
    }
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await fetch('/api/chat/general', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': user?.id || 'anonymous'
        },
        body: JSON.stringify({ message })
      });
      if (!response.ok) throw new Error('Failed to send message');
      return response.json();
    },
    onMutate: async (message) => {
      await queryClient.cancelQueries({ queryKey: CHAT_KEY });
      const previous = queryClient.getQueryData<any[]>(CHAT_KEY) || [];
      const temp = {
        id: `temp-${Date.now()}`,
        message,
        userId: user?.id || 'anonymous',
        createdAt: new Date().toISOString()
      };
      queryClient.setQueryData(CHAT_KEY, [...previous, temp]);
      setInput("");
      return { previous };
    },
    onError: (_err, _msg, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(CHAT_KEY, ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CHAT_KEY });
    }
  });

  const incidents = incidentsData?.incidents || incidentsData || [];

  // Convert chat messages to UIMessage format
  const uiMessages: UIMessage[] = useMemo(() => {
    if (!chatMessages?.length) return [];
    return chatMessages.map((msg: any) => ({
      id: msg.id,
      text: msg.message,
      userId: msg.userId,
      createdAt: msg.createdAt,
    }));
  }, [chatMessages]);

  // Convert incidents to proper format
  const incidentItems: IncidentItem[] = useMemo(() => {
    return incidents.map((incident: any) => ({
      id: incident.id,
      kind: "incident" as const,
      title: incident.title,
      description: incident.description,
      severity: incident.severity,
      type: incident.type,
      category: incident.category,
      createdAt: incident.createdAt,
      userId: incident.userId,
      reportedBy: incident.reportedBy,
    }));
  }, [incidents]);

  const filteredIncidents = incidentItems;
  const filteredMessages: UIMessage[] = [];

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessageMutation.mutate(input.trim());
  };

  return (
    <div className="h-[100dvh] bg-[#0b1220] text-white flex flex-col">
      {/* Mobile header */}
      <div className="sticky top-0 z-50 border-b border-white/5 bg-[#0b1220]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0b1220]/80 shrink-0">
        <div className="px-3 py-2 flex items-center gap-2">
          <div className="font-semibold text-base">Community Feed</div>
        </div>
      </div>

      {/* Messages and incidents list with flex-1 to fill remaining space */}
      <div className="flex-1 overflow-y-auto pb-36 pt-2">
        {/* Show incidents first if applicable */}
        {filteredIncidents.map((incident) => (
          <IncidentCard key={incident.id} item={incident} currentUser={user} />
        ))}
        
        {/* Show chat messages using new MessageList component */}
        {filteredMessages.length > 0 && (
          <MessageList messages={filteredMessages} meId={user?.id || null} />
        )}
      </div>

      {/* Bottom input bar (WhatsApp-style) */}
      <div className="sticky bottom-0 z-[var(--z-inputbar)] bg-[#0b1220]/90 backdrop-blur supports-[backdrop-filter]:bg-[#0b1220]/70 border-t border-white/5">
        <div className="px-2 py-2 flex items-end gap-2">
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full tap-target" aria-label="Open camera">
            <Camera className="h-5 w-5" />
          </Button>

          <div className="flex-1">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message…"
              className="bg-zinc-900 border-zinc-800 text-sm rounded-full px-4 h-10"
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            />
          </div>

          <Button onClick={handleSend} className="h-10 w-10 rounded-full p-0 bg-cyan-600 hover:bg-cyan-500 tap-target" disabled={!input.trim()} aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {/* Safe-area spacer */}
        <div style={{ height: "calc(env(safe-area-inset-bottom))" }} />
      </div>

      {/* FAB: Report Incident - positioned above input bar */}
      <Button
        onClick={() => setDrawerOpen(true)}
        className="fixed right-4 h-14 w-14 rounded-full bg-cyan-600 shadow-lg shadow-cyan-600/30 hover:bg-cyan-500 tap-target"
        style={{
          bottom: "calc(72px + env(safe-area-inset-bottom))"
        }}
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Mobile Drawer for Incident Report */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="bg-[#0b1220] text-white border-t border-white/10">
          <DrawerHeader>
            <DrawerTitle>Report Incident</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 space-y-3 pb-4">
            <Select defaultValue="medium">
              <SelectTrigger className="bg-zinc-900 border-zinc-800">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>

            <Input placeholder="Title" className="bg-zinc-900 border-zinc-800" />
            <Textarea placeholder="Describe what happened…" className="bg-zinc-900 border-zinc-800 min-h-[120px]" />
            
            <div className="flex gap-2 pt-4">
              <Button className="flex-1 bg-cyan-600 hover:bg-cyan-500 tap-target">Submit</Button>
              <Button variant="outline" className="border-zinc-700 tap-target" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}