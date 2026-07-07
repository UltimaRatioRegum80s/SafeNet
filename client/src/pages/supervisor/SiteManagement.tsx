import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { useToast } from '../../hooks/use-toast';
import { useAuthStore } from '../../store/auth';
import MapComponent from '../../components/MapComponent';
import { MapPin, Plus, Edit, QrCode, Trash2 } from 'lucide-react';
import { Site, PatrolPoint } from '../../types';

export default function SiteManagement() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [sites, setSites] = useState<Site[]>([]);
  const [patrolPoints, setPatrolPoints] = useState<PatrolPoint[]>([]);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [showCreateSite, setShowCreateSite] = useState(false);
  const [showCreatePoint, setShowCreatePoint] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newPointLabel, setNewPointLabel] = useState('');
  const [newPointRadius, setNewPointRadius] = useState(10);

  // Mock data
  const mockSites: Site[] = [
    {
      id: 'site1',
      tenantId: user?.id || 'tenant1',
      name: 'Downtown Plaza',
      geofence: {
        type: 'circle',
        center: { lat: 37.7749, lng: -122.4194 },
        radius: 200
      },
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: user?.id || 'admin',
      updatedBy: user?.id || 'admin'
    },
    {
      id: 'site2',
      tenantId: user?.id || 'tenant1',
      name: 'West Gate Complex',
      geofence: {
        type: 'circle',
        center: { lat: 37.7849, lng: -122.4094 },
        radius: 150
      },
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: user?.id || 'admin',
      updatedBy: user?.id || 'admin'
    }
  ];

  const mockPatrolPoints: PatrolPoint[] = [
    {
      id: 'point1',
      siteId: 'site1',
      label: 'Main Entrance',
      location: { lat: 37.7749, lng: -122.4194 },
      radiusM: 10,
      qrCode: 'QR_MAIN_ENTRANCE',
      order: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: user?.id || 'admin',
      updatedBy: user?.id || 'admin'
    },
    {
      id: 'point2',
      siteId: 'site1',
      label: 'Parking Garage Level 2',
      location: { lat: 37.7759, lng: -122.4184 },
      radiusM: 15,
      qrCode: 'QR_PARKING_L2',
      order: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: user?.id || 'admin',
      updatedBy: user?.id || 'admin'
    }
  ];

  useState(() => {
    setSites(mockSites);
    setPatrolPoints(mockPatrolPoints);
    setSelectedSite(mockSites[0]);
  });

  const getPatrolPointsForSite = (siteId: string) => {
    return patrolPoints.filter(point => point.siteId === siteId);
  };

  const handleCreateSite = async () => {
    if (!newSiteName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a site name.",
        variant: "destructive",
      });
      return;
    }

    const newSite: Site = {
      id: `site${Date.now()}`,
      tenantId: user?.id || 'tenant1',
      name: newSiteName,
      geofence: {
        type: 'circle',
        center: { lat: 37.7749, lng: -122.4194 },
        radius: 100
      },
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: user?.id || 'admin',
      updatedBy: user?.id || 'admin'
    };

    setSites(prev => [...prev, newSite]);
    setNewSiteName('');
    setShowCreateSite(false);

    toast({
      title: "Site Created",
      description: `${newSiteName} has been created successfully.`,
    });
  };

  const handleCreatePatrolPoint = async () => {
    if (!newPointLabel.trim() || !selectedSite) {
      toast({
        title: "Error",
        description: "Please enter a patrol point label and select a site.",
        variant: "destructive",
      });
      return;
    }

    const newPoint: PatrolPoint = {
      id: `point${Date.now()}`,
      siteId: selectedSite.id,
      label: newPointLabel,
      location: { lat: 37.7749 + Math.random() * 0.01, lng: -122.4194 + Math.random() * 0.01 },
      radiusM: newPointRadius,
      qrCode: `QR_${newPointLabel.toUpperCase().replace(/\s+/g, '_')}`,
      order: getPatrolPointsForSite(selectedSite.id).length + 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: user?.id || 'admin',
      updatedBy: user?.id || 'admin'
    };

    setPatrolPoints(prev => [...prev, newPoint]);
    setNewPointLabel('');
    setNewPointRadius(10);
    setShowCreatePoint(false);

    toast({
      title: "Patrol Point Created",
      description: `${newPointLabel} has been added to ${selectedSite.name}.`,
    });
  };

  const handleDeletePatrolPoint = (pointId: string) => {
    setPatrolPoints(prev => prev.filter(point => point.id !== pointId));
    
    toast({
      title: "Patrol Point Deleted",
      description: "The patrol point has been removed.",
    });
  };

  const generateQRSheet = () => {
    if (!selectedSite) return;
    
    const sitePoints = getPatrolPointsForSite(selectedSite.id);
    
    toast({
      title: "QR Sheet Generated",
      description: `Generating printable QR codes for ${sitePoints.length} patrol points.`,
    });

    // Mock QR sheet generation
    console.log('QR Sheet for:', selectedSite.name);
    sitePoints.forEach(point => {
      console.log(`${point.label}: ${point.qrCode}`);
    });
  };

  const mapMarkers = selectedSite ? [
    // Site center
    {
      id: 'site-center',
      type: 'guard' as const,
      position: selectedSite.geofence.center || { lat: 0, lng: 0 },
      title: selectedSite.name,
      data: selectedSite
    },
    // Patrol points
    ...getPatrolPointsForSite(selectedSite.id).map(point => ({
      id: point.id,
      type: 'guard' as const,
      position: point.location,
      title: point.label,
      data: point
    }))
  ] : [];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center">
              <MapPin className="w-6 h-6 mr-2 text-primary" />
              Site Management
            </h1>
            <p className="text-gray-600 mt-1">Manage security sites and patrol points</p>
          </div>
          <Dialog open={showCreateSite} onOpenChange={setShowCreateSite}>
            <DialogTrigger asChild>
              <Button data-testid="create-site-button">
                <Plus className="w-4 h-4 mr-2" />
                Create Site
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Site</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="site-name">Site Name</Label>
                  <Input
                    id="site-name"
                    placeholder="Enter site name"
                    value={newSiteName}
                    onChange={(e) => setNewSiteName(e.target.value)}
                    data-testid="site-name-input"
                  />
                </div>
                <div>
                  <Label>Geofence Location</Label>
                  <div className="border border-gray-300 rounded-md h-32 bg-gray-50 flex items-center justify-center">
                    <span className="text-gray-500 text-sm">Click to set location on map</span>
                  </div>
                </div>
                <Button onClick={handleCreateSite} className="w-full" data-testid="create-site-submit">
                  Create Site
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sites List */}
          <Card>
            <CardHeader>
              <CardTitle>Sites</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sites.map((site) => (
                <Card 
                  key={site.id}
                  className={`cursor-pointer transition-colors ${
                    selectedSite?.id === site.id ? 'border-primary bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedSite(site)}
                  data-testid={`site-card-${site.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{site.name}</h3>
                        <p className="text-sm text-gray-600">
                          {getPatrolPointsForSite(site.id).length} patrol points
                        </p>
                      </div>
                      <Badge variant={site.active ? "default" : "secondary"}>
                        {site.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>

          {/* Site Details and Map */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {selectedSite ? selectedSite.name : 'Select a Site'}
                </CardTitle>
                {selectedSite && (
                  <div className="flex space-x-2">
                    <Button 
                      onClick={generateQRSheet}
                      variant="outline"
                      size="sm"
                      data-testid="generate-qr-sheet"
                    >
                      <QrCode className="w-4 h-4 mr-2" />
                      QR Sheet
                    </Button>
                    <Dialog open={showCreatePoint} onOpenChange={setShowCreatePoint}>
                      <DialogTrigger asChild>
                        <Button size="sm" data-testid="add-patrol-point">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Patrol Point
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Patrol Point</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="point-label">Point Label</Label>
                            <Input
                              id="point-label"
                              placeholder="Enter patrol point label"
                              value={newPointLabel}
                              onChange={(e) => setNewPointLabel(e.target.value)}
                              data-testid="point-label-input"
                            />
                          </div>
                          <div>
                            <Label htmlFor="point-radius">Check-in Radius (meters)</Label>
                            <Input
                              id="point-radius"
                              type="number"
                              min="5"
                              max="100"
                              value={newPointRadius}
                              onChange={(e) => setNewPointRadius(Number(e.target.value))}
                              data-testid="point-radius-input"
                            />
                          </div>
                          <div>
                            <Label>Location</Label>
                            <div className="border border-gray-300 rounded-md h-32 bg-gray-50 flex items-center justify-center">
                              <span className="text-gray-500 text-sm">Click on map to set location</span>
                            </div>
                          </div>
                          <Button onClick={handleCreatePatrolPoint} className="w-full" data-testid="create-point-submit">
                            Add Patrol Point
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {selectedSite ? (
                <div className="space-y-4">
                  {/* Map */}
                  <MapComponent
                    markers={mapMarkers}
                    center={selectedSite.geofence.center}
                    height="300px"
                    onMarkerClick={(marker) => {
                      console.log('Marker clicked:', marker);
                    }}
                  />

                  {/* Patrol Points List */}
                  <div>
                    <h3 className="font-medium mb-3">
                      Patrol Points ({getPatrolPointsForSite(selectedSite.id).length})
                    </h3>
                    <div className="space-y-2">
                      {getPatrolPointsForSite(selectedSite.id).map((point) => (
                        <Card key={point.id} className="border-gray-200">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-medium">{point.label}</h4>
                                <p className="text-sm text-gray-600">
                                  QR: {point.qrCode} • Radius: {point.radiusM}m
                                </p>
                              </div>
                              <div className="flex space-x-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  data-testid={`edit-point-${point.id}`}
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => handleDeletePatrolPoint(point.id)}
                                  data-testid={`delete-point-${point.id}`}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-12">
                  <MapPin className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>Select a site to view details and manage patrol points</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
