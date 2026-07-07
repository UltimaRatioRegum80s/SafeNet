import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { useToast } from '../../hooks/use-toast';
import { Building, Plus, Edit, Trash2, Users } from 'lucide-react';
import { Tenant } from '../../types';

export default function TenantManagement() {
  const { toast } = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [newTenantName, setNewTenantName] = useState('');
  const [newTenantPlan, setNewTenantPlan] = useState<'basic' | 'professional' | 'enterprise'>('basic');

  // Mock data
  const mockTenants: Tenant[] = [
    {
      id: '1',
      name: 'Downtown Security Corp',
      billingPlan: 'professional',
      createdAt: new Date('2023-12-15'),
      updatedAt: new Date()
    },
    {
      id: '2',
      name: 'Metro Property Management',
      billingPlan: 'basic',
      createdAt: new Date('2024-01-08'),
      updatedAt: new Date()
    },
    {
      id: '3',
      name: 'Citywide Security Solutions',
      billingPlan: 'enterprise',
      createdAt: new Date('2024-01-12'),
      updatedAt: new Date()
    },
    {
      id: '4',
      name: 'Harbor Point Properties',
      billingPlan: 'professional',
      createdAt: new Date('2024-01-20'),
      updatedAt: new Date()
    }
  ];

  useState(() => {
    setTenants(mockTenants);
  });

  const handleCreateTenant = async () => {
    if (!newTenantName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a tenant name.",
        variant: "destructive",
      });
      return;
    }

    const newTenant: Tenant = {
      id: `tenant${Date.now()}`,
      name: newTenantName,
      billingPlan: newTenantPlan,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    setTenants(prev => [...prev, newTenant]);
    setNewTenantName('');
    setNewTenantPlan('basic');
    setShowCreateDialog(false);

    toast({
      title: "Tenant Created",
      description: `${newTenantName} has been created successfully.`,
    });
  };

  const handleEditTenant = async () => {
    if (!selectedTenant || !newTenantName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid tenant name.",
        variant: "destructive",
      });
      return;
    }

    setTenants(prev => prev.map(tenant => 
      tenant.id === selectedTenant.id 
        ? { 
            ...tenant, 
            name: newTenantName, 
            billingPlan: newTenantPlan,
            updatedAt: new Date() 
          }
        : tenant
    ));

    toast({
      title: "Tenant Updated",
      description: `${newTenantName} has been updated successfully.`,
    });

    setShowEditDialog(false);
    setSelectedTenant(null);
    setNewTenantName('');
    setNewTenantPlan('basic');
  };

  const handleDeleteTenant = (tenantId: string) => {
    const tenant = tenants.find(t => t.id === tenantId);
    if (!tenant) return;

    setTenants(prev => prev.filter(t => t.id !== tenantId));
    
    toast({
      title: "Tenant Deleted",
      description: `${tenant.name} has been deleted.`,
    });
  };

  const openEditDialog = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setNewTenantName(tenant.name);
    setNewTenantPlan(tenant.billingPlan);
    setShowEditDialog(true);
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

  const getPlanPrice = (plan: string) => {
    switch (plan.toLowerCase()) {
      case 'basic':
        return '$29/month';
      case 'professional':
        return '$99/month';
      case 'enterprise':
        return '$299/month';
      default:
        return 'Custom';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center">
              <Building className="w-6 h-6 mr-2 text-primary" />
              Tenant Management
            </h1>
            <p className="text-gray-600 mt-1">Manage organizations and their billing plans</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button data-testid="create-tenant-button">
                <Plus className="w-4 h-4 mr-2" />
                Create Tenant
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Tenant</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="tenant-name">Organization Name</Label>
                  <Input
                    id="tenant-name"
                    placeholder="Enter organization name"
                    value={newTenantName}
                    onChange={(e) => setNewTenantName(e.target.value)}
                    data-testid="tenant-name-input"
                  />
                </div>
                <div>
                  <Label htmlFor="billing-plan">Billing Plan</Label>
                  <Select value={newTenantPlan} onValueChange={(value: any) => setNewTenantPlan(value)}>
                    <SelectTrigger data-testid="billing-plan-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Basic - $29/month</SelectItem>
                      <SelectItem value="professional">Professional - $99/month</SelectItem>
                      <SelectItem value="enterprise">Enterprise - $299/month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreateTenant} className="w-full" data-testid="create-tenant-submit">
                  Create Tenant
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tenants Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tenants.map((tenant) => (
            <Card key={tenant.id} className="hover:shadow-md transition-shadow" data-testid={`tenant-card-${tenant.id}`}>
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{tenant.name}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      Created: {tenant.createdAt.toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex space-x-1">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => openEditDialog(tenant)}
                      data-testid={`edit-tenant-${tenant.id}`}
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleDeleteTenant(tenant.id)}
                      data-testid={`delete-tenant-${tenant.id}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Billing Plan</span>
                    <Badge className={getPlanColor(tenant.billingPlan)}>
                      {tenant.billingPlan}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Price</span>
                    <span className="text-sm font-medium">
                      {getPlanPrice(tenant.billingPlan)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Users</span>
                    <div className="flex items-center text-sm">
                      <Users className="w-4 h-4 mr-1" />
                      {Math.floor(Math.random() * 20) + 5}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Status</span>
                    <Badge className="bg-green-100 text-green-800">
                      Active
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Tenant</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-tenant-name">Organization Name</Label>
                <Input
                  id="edit-tenant-name"
                  placeholder="Enter organization name"
                  value={newTenantName}
                  onChange={(e) => setNewTenantName(e.target.value)}
                  data-testid="edit-tenant-name-input"
                />
              </div>
              <div>
                <Label htmlFor="edit-billing-plan">Billing Plan</Label>
                <Select value={newTenantPlan} onValueChange={(value: any) => setNewTenantPlan(value)}>
                  <SelectTrigger data-testid="edit-billing-plan-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic - $29/month</SelectItem>
                    <SelectItem value="professional">Professional - $99/month</SelectItem>
                    <SelectItem value="enterprise">Enterprise - $299/month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleEditTenant} className="w-full" data-testid="edit-tenant-submit">
                Update Tenant
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Summary Stats */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Tenant Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{tenants.length}</div>
                <div className="text-sm text-gray-600">Total Tenants</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {tenants.filter(t => t.billingPlan === 'basic').length}
                </div>
                <div className="text-sm text-gray-600">Basic Plans</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {tenants.filter(t => t.billingPlan === 'professional').length}
                </div>
                <div className="text-sm text-gray-600">Professional Plans</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {tenants.filter(t => t.billingPlan === 'enterprise').length}
                </div>
                <div className="text-sm text-gray-600">Enterprise Plans</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
