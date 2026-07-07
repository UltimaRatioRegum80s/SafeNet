import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { useToast } from '../../hooks/use-toast';
import { FileText, Download, CheckCircle, MapPin, AlertTriangle, Clock } from 'lucide-react';

export default function ClientReports() {
  const { toast } = useToast();
  const [dateFrom, setDateFrom] = useState('2024-01-01');
  const [dateTo, setDateTo] = useState('2024-01-31');
  const [selectedSite, setSelectedSite] = useState('downtown-plaza');

  // Mock data - would be fetched from Firestore
  const reportData = {
    compliance: 94.2,
    checkins: 1247,
    incidents: 23,
    responseTime: '4.2m'
  };

  const patrolData = [
    {
      id: '1',
      guard: 'S. Chen',
      location: 'Main Entrance',
      time: '14:23',
      method: 'QR'
    },
    {
      id: '2',
      guard: 'M. Johnson',
      location: 'Parking Level 2',
      time: '14:15',
      method: 'GPS'
    },
    {
      id: '3',
      guard: 'R. Williams',
      location: 'Building A Lobby',
      time: '14:08',
      method: 'QR'
    }
  ];

  const incidentData = [
    {
      id: '1',
      type: 'Suspicious Activity',
      severity: 'High',
      status: 'Resolved',
      date: 'Jan 15'
    },
    {
      id: '2',
      type: 'Equipment Issue',
      severity: 'Medium',
      status: 'In Progress',
      date: 'Jan 14'
    },
    {
      id: '3',
      type: 'Medical Emergency',
      severity: 'Critical',
      status: 'Resolved',
      date: 'Jan 12'
    }
  ];

  const handleGenerateReport = () => {
    toast({
      title: "PDF Report Generated",
      description: "Your security report is being generated and will be downloaded shortly.",
    });
    
    // Mock PDF generation
    setTimeout(() => {
      const link = document.createElement('a');
      link.href = '#';
      link.download = `security-report-${dateFrom}-to-${dateTo}.pdf`;
      link.click();
    }, 2000);
  };

  const handleExportCSV = () => {
    toast({
      title: "CSV Export Started",
      description: "Your data is being exported to CSV format.",
    });
    
    // Mock CSV export
    setTimeout(() => {
      const csvContent = [
        ['Date', 'Guard', 'Location', 'Method', 'Status'],
        ...patrolData.map(item => [
          new Date().toLocaleDateString(),
          item.guard,
          item.location,
          item.method,
          'Completed'
        ])
      ].map(row => row.join(',')).join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `patrol-data-${dateFrom}-to-${dateTo}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    }, 1000);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'low':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-amber-100 text-amber-800';
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'critical':
        return 'bg-red-200 text-red-900';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'in progress':
        return 'bg-amber-100 text-amber-800';
      case 'open':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getMethodColor = (method: string) => {
    switch (method.toLowerCase()) {
      case 'qr':
        return 'bg-primary/10 text-primary';
      case 'gps':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Reports Header */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Security Reports Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Date Range</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-40"
                      data-testid="date-from"
                    />
                    <span className="text-gray-500">to</span>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-40"
                      data-testid="date-to"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Site</Label>
                  <Select value={selectedSite} onValueChange={setSelectedSite}>
                    <SelectTrigger className="w-48 mt-1" data-testid="site-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sites</SelectItem>
                      <SelectItem value="downtown-plaza">Downtown Plaza</SelectItem>
                      <SelectItem value="west-gate">West Gate Complex</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex space-x-3">
                <Button 
                  onClick={handleGenerateReport}
                  className="bg-primary hover:bg-primary/90"
                  data-testid="export-pdf"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Export PDF
                </Button>
                <Button 
                  onClick={handleExportCSV}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="export-csv"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="bg-green-100 rounded-lg p-3">
                  <CheckCircle className="text-green-600 text-xl" />
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-600">Patrol Compliance</h3>
                  <p className="text-2xl font-bold text-green-600" data-testid="kpi-compliance">
                    {reportData.compliance}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="bg-primary/10 rounded-lg p-3">
                  <MapPin className="text-primary text-xl" />
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-600">Total Check-ins</h3>
                  <p className="text-2xl font-bold text-primary" data-testid="kpi-checkins">
                    {reportData.checkins.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="bg-amber-100 rounded-lg p-3">
                  <AlertTriangle className="text-amber-600 text-xl" />
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-600">Incidents Logged</h3>
                  <p className="text-2xl font-bold text-amber-600" data-testid="kpi-incidents">
                    {reportData.incidents}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="bg-blue-100 rounded-lg p-3">
                  <Clock className="text-blue-600 text-xl" />
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-600">Avg Response Time</h3>
                  <p className="text-2xl font-bold text-blue-600" data-testid="kpi-response-time">
                    {reportData.responseTime}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Reports Tables */}
        <div className="grid grid-cols-2 gap-6">
          {/* Patrol Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Patrol Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Guard
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Location
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Method
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {patrolData.map((patrol) => (
                      <tr key={patrol.id} data-testid={`patrol-row-${patrol.id}`}>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {patrol.guard}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {patrol.location}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {patrol.time}
                        </td>
                        <td className="px-6 py-4">
                          <Badge 
                            className={getMethodColor(patrol.method)}
                            data-testid={`method-badge-${patrol.id}`}
                          >
                            {patrol.method}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Incident Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Incident Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Severity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {incidentData.map((incident) => (
                      <tr key={incident.id} data-testid={`incident-row-${incident.id}`}>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {incident.type}
                        </td>
                        <td className="px-6 py-4">
                          <Badge 
                            className={getSeverityColor(incident.severity)}
                            data-testid={`severity-badge-${incident.id}`}
                          >
                            {incident.severity}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <Badge 
                            className={getStatusColor(incident.status)}
                            data-testid={`status-badge-${incident.id}`}
                          >
                            {incident.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {incident.date}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
