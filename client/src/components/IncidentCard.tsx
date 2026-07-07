import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Clock,
  MessageSquare,
  MapPin,
  Cloud,
  CloudOff,
  RefreshCw,
  Lock,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import clsx from "clsx";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { IncidentComments } from "@/components/IncidentComments";
import { useReviewSummary, useIncidentComments } from "@/features/incidents/api";
import { INCIDENT_TYPES_BY_ID, getSeverityColor, getSeverityBadgeColor } from "@/features/report/incidentTypes";
import { resolveToV2Type, getGroupBadgeClasses, type TaxonomyType } from "@/features/report/taxonomyV2";
import type { SyncStatus } from "@/lib/offlineDb";
import { useAuthStore } from "@/store/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ResponseSignal, IncidentResponse } from "@shared/schema";

export type IncidentItem = {
  id: string;
  title: string;
  description?: string;
  severity: "low" | "medium" | "high" | "critical";
  type: string;
  category: string;
  userId?: string;
  reportedBy?: string;
  isOwnIncident?: boolean;
  createdAt: string; // ISO
  latitude: number;
  longitude: number;
  isAnonymous?: boolean;
  state?: "new" | "validated" | "acknowledged" | "resolved" | "closed";
  photos?: string[];
  metadata?: any;
  syncStatus?: SyncStatus;
  isLocal?: boolean;
};

// Removed local severityStyles - now using centralized getSeverityBadgeColor function

// Community Attention signal configuration (reuses existing response signals)
const ATTENTION_SIGNALS: { signal: ResponseSignal; arrow: string; label: string; tooltip: string }[] = [
  { signal: "seen", arrow: "↑", label: "More attention", tooltip: "This needs more community attention" },
  { signal: "resolved", arrow: "↓", label: "Less attention", tooltip: "This needs less community attention" },
];

type ResponseCounts = Record<ResponseSignal, number>;

function CommunityAttention({ incidentId, isLocal }: { incidentId: string; isLocal?: boolean }) {
  const user = useAuthStore((state) => state.user);
  
  const { data: counts = { seen: 0, caution: 0, helpful: 0, resolved: 0 } } = useQuery<ResponseCounts>({
    queryKey: ['/api/incidents', incidentId, 'responses'],
    enabled: !isLocal,
  });

  const { data: myResponse } = useQuery<IncidentResponse | null>({
    queryKey: ['/api/incidents', incidentId, 'my-response'],
    enabled: !isLocal && !!user,
  });

  const upsertMutation = useMutation({
    mutationFn: async (signal: ResponseSignal) => {
      return apiRequest('POST', `/api/incidents/${incidentId}/respond`, { signal });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/incidents', incidentId, 'responses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/incidents', incidentId, 'my-response'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/incidents/${incidentId}/respond`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/incidents', incidentId, 'responses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/incidents', incidentId, 'my-response'] });
    },
  });

  const handleClick = (signal: ResponseSignal) => {
    if (!user) return;
    
    if (myResponse?.signal === signal) {
      deleteMutation.mutate();
    } else {
      upsertMutation.mutate(signal);
    }
  };

  if (isLocal) return null;

  const isPending = upsertMutation.isPending || deleteMutation.isPending;
  
  const moreCount = counts.seen || 0;
  const lessCount = counts.resolved || 0;

  return (
    <div 
      className="pt-2 border-t border-white/5"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] text-zinc-400 font-medium">Community Attention</span>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            {ATTENTION_SIGNALS.map(({ signal, arrow, label, tooltip }) => {
              const isActive = myResponse?.signal === signal;
              const count = signal === "seen" ? moreCount : lessCount;
              
              return (
                <Tooltip key={signal}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!user || isPending}
                      onClick={() => handleClick(signal)}
                      data-testid={`attention-${signal}-${incidentId}`}
                      className={clsx(
                        "h-6 px-2 gap-1.5 text-[10px] font-medium transition-all rounded",
                        isActive 
                          ? "bg-zinc-700/50 text-zinc-200 hover:bg-zinc-700/70" 
                          : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border border-white/10",
                        !user && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <span className="text-xs">{arrow}</span>
                      <span>{label}</span>
                      <span className="text-[9px] opacity-60">{count}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <p>{user ? tooltip : "Sign in to signal"}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </div>
        <p className="text-[9px] text-zinc-600">Community signals only. Does not affect severity, urgency, or response.</p>
      </div>
    </div>
  );
}

export function IncidentCard({ incident, groupFilter }: { incident: IncidentItem; groupFilter?: string }) {
  const {
    id,
    title,
    description,
    severity,
    type,
    createdAt,
    latitude,
    longitude,
    photos = [],
    state = 'new',
    syncStatus,
    isLocal,
    isOwnIncident,
  } = incident;

  // Get the incident type configuration for proper icon and colors
  // Try v2 taxonomy first, then fall back to legacy
  const v2Type = resolveToV2Type(type);
  const legacyType = INCIDENT_TYPES_BY_ID[type];
  
  // For display: use v2 if available, fall back to severity-based color
  const severityColorMap: Record<string, string> = {
    low: '#facc15',      // Yellow
    medium: '#f97316',   // Amber  
    high: '#ef4444',     // Red
    critical: '#dc2626'  // Dark red
  };
  const displayColor = v2Type?.color || severityColorMap[severity] || '#ff8c00';
  const displayLabel = v2Type?.label || legacyType?.label || title;
  const groupId = v2Type?.groupId;

  const [open, setOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const confirmResetRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const user = useAuthStore((state) => state.user);

  // Server-stamped: the API sets isOwnIncident=true only for the authenticated owner.
  // This avoids client-side ID comparison, which breaks for anonymous incidents
  // where userId is stripped from the API response to protect anonymity.
  const isOwner = !!user && !!isOwnIncident;

  // Preload count (fetchEnabled=true), live updates only when open - skip for local incidents
  const { data: reviews } = useReviewSummary(id, !isLocal, open && !isLocal);
  // Get comment count for display in footer - skip for local incidents
  const { data: comments = [] } = useIncidentComments(id, !isLocal);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/incidents/${id}`);
    },
    onMutate: async () => {
      // Cancel any in-flight refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).startsWith('/api/incidents/nearby') });

      // Snapshot the current cache for rollback
      const previousData = queryClient.getQueriesData({
        predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).startsWith('/api/incidents/nearby'),
      });

      // Optimistically remove from every matching cache entry
      queryClient.setQueriesData(
        { predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).startsWith('/api/incidents/nearby') },
        (old: any) => {
          if (!old) return old;
          if (Array.isArray(old)) return old.filter((inc: any) => inc.id !== id);
          return old;
        }
      );

      // Remove map marker immediately (no need to wait for server)
      window.dispatchEvent(new CustomEvent('nn:incident:deleted', { detail: { id } }));

      return { previousData };
    },
    onSuccess: () => {
      // Background refetch to sync with server
      queryClient.invalidateQueries({ queryKey: ['/api/incidents/nearby'] });
      toast({ title: "Incident removed", description: "Your incident has been deleted." });
    },
    onError: (_err, _vars, context: any) => {
      // Roll back optimistic cache removal
      if (context?.previousData) {
        for (const [key, data] of context.previousData) {
          queryClient.setQueryData(key, data);
        }
      }
      // Force refetch to also restore any map markers that were removed optimistically
      queryClient.invalidateQueries({ queryKey: ['/api/incidents/nearby'] });
      toast({ title: "Delete failed", description: "Could not delete the incident. Try again.", variant: "destructive" });
      setConfirmDelete(false);
    },
  });

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      // Auto-reset after 3 seconds if not confirmed
      if (confirmResetRef.current) clearTimeout(confirmResetRef.current);
      confirmResetRef.current = setTimeout(() => setConfirmDelete(false), 3000);
    } else {
      if (confirmResetRef.current) clearTimeout(confirmResetRef.current);
      setConfirmDelete(false);
      deleteMutation.mutate();
    }
  };

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => { if (confirmResetRef.current) clearTimeout(confirmResetRef.current); };
  }, []);

  return (
    <div>
      <Card 
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "relative cursor-pointer rounded-lg border shadow-lg transition-all hover:shadow-xl",
          "bg-zinc-900/80 border-white/10 hover:border-white/20"
        )}
        style={{ 
          borderColor: displayColor ? `${displayColor}30` : undefined,
          boxShadow: displayColor ? `0 2px 10px ${displayColor}15` : undefined
        }}
        role="button"
        aria-expanded={open}
        aria-controls={`incident-comments-${id}`}
      >
        <CardContent className="p-4">
          {/* Header with icon, title and severity badge */}
          <div className="flex items-start gap-3">
            <div 
              className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg"
              style={{ backgroundColor: `${displayColor}25` }}
            >
              {legacyType?.buttonIcon ? (
                <img 
                  src={legacyType.buttonIcon} 
                  alt={displayLabel}
                  className="h-6 w-6 object-contain"
                />
              ) : (
                <span 
                  className="text-lg font-bold"
                  style={{ color: displayColor }}
                >
                  {displayLabel.charAt(0)}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold text-white leading-tight">
                  {title}
                </h3>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isLocal && syncStatus && (
                    <Badge className={clsx(
                      "rounded text-xs font-semibold px-2 py-1 flex items-center gap-1",
                      syncStatus === 'pending' && "bg-amber-500/20 text-amber-400 border border-amber-500/30",
                      syncStatus === 'syncing' && "bg-blue-500/20 text-blue-400 border border-blue-500/30",
                      syncStatus === 'synced' && "bg-green-500/20 text-green-400 border border-green-500/30",
                      syncStatus === 'error' && "bg-red-500/20 text-red-400 border border-red-500/30"
                    )}>
                      {syncStatus === 'pending' && <CloudOff className="h-3 w-3" />}
                      {syncStatus === 'syncing' && <RefreshCw className="h-3 w-3 animate-spin" />}
                      {syncStatus === 'synced' && <Cloud className="h-3 w-3" />}
                      {syncStatus === 'error' && <AlertTriangle className="h-3 w-3" />}
                      {syncStatus === 'pending' && 'Pending'}
                      {syncStatus === 'syncing' && 'Syncing'}
                      {syncStatus === 'synced' && 'Synced'}
                      {syncStatus === 'error' && 'Failed'}
                    </Badge>
                  )}
                  {/* Delete button — owner only, two-step confirmation */}
                  {isOwner && !isLocal && (
                    <button
                      onClick={handleDeleteClick}
                      disabled={deleteMutation.isPending}
                      aria-label={confirmDelete ? "Tap again to confirm deletion" : "Delete this incident"}
                      className={clsx(
                        "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold transition-all",
                        confirmDelete
                          ? "bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30"
                          : "text-zinc-600 hover:text-red-400 hover:bg-red-500/10 border border-transparent",
                        deleteMutation.isPending && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Trash2 className="h-3 w-3" />
                      {confirmDelete && <span>Confirm?</span>}
                    </button>
                  )}
                  <span 
                    className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: displayColor }}
                    title={displayLabel}
                  />
                </div>
              </div>

              {/* Description - skip duplicate "Quick report:" text */}
              {description && description !== title && !description.startsWith('Quick report:') && (
                <p className="mt-1 text-sm text-zinc-300">
                  {description}
                </p>
              )}

              {/* Footer with timestamp and comment count */}
              <div className="mt-3 flex items-center gap-4 text-xs text-zinc-400">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Lock className="h-3 w-3 text-zinc-500 hover:text-zinc-400 cursor-help flex-shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[220px] text-center">
                      <p>Structured safety report. Content is moderated.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {(() => {
                    const date = new Date(createdAt);
                    const now = new Date();
                    
                    // Check if same calendar day
                    if (date.toDateString() === now.toDateString()) {
                      // Same day - show time only
                      return date.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false
                      });
                    }
                    
                    // Calculate calendar-day difference
                    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                    const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const daysDiff = Math.floor((nowOnly.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24));
                    
                    if (daysDiff < 7) {
                      // Within a week - show day and time
                      return new Intl.DateTimeFormat(undefined, {
                        weekday: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                      }).format(date);
                    } else {
                      // Older - show full date and time
                      return new Intl.DateTimeFormat(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                      }).format(date);
                    }
                  })()
                  }
                </span>
                
                {/* Comment count indicator */}
                <div className="flex items-center gap-1 text-zinc-400 hover:text-zinc-300 transition-colors">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>{comments.length}</span>
                </div>
                
                {/* Approx location indicator for pending incidents */}
                {isLocal && syncStatus === 'pending' && (
                  <span className="flex items-center gap-1 text-amber-400">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>Approx. location</span>
                  </span>
                )}
                
                {/* View on Map button - disabled for local incidents */}
                {!isLocal && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const params = new URLSearchParams();
                      params.set('focus', id);
                      if (groupFilter && groupFilter !== 'all') {
                        params.set('group', groupFilter);
                      }
                      setLocation(`/community/map?${params.toString()}`);
                    }}
                    data-testid={`button-view-map-${id}`}
                    className="ml-auto flex items-center gap-1.5 rounded-md bg-blue-500/20 px-2.5 py-1.5 text-blue-400 hover:bg-blue-500/30 hover:text-blue-300 transition-all"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    <span>View on Map</span>
                  </button>
                )}
              </div>
              
              {/* Community Attention signals */}
              <CommunityAttention incidentId={id} isLocal={isLocal} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comments section */}
      {open && (
        <div id={`incident-comments-${id}`} className="mt-2">
          <IncidentComments incidentId={id} open={open} />
        </div>
      )}
    </div>
  );
}