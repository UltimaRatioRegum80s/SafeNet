import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { useAuthStore } from '../../store/auth';
import { Building, UserPlus, MapPin, Settings, Users, BarChart3 } from 'lucide-react';

export default function AdminPanel() {
  const [, setLocation] = useLocation();
  const { user } = useAuthStore();

  // Mock data - would be fetched from Firestore
  const stats = {
    totalTenants: 12,
    totalUsers: 84,
    activeSites: 28,
    totalIncidents: 156
  };

  const recentTenants = [
    {
      id: '1',
      name: 'Downtown Security Corp',
      plan: 'Professional',
      users: 12,
      status: 'active',
      createdAt: new Date('2023-12-15')
    },
    {
      id: '2',
      name: 'Metro Property Management',
      plan: 'Basic',
      users: 6,
      status: 'active',
      createdAt: new Date('2024-01-08')
    },
    {
      id: '3',
      name: 'Citywide Security Solutions',
      plan: 'Enterprise',
      users: 24,
      status: 'active',
      createdAt: new Date('2024-01-12')
    }
  ];

  const recentUsers = [
    {
      id: '1',
      email: 'sarah.chen@downtown-security.com',
      role: 'guard',
      tenant: 'Downtown Security Corp',
      status: 'active',
      invitedAt: new Date('2024-01-15')
    },
    {
      id: '2',
      email: 'mike.johnson@metro-property.com',
      role: 'supervisor',
      tenant: 'Metro Property Management',
      status: 'pending',
      invitedAt: new Date('2024-01-14')
    }
  ];

  const handleNavigate = (path: string) => {
    setLocation(path);
  };

  const getPlanColor = (plan: string) => {
    switch (plan.toLowerCase()) {
      case 'basic':
        return 'bg-gray-100 text-gray-800';
      case 'professional':
        return 'bg-blue-100 text-blue-800';
      case 'enterprise':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-amber-100 text-amber-800';
      case 'inactive':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      case 'supervisor':
        return 'bg-blue-100 text-blue-800';
      case 'guard':
        return 'bg-green-100 text-green-800';
      case 'client':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center">
            <Settings className="w-6 h-6 mr-2 text-primary" />
            Admin Panel
          </h1>
          <p className="text-gray-600 mt-1">Manage tenants, users, and system configuration</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="bg-primary/10 rounded-lg p-3">
                  <Building className="text-primary text-xl" />
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-600">Total Tenants</h3>
                  <p className="text-2xl font-bold text-primary" data-testid="total-tenants">
                    {stats.totalTenants}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="bg-green-100 rounded-lg p-3">
                  <Users className="text-green-600 text-xl" />
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-600">Total Users</h3>
                  <p className="text-2xl font-bold text-green-600" data-testid="total-users">
                    {stats.totalUsers}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="bg-blue-100 rounded-lg p-3">
                  <MapPin className="text-blue-600 text-xl" />
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-600">Active Sites</h3>
                  <p className="text-2xl font-bold text-blue-600" data-testid="active-sites">
                    {stats.activeSites}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="bg-amber-100 rounded-lg p-3">
                  <BarChart3 className="text-amber-600 text-xl" />
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-600">Total Incidents</h3>
                  <p className="text-2xl font-bold text-amber-600" data-testid="total-incidents">
                    {stats.totalIncidents}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Button
            className="h-24 flex-col space-y-2 bg-primary hover:bg-primary/90"
            onClick={() => handleNavigate('/admin/tenants')}
            data-testid="create-tenant-button"
          >
            <Building className="text-2xl" />
            <div>
              <div className="font-semibold">Create Tenant</div>
              <div className="text-sm text-primary-foreground/80">Add new organization</div>
            </div>
          </Button>

          <Button
            className="h-24 flex-col space-y-2 bg-green-600 hover:bg-green-700"
            onClick={() => handleNavigate('/admin/users')}
            data-testid="invite-user-button"
          >
            <UserPlus className="text-2xl" />
            <div>
              <div className="font-semibold">Invite User</div>
              <div className="text-sm text-green-100">Send email invitation</div>
            </div>
          </Button>

          <Button
            className="h-24 flex-col space-y-2 bg-amber-600 hover:bg-amber-700"
            onClick={() => handleNavigate('/supervisor/sites')}
            data-testid="manage-sites-button"
          >
            <MapPin className="text-2xl" />
            <div>
              <div className="font-semibold">Manage Sites</div>
              <div className="text-sm text-amber-100">Configure locations</div>
            </div>
          </Button>

          <Button
            className="h-24 flex-col space-y-2 bg-purple-600 hover:bg-purple-700"
            onClick={() => console.log('System settings')}
            data-testid="system-settings-button"
          >
            <Settings className="text-2xl" />
            <div>
              <div className="font-semibold">System Settings</div>
              <div className="text-sm text-purple-100">Configure features</div>
            </div>
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Tenants */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Tenants</CardTitle>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleNavigate('/admin/tenants')}
                  data-testid="view-all-tenants"
                >
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentTenants.map((tenant) => (
                <div 
                  key={tenant.id} 
                  className="border border-gray-200 rounded-lg p-4"
                  data-testid={`tenant-card-${tenant.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{tenant.name}</h3>
                      <p className="text-sm text-gray-600">
                        Users: {tenant.users} • Created: {tenant.createdAt.toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getPlanColor(tenant.plan)}>
                        {tenant.plan}
                      </Badge>
                      <Badge className={getStatusColor(tenant.status)}>
                        {tenant.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent User Invitations */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent User Invitations</CardTitle>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleNavigate('/admin/users')}
                  data-testid="view-all-users"
                >
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentUsers.map((user) => (
                <div 
                  key={user.id} 
                  className="border border-gray-200 rounded-lg p-4"
                  data-testid={`user-card-${user.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{user.email}</h3>
                      <p className="text-sm text-gray-600">
                        {user.tenant} • Invited: {user.invitedAt.toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getRoleColor(user.role)}>
                        {user.role}
                      </Badge>
                      <Badge className={getStatusColor(user.status)}>
                        {user.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* System Health */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-lg font-semibold text-green-600">99.9%</div>
                <div className="text-sm text-gray-600">Uptime</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-600">45ms</div>
                <div className="text-sm text-gray-600">Avg Response Time</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-primary">1.2TB</div>
                <div className="text-sm text-gray-600">Storage Used</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
