export type UserRole = 'resident' | 'moderator' | 'admin';

export interface User {
  uid: string;
  neighborhoodId: string;
  roles: UserRole[];
  name: string;
  email: string;
  phone?: string;
  address?: string;
  verified: boolean;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}

export interface Neighborhood {
  id: string;
  name: string;
  description: string;
  boundary: { lat: number; lng: number }[];
  moderators: string[];
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommunityPost {
  id: string;
  neighborhoodId: string;
  authorId: string;
  authorName: string;
  type: 'safety' | 'lost_found' | 'recommendation' | 'general' | 'crime_report';
  title: string;
  content: string;
  photos: string[];
  location?: { lat: number; lng: number; address?: string };
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tags: string[];
  likes: number;
  comments: number;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrimeReport {
  id: string;
  neighborhoodId: string;
  reporterId?: string;
  category: 'theft' | 'vandalism' | 'suspicious_activity' | 'assault' | 'burglary' | 'vehicle_crime' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location: { lat: number; lng: number; address?: string };
  timeOfIncident: Date;
  photos: string[];
  anonymous: boolean;
  policeReported: boolean;
  caseNumber?: string;
  status: 'reported' | 'investigating' | 'resolved' | 'closed';
  createdAt: Date;
  updatedAt: Date;
}

export interface SafetyAlert {
  id: string;
  neighborhoodId: string;
  authorId: string;
  authorName: string;
  type: 'emergency' | 'warning' | 'advisory' | 'weather' | 'traffic';
  title: string;
  description: string;
  location?: { lat: number; lng: number; address?: string };
  radius: number; // in meters
  expiresAt?: Date;
  acknowledged: string[]; // user IDs who acknowledged
  createdAt: Date;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  content: string;
  parentId?: string; // for replies
  likes: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MapMarker {
  id: string;
  type: 'crime' | 'safety_alert' | 'community_post' | 'lost_found';
  position: { lat: number; lng: number };
  title: string;
  description: string;
  category?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  timeAgo: string;
  data: CrimeReport | SafetyAlert | CommunityPost;
}

export interface NeighborhoodStats {
  totalMembers: number;
  activePosts: number;
  crimeReports: number;
  safetyAlerts: number;
  weeklyActivity: number;
  crimeByCategory: { [key: string]: number };
  trendingTopics: string[];
}