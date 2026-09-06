import { Link, useLocation } from 'wouter';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  Home, 
  MessageSquare, 
  MapPin, 
  PlusCircle, 
  Bell, 
  Menu,
  Shield,
  Search,
  LogOut,
  BarChart3
} from 'lucide-react';
import nabornetLogoLight from '@assets/Logo_1755373407688.png';
import nabornetLogoDark from '@assets/Logo dark mode_1755373493360.png';
import NotificationBell from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { useAuthStore } from '../store/auth';
import { logout as endSession } from '@/lib/auth';

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export default function Header({ title = "NaborNet", subtitle }: HeaderProps) {
  const [location] = useLocation();
  const { user, logout: clearAuth } = useAuthStore();

  // This button used to clear the client store only: the session cookie stayed
  // valid, so a reload signed the same person straight back in, and their
  // cached requests and notes were still in memory for whoever used the device
  // next. It now goes through the shared sign-out path.
  const handleLogout = async () => {
    await endSession();
    clearAuth();
    window.location.href = '/';
  };

  const navItems = [
    { href: '/', icon: Home, label: 'Dashboard', active: location === '/' || location === '/community' },
    { href: '/community/report', icon: PlusCircle, label: 'Report', active: location === '/community/report' },
    { href: '/community/map', icon: MapPin, label: 'Map', active: location === '/community/map' },
    { href: '/community/feed', icon: MessageSquare, label: 'Feed', active: location === '/community/feed' },
    { href: '/community/statistics', icon: BarChart3, label: 'Stats', active: location === '/community/statistics' },
  ];

  return (
    <div className="border-b bg-background dark:bg-background">
      {/* Top Header */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3 ml-[18px] mr-[18px]">
            <img 
              src={nabornetLogoLight} 
              alt="NaborNet" 
              className="w-10 h-10 object-contain dark:hidden"
              data-testid="logo-light"
            />
            <img 
              src={nabornetLogoDark} 
              alt="NaborNet" 
              className="w-10 h-10 object-contain hidden dark:block"
              data-testid="logo-dark"
            />
            <div>
              <h1 className="text-xl font-bold text-foreground dark:text-foreground" data-testid="header-title">
                {title}
              </h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground dark:text-muted-foreground" data-testid="header-subtitle">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground mt-[8px] mb-[8px] pt-[0px] pb-[0px] pl-[37px] pr-[37px] ml-[-10px] mr-[-10px]"
              data-testid="logout-button"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden lg:inline">Logout</span>
            </Button>
            <Button variant="ghost" size="sm" data-testid="search-button">
              <Search className="w-4 h-4" />
            </Button>
            <NotificationBell />
            <ThemeToggle />
            <Button variant="ghost" size="sm" data-testid="menu-button">
              <Menu className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
      {/* Navigation */}
      <div className="px-4 border-t bg-muted dark:bg-muted">
        <div className="max-w-6xl mx-auto">
          <nav className="flex items-center justify-between py-2 relative">
            {/* Dashboard button on the left */}
            <div>
              <Link href={navItems[0].href}>
                <Button
                  variant={navItems[0].active ? "default" : "ghost"}
                  size="sm"
                  className="flex items-center gap-2 ml-[18px] mr-[18px]"
                  data-testid={`nav-${navItems[0].label.toLowerCase()}`}
                >
                  <Home className="w-4 h-4" />
                  <span className="hidden sm:inline">{navItems[0].label}</span>
                </Button>
              </Link>
            </div>

            {/* Centered navigation buttons (Report, Map, Feed) */}
            <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center space-x-4">
              {navItems.slice(1).map((item) => { // Skip Dashboard, show Report, Map, Feed
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={item.active ? "default" : "ghost"}
                      size="sm"
                      className="flex items-center gap-2"
                      data-testid={`nav-${item.label.toLowerCase()}`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="hidden sm:inline">{item.label}</span>
                    </Button>
                  </Link>
                );
              })}
            </div>
            
            {/* Welcome Message */}
            <div className="hidden md:flex items-center gap-3">
              <div className="text-right">
                <h3 className="font-semibold text-foreground dark:text-foreground ml-[-73px] mr-[-73px] text-[12px] text-center">
                  Welcome to {user && user.neighbourhood ? `${user.neighbourhood}, ${user.city}` : user ? `${user.city} Community` : 'Your Community'}
                </h3>
                <p className="text-xs text-muted-foreground dark:text-muted-foreground">Stay informed, connect , and help keep our community secure.</p>
              </div>
              <Shield className="w-6 h-6 text-orange-500" />
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}