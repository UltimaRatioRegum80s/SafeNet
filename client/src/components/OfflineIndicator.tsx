import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw, AlertCircle } from 'lucide-react';
import { getPendingCount, getErrorCount } from '@/lib/offlineDb';
import { syncPendingIncidents, addSyncListener } from '@/lib/syncEngine';
import { cn } from '@/lib/utils';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const updateCounts = async () => {
      const pending = await getPendingCount();
      const errors = await getErrorCount();
      setPendingCount(pending);
      setErrorCount(errors);
    };

    updateCounts();
    const interval = setInterval(updateCounts, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribe = addSyncListener(setSyncStatus);
    return unsubscribe;
  }, []);

  const handleRetrySync = async () => {
    if (syncStatus === 'syncing') return;
    await syncPendingIncidents();
  };

  const totalPending = pendingCount + errorCount;
  
  if (isOnline && totalPending === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 z-50">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-full shadow-lg transition-all",
          "text-sm font-medium",
          !isOnline 
            ? "bg-amber-500 text-white" 
            : errorCount > 0 
              ? "bg-red-500 text-white"
              : pendingCount > 0 
                ? "bg-blue-500 text-white"
                : "bg-green-500 text-white"
        )}
        data-testid="offline-indicator"
      >
        {!isOnline ? (
          <>
            <WifiOff className="h-4 w-4" />
            <span>Offline</span>
          </>
        ) : syncStatus === 'syncing' ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Syncing...</span>
          </>
        ) : errorCount > 0 ? (
          <>
            <AlertCircle className="h-4 w-4" />
            <span>{errorCount} failed</span>
          </>
        ) : pendingCount > 0 ? (
          <>
            <Cloud className="h-4 w-4" />
            <span>{pendingCount} pending</span>
          </>
        ) : (
          <>
            <Wifi className="h-4 w-4" />
            <span>Online</span>
          </>
        )}
      </button>

      {showDetails && (
        <div className="absolute bottom-12 left-0 bg-card border border-border rounded-lg shadow-xl p-4 min-w-[200px]">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span className={cn(
                "font-medium",
                isOnline ? "text-green-500" : "text-amber-500"
              )}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            
            {pendingCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Pending sync:</span>
                <span className="font-medium text-blue-500">{pendingCount}</span>
              </div>
            )}
            
            {errorCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Failed:</span>
                <span className="font-medium text-red-500">{errorCount}</span>
              </div>
            )}
            
            {isOnline && (pendingCount > 0 || errorCount > 0) && (
              <button
                onClick={handleRetrySync}
                disabled={syncStatus === 'syncing'}
                className="w-full mt-2 px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm font-medium disabled:opacity-50"
                data-testid="button-retry-sync"
              >
                {syncStatus === 'syncing' ? 'Syncing...' : 'Retry Sync'}
              </button>
            )}
            
            {!isOnline && (
              <p className="text-xs text-muted-foreground mt-2">
                Your reports will sync when you're back online.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function PendingBadge({ status, className }: { status: 'pending' | 'synced' | 'error'; className?: string }) {
  const config = {
    pending: { label: 'Pending sync', color: 'bg-amber-500', icon: CloudOff },
    synced: { label: 'Synced', color: 'bg-green-500', icon: Cloud },
    error: { label: 'Sync failed', color: 'bg-red-500', icon: AlertCircle },
  };
  
  const { label, color, icon: Icon } = config[status];
  
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white",
      color,
      className
    )}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

export function ApproxLocationBadge({ className }: { className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
      "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
      className
    )}>
      Approx. location
    </span>
  );
}
