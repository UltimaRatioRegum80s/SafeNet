interface NaborNetLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export default function NaborNetLogo({ className = "", size = 'md', showText = true }: NaborNetLogoProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-xl',
    xl: 'text-2xl'
  };

  return (
    <div className={`flex items-center space-x-3 ${className}`} data-testid="nabornet-logo">
      {/* Logo Circle */}
      <div className={`${sizeClasses[size]} relative`}>
        <svg viewBox="0 0 200 200" className="w-full h-full">
          {/* Circle background with gradient */}
          <defs>
            <linearGradient id="nabornetGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(217, 91%, 60%)" />
              <stop offset="100%" stopColor="hsl(217, 91%, 40%)" />
            </linearGradient>
          </defs>
          
          <circle 
            cx="100" 
            cy="100" 
            r="90" 
            fill="url(#nabornetGradient)"
            stroke="hsl(217, 91%, 30%)"
            strokeWidth="4"
          />
          
          {/* Network/Community icon - interconnected houses */}
          <g fill="white">
            {/* House 1 */}
            <path d="M60 80 L80 60 L100 80 L100 120 L60 120 Z" />
            <rect x="70" y="90" width="8" height="8" fill="hsl(217, 91%, 50%)" />
            <rect x="82" y="90" width="8" height="8" fill="hsl(217, 91%, 50%)" />
            <rect x="76" y="105" width="8" height="15" fill="hsl(217, 91%, 50%)" />
            
            {/* House 2 */}
            <path d="M100 80 L120 60 L140 80 L140 120 L100 120 Z" />
            <rect x="110" y="90" width="8" height="8" fill="hsl(217, 91%, 50%)" />
            <rect x="122" y="90" width="8" height="8" fill="hsl(217, 91%, 50%)" />
            <rect x="116" y="105" width="8" height="15" fill="hsl(217, 91%, 50%)" />
            
            {/* House 3 */}
            <path d="M80 130 L100 110 L120 130 L120 170 L80 170 Z" />
            <rect x="90" y="140" width="8" height="8" fill="hsl(217, 91%, 50%)" />
            <rect x="102" y="140" width="8" height="8" fill="hsl(217, 91%, 50%)" />
            <rect x="96" y="155" width="8" height="15" fill="hsl(217, 91%, 50%)" />
            
            {/* Connection lines between houses */}
            <line x1="80" y1="100" x2="100" y2="100" stroke="white" strokeWidth="3" />
            <line x1="120" y1="100" x2="140" y2="100" stroke="white" strokeWidth="3" />
            <line x1="90" y1="120" x2="90" y2="130" stroke="white" strokeWidth="3" />
            <line x1="110" y1="120" x2="110" y2="130" stroke="white" strokeWidth="3" />
          </g>
        </svg>
      </div>
      
      {/* Company name */}
      {showText && (
        <div className={`font-bold ${textSizeClasses[size]}`}>
          <div className="text-blue-600 dark:text-blue-400">NABOR</div>
          <div className="text-blue-600 dark:text-blue-400 -mt-1">NET</div>
        </div>
      )}
    </div>
  );
}