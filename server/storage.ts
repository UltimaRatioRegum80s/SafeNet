import { 
  type User, 
  type InsertUser, 
  type Incident, 
  type InsertIncident, 
  type Report, 
  type InsertReport,
  type Follow,
  type InsertFollow,
  type Notification,
  type ChatMessage,
  type InsertChatMessage,
  type IncidentResponse,
  type ResponseSignal,
  users,
  incidents,
  reports,
  follows,
  notifications,
  chatMessages,
  incidentResponses,
  businesses,
  events,
  drivebyRequests,
  type Business,
  type InsertBusiness,
  type Event,
  type InsertEvent,
  type DrivebyRequest,
  type InsertDrivebyRequest,
  type PushSubscription,
  type InsertPushSubscription,
  pushSubscriptions,
  type AbuseReport,
  type InsertAbuseReport,
  abuse_reports,
  loginAttempts,
  passwordResetTokens,
  incidentComments,
  incidentReviews,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc, asc, or, isNull } from "drizzle-orm";
import { isWhitelistedEmail } from "./lib/geoPolicy";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserLocation(userId: string, latitude: number, longitude: number): Promise<void>;
  updateUserHomeLocation(userId: string, latitude: number, longitude: number): Promise<void>;
  updateUserInterestLocation(userId: string, latitude: number, longitude: number): Promise<void>;
  verifyUser(userId: string, type: string, badge: string): Promise<User>;

  // Incident operations
  createIncident(incident: InsertIncident & { userId: string | null; state?: 'new' | 'validated' | 'acknowledged' | 'resolved' | 'closed'; source?: 'gps' | 'network' | 'manual' | null }): Promise<Incident>;
  getIncidents(limit?: number): Promise<Incident[]>;
  getIncidentsByUser(userId: string, sinceHours?: number): Promise<Incident[]>;
  getIncident(id: string): Promise<Incident | undefined>;
  getIncidentsNearby(latitude: number, longitude: number, radiusKm: number, sinceHours?: number, category?: string, severity?: string, userEmail?: string | null): Promise<Incident[]>;
  getIncidentsInBounds(minLat: number, minLng: number, maxLat: number, maxLng: number, sinceHours?: number): Promise<Incident[]>;
  moderateIncident(incidentId: string, moderatorId: string, reason?: string): Promise<void>;
  resolveIncidentBasic(incidentId: string, moderatorId: string): Promise<void>;
  findDuplicateIncident(type: string, latitude: number, longitude: number, withinMinutes: number): Promise<Incident | undefined>;
  incrementDuplicateCount(incidentId: string): Promise<void>;
  getAnonymousIncidentsQueue(): Promise<Incident[]>;
  getIncidentByIdempotencyKey(idempotencyKey: string): Promise<Incident | undefined>;

  // Report operations
  reportIncident(report: InsertReport & { reporterId: string }): Promise<Report>;
  getReportsByIncident(incidentId: string): Promise<Report[]>;

  // Follow operations
  followIncident(follow: InsertFollow & { userId: string }): Promise<Follow>;
  unfollowIncident(userId: string, incidentId: string): Promise<void>;
  getFollowedIncidents(userId: string): Promise<string[]>;

  // Notification operations
  createNotification(notification: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification>;
  getUserNotifications(userId: string): Promise<Notification[]>;
  markNotificationRead(notificationId: string): Promise<void>;

  // Chat operations
  createChatMessage(message: InsertChatMessage & { userId: string | null }): Promise<ChatMessage>;
  getChatHistory(room: string, limit?: number): Promise<ChatMessage[]>;
  pruneChatHistory(room: string, keepCount?: number): Promise<void>;

  // Phase 2: Enhanced incident operations
  acknowledgeIncident(incidentId: string, userId: string): Promise<Incident>;
  resolveIncident(incidentId: string, userId: string, resolveNote: string): Promise<Incident>;

  // Phase 2: Business operations
  createBusiness(business: InsertBusiness & { ownerId: string }): Promise<Business>;
  getBusinessesNearby(latitude: number, longitude: number, radiusMeters?: number): Promise<Business[]>;

  // Phase 2: Event operations
  createEvent(event: InsertEvent & { organizerId: string }): Promise<Event>;
  getEventsNearby(latitude: number, longitude: number, radiusMeters?: number, sinceHours?: number, untilHours?: number): Promise<Event[]>;
  getActivePromotions(latitude: number, longitude: number, radiusMeters?: number): Promise<Event[]>;

  // Phase 2: Drive-by request operations
  createDrivebyRequest(request: InsertDrivebyRequest & { requesterId: string }): Promise<DrivebyRequest>;
  getUserDrivebyRequests(userId: string): Promise<DrivebyRequest[]>;
  getDrivebyInbox(): Promise<DrivebyRequest[]>;
  acceptDrivebyRequest(requestId: string, acceptedBy: string, estimatedArrival?: Date): Promise<DrivebyRequest>;
  completeDrivebyRequest(requestId: string, completionNotes: string): Promise<DrivebyRequest>;
  cancelDrivebyRequest(requestId: string): Promise<DrivebyRequest>;

  // Push notification operations
  createPushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription>;
  getPushSubscriptionsByNeighborhood(neighbourhoodId: string): Promise<PushSubscription[]>;
  updatePushSubscriptionTypes(endpoint: string, types: string[]): Promise<void>;
  removePushSubscription(endpoint: string): Promise<void>;

  // Abuse report operations
  createAbuseReport(report: InsertAbuseReport & { reporterUserId: string | null }): Promise<AbuseReport>;
  getAbuseReportsByIncident(incidentId: string): Promise<AbuseReport[]>;
  getModerationQueue(): Promise<(Incident & { report_count: number })[]>;
  updateIncidentShadowStatus(incidentId: string, isShadowHidden: boolean): Promise<void>;
  deleteIncident(incidentId: string, requestingUserId: string): Promise<"deleted" | "not_found" | "forbidden">;

  // Phase 2: Incident Response operations (structured reactions)
  upsertResponse(incidentId: string, userId: string, signal: ResponseSignal): Promise<IncidentResponse>;
  deleteResponse(incidentId: string, userId: string): Promise<void>;
  getResponseCounts(incidentId: string): Promise<Record<ResponseSignal, number>>;
  getUserResponse(incidentId: string, userId: string): Promise<IncidentResponse | undefined>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserLocation(userId: string, latitude: number, longitude: number): Promise<void> {
    await db.update(users)
      .set({ 
        lastLatitude: latitude.toString(), 
        lastLongitude: longitude.toString() 
      })
      .where(eq(users.id, userId));
  }

  async updateUserHomeLocation(userId: string, latitude: number, longitude: number): Promise<void> {
    await db.update(users)
      .set({ 
        homeLatitude: latitude.toString(), 
        homeLongitude: longitude.toString() 
      })
      .where(eq(users.id, userId));
  }

  async updateUserInterestLocation(userId: string, latitude: number, longitude: number): Promise<void> {
    await db.update(users)
      .set({ 
        interestLatitude: latitude.toString(), 
        interestLongitude: longitude.toString() 
      })
      .where(eq(users.id, userId));
  }

  async verifyUser(userId: string, type: string, badge: string): Promise<User> {
    const [user] = await db.update(users)
      .set({ 
        isVerified: true, 
        verifiedType: type as any, 
        verifiedBadge: badge 
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Incident operations
  async createIncident(incident: InsertIncident & { userId: string | null; state?: 'new' | 'validated' | 'acknowledged' | 'resolved' | 'closed'; source?: 'gps' | 'network' | 'manual' | null }): Promise<Incident> {
    // Convert numeric coordinates to strings for decimal fields
    const incidentData = {
      ...incident,
      latitude: typeof incident.latitude === 'number' ? incident.latitude.toString() : incident.latitude,
      longitude: typeof incident.longitude === 'number' ? incident.longitude.toString() : incident.longitude,
    };
    const [newIncident] = await db.insert(incidents).values([incidentData]).returning();
    
    // Notify nearby users if not anonymous
    if (!incident.isAnonymous) {
      await this.notifyNearbyUsers(newIncident);
    }
    
    return newIncident;
  }

  async getIncidents(limit = 50, sinceHours = 168): Promise<Incident[]> {
    const hoursAgo = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
    
    return await db.select()
      .from(incidents)
      .where(and(
        eq(incidents.isModerated, false),
        eq(incidents.isShadowHidden, false),
        sql`${incidents.createdAt} >= ${hoursAgo}`
      ))
      .orderBy(desc(incidents.createdAt))
      .limit(limit);
  }

  async getIncidentsByUser(userId: string, sinceHours?: number): Promise<Incident[]> {
    const conditions = [
      eq(incidents.userId, userId),
      eq(incidents.isModerated, false),
      eq(incidents.isShadowHidden, false)
    ];
    
    if (sinceHours) {
      const hoursAgo = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
      conditions.push(sql`${incidents.createdAt} >= ${hoursAgo}`);
    }
    
    return await db.select()
      .from(incidents)
      .where(and(...conditions))
      .orderBy(desc(incidents.createdAt));
  }

  async getIncident(id: string): Promise<Incident | undefined> {
    const [incident] = await db.select().from(incidents).where(eq(incidents.id, id));
    return incident || undefined;
  }

  async getIncidentsNearby(latitude: number, longitude: number, radiusKm: number, sinceHours = 72, category?: string, severity?: string, userEmail?: string | null): Promise<Incident[]> {
    // Using Haversine formula for distance calculation (radiusKm already in km)
    const hoursAgo = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
    
    // Visibility filtering based on GeoPolicy
    // - public_beta: visible to all
    // - private_whitelist: only visible to whitelisted users
    const canSeePrivate = isWhitelistedEmail(userEmail);
    
    const conditions = [
      eq(incidents.isModerated, false),
      eq(incidents.isShadowHidden, false),
      sql`${incidents.createdAt} >= ${hoursAgo}`,
      sql`(
        6371 * acos(
          cos(radians(${latitude})) * 
          cos(radians(${incidents.latitude}::decimal)) * 
          cos(radians(${incidents.longitude}::decimal) - radians(${longitude})) + 
          sin(radians(${latitude})) * 
          sin(radians(${incidents.latitude}::decimal))
        )
      ) <= ${radiusKm}`
    ];
    
    // Apply visibility scope filter (unless user is whitelisted)
    if (!canSeePrivate) {
      // Non-whitelisted users can only see public_beta incidents
      conditions.push(
        or(
          eq(incidents.visibilityScope, 'public_beta'),
          isNull(incidents.visibilityScope)
        )!
      );
    }
    
    // Optional category filter
    if (category) {
      conditions.push(eq(incidents.category, category));
    }
    
    // Optional severity filter
    if (severity) {
      conditions.push(sql`${incidents.severity} = ${severity}`);
    }
    
    return await db.select()
      .from(incidents)
      .where(and(...conditions))
      .orderBy(desc(incidents.createdAt));
  }

  async getIncidentsInBounds(minLat: number, minLng: number, maxLat: number, maxLng: number, sinceHours = 72): Promise<Incident[]> {
    const hoursAgo = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
    
    return await db.select()
      .from(incidents)
      .where(
        and(
          eq(incidents.isModerated, false),
          eq(incidents.isShadowHidden, false),
          sql`${incidents.createdAt} >= ${hoursAgo}`,
          sql`${incidents.latitude}::decimal >= ${minLat}`,
          sql`${incidents.latitude}::decimal <= ${maxLat}`,
          sql`${incidents.longitude}::decimal >= ${minLng}`,
          sql`${incidents.longitude}::decimal <= ${maxLng}`
        )
      )
      .orderBy(desc(incidents.createdAt));
  }

  async moderateIncident(incidentId: string, moderatorId: string, reason?: string): Promise<void> {
    await db.update(incidents)
      .set({ 
        isModerated: true, 
        moderatedBy: moderatorId, 
        moderationReason: reason 
      })
      .where(eq(incidents.id, incidentId));
  }

  async resolveIncidentBasic(incidentId: string, moderatorId: string): Promise<void> {
    await db.update(incidents)
      .set({ 
        state: "resolved",
        moderatedBy: moderatorId,
        closedAt: new Date()
      })
      .where(eq(incidents.id, incidentId));
  }

  async findDuplicateIncident(type: string, latitude: number, longitude: number, withinMinutes?: number): Promise<Incident | undefined> {
    // Use configurable parameters
    const windowMinutes = withinMinutes || Number(process.env.DEDUPE_WINDOW_MINUTES) || 10;
    const radiusMeters = Number(process.env.DEDUPE_RADIUS_METERS) || 100;
    
    const timeAgo = new Date(Date.now() - windowMinutes * 60 * 1000);
    const [duplicate] = await db.select()
      .from(incidents)
      .where(
        and(
          eq(incidents.type, type),
          sql`${incidents.createdAt} >= ${timeAgo}`,
          sql`(
            6371000 * acos(
              cos(radians(${latitude})) * 
              cos(radians(${incidents.latitude}::decimal)) * 
              cos(radians(${incidents.longitude}::decimal) - radians(${longitude})) + 
              sin(radians(${latitude})) * 
              sin(radians(${incidents.latitude}::decimal))
            )
          ) <= ${radiusMeters}`
        )
      )
      .limit(1);
    
    return duplicate || undefined;
  }

  async incrementDuplicateCount(incidentId: string): Promise<void> {
    await db.update(incidents)
      .set({ duplicateCount: sql`duplicate_count + 1` })
      .where(eq(incidents.id, incidentId));
  }

  async getAnonymousIncidentsQueue(): Promise<Incident[]> {
    return await db.select()
      .from(incidents)
      .where(
        and(
          eq(incidents.isAnonymous, true),
          eq(incidents.state, "new")
        )
      )
      .orderBy(desc(incidents.createdAt));
  }

  async getIncidentByIdempotencyKey(idempotencyKey: string): Promise<Incident | undefined> {
    const [incident] = await db.select()
      .from(incidents)
      .where(eq(incidents.idempotencyKey, idempotencyKey));
    return incident || undefined;
  }

  // Report operations
  async reportIncident(report: InsertReport & { reporterId: string }): Promise<Report> {
    const [newReport] = await db.insert(reports).values(report).returning();
    
    // Increment report count on incident
    await db.update(incidents)
      .set({ reportCount: sql`report_count + 1` })
      .where(eq(incidents.id, report.incidentId!));
    
    return newReport;
  }

  async getReportsByIncident(incidentId: string): Promise<Report[]> {
    return await db.select()
      .from(reports)
      .where(eq(reports.incidentId, incidentId))
      .orderBy(desc(reports.createdAt));
  }

  // Follow operations
  async followIncident(follow: InsertFollow & { userId: string }): Promise<Follow> {
    const [newFollow] = await db.insert(follows).values(follow).returning();
    return newFollow;
  }

  async unfollowIncident(userId: string, incidentId: string): Promise<void> {
    await db.delete(follows)
      .where(and(
        eq(follows.userId, userId),
        eq(follows.incidentId, incidentId)
      ));
  }

  async getFollowedIncidents(userId: string): Promise<string[]> {
    const followedIncidents = await db.select({ incidentId: follows.incidentId })
      .from(follows)
      .where(eq(follows.userId, userId));
    
    return followedIncidents.map(f => f.incidentId).filter(id => id !== null);
  }

  // Notification operations
  async createNotification(notification: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification> {
    const [newNotification] = await db.insert(notifications).values(notification).returning();
    return newNotification;
  }

  async getUserNotifications(userId: string): Promise<Notification[]> {
    return await db.select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, notificationId));
  }

  // Helper method to notify nearby users
  private async notifyNearbyUsers(incident: Incident): Promise<void> {
    // Get users within notification radius
    const nearbyUsers = await db.select()
      .from(users)
      .where(
        and(
          sql`${users.lastLatitude} IS NOT NULL`,
          sql`${users.lastLongitude} IS NOT NULL`,
          sql`(
            6371000 * acos(
              cos(radians(${incident.latitude}::decimal)) * 
              cos(radians(${users.lastLatitude}::decimal)) * 
              cos(radians(${users.lastLongitude}::decimal) - radians(${incident.longitude}::decimal)) + 
              sin(radians(${incident.latitude}::decimal)) * 
              sin(radians(${users.lastLatitude}::decimal))
            )
          ) <= ${users.notificationRadius}`
        )
      );

    // Create notifications for nearby users
    for (const user of nearbyUsers) {
      if (user.id !== incident.userId) { // Don't notify the reporter
        await this.createNotification({
          userId: user.id,
          incidentId: incident.id,
          type: 'incident_nearby',
          title: `${incident.severity.toUpperCase()}: ${incident.title}`,
          message: `New incident reported nearby: ${incident.description}`,
          isRead: false,
        });
      }
    }
  }

  // Chat operations
  async createChatMessage(message: InsertChatMessage & { userId: string | null }): Promise<ChatMessage> {
    const [newMessage] = await db.insert(chatMessages).values(message).returning();
    
    // Auto-prune old messages to keep room size manageable
    setTimeout(() => this.pruneChatHistory(message.room), 1000);
    
    return newMessage;
  }

  // Get chat messages (with 7-day default filtering)
  async getChatHistory(room: string, limit = 50, sinceHours = 168): Promise<ChatMessage[]> {
    const hoursAgo = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
    
    return await db.select()
      .from(chatMessages)
      .where(and(
        eq(chatMessages.room, room),
        sql`${chatMessages.createdAt} >= ${hoursAgo}`
      ))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
  }

  async pruneChatHistory(room: string, keepCount = 100): Promise<void> {
    const messagesToDelete = await db.select()
      .from(chatMessages)
      .where(eq(chatMessages.room, room))
      .orderBy(desc(chatMessages.createdAt))
      .offset(keepCount);
    
    if (messagesToDelete.length > 0) {
      const idsToDelete = messagesToDelete.map(m => m.id);
      await db.delete(chatMessages)
        .where(sql`${chatMessages.id} = ANY(${idsToDelete})`);
    }
  }

  // Phase 2: Authority actions for incidents (police, security, etc.)
  async acknowledgeIncident(incidentId: string, userId: string): Promise<Incident> {
    const [incident] = await db.update(incidents)
      .set({ 
        state: 'acknowledged', 
        acknowledgedAt: sql`now()`,
        acknowledgedBy: userId 
      })
      .where(eq(incidents.id, incidentId))
      .returning();
    return incident;
  }

  async resolveIncident(incidentId: string, userId: string, resolveNote: string): Promise<Incident> {
    const [incident] = await db.update(incidents)
      .set({ 
        state: 'resolved', 
        resolvedAt: sql`now()`,
        resolvedBy: userId,
        resolveNote 
      })
      .where(eq(incidents.id, incidentId))
      .returning();
    return incident;
  }

  // Phase 2: Community Business operations
  async createBusiness(business: InsertBusiness & { ownerId: string }): Promise<Business> {
    const [newBusiness] = await db.insert(businesses).values([business]).returning();
    return newBusiness;
  }

  async getBusinessesNearby(latitude: number, longitude: number, radiusMeters = 2000): Promise<Business[]> {
    return await db.execute(sql`
      SELECT * FROM businesses
      WHERE (
        6371000 * acos(
          cos(radians(${latitude})) * 
          cos(radians(latitude::decimal)) * 
          cos(radians(longitude::decimal) - radians(${longitude})) + 
          sin(radians(${latitude})) * 
          sin(radians(latitude::decimal))
        )
      ) <= ${radiusMeters}
      AND is_verified = true
      ORDER BY created_at DESC
    `).then(result => result.rows as Business[]);
  }

  // Phase 2: Community Event operations  
  async createEvent(event: InsertEvent & { organizerId: string }): Promise<Event> {
    const [newEvent] = await db.insert(events).values([event]).returning();
    return newEvent;
  }

  async getEventsNearby(
    latitude: number, 
    longitude: number, 
    radiusMeters = 5000, 
    sinceHours = 0, 
    untilHours = 168 // 7 days
  ): Promise<Event[]> {
    const sinceTime = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
    const untilTime = new Date(Date.now() + untilHours * 60 * 60 * 1000);
    
    return await db.execute(sql`
      SELECT * FROM events
      WHERE (
        6371000 * acos(
          cos(radians(${latitude})) * 
          cos(radians(latitude::decimal)) * 
          cos(radians(longitude::decimal) - radians(${longitude})) + 
          sin(radians(${latitude})) * 
          sin(radians(latitude::decimal))
        )
      ) <= ${radiusMeters}
      AND is_active = true
      AND start_time >= ${sinceTime}
      AND start_time <= ${untilTime}
      ORDER BY start_time ASC
    `).then(result => result.rows as Event[]);
  }

  async getActivePromotions(latitude: number, longitude: number, radiusMeters = 5000): Promise<Event[]> {
    return await db.execute(sql`
      SELECT * FROM events
      WHERE (
        6371000 * acos(
          cos(radians(${latitude})) * 
          cos(radians(latitude::decimal)) * 
          cos(radians(longitude::decimal) - radians(${longitude})) + 
          sin(radians(${latitude})) * 
          sin(radians(latitude::decimal))
        )
      ) <= ${radiusMeters}
      AND is_promotion = true
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
      ORDER BY created_at DESC
    `).then(result => result.rows as Event[]);
  }

  // Phase 2: Drive-by Security Request operations
  async createDrivebyRequest(request: InsertDrivebyRequest & { requesterId: string }): Promise<DrivebyRequest> {
    const [newRequest] = await db.insert(drivebyRequests).values([request]).returning();
    return newRequest;
  }

  async getUserDrivebyRequests(userId: string): Promise<DrivebyRequest[]> {
    return await db.select()
      .from(drivebyRequests)
      .where(eq(drivebyRequests.requesterId, userId))
      .orderBy(desc(drivebyRequests.createdAt));
  }

  async getDrivebyInbox(): Promise<DrivebyRequest[]> {
    // For security organizations to see pending requests
    return await db.select()
      .from(drivebyRequests)
      .where(eq(drivebyRequests.state, 'pending'))
      .orderBy(desc(drivebyRequests.priority), desc(drivebyRequests.createdAt));
  }

  async acceptDrivebyRequest(requestId: string, acceptedBy: string, estimatedArrival?: Date): Promise<DrivebyRequest> {
    const [request] = await db.update(drivebyRequests)
      .set({ 
        state: 'accepted',
        acceptedBy,
        acceptedAt: sql`now()`,
        estimatedArrival
      })
      .where(eq(drivebyRequests.id, requestId))
      .returning();
    return request;
  }

  async completeDrivebyRequest(requestId: string, completionNotes: string): Promise<DrivebyRequest> {
    const [request] = await db.update(drivebyRequests)
      .set({ 
        state: 'completed',
        completedAt: sql`now()`,
        completionNotes
      })
      .where(eq(drivebyRequests.id, requestId))
      .returning();
    return request;
  }

  async cancelDrivebyRequest(requestId: string): Promise<DrivebyRequest> {
    const [request] = await db.update(drivebyRequests)
      .set({ state: 'cancelled' })
      .where(eq(drivebyRequests.id, requestId))
      .returning();
    return request;
  }

  // Push notification operations
  async createPushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription> {
    // Upsert: update if exists, insert if new
    const existing = await db.select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db.update(pushSubscriptions)
        .set({
          userId: subscription.userId,
          neighbourhoodId: subscription.neighbourhoodId,
          types: subscription.types,
          isActive: true,
          updatedAt: sql`now()`
        })
        .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(pushSubscriptions)
        .values(subscription)
        .returning();
      return created;
    }
  }

  async getPushSubscriptionsByNeighborhood(neighbourhoodId: string): Promise<PushSubscription[]> {
    return await db.select()
      .from(pushSubscriptions)
      .where(and(
        eq(pushSubscriptions.neighbourhoodId, neighbourhoodId),
        eq(pushSubscriptions.isActive, true)
      ));
  }

  async updatePushSubscriptionTypes(endpoint: string, types: string[]): Promise<void> {
    await db.update(pushSubscriptions)
      .set({ 
        types, 
        updatedAt: sql`now()` 
      })
      .where(eq(pushSubscriptions.endpoint, endpoint));
  }

  async removePushSubscription(endpoint: string): Promise<void> {
    await db.update(pushSubscriptions)
      .set({ 
        isActive: false, 
        updatedAt: sql`now()` 
      })
      .where(eq(pushSubscriptions.endpoint, endpoint));
  }

  // Abuse report operations
  async createAbuseReport(report: InsertAbuseReport & { reporterUserId: string | null }): Promise<AbuseReport> {
    const [created] = await db.insert(abuse_reports)
      .values({
        id: crypto.randomUUID(),
        incidentId: report.incidentId,
        reporterUserId: report.reporterUserId,
        reason: report.reason,
        note: report.note,
      })
      .returning();
    return created;
  }

  async getAbuseReportsByIncident(incidentId: string): Promise<AbuseReport[]> {
    return await db.select()
      .from(abuse_reports)
      .where(eq(abuse_reports.incidentId, incidentId))
      .orderBy(desc(abuse_reports.createdAt));
  }

  async getModerationQueue(): Promise<(Incident & { report_count: number })[]> {
    const rows = await db.execute(sql`
      SELECT i.*,
             COALESCE(ar.cnt, 0) AS report_count
      FROM incidents i
      LEFT JOIN (
        SELECT incident_id, COUNT(*)::int cnt
        FROM abuse_reports
        GROUP BY incident_id
      ) ar ON ar.incident_id = i.id
      WHERE i.is_shadow_hidden = true OR COALESCE(ar.cnt, 0) >= 2
      ORDER BY i.created_at DESC
      LIMIT 200
    `);
    return rows.rows as any[];
  }

  async updateIncidentShadowStatus(incidentId: string, isShadowHidden: boolean): Promise<void> {
    await db.update(incidents)
      .set({ isShadowHidden })
      .where(eq(incidents.id, incidentId));
  }

  async deleteIncident(incidentId: string, requestingUserId: string): Promise<"deleted" | "not_found" | "forbidden"> {
    const [incident] = await db
      .select({ userId: incidents.userId })
      .from(incidents)
      .where(eq(incidents.id, incidentId))
      .limit(1);

    if (!incident) return "not_found";
    if (incident.userId !== requestingUserId) return "forbidden";

    // Delete all dependent rows before the incident to avoid FK constraint failures.
    await db.transaction(async (tx) => {
      await tx.delete(incidentResponses).where(eq(incidentResponses.incidentId, incidentId));
      await tx.delete(incidentComments).where(eq(incidentComments.incidentId, incidentId));
      await tx.delete(incidentReviews).where(eq(incidentReviews.incidentId, incidentId));
      await tx.delete(follows).where(eq(follows.incidentId, incidentId));
      await tx.delete(reports).where(eq(reports.incidentId, incidentId));
      await tx.delete(notifications).where(eq(notifications.incidentId, incidentId));
      await tx.delete(drivebyRequests).where(eq(drivebyRequests.incidentId, incidentId));
      await tx.delete(incidents).where(eq(incidents.id, incidentId));
    });

    return "deleted";
  }

  // Cleanup operations
  async cleanupOldIncidents(olderThanDays = 7): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    
    try {
      // Delete incidents older than the cutoff date
      const result = await db.delete(incidents)
        .where(sql`${incidents.createdAt} < ${cutoffDate}`)
        .returning({ id: incidents.id });
      
      console.log(`🧹 [CLEANUP] Removed ${result.length} incidents older than ${olderThanDays} days`);
      return result.length;
    } catch (error) {
      console.error('❌ [CLEANUP] Failed to cleanup old incidents:', error);
      throw error;
    }
  }

  async cleanupOldChatMessages(olderThanDays = 7): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    
    try {
      // Delete chat messages older than the cutoff date
      const result = await db.delete(chatMessages)
        .where(sql`${chatMessages.createdAt} < ${cutoffDate}`)
        .returning({ id: chatMessages.id });
      
      console.log(`💬 [CLEANUP] Removed ${result.length} chat messages older than ${olderThanDays} days`);
      return result.length;
    } catch (error) {
      console.error('❌ [CLEANUP] Failed to cleanup old chat messages:', error);
      throw error;
    }
  }

  // Cleanup expired login attempts (older than 24 hours)
  async cleanupOldLoginAttempts(): Promise<number> {
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours
    
    try {
      const result = await db.delete(loginAttempts)
        .where(sql`${loginAttempts.attemptedAt} < ${cutoffDate}`)
        .returning({ id: loginAttempts.id });
      
      if (result.length > 0) {
        console.log(`🔐 [CLEANUP] Removed ${result.length} login attempts older than 24 hours`);
      }
      return result.length;
    } catch (error) {
      console.error('❌ [CLEANUP] Failed to cleanup old login attempts:', error);
      return 0;
    }
  }

  // Cleanup expired/used password reset tokens (older than 24 hours)
  async cleanupOldPasswordResetTokens(): Promise<number> {
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours
    
    try {
      const result = await db.delete(passwordResetTokens)
        .where(sql`${passwordResetTokens.createdAt} < ${cutoffDate}`)
        .returning({ id: passwordResetTokens.id });
      
      if (result.length > 0) {
        console.log(`🔑 [CLEANUP] Removed ${result.length} password reset tokens older than 24 hours`);
      }
      return result.length;
    } catch (error) {
      console.error('❌ [CLEANUP] Failed to cleanup old password reset tokens:', error);
      return 0;
    }
  }

  // Combined cleanup method
  async cleanupOldData(olderThanDays = 7): Promise<{ incidents: number; chatMessages: number; loginAttempts: number; passwordResetTokens: number }> {
    const incidentCount = await this.cleanupOldIncidents(olderThanDays);
    const chatCount = await this.cleanupOldChatMessages(olderThanDays);
    const loginAttemptsCount = await this.cleanupOldLoginAttempts();
    const passwordTokensCount = await this.cleanupOldPasswordResetTokens();
    
    console.log(`🧹 [CLEANUP] Total cleanup: ${incidentCount} incidents + ${chatCount} chat messages + ${loginAttemptsCount} login attempts + ${passwordTokensCount} reset tokens`);
    return { incidents: incidentCount, chatMessages: chatCount, loginAttempts: loginAttemptsCount, passwordResetTokens: passwordTokensCount };
  }

  // Phase 2: Incident Response operations (structured reactions)
  async upsertResponse(incidentId: string, userId: string, signal: ResponseSignal): Promise<IncidentResponse> {
    const [response] = await db
      .insert(incidentResponses)
      .values({
        incidentId,
        userId,
        signal,
      })
      .onConflictDoUpdate({
        target: [incidentResponses.incidentId, incidentResponses.userId],
        set: {
          signal,
          updatedAt: sql`now()`,
        },
      })
      .returning();
    return response;
  }

  async deleteResponse(incidentId: string, userId: string): Promise<void> {
    await db
      .delete(incidentResponses)
      .where(
        and(
          eq(incidentResponses.incidentId, incidentId),
          eq(incidentResponses.userId, userId)
        )
      );
  }

  async getResponseCounts(incidentId: string): Promise<Record<ResponseSignal, number>> {
    const counts = await db
      .select({
        signal: incidentResponses.signal,
        count: sql<number>`count(*)::int`,
      })
      .from(incidentResponses)
      .where(eq(incidentResponses.incidentId, incidentId))
      .groupBy(incidentResponses.signal);

    const result: Record<ResponseSignal, number> = {
      seen: 0,
      caution: 0,
      helpful: 0,
      resolved: 0,
    };

    for (const row of counts) {
      if (row.signal) {
        result[row.signal as ResponseSignal] = row.count;
      }
    }

    return result;
  }

  async getUserResponse(incidentId: string, userId: string): Promise<IncidentResponse | undefined> {
    const [response] = await db
      .select()
      .from(incidentResponses)
      .where(
        and(
          eq(incidentResponses.incidentId, incidentId),
          eq(incidentResponses.userId, userId)
        )
      );
    return response || undefined;
  }
}

export const storage = new DatabaseStorage();
