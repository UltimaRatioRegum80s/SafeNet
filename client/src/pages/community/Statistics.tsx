import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import Header from '../../components/Header';
import { 
  Users, 
  AlertTriangle, 
  TrendingUp,
  Bell,
  MessageSquare,
  Shield,
  CheckCircle
} from 'lucide-react';

interface NeighborhoodStats {
  totalMembers: number;
  activeThisWeek: number;
  incidentReports: number;
  safetyScore: number;
  recentActivity: Array<{
    id: string;
    type: 'post' | 'report' | 'alert';
    title: string;
    author: string;
    timeAgo: string;
    priority?: 'low' | 'medium' | 'high';
  }>;
}

export default function Statistics() {
  const [stats, setStats] = useState<NeighborhoodStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock neighborhood data
    const mockStats: NeighborhoodStats = {
      totalMembers: 1247,
      activeThisWeek: 89,
      incidentReports: 3,
      safetyScore: 94,
      recentActivity: [
        {
          id: '1',
          type: 'report',
          title: 'Suspicious Activity Near Elementary School',
          author: 'Sarah Chen',
          timeAgo: '2 hours ago',
          priority: 'high'
        },
        {
          id: '2',
          type: 'post',
          title: 'Lost Dog - Golden Retriever',
          author: 'Mike Rodriguez',
          timeAgo: '4 hours ago',
          priority: 'medium'
        },
        {
          id: '3',
          type: 'alert',
          title: 'Neighborhood Watch Meeting Saturday',
          author: 'Community Moderator',
          timeAgo: '1 day ago',
          priority: 'low'
        },
        {
          id: '4',
          type: 'report',
          title: 'Package Theft on Elm Street',
          author: 'Anonymous',
          timeAgo: '2 days ago',
          priority: 'medium'
        },
        {
          id: '5',
          type: 'post',
          title: 'Recommendation: Local Contractor',
          author: 'Lisa Park',
          timeAgo: '3 days ago',
          priority: 'low'
        }
      ]
    };
    
    const timeoutId = setTimeout(() => {
      setStats(mockStats);
      setLoading(false);
    }, 1000);
    
    // Cleanup timeout on unmount
    return () => clearTimeout(timeoutId);
  }, []);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'report': return <AlertTriangle className="w-4 h-4 text-blue-700" />;
      case 'alert': return <Bell className="w-4 h-4 text-cyan-600" />;
      default: return <MessageSquare className="w-4 h-4 text-blue-600" />;
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100';
      case 'medium': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100';
      case 'low': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background dark:bg-background">
        <Header title="Community Statistics" />
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background dark:bg-background">
      <Header title="Community Statistics" />
      <div className="max-w-6xl mx-auto px-4 py-6">
        
        {/* Main Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-card dark:bg-card border-border dark:border-border">
            <CardContent className="p-6 text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-primary" />
              <div className="text-3xl font-bold text-primary mb-2" data-testid="total-members">
                {stats?.totalMembers.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">Total Members</div>
            </CardContent>
          </Card>
          
          <Card className="bg-card dark:bg-card border-border dark:border-border">
            <CardContent className="p-6 text-center">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 text-primary" />
              <div className="text-3xl font-bold text-primary mb-2" data-testid="active-members">
                {stats?.activeThisWeek}
              </div>
              <div className="text-sm text-muted-foreground">Active This Week</div>
            </CardContent>
          </Card>
          
          <Card className="bg-card dark:bg-card border-border dark:border-border">
            <CardContent className="p-6 text-center">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-primary" />
              <div className="text-3xl font-bold text-primary mb-2" data-testid="incident-reports">
                {stats?.incidentReports}
              </div>
              <div className="text-sm text-muted-foreground">Open Reports</div>
            </CardContent>
          </Card>

          <Card className="bg-card dark:bg-card border-border dark:border-border">
            <CardContent className="p-6 text-center">
              <Shield className="w-12 h-12 mx-auto mb-4 text-primary" />
              <div className="text-3xl font-bold text-primary mb-2">
                {stats?.safetyScore}%
              </div>
              <div className="text-sm text-muted-foreground">Safety Score</div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="bg-card dark:bg-card border-border dark:border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground dark:text-foreground">
              <MessageSquare className="w-5 h-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats?.recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 p-3 bg-muted/50 dark:bg-muted/50 rounded-lg">
                {getActivityIcon(activity.type)}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-foreground dark:text-foreground truncate">
                    {activity.title}
                  </h4>
                  <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                    by {activity.author} • {activity.timeAgo}
                  </p>
                </div>
                {activity.priority && (
                  <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(activity.priority)}`}>
                    {activity.priority}
                  </span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}