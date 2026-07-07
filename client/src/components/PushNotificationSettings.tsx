import React, { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, TestTube, Settings } from "lucide-react";
import { pushManager } from "@/lib/pushNotifications";

export default function PushNotificationSettings() {
  // Mock user data for now - integrate with actual auth later
  const user = { neighbourhood: 'windhoek-city' };
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [supportsPush, setSupportsPush] = useState(false);

  useEffect(() => {
    checkPushSupport();
    loadCurrentSettings();
  }, []);

  async function checkPushSupport() {
    const initialized = await pushManager.initialize();
    setSupportsPush(initialized);
  }

  function loadCurrentSettings() {
    setIsSubscribed(pushManager.isSubscribed());
    setSelectedTypes(pushManager.getSubscribedTypes());
  }

  async function handleSubscribe() {
    if (!user?.neighbourhood) {
      alert("Please set your neighborhood in your profile first");
      return;
    }

    setIsLoading(true);
    try {
      const success = await pushManager.subscribe(
        user.neighbourhood,
        selectedTypes.length > 0 ? selectedTypes : ['all']
      );
      
      if (success) {
        setIsSubscribed(true);
        alert("✅ Push notifications enabled! You'll receive alerts for incidents in your area.");
      } else {
        alert("❌ Failed to enable push notifications. Please check your browser permissions.");
      }
    } catch (error) {
      console.error('Subscription failed:', error);
      alert("❌ Push notification setup failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUnsubscribe() {
    setIsLoading(true);
    try {
      const success = await pushManager.unsubscribe();
      if (success) {
        setIsSubscribed(false);
        setSelectedTypes([]);
        alert("🔕 Push notifications disabled");
      }
    } catch (error) {
      console.error('Unsubscribe failed:', error);
      alert("❌ Failed to disable notifications");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdateSettings() {
    setIsLoading(true);
    try {
      const success = await pushManager.updateSettings(selectedTypes);
      if (success) {
        alert("✅ Notification preferences updated");
      } else {
        alert("❌ Failed to update preferences");
      }
    } catch (error) {
      console.error('Settings update failed:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleTestNotification() {
    const success = await pushManager.sendTestNotification();
    if (!success) {
      alert("❌ Test notification failed. Check browser permissions.");
    }
  }

  function toggleIncidentType(typeId: string) {
    setSelectedTypes(prev => 
      prev.includes(typeId) 
        ? prev.filter(id => id !== typeId)
        : [...prev, typeId]
    );
  }

  if (!supportsPush) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="w-5 h-5" />
            Push Notifications Unavailable
          </CardTitle>
          <CardDescription>
            Your browser doesn't support push notifications or you're on an unsupported device.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const availableTypes = pushManager.getAvailableTypes();

  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Get instant alerts for incidents in your neighborhood: {user?.neighbourhood || 'Not set'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Enable Notifications</Label>
              <div className="text-sm text-gray-400">
                Receive alerts for selected incident types
              </div>
            </div>
            <Switch
              checked={isSubscribed}
              onCheckedChange={isSubscribed ? handleUnsubscribe : handleSubscribe}
              disabled={isLoading}
              className="focus-enhanced"
            />
          </div>

          {isSubscribed && (
            <>
              <div className="space-y-3">
                <Label className="text-sm font-medium">Incident Types</Label>
                <div className="grid grid-cols-2 gap-2">
                  {availableTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => toggleIncidentType(type.id)}
                      className={`p-3 rounded-lg border text-left transition-colors tap-target focus-enhanced ${
                        selectedTypes.includes(type.id)
                          ? 'glass-toolbar border-sky-500/50'
                          : 'glass-card border-gray-700/50 hover:border-gray-600/50'
                      }`}
                    >
                      <div className="font-medium text-sm">{type.label}</div>
                      <div className="text-xs text-gray-400 mt-1">{type.description}</div>
                    </button>
                  ))}
                </div>
                
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Badge variant="outline" className="text-xs">
                    {selectedTypes.length === 0 ? 'All types' : `${selectedTypes.length} selected`}
                  </Badge>
                  {selectedTypes.length === 0 && (
                    <span>Select specific types or leave empty for all incidents</span>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleUpdateSettings}
                  disabled={isLoading}
                  size="sm"
                  className="tap-target focus-enhanced"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Update Preferences
                </Button>
                <Button
                  onClick={handleTestNotification}
                  variant="outline"
                  size="sm"
                  className="tap-target focus-enhanced"
                >
                  <TestTube className="w-4 h-4 mr-2" />
                  Test
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {!isSubscribed && (
        <div className="text-sm text-gray-400 bg-gray-900/50 p-3 rounded-lg border border-gray-800">
          <p className="mb-2">🔔 <strong>Stay informed:</strong></p>
          <ul className="space-y-1 text-xs">
            <li>• Get instant alerts for incidents near you</li>
            <li>• Choose which types of incidents to receive</li>
            <li>• Notifications work even when the app is closed</li>
            <li>• Your location stays private - only neighborhood alerts</li>
          </ul>
        </div>
      )}
    </div>
  );
}