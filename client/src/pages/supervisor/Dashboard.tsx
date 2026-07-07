import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { useDashboardStore } from '../../store/dashboard';
import MapComponent from '../../components/MapComponent';
import Header from '../../components/Header';
import { Users, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

export default function SupervisorDashboard() {
  const { data, incidents, checkins, setData, setIncidents, setCheckins } = useDashboardStore();
  const [loading, setLoading] = useState(true);

  // Mock data - would be fetched from Firestore
  const mockDashboardData = {
    activeGuards: 3,
    openIncidents: 2,
    compliance: 94.2,
    recentCheckins: [
      {
        id: '1',
        guardId: 'guard1',
        guardName: 'Officer Sarah Chen',
        pointLabel: 'Main Entrance Gate',
        timestamp: new Date(Date.now() - 2 * 60 * 1000),
        siteId: 'site1',
        patrolPointId: 'point1',
        location: { lat: 37.7749, lng: -122.4194 },
        batteryPct: 87,
        method: 'qr' as const,
        createdAt: new Date(),
        createdBy: 'guard1'
      }
    ],
    recentIncidents: [
      {
        id: '1',
        siteId: 'site1',
        category: 'suspicious' as const,
        severity: 'high' as const,
        description: 'Suspicious Activity in Parking Garage Level 2',
        photos: [],
        status: 'open' as const,
        createdAt: new Date(Date.now() - 15 * 60 * 1000),
        updatedAt: new Date(),
        createdBy: 'guard1',
        updatedBy: 'guard1'
      }
    ],
    guardLocations: [
      {
        guardId: 'guard1',
        guardName: 'Officer Sarah Chen',
        location: { lat: 37.7749, lng: -122.4194 },
        lastUpdate: new Date()
      }
    ]
  };

  useEffect(() => {
    // Simulate data loading
    const loadData = async () => {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      setData(mockDashboardData);
      setIncidents(mockDashboardData.recentIncidents);
      setCheckins(mockDashboardData.recentCheckins);
      setLoading(false);
    };

    loadData();
  }, [setData, setIncidents, setCheckins]);

  const mapMarkers = [
    // Guard locations
    ...(data?.guardLocations.map(guard => ({
      id: guard.guardId,
      type: 'guard' as const,
      position: guard.location,
      title: guard.guardName,
      data: guard
    })) || []),
    // Incident locations
    ...incidents.filter(incident => incident.location).map(incident => ({
      id: incident.id,
      type: 'incident' as const,
      position: incident.location!,
      title: incident.description,
      data: incident
    }))
  ];

  const activityFeed = [
    ...checkins.map(checkin => ({
      id: checkin.id,
      type: 'checkin',
      action: 'Check-in Completed',
      guard: `Guard ${checkin.guardId}`,
      location: `Point ${checkin.patrolPointId}`,
      timestamp: checkin.timestamp
    })),
    ...incidents.map(incident => ({
      id: incident.id,
      type: 'incident',
      action: 'Incident Updated',
      guard: incident.description,
      location: `Status: ${incident.status}`,
      timestamp: incident.createdAt
    }))
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 10);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        title="Live Security Dashboard" 
        subtitle="Downtown Plaza Security Operations" 
      />
      
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Guards</p>
                  <p className="text-2xl font-bold text-green-600" data-testid="active-guards">
                    {data?.activeGuards || 0}
                  </p>
                </div>
                <Users className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Open Incidents</p>
                  <p className="text-2xl font-bold text-orange-600" data-testid="open-incidents">
                    {data?.openIncidents || 0}
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Compliance</p>
                  <p className="text-2xl font-bold text-blue-600" data-testid="compliance">
                    {data?.compliance || 0}%
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="h-96">
            <CardHeader>
              <CardTitle>Live Security Map</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <MapComponent
                markers={mapMarkers}
                height="320px"
                onMarkerClick={(marker) => {
                  console.log('Marker clicked:', marker);
                }}
              />
            </CardContent>
          </Card>

          {/* Incident Management Board */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Active Incidents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {/* Open Column */}
                <div className="bg-red-50 rounded-lg p-4">
                  <h3 className="font-medium text-red-800 mb-3">Open (2)</h3>
                  <div className="space-y-3">
                    <div className="bg-white rounded p-3 border border-red-200">
                      <h4 className="font-medium text-sm">Suspicious Activity</h4>
                      <p className="text-xs text-gray-600">Parking Garage Level 2</p>
                      <p className="text-xs text-red-600">High Priority • 15 min ago</p>
                      <Button 
                        size="sm" 
                        className="mt-2 text-xs"
                        data-testid="assign-incident-1"
                      >
                        Assign
                      </Button>
                    </div>
                    <div className="bg-white rounded p-3 border border-red-200">
                      <h4 className="font-medium text-sm">Equipment Malfunction</h4>
                      <p className="text-xs text-gray-600">Security Office</p>
                      <p className="text-xs text-amber-600">Medium Priority • 1 hr ago</p>
                      <Button 
                        size="sm" 
                        className="mt-2 text-xs"
                        data-testid="assign-incident-2"
                      >
                        Assign
                      </Button>
                    </div>
                  </div>
                </div>

                {/* In Progress Column */}
                <div className="bg-amber-50 rounded-lg p-4">
                  <h3 className="font-medium text-amber-800 mb-3">In Progress (1)</h3>
                  <div className="space-y-3">
                    <div className="bg-white rounded p-3 border border-amber-200">
                      <h4 className="font-medium text-sm">Fire Alarm Investigation</h4>
                      <p className="text-xs text-gray-600">Building A - 3rd Floor</p>
                      <p className="text-xs text-blue-600">Assigned to: Officer Chen</p>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="mt-2 text-xs border-green-600 text-green-600"
                        data-testid="resolve-incident"
                      >
                        Mark Resolved
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Resolved Column */}
                <div className="bg-green-50 rounded-lg p-4">
                  <h3 className="font-medium text-green-800 mb-3">Resolved (8)</h3>
                  <div className="space-y-3">
                    <div className="bg-white rounded p-3 border border-green-200">
                      <h4 className="font-medium text-sm">Visitor Badge Issue</h4>
                      <p className="text-xs text-gray-600">Main Lobby</p>
                      <p className="text-xs text-green-600">Resolved by: Officer Johnson</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Feed */}
        <div className="w-80 bg-white border-l p-6">
          <h2 className="text-lg font-semibold mb-4">Live Activity Feed</h2>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {activityFeed.map((activity) => (
              <div 
                key={activity.id} 
                className={`border-l-4 pl-4 ${
                  activity.type === 'checkin' ? 'border-green-500' : 
                  activity.type === 'incident' ? 'border-amber-500' : 'border-primary'
                }`}
                data-testid={`activity-${activity.id}`}
              >
                <h4 className="font-medium text-sm">{activity.action}</h4>
                <p className="text-xs text-gray-600">{activity.guard}</p>
                <p className="text-xs text-gray-500">{activity.location}</p>
                <p className="text-xs text-gray-400">
                  {activity.timestamp.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
