import React, { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import PushNotificationSettings from "@/components/PushNotificationSettings";
import { pushManager } from "@/lib/pushNotifications";

export default function NotificationSettings() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Initialize push manager when component mounts
    pushManager.initialize();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900">
      {/* Header */}
      <div className="glass-toolbar backdrop-blur-md px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation('/community/map')}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors tap-target focus-enhanced"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">Notification Settings</h1>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-w-2xl mx-auto">
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-2">Stay Informed</h2>
          <p className="text-gray-400 text-sm">
            Configure how you want to receive alerts about incidents in your neighborhood.
            Push notifications work even when NaborNet is closed.
          </p>
        </div>

        <PushNotificationSettings />

        {/* Footer info */}
        <div className="mt-8 p-4 glass-card rounded-xl border border-gray-800/50">
          <h3 className="font-medium mb-2 text-sm">🔒 Privacy & Security</h3>
          <ul className="text-xs text-gray-400 space-y-1">
            <li>• Notifications are sent only to your neighborhood area</li>
            <li>• Your exact location is never shared with other users</li>
            <li>• You can disable notifications anytime in these settings</li>
            <li>• Anonymous reports still trigger notifications to help the community</li>
          </ul>
        </div>
      </div>
    </div>
  );
}