import { Badge } from './ui/badge';
import { Shield, Users, Truck, Flame, Heart, HelpCircle } from 'lucide-react';

interface VerifiedBadgeProps {
  type: 'police' | 'municipal' | 'security' | 'fire' | 'medical' | 'ngo';
  badge?: string;
  size?: 'sm' | 'md' | 'lg';
}

const badgeIcons = {
  police: Shield,
  municipal: Truck,
  security: Users,
  fire: Flame,
  medical: Heart,
  ngo: HelpCircle,
};

const badgeColors = {
  police: 'bg-blue-100 text-blue-800 border-blue-200',
  municipal: 'bg-green-100 text-green-800 border-green-200',
  security: 'bg-purple-100 text-purple-800 border-purple-200',
  fire: 'bg-red-100 text-red-800 border-red-200',
  medical: 'bg-pink-100 text-pink-800 border-pink-200',
  ngo: 'bg-orange-100 text-orange-800 border-orange-200',
};

export default function VerifiedBadge({ type, badge, size = 'md' }: VerifiedBadgeProps) {
  const Icon = badgeIcons[type];
  const colorClass = badgeColors[type];
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <Badge 
      variant="outline" 
      className={`inline-flex items-center gap-1 ${colorClass} ${sizeClasses[size]} border font-medium`}
      data-testid={`verified-badge-${type}`}
    >
      <Icon className={iconSizes[size]} />
      {badge || type.charAt(0).toUpperCase() + type.slice(1)}
    </Badge>
  );
}