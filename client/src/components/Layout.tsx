import { ReactNode } from 'react';
import { useAuthStore } from '../store/auth';
import RoleSelector from './RoleSelector';

interface LayoutProps {
  children: ReactNode;
  showRoleSelector?: boolean;
}

export default function Layout({ children, showRoleSelector = true }: LayoutProps) {
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {showRoleSelector && user && <RoleSelector />}
      <main className={showRoleSelector ? 'pt-16' : ''}>
        {children}
      </main>
    </div>
  );
}
