import { useUserStore } from '../store/user';
import { useAuthStore } from '../store/auth';
import { UserRole } from '../types';
import { Shield, Bus, BarChart3, Settings } from 'lucide-react';

const roleConfig: Record<UserRole, { icon: any, label: string }> = {
  guard: { icon: Shield, label: 'Guard View' },
  supervisor: { icon: Bus, label: 'Supervisor Dashboard' },
  client: { icon: BarChart3, label: 'Client Reports' },
  admin: { icon: Settings, label: 'Admin Panel' },
  resident: { icon: Shield, label: 'Community Member' },
  moderator: { icon: Settings, label: 'Moderator' },
};

export default function RoleSelector() {
  const { user } = useAuthStore();
  const { currentRole, setCurrentRole } = useUserStore();

  if (!user) return null;

  const handleRoleChange = (role: UserRole) => {
    setCurrentRole(role);
  };

  return (
    <div className="fixed top-0 left-0 right-0 bg-white shadow-sm z-50 border-b">
      <div className="flex overflow-x-auto">
        {user.roles.map((role) => {
          const config = roleConfig[role as UserRole];
          if (!config) return null;
          const { icon: Icon, label } = config;
          const isActive = currentRole === role;
          
          return (
            <button
              key={role}
              onClick={() => handleRoleChange(role as UserRole)}
              className={`px-6 py-3 text-sm font-medium border-b-2 flex items-center space-x-2 ${
                isActive
                  ? 'border-primary text-primary bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              data-testid={`role-tab-${role}`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
