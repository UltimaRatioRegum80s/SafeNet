import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, Check, X } from "lucide-react";
import { useLocation } from "wouter";
import NNImage from "@/components/NNImage";
import { SeverityChip } from "@/components/SeverityUI";
import { timeAgo } from "@/lib/timeAgo";
import { getModerationQueue, moderateIncident } from "@/lib/apiModeration";
import { useToast } from "@/hooks/use-toast";

export default function ModerationQueue() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const queueQuery = useQuery({
    queryKey: ["moderation", "queue"],
    queryFn: getModerationQueue,
  });

  const moderationMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "approve" | "reject" }) => {
      return moderateIncident(id, action);
    },
    onSuccess: (_, { action }) => {
      toast({
        title: `Incident ${action}d`,
        description: `The incident has been ${action}d successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["moderation", "queue"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Moderation failed",
        description: error.message || "Could not complete moderation action",
      });
    },
  });

  if (queueQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-400">Loading moderation queue...</p>
        </div>
      </div>
    );
  }

  const queueItems = queueQuery.data?.items || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900">
      {/* Header */}
      <div className="glass-toolbar backdrop-blur-md px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation('/community/map')}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors tap-target focus-enhanced"
            aria-label="Go back"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Shield className="w-5 h-5 text-amber-400" />
          <h1 className="text-lg font-semibold">Moderation Queue</h1>
          <div className="ml-auto text-sm text-gray-400">
            {queueItems.length} items
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-w-4xl mx-auto">
        {queueItems.length === 0 ? (
          <div className="text-center py-12">
            <Shield className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">All Clear!</h2>
            <p className="text-gray-400">
              No incidents require moderation at this time.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-2">Flagged Incidents</h2>
              <p className="text-gray-400 text-sm">
                Review incidents that have been reported or automatically flagged by our quality controls.
              </p>
            </div>

            {queueItems.map((incident: any) => (
              <div
                key={incident.id}
                className="glass-card rounded-2xl p-4 border border-gray-700/50"
              >
                <div className="flex items-start gap-4">
                  {/* Photo Preview */}
                  {incident.photos?.[0] && (
                    <div className="flex-shrink-0">
                      <NNImage
                        src={incident.photos[0]}
                        alt="Incident photo"
                        className="w-20 h-16 rounded-lg object-cover"
                      />
                    </div>
                  )}

                  {/* Incident Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <SeverityChip sev={incident.severity} />
                      <h3 className="font-medium text-lg">{incident.title}</h3>
                    </div>
                    
                    <p className="text-gray-300 text-sm mb-3 line-clamp-2">
                      {incident.description}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>Type: {incident.type}</span>
                      <span>Reported: {timeAgo(new Date(incident.createdAt).getTime())}</span>
                      {incident.report_count > 0 && (
                        <span className="text-red-400 font-medium">
                          {incident.report_count} abuse report{incident.report_count !== 1 ? 's' : ''}
                        </span>
                      )}
                      {incident.isShadowHidden && (
                        <span className="text-amber-400 font-medium">Auto-flagged</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      onClick={() => moderationMutation.mutate({ id: incident.id, action: "approve" })}
                      disabled={moderationMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                      data-testid={`button-approve-${incident.id}`}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => moderationMutation.mutate({ id: incident.id, action: "reject" })}
                      disabled={moderationMutation.isPending}
                      data-testid={`button-reject-${incident.id}`}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}