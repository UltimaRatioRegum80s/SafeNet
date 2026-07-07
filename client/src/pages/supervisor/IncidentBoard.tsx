import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { useToast } from '../../hooks/use-toast';
import { useAuthStore } from '../../store/auth';
import { TriangleAlert, Clock, CheckCircle, User, MapPin } from 'lucide-react';
import { Incident } from '../../types';

export default function IncidentBoard() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [assigneeId, setAssigneeId] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');

  // Mock data - would be fetched from Firestore
  const mockIncidents: Incident[] = [
    {
      id: '1',
      siteId: 'site1',
      category: 'suspicious',
      severity: 'high',
      description: 'Suspicious Activity in Parking Garage Level 2',
      photos: [],
      location: { lat: 37.7749, lng: -122.4194 },
      status: 'open',
      createdAt: new Date(Date.now() - 15 * 60 * 1000),
      updatedAt: new Date(),
      createdBy: 'guard1',
      updatedBy: 'guard1'
    },
    {
      id: '2',
      siteId: 'site1',
      category: 'maintenance',
      severity: 'medium',
      description: 'Equipment Malfunction in Security Office',
      photos: [],
      status: 'open',
      createdAt: new Date(Date.now() - 60 * 60 * 1000),
      updatedAt: new Date(),
      createdBy: 'guard2',
      updatedBy: 'guard2'
    },
    {
      id: '3',
      siteId: 'site1',
      category: 'fire',
      severity: 'high',
      description: 'Fire Alarm Investigation - Building A, 3rd Floor',
      photos: [],
      status: 'in-progress',
      assignedTo: 'guard1',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      updatedAt: new Date(),
      createdBy: 'guard1',
      updatedBy: 'supervisor1'
    },
    {
      id: '4',
      siteId: 'site1',
      category: 'maintenance',
      severity: 'low',
      description: 'Visitor Badge Issue at Main Lobby',
      photos: [],
      status: 'resolved',
      assignedTo: 'guard2',
      resolvedAt: new Date(Date.now() - 30 * 60 * 1000),
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      updatedAt: new Date(),
      createdBy: 'guard2',
      updatedBy: 'guard2'
    }
  ];

  const guards = [
    { id: 'guard1', name: 'Officer Sarah Chen' },
    { id: 'guard2', name: 'Officer Mike Johnson' },
    { id: 'guard3', name: 'Officer Rachel Williams' }
  ];

  useEffect(() => {
    // Simulate loading incidents
    const loadIncidents = async () => {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      setIncidents(mockIncidents);
      setLoading(false);
    };

    loadIncidents();
  }, []);

  const getIncidentsByStatus = (status: string) => {
    return incidents.filter(incident => incident.status === status);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'medium':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'critical':
        return 'bg-red-200 text-red-900 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'suspicious':
        return <TriangleAlert className="w-4 h-4" />;
      case 'fire':
        return <TriangleAlert className="w-4 h-4 text-red-600" />;
      case 'medical':
        return <TriangleAlert className="w-4 h-4 text-red-600" />;
      default:
        return <TriangleAlert className="w-4 h-4" />;
    }
  };

  const handleAssignIncident = async (incidentId: string) => {
    if (!assigneeId) {
      toast({
        title: "Error",
        description: "Please select a guard to assign the incident to.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Update incident in state
      setIncidents(prev => prev.map(incident => 
        incident.id === incidentId 
          ? { ...incident, status: 'in-progress', assignedTo: assigneeId, updatedAt: new Date() }
          : incident
      ));

      const assignedGuard = guards.find(g => g.id === assigneeId);
      toast({
        title: "Incident Assigned",
        description: `Incident assigned to ${assignedGuard?.name}`,
      });

      setAssigneeId('');
      setSelectedIncident(null);
    } catch (error: any) {
      toast({
        title: "Assignment Failed",
        description: error.message || "Failed to assign incident",
        variant: "destructive",
      });
    }
  };

  const handleResolveIncident = async (incidentId: string) => {
    try {
      // Update incident in state
      setIncidents(prev => prev.map(incident => 
        incident.id === incidentId 
          ? { 
              ...incident, 
              status: 'resolved', 
              resolvedAt: new Date(),
              updatedAt: new Date() 
            }
          : incident
      ));

      toast({
        title: "Incident Resolved",
        description: "Incident has been marked as resolved",
      });

      setResolutionNotes('');
      setSelectedIncident(null);
    } catch (error: any) {
      toast({
        title: "Resolution Failed",
        description: error.message || "Failed to resolve incident",
        variant: "destructive",
      });
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 60) {
      return `${diffMins} min ago`;
    } else {
      return `${diffHours} hr ago`;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center">
            <TriangleAlert className="w-6 h-6 mr-2 text-amber-600" />
            Incident Management Board
          </h1>
          <p className="text-gray-600 mt-1">Track and manage security incidents</p>
        </div>

        {/* Kanban Board */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Open Column */}
          <Card className="bg-red-50 border-red-200">
            <CardHeader>
              <CardTitle className="text-red-800 flex items-center">
                <TriangleAlert className="w-5 h-5 mr-2" />
                Open ({getIncidentsByStatus('open').length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {getIncidentsByStatus('open').map((incident) => (
                <Dialog key={incident.id}>
                  <DialogTrigger asChild>
                    <Card 
                      className="cursor-pointer hover:shadow-md transition-shadow bg-white border-red-200"
                      data-testid={`incident-card-${incident.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center">
                            {getCategoryIcon(incident.category)}
                            <span className="ml-2 font-medium text-sm capitalize">
                              {incident.category.replace('-', ' ')}
                            </span>
                          </div>
                          <Badge className={getSeverityColor(incident.severity)}>
                            {incident.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-700 mb-2 line-clamp-2">
                          {incident.description}
                        </p>
                        <div className="flex items-center text-xs text-gray-500">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatTimeAgo(incident.createdAt)}
                        </div>
                      </CardContent>
                    </Card>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Assign Incident</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-medium">{incident.description}</h3>
                        <p className="text-sm text-gray-600">
                          Severity: <Badge className={getSeverityColor(incident.severity)}>
                            {incident.severity}
                          </Badge>
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="assignee">Assign to Guard</Label>
                        <Select value={assigneeId} onValueChange={setAssigneeId}>
                          <SelectTrigger data-testid={`assign-select-${incident.id}`}>
                            <SelectValue placeholder="Select a guard" />
                          </SelectTrigger>
                          <SelectContent>
                            {guards.map((guard) => (
                              <SelectItem key={guard.id} value={guard.id}>
                                {guard.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button 
                        onClick={() => handleAssignIncident(incident.id)}
                        className="w-full"
                        data-testid={`assign-submit-${incident.id}`}
                      >
                        <User className="w-4 h-4 mr-2" />
                        Assign Incident
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              ))}
            </CardContent>
          </Card>

          {/* In Progress Column */}
          <Card className="bg-amber-50 border-amber-200">
            <CardHeader>
              <CardTitle className="text-amber-800 flex items-center">
                <Clock className="w-5 h-5 mr-2" />
                In Progress ({getIncidentsByStatus('in-progress').length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {getIncidentsByStatus('in-progress').map((incident) => {
                const assignedGuard = guards.find(g => g.id === incident.assignedTo);
                return (
                  <Dialog key={incident.id}>
                    <DialogTrigger asChild>
                      <Card 
                        className="cursor-pointer hover:shadow-md transition-shadow bg-white border-amber-200"
                        data-testid={`incident-card-${incident.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center">
                              {getCategoryIcon(incident.category)}
                              <span className="ml-2 font-medium text-sm capitalize">
                                {incident.category.replace('-', ' ')}
                              </span>
                            </div>
                            <Badge className={getSeverityColor(incident.severity)}>
                              {incident.severity}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-700 mb-2 line-clamp-2">
                            {incident.description}
                          </p>
                          {assignedGuard && (
                            <div className="flex items-center text-xs text-blue-600 mb-1">
                              <User className="w-3 h-3 mr-1" />
                              {assignedGuard.name}
                            </div>
                          )}
                          <div className="flex items-center text-xs text-gray-500">
                            <Clock className="w-3 h-3 mr-1" />
                            {formatTimeAgo(incident.createdAt)}
                          </div>
                        </CardContent>
                      </Card>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Resolve Incident</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <h3 className="font-medium">{incident.description}</h3>
                          <p className="text-sm text-gray-600">
                            Assigned to: {assignedGuard?.name}
                          </p>
                        </div>
                        <div>
                          <Label htmlFor="resolution">Resolution Notes (Optional)</Label>
                          <Textarea
                            id="resolution"
                            placeholder="Add resolution notes..."
                            value={resolutionNotes}
                            onChange={(e) => setResolutionNotes(e.target.value)}
                            data-testid={`resolution-notes-${incident.id}`}
                          />
                        </div>
                        <Button 
                          onClick={() => handleResolveIncident(incident.id)}
                          className="w-full bg-green-600 hover:bg-green-700"
                          data-testid={`resolve-submit-${incident.id}`}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Mark as Resolved
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                );
              })}
            </CardContent>
          </Card>

          {/* Resolved Column */}
          <Card className="bg-green-50 border-green-200">
            <CardHeader>
              <CardTitle className="text-green-800 flex items-center">
                <CheckCircle className="w-5 h-5 mr-2" />
                Resolved ({getIncidentsByStatus('resolved').length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {getIncidentsByStatus('resolved').map((incident) => {
                const assignedGuard = guards.find(g => g.id === incident.assignedTo);
                return (
                  <Card 
                    key={incident.id}
                    className="bg-white border-green-200"
                    data-testid={`incident-card-${incident.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center">
                          {getCategoryIcon(incident.category)}
                          <span className="ml-2 font-medium text-sm capitalize">
                            {incident.category.replace('-', ' ')}
                          </span>
                        </div>
                        <Badge className="bg-green-100 text-green-800">
                          Resolved
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-700 mb-2 line-clamp-2">
                        {incident.description}
                      </p>
                      {assignedGuard && (
                        <div className="flex items-center text-xs text-green-600 mb-1">
                          <User className="w-3 h-3 mr-1" />
                          Resolved by: {assignedGuard.name}
                        </div>
                      )}
                      {incident.resolvedAt && (
                        <div className="flex items-center text-xs text-gray-500">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          {formatTimeAgo(incident.resolvedAt)}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Summary Stats */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Incident Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {getIncidentsByStatus('open').length}
                </div>
                <div className="text-sm text-gray-600">Open</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-600">
                  {getIncidentsByStatus('in-progress').length}
                </div>
                <div className="text-sm text-gray-600">In Progress</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {getIncidentsByStatus('resolved').length}
                </div>
                <div className="text-sm text-gray-600">Resolved</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {incidents.length}
                </div>
                <div className="text-sm text-gray-600">Total</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
