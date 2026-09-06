import React, { useState, useRef, useMemo, useEffect } from "react";
import { Camera, Paperclip, Send, Smile, ChevronDown } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "../../components/ui/button";
import { ReportFab } from "../../components/shared/ReportFab";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../store/auth";
import { socketService } from "../../lib/socketService";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import MessageList from "../../components/chat/MessageList";
import type { UIMessage } from "../../components/chat/MessageItem";
import FilterTabs from "../../components/FilterTabs";
import { useFilter } from "../../components/FeedPageWrapper";
import { IncidentCard } from "../../components/IncidentCard";
import { Timeline, TimelineItem, TimelineSeparator } from "../../components/Timeline";
import { toLocalDateKey, relativeDateLabel } from "../../lib/date";
import { useToast } from "@/hooks/use-toast";
import { useOfflineQueueStore } from "@/state/useOfflineQueueStore";
import { useLocationStore } from "@/store/locationStore";
import { pickQueryLocation, quantizeCoord } from "@/lib/useDeviceLocation";
import { LocationRequiredBanner } from "@/components/LocationRequiredBanner";
import { useCityFallbackCoords } from "@/hooks/useCityFallbackCoords";
import GroupFilterTabs, { type GroupFilter } from "@/components/GroupFilterTabs";
import { resolveToV2Type } from "@/features/report/taxonomyV2";
import { useSearchParamsWouter } from "@/router/useSearchParamsWouter";

// Chat feature is disabled until moderation tooling is production-ready
type FeedFilter = "all" | "incidents";
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

type SyncStatus = 'pending' | 'syncing' | 'synced' | 'error';

type IncidentItem = BaseItem & {
  kind: "incident";
  title: string;
  description?: string;
  severity: Severity;
  type: string;
  category: string;
  userId?: string;
  reportedBy?: string;
  isOwnIncident?: boolean;
  coordinates?: [number, number];
  state?: "new" | "validated" | "acknowledged" | "resolved" | "closed";
  photos?: string[];
  metadata?: any;
  isAnonymous?: boolean;
  isLocal?: boolean;      // True for offline incidents not yet synced
  syncStatus?: SyncStatus; // Sync state for local incidents
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


// Old IncidentCard component removed - now using the new modern IncidentCard from components

const ROOM = "general"; // same room used by /api/chat/general
const CHAT_KEY = ['/api/chat/general'];

import type { HTMLAttributes } from "react";

export default function CommunityFeed({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const { filter } = useFilter() || { filter: "all" };
  const [input, setInput] = useState("");
  const [showJumpButton, setShowJumpButton] = useState(false);
  const [commentInputFocused, setCommentInputFocused] = useState(false);
  const [, navigate] = useLocation();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const feedEndRef = useRef<HTMLDivElement>(null);
  
  // Allowed values for radius/time filters
  const ALLOWED_RADIUS_KM = [1, 3, 5, 10] as const;
  const ALLOWED_SINCE_HOURS = [24, 72, 168] as const;
  const DEFAULT_RADIUS_KM = 5;
  const DEFAULT_SINCE_HOURS = 72;
  
  // Derive all filters from URL (single source of truth)
  const searchParams = useSearchParamsWouter();
  
  // Radius from URL
  const radiusKm = useMemo(() => {
    const urlRadius = searchParams.get('radiusKm');
    const parsed = urlRadius ? parseInt(urlRadius, 10) : DEFAULT_RADIUS_KM;
    return (ALLOWED_RADIUS_KM as readonly number[]).includes(parsed) ? parsed : DEFAULT_RADIUS_KM;
  }, [searchParams]);
  
  // Time window from URL
  const sinceHours = useMemo(() => {
    const urlSince = searchParams.get('sinceHours');
    const parsed = urlSince ? parseInt(urlSince, 10) : DEFAULT_SINCE_HOURS;
    return (ALLOWED_SINCE_HOURS as readonly number[]).includes(parsed) ? parsed : DEFAULT_SINCE_HOURS;
  }, [searchParams]);
  
  // Update URL when radius changes
  const setRadiusKm = (newRadius: number) => {
    const newParams = new URLSearchParams(window.location.search);
    if (newRadius === DEFAULT_RADIUS_KM) {
      newParams.delete('radiusKm');
    } else {
      newParams.set('radiusKm', String(newRadius));
    }
    const newSearch = newParams.toString();
    const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
    window.history.pushState({}, '', newUrl);
  };
  
  // Update URL when time window changes
  const setSinceHours = (newSince: number) => {
    const newParams = new URLSearchParams(window.location.search);
    if (newSince === DEFAULT_SINCE_HOURS) {
      newParams.delete('sinceHours');
    } else {
      newParams.set('sinceHours', String(newSince));
    }
    const newSearch = newParams.toString();
    const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
    window.history.pushState({}, '', newUrl);
  };
  
  // Derive group filter from URL (single source of truth)
  const groupFilter = useMemo<GroupFilter>(() => {
    const urlGroup = searchParams.get('group');
    if (urlGroup && ['services', 'nabor_note', 'emergency', 'critical'].includes(urlGroup)) {
      return urlGroup as GroupFilter;
    }
    return 'all';
  }, [searchParams]);
  
  // Update URL when filter changes
  const setGroupFilter = (newFilter: GroupFilter) => {
    const newParams = new URLSearchParams(window.location.search);
    if (newFilter === 'all') {
      newParams.delete('group');
    } else {
      newParams.set('group', newFilter);
    }
    const newSearch = newParams.toString();
    const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
    window.history.pushState({}, '', newUrl);
  };
  
  const currentLocation = useLocationStore(state => state.currentLocation);
  const lastGoodLocation = useLocationStore(state => state.lastGoodLocation);
  const locationStatus = useLocationStore(state => state.locationStatus);
  
  // City fallback when GPS is unavailable
  const cityFallback = useCityFallbackCoords();

  // Get feed location using the shared pickQueryLocation helper (with stale fallback)
  // Returns null if no valid GPS location is available
  const feedLocation = useMemo(() => {
    return pickQueryLocation({ currentLocation, lastGoodLocation });
  }, [currentLocation, lastGoodLocation]);
  
  // True if GPS (current or stale) is available
  const hasValidLocation = feedLocation !== null;

  // True if we can fetch data (GPS or city fallback)
  const hasAnyLocation = hasValidLocation || !!cityFallback;

  // True if we're using city fallback (no GPS)
  const isCityFallback = !hasValidLocation && !!cityFallback;
  
  // FIX #1A: Quantize coordinates to 3 decimal places (~110m) to prevent GPS jitter
  // from causing new query keys on every small GPS update
  const quantizedLocation = useMemo(() => {
    const loc = feedLocation ?? (cityFallback ? { lat: cityFallback.lat, lng: cityFallback.lng } : null);
    if (!loc) return null;
    return {
      lat: quantizeCoord(loc.lat, 3),
      lng: quantizeCoord(loc.lng, 3)
    };
  }, [feedLocation, cityFallback?.lat, cityFallback?.lng]);

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

  // Hide FABs while a comment input is focused (keyboard up on mobile)
  useEffect(() => {
    const show = () => setCommentInputFocused(false);
    const hide = () => setCommentInputFocused(true);
    window.addEventListener("nn:comment:focus", hide);
    window.addEventListener("nn:comment:blur", show);
    return () => {
      window.removeEventListener("nn:comment:focus", hide);
      window.removeEventListener("nn:comment:blur", show);
    };
  }, []);

  // Create a users map from available data
  const users: Record<string, User> = {
    [user?.id || 'anonymous']: user || { id: 'anonymous', name: 'You' },
    // Add more users as they appear in chat messages
  };

  // Ensure we have a valid current user ID
  const currentUserId = user?.id || 'anonymous';

  // Fetch incidents based on location, radius, and time window
  // Enabled when we have GPS or city fallback
  // FIX #1A: Use QUANTIZED coordinates in query key to prevent GPS jitter from causing cache misses
  const incidentsQueryKey = hasAnyLocation && quantizedLocation
    ? ['/api/incidents/nearby', quantizedLocation.lat, quantizedLocation.lng, radiusKm, sinceHours]
    : ['/api/incidents/nearby', 'no-location'];
  
  // FIX #1B: Track previous data to prevent empty-state flashing during refetch
  const previousIncidentsRef = useRef<any[]>([]);
    
  const { data: incidentsData, isLoading: incidentsLoading, isFetching } = useQuery({
    queryKey: incidentsQueryKey,
    queryFn: async () => {
      if (!hasAnyLocation || !quantizedLocation) {
        console.log("[Feed] No valid location, skipping incident fetch");
        return [];
      }
      // Use quantized coords for API request (consistent with query key)
      const params = new URLSearchParams({
        lat: String(quantizedLocation.lat),
        lng: String(quantizedLocation.lng),
        radiusKm: String(radiusKm),
        sinceHours: String(sinceHours)
      });
      console.log("[Feed] Fetching incidents for location:", quantizedLocation, isCityFallback ? "(city fallback)" : "(GPS)");
      const response = await fetch(`/api/incidents/nearby?${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch incidents');
      const data = await response.json();
      // Store successful fetch for use as placeholder
      if (Array.isArray(data) && data.length > 0) {
        previousIncidentsRef.current = data;
      }
      return data;
    },
    // Enable when we have GPS or city fallback
    enabled: hasAnyLocation,
    // FIX #1B: Keep previous data while fetching new data (prevents empty flashes)
    placeholderData: (previousData) => previousData ?? previousIncidentsRef.current,
    // Keep data fresh but don't invalidate too quickly
    staleTime: 30000,
    refetchInterval: 60000,
    refetchOnWindowFocus: false, // Prevent refetch on tab focus (can cause flicker)
  });

  // Fetch chat messages
  const { data: chatData } = useQuery({
    queryKey: CHAT_KEY,
    queryFn: async () => {
      const response = await fetch('/api/chat/general');
      if (!response.ok) throw new Error('Failed to fetch chat messages');
      return response.json();
    }
  });

  // Get local pending incidents from offline queue
  const { localIncidents } = useOfflineQueueStore();
  
  // Convert data to feed format, merging server and local incidents
  const incidents: IncidentItem[] = useMemo(() => {
    const serverIncidents = (incidentsData || []).map((incident: any) => ({
      id: incident.id,
      kind: "incident" as const,
      title: incident.title || incident.type?.replace('_', ' ') || 'Incident Report',
      description: incident.description,
      severity: incident.severity || 'medium',
      type: incident.type,
      category: incident.category || 'general',
      createdAt: incident.createdAt,
      userId: incident.userId,
      reportedBy: incident.reportedBy,
      isOwnIncident: Boolean(incident.isOwnIncident),
      coordinates: [
        parseFloat(String(incident.latitude || '0')) || 0,
        parseFloat(String(incident.longitude || '0')) || 0
      ] as [number, number],
      state: incident.state || 'new',
      photos: incident.photos || [],
      metadata: incident.metadata || {},
      isAnonymous: Boolean(incident.isAnonymous),
    }));
    
    // Add local pending incidents (not yet synced)
    const pendingLocalIncidents = localIncidents
      .filter(li => li.syncStatus !== 'synced')
      .map((li) => ({
        id: li.id,
        kind: "incident" as const,
        title: li.title || li.type?.replace('_', ' ') || 'Incident Report',
        description: li.description,
        severity: li.severity,
        type: li.type,
        category: 'general',
        createdAt: new Date(li.createdAt).toISOString(),
        userId: user?.id,
        reportedBy: user?.username,
        coordinates: [li.latitude, li.longitude] as [number, number],
        state: 'new' as const,
        photos: [],
        metadata: {},
        isAnonymous: false,
        syncStatus: li.syncStatus,
        isLocal: true,
      }));
    
    // Combine and sort by createdAt (newest first)
    return [...pendingLocalIncidents, ...serverIncidents].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [incidentsData, localIncidents, user]);

  // Convert chat data to UIMessage format
  const chatMessages: UIMessage[] = useMemo(() => {
    if (!chatData?.length) return [];
    return chatData.map((msg: any) => ({
      id: msg.id,
      text: msg.message,
      userId: msg.userId,
      createdAt: msg.createdAt,
    }));
  }, [chatData]);

  // Filter what to show (chat is disabled until moderation is ready)
  // Filter incidents by v2 group (if selected)
  const filteredIncidents = useMemo(() => {
    if (filter !== "all" && filter !== "incidents") return [];
    
    // If no group filter, return all incidents
    if (groupFilter === 'all') return incidents;
    
    // Filter by v2 taxonomy group
    return incidents.filter(incident => {
      const v2Type = resolveToV2Type(incident.type);
      return v2Type?.groupId === groupFilter;
    });
  }, [incidents, filter, groupFilter]);
  
  const filteredMessages: UIMessage[] = []; // Chat disabled

  // Auto-scroll to bottom when component mounts or new messages arrive
  const scrollToBottom = (smooth = true) => {
    if (feedEndRef.current) {
      feedEndRef.current.scrollIntoView({ 
        behavior: smooth ? 'smooth' : 'auto',
        block: 'end'
      });
    } else {
      // Fallback: scroll to bottom of page
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  };

  // Auto-scroll to bottom on initial load
  useEffect(() => {
    if ((filteredIncidents.length > 0 || filteredMessages.length > 0)) {
      // Use timeout to ensure DOM is rendered
      setTimeout(() => scrollToBottom(false), 100);
    }
  }, [filteredIncidents.length, filteredMessages.length, filter]);

  // Monitor scroll position to show/hide jump button
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
      const hasScrollableContent = scrollHeight > clientHeight + 100;
      
      setShowJumpButton(!isNearBottom && hasScrollableContent);
    };

    // Initial check with delay to ensure content is loaded
    setTimeout(handleScroll, 500);

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [filteredIncidents.length, filteredMessages.length]);

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

  const handleReportFAB = () => {
    if (!hasValidLocation) {
      toast({
        title: "GPS required to report",
        description: "Enable location access before reporting an incident.",
      });
      return;
    }
    navigate('/community/report');
  };

  return (
    <div className={`min-h-screen flex flex-col ${className || ''}`} {...props}>
      {/* Location-based feed filters. Pins to the layout's reserved chrome
          height (see AppLayout) rather than a hand-tuned offset, so it lands
          just under the floating navigation instead of on top of the notices
          below it. */}
      <div
        className="sticky z-40 bg-background/95 backdrop-blur border-b border-border"
        style={{ top: "var(--nn-top-chrome)" }}
      >
        {/* Group filter tabs */}
        <div className="mx-auto max-w-2xl">
          <GroupFilterTabs value={groupFilter} onChange={setGroupFilter} />
        </div>
        
        {/* Radius and time filters */}
        <div className="mx-auto max-w-2xl flex items-center gap-3 justify-between px-4 py-2 border-t border-border">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Radius:</span>
            <Select value={String(radiusKm)} onValueChange={(v) => setRadiusKm(Number(v))}>
              <SelectTrigger className="w-[80px] h-8 text-xs bg-muted border-border" data-testid="select-radius">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 km</SelectItem>
                <SelectItem value="3">3 km</SelectItem>
                <SelectItem value="5">5 km</SelectItem>
                <SelectItem value="10">10 km</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Time:</span>
            <Select value={String(sinceHours)} onValueChange={(v) => setSinceHours(Number(v))}>
              <SelectTrigger className="w-[80px] h-8 text-xs bg-muted border-border" data-testid="select-time">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24">24h</SelectItem>
                <SelectItem value="72">3 days</SelectItem>
                <SelectItem value="168">7 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {incidentsLoading && <span className="text-xs text-muted-foreground">Loading...</span>}
        </div>
      </div>
      
      {/* Location soft banners - informational only, never block content */}
      {isCityFallback && cityFallback && (
        <div className="mx-auto max-w-2xl px-4 py-2">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 text-sm text-blue-700 dark:text-blue-300">
            <span className="shrink-0">📍</span>
            <span>Showing feed near <strong>{cityFallback.cityName}</strong> — enable GPS for your exact location.</span>
          </div>
        </div>
      )}
      {!hasAnyLocation && (
        <div className="mx-auto max-w-2xl px-4 py-2">
          <LocationRequiredBanner />
        </div>
      )}
      
      {/* Centered timeline container */}
      <div 
        ref={timelineContainerRef}
        className="mx-auto w-full max-w-2xl px-4 sm:max-w-3xl sm:px-6 lg:max-w-4xl lg:px-8"
      >
        <div className="flex-1 overflow-y-auto pb-36 pt-2">
          <section className="py-4 sm:py-6">
            <Timeline>
              {(() => {
                // Combine incidents and messages into unified feed
                const allItems = [
                  ...filteredIncidents.map(incident => ({
                    kind: 'incident' as const,
                    data: incident,
                    createdAt: incident.createdAt
                  })),
                  ...filteredMessages.map(message => ({
                    kind: 'message' as const,
                    data: message,
                    createdAt: message.createdAt
                  }))
                ];

                // Sort by oldest first (newest messages at bottom)
                const sorted = allItems.sort(
                  (a, b) => new Date(a.createdAt || new Date()).getTime() - new Date(b.createdAt || new Date()).getTime()
                );

                let lastKey = "";
                return sorted.map((item) => {
                  const key = toLocalDateKey(item.createdAt || new Date());
                  const needsSeparator = key !== lastKey;
                  if (needsSeparator) lastKey = key;

                  return (
                    <React.Fragment key={`${item.kind}-${item.data.id}`}>
                      {needsSeparator && (
                        <TimelineSeparator
                          label={relativeDateLabel(item.createdAt || new Date())}
                          sticky
                          topClass="top-[144px]"
                        />
                      )}

                      {item.kind === "incident" ? (
                        <TimelineItem
                          severity={item.data.severity}
                          variant="incident"
                        >
                          <IncidentCard 
                            incident={{
                              ...item.data,
                              latitude: item.data.coordinates?.[0] || 0,
                              longitude: item.data.coordinates?.[1] || 0,
                              isLocal: item.data.isLocal,
                              syncStatus: item.data.syncStatus,
                            }}
                            groupFilter={groupFilter}
                          />
                        </TimelineItem>
                      ) : (
                        <TimelineItem variant="message">
                          <div className="px-3">
                            <MessageList messages={[item.data]} meId={user?.id || null} />
                          </div>
                        </TimelineItem>
                      )}
                    </React.Fragment>
                  );
                });
              })()}
            </Timeline>
            {/* Invisible element to scroll to */}
            <div ref={feedEndRef} className="h-1" />
          </section>
        </div>
      </div>

      {/* Chat input section - fixed to bottom of viewport */}
      <div className="fixed bottom-0 left-0 right-0 z-[var(--z-inputbar)] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-t border-border p-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto max-w-2xl flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground p-2"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <div className="flex-1 relative">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground pr-10"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim()) {
                    sendMessageMutation.mutate(input.trim());
                  }
                }
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
            >
              <Smile className="h-4 w-4" />
            </Button>
          </div>
          <Button
            onClick={() => {
              if (input.trim()) {
                sendMessageMutation.mutate(input.trim());
              }
            }}
            disabled={!input.trim() || sendMessageMutation.isPending}
            className="bg-[#4cc0ff] hover:bg-[#4cc0ff]/80 text-white px-4"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Jump to Bottom Button */}
      {showJumpButton && (
        <Button
          onClick={() => scrollToBottom(true)}
          className={`fixed bottom-32 right-4 w-12 h-12 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white shadow-lg border border-zinc-600 z-50 mt-[50px] mb-[50px] transition-opacity duration-150 ${commentInputFocused ? "opacity-0 pointer-events-none" : "opacity-100"}`}
          data-testid="button-jump-to-bottom"
        >
          <ChevronDown className="h-5 w-5" />
        </Button>
      )}

      {/* Floating Action Button — navigates to full report form (GPS required) */}
      <ReportFab
        onClick={handleReportFAB}
        title={hasValidLocation ? "Report an incident" : "Enable GPS to report"}
        disabled={!hasValidLocation}
        className={`transition-opacity duration-150 ${commentInputFocused ? "opacity-0 pointer-events-none" : "opacity-100"}`}
      />
    </div>
  );
}