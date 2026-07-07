export const RoutePaths = {
  Home: "/",
  Map: "/community/map",
  Report: "/community/report",
  ReportFull: "/community/report-full", 
  Feed: "/community/feed",
  Dashboard: "/community/dashboard",
  Community: "/community",
  Phase2: "/community/phase2",
  Notifications: "/community/notifications",
  ModerationQueue: "/admin/moderation",
  Login: "/login",
  Signup: "/signup",
} as const;

export type RouteKey = keyof typeof RoutePaths;