import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, X, Clock, UserCheck, UserX, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type AccessRequest = {
  id: string;
  email: string | null;
  username: string;
  accessStatus: string;
  accessRequestedAt: string | null;
  accessApprovedAt: string | null;
  requestedName: string | null;
  requestedCity: string | null;
  requestedReason: string | null;
  oauthProvider: string | null;
  country: string;
  city: string;
  createdAt: string;
};

function StatusTab({ label, value, current, onClick }: { label: string; value: string; current: string; onClick: (v: string) => void }) {
  return (
    <button
      onClick={() => onClick(value)}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
        current === value
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:bg-muted/80'
      }`}
    >
      {label}
    </button>
  );
}

export default function AccessRequests() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('pending');

  const { data, isLoading } = useQuery<{ requests: AccessRequest[] }>({
    queryKey: ['/api/admin/access-requests', statusFilter],
    queryFn: async () => {
      const res = await fetch(`/api/admin/access-requests?status=${statusFilter}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/admin/access-requests/${userId}/approve`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to approve');
      return res.json();
    },
    onSuccess: (_, userId) => {
      toast({ title: "User approved", description: "They can now access the community." });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/access-requests'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not approve user.", variant: "destructive" });
    },
  });

  const denyMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/admin/access-requests/${userId}/deny`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to deny');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "User denied" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/access-requests'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not deny user.", variant: "destructive" });
    },
  });

  const requests = data?.requests || [];

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <StatusTab label="Pending" value="pending" current={statusFilter} onClick={setStatusFilter} />
        <StatusTab label="Approved" value="approved" current={statusFilter} onClick={setStatusFilter} />
        <StatusTab label="Denied" value="denied" current={statusFilter} onClick={setStatusFilter} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No {statusFilter} requests found.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <Card key={req.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium truncate">{req.requestedName || req.username}</span>
                      {req.oauthProvider && (
                        <Badge variant="outline" className="text-xs">{req.oauthProvider}</Badge>
                      )}
                    </div>
                    {req.email && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{req.email}</span>
                      </div>
                    )}
                    {req.requestedCity && (
                      <p className="text-sm text-muted-foreground">Location: {req.requestedCity}</p>
                    )}
                    {req.requestedReason && (
                      <p className="text-sm mt-1 text-foreground/80">{req.requestedReason}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      <Clock className="h-3 w-3 inline mr-1" />
                      Joined {formatDate(req.createdAt)}
                    </p>
                  </div>

                  {statusFilter === 'pending' && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => approveMutation.mutate(req.id)}
                        disabled={approveMutation.isPending}
                      >
                        <Check className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => denyMutation.mutate(req.id)}
                        disabled={denyMutation.isPending}
                      >
                        <X className="h-4 w-4 mr-1" /> Deny
                      </Button>
                    </div>
                  )}

                  {statusFilter === 'approved' && (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      <UserCheck className="h-3 w-3 mr-1" /> Approved
                    </Badge>
                  )}

                  {statusFilter === 'denied' && (
                    <Badge variant="destructive">
                      <UserX className="h-3 w-3 mr-1" /> Denied
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
