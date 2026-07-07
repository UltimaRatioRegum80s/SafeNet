import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useToast } from '../../hooks/use-toast';
import { Mail, UserPlus, Send, Clock, CheckCircle, X } from 'lucide-react';
import { UserRole } from '../../types';

interface UserInvitation {
  id: string;
  email: string;
  role: UserRole;
  tenantId: string;
  tenantName: string;
  status: 'pending' | 'accepted' | 'expired';
  invitedAt: Date;
  expiresAt: Date;
}

export default function UserInvitation() {
  const { toast } = useToast();
  const [invitations, setInvitations] = useState<UserInvitation[]>([]);
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('resident');
  const [selectedTenant, setSelectedTenant] = useState('');
  const [loading, setLoading] = useState(false);

  // Mock data
  const tenants = [
    { id: '1', name: 'Downtown Security Corp' },
    { id: '2', name: 'Metro Property Management' },
    { id: '3', name: 'Citywide Security Solutions' },
    { id: '4', name: 'Harbor Point Properties' }
  ];

  const mockInvitations: UserInvitation[] = [
    {
      id: '1',
      email: 'sarah.chen@downtown-security.com',
      role: 'guard',
      tenantId: '1',
      tenantName: 'Downtown Security Corp',
      status: 'accepted',
      invitedAt: new Date('2024-01-15'),
      expiresAt: new Date('2024-01-22')
    },
    {
      id: '2',
      email: 'mike.johnson@metro-property.com',
      role: 'supervisor',
      tenantId: '2',
      tenantName: 'Metro Property Management',
      status: 'pending',
      invitedAt: new Date('2024-01-14'),
      expiresAt: new Date('2024-01-21')
    },
    {
      id: '3',
      email: 'alex.williams@citywide-security.com',
      role: 'client',
      tenantId: '3',
      tenantName: 'Citywide Security Solutions',
      status: 'pending',
      invitedAt: new Date('2024-01-13'),
      expiresAt: new Date('2024-01-20')
    },
    {
      id: '4',
      email: 'jennifer.davis@harbor-point.com',
      role: 'admin',
      tenantId: '4',
      tenantName: 'Harbor Point Properties',
      status: 'expired',
      invitedAt: new Date('2024-01-10'),
      expiresAt: new Date('2024-01-17')
    }
  ];

  useState(() => {
    setInvitations(mockInvitations);
  });

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !selectedRole || !selectedTenant) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const tenant = tenants.find(t => t.id === selectedTenant);
      const newInvitation: UserInvitation = {
        id: `inv${Date.now()}`,
        email,
        role: selectedRole,
        tenantId: selectedTenant,
        tenantName: tenant?.name || '',
        status: 'pending',
        invitedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      };

      setInvitations(prev => [newInvitation, ...prev]);

      // Reset form
      setEmail('');
      setSelectedRole('guard');
      setSelectedTenant('');

      toast({
        title: "Invitation Sent",
        description: `Invitation sent to ${email} successfully.`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to Send Invitation",
        description: error.message || "An error occurred while sending the invitation.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendInvitation = (invitationId: string) => {
    setInvitations(prev => prev.map(inv => 
      inv.id === invitationId 
        ? { 
            ...inv, 
            status: 'pending', 
            invitedAt: new Date(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          }
        : inv
    ));

    toast({
      title: "Invitation Resent",
      description: "The invitation has been resent successfully.",
    });
  };

  const handleCancelInvitation = (invitationId: string) => {
    setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
    
    toast({
      title: "Invitation Cancelled",
      description: "The invitation has been cancelled.",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-100 text-amber-800';
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'expired':
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'accepted':
        return <CheckCircle className="w-4 h-4" />;
      case 'expired':
        return <X className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const formatTimeRemaining = (expiresAt: Date) => {
    const now = new Date();
    const diffMs = expiresAt.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) {
      return 'Expired';
    } else if (diffDays === 1) {
      return '1 day remaining';
    } else {
      return `${diffDays} days remaining`;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center">
            <UserPlus className="w-6 h-6 mr-2 text-primary" />
            User Invitation Management
          </h1>
          <p className="text-gray-600 mt-1">Invite users and manage pending invitations</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Invitation Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Mail className="w-5 h-5 mr-2" />
                Send New Invitation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendInvitation} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    data-testid="invitation-email-input"
                  />
                </div>

                <div>
                  <Label htmlFor="role">Role *</Label>
                  <Select value={selectedRole} onValueChange={(value: UserRole) => setSelectedRole(value)}>
                    <SelectTrigger data-testid="invitation-role-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="guard">Guard</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="tenant">Tenant *</Label>
                  <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                    <SelectTrigger data-testid="invitation-tenant-select">
                      <SelectValue placeholder="Select tenant" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading}
                  data-testid="send-invitation-button"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Invitation
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Invitations List */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent Invitations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {invitations.map((invitation) => (
                  <Card 
                    key={invitation.id} 
                    className="border-gray-200"
                    data-testid={`invitation-card-${invitation.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium">{invitation.email}</h3>
                            <Badge className={getRoleColor(invitation.role)}>
                              {invitation.role}
                            </Badge>
                            <Badge className={getStatusColor(invitation.status)}>
                              <div className="flex items-center">
                                {getStatusIcon(invitation.status)}
                                <span className="ml-1">{invitation.status}</span>
                              </div>
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-1">
                            Tenant: {invitation.tenantName}
                          </p>
                          <p className="text-sm text-gray-500">
                            Invited: {invitation.invitedAt.toLocaleDateString()}
                          </p>
                          {invitation.status === 'pending' && (
                            <p className="text-sm text-amber-600">
                              {formatTimeRemaining(invitation.expiresAt)}
                            </p>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          {invitation.status === 'pending' && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleResendInvitation(invitation.id)}
                              data-testid={`resend-invitation-${invitation.id}`}
                            >
                              <Send className="w-3 h-3 mr-1" />
                              Resend
                            </Button>
                          )}
                          {invitation.status === 'expired' && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleResendInvitation(invitation.id)}
                              data-testid={`resend-invitation-${invitation.id}`}
                            >
                              <Send className="w-3 h-3 mr-1" />
                              Resend
                            </Button>
                          )}
                          {invitation.status !== 'accepted' && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleCancelInvitation(invitation.id)}
                              data-testid={`cancel-invitation-${invitation.id}`}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {invitations.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <Mail className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p>No invitations sent yet</p>
                    <p className="text-sm">Send your first invitation using the form on the left</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Stats */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Invitation Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{invitations.length}</div>
                <div className="text-sm text-gray-600">Total Invitations</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-600">
                  {invitations.filter(inv => inv.status === 'pending').length}
                </div>
                <div className="text-sm text-gray-600">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {invitations.filter(inv => inv.status === 'accepted').length}
                </div>
                <div className="text-sm text-gray-600">Accepted</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {invitations.filter(inv => inv.status === 'expired').length}
                </div>
                <div className="text-sm text-gray-600">Expired</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
