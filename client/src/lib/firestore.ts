import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  setDoc,
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot,
  Timestamp,
  WriteBatch,
  writeBatch
} from "firebase/firestore";
import { db } from "./firebase";
import { 
  Site, 
  PatrolPoint, 
  Route, 
  Shift, 
  CheckIn, 
  Incident, 
  Alert, 
  Tenant, 
  User 
} from "../types";

// Helper function to convert Firestore timestamps
const convertTimestamps = (data: any) => {
  const converted = { ...data };
  Object.keys(converted).forEach(key => {
    if (converted[key] instanceof Timestamp) {
      converted[key] = converted[key].toDate();
    }
  });
  return converted;
};

// Tenants
export const createTenant = async (tenantData: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>) => {
  const docRef = await addDoc(collection(db, 'tenants'), {
    ...tenantData,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
};

export const getTenants = async (): Promise<Tenant[]> => {
  const querySnapshot = await getDocs(collection(db, 'tenants'));
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  })) as Tenant[];
};

// Sites
export const createSite = async (siteData: Omit<Site, 'id' | 'createdAt' | 'updatedAt'>) => {
  const docRef = await addDoc(collection(db, 'sites'), {
    ...siteData,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
};

export const getSitesByTenant = async (tenantId: string): Promise<Site[]> => {
  const q = query(collection(db, 'sites'), where('tenantId', '==', tenantId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  })) as Site[];
};

export const updateSite = async (siteId: string, updates: Partial<Site>) => {
  const siteRef = doc(db, 'sites', siteId);
  await updateDoc(siteRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

// Patrol Points
export const createPatrolPoint = async (pointData: Omit<PatrolPoint, 'id' | 'createdAt' | 'updatedAt'>) => {
  const docRef = await addDoc(collection(db, 'patrolPoints'), {
    ...pointData,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
};

export const getPatrolPointsBySite = async (siteId: string): Promise<PatrolPoint[]> => {
  const q = query(
    collection(db, 'patrolPoints'), 
    where('siteId', '==', siteId),
    orderBy('order')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  })) as PatrolPoint[];
};

// Check-ins
export const createCheckIn = async (checkinData: Omit<CheckIn, 'id' | 'createdAt'>) => {
  const docRef = await addDoc(collection(db, 'checkins'), {
    ...checkinData,
    timestamp: Timestamp.fromDate(checkinData.timestamp),
    createdAt: Timestamp.now(),
  });
  return docRef.id;
};

export const getRecentCheckIns = async (siteId: string, limitCount = 10): Promise<CheckIn[]> => {
  const q = query(
    collection(db, 'checkins'),
    where('siteId', '==', siteId),
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  })) as CheckIn[];
};

// Incidents
export const createIncident = async (incidentData: Omit<Incident, 'id' | 'createdAt' | 'updatedAt'>) => {
  const docRef = await addDoc(collection(db, 'incidents'), {
    ...incidentData,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
};

export const getIncidentsBySite = async (siteId: string): Promise<Incident[]> => {
  const q = query(
    collection(db, 'incidents'),
    where('siteId', '==', siteId),
    orderBy('createdAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  })) as Incident[];
};

export const updateIncident = async (incidentId: string, updates: Partial<Incident>) => {
  const incidentRef = doc(db, 'incidents', incidentId);
  await updateDoc(incidentRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

// Alerts
export const createAlert = async (alertData: Omit<Alert, 'id' | 'createdAt'>) => {
  const docRef = await addDoc(collection(db, 'alerts'), {
    ...alertData,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
};

export const getActiveAlerts = async (siteId: string): Promise<Alert[]> => {
  const q = query(
    collection(db, 'alerts'),
    where('siteId', '==', siteId),
    where('handledAt', '==', null),
    orderBy('createdAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...convertTimestamps(doc.data())
  })) as Alert[];
};

// Real-time subscriptions
export const subscribeToIncidents = (siteId: string, callback: (incidents: Incident[]) => void) => {
  const q = query(
    collection(db, 'incidents'),
    where('siteId', '==', siteId),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const incidents = snapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data())
    })) as Incident[];
    callback(incidents);
  });
};

export const subscribeToCheckIns = (siteId: string, callback: (checkins: CheckIn[]) => void) => {
  const q = query(
    collection(db, 'checkins'),
    where('siteId', '==', siteId),
    orderBy('timestamp', 'desc'),
    limit(20)
  );
  
  return onSnapshot(q, (snapshot) => {
    const checkins = snapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data())
    })) as CheckIn[];
    callback(checkins);
  });
};

// Users
export const createUser = async (userId: string, userData: Omit<User, 'uid'>) => {
  await setDoc(doc(db, 'users', userId), {
    ...userData,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
};

export const getUsersByTenant = async (tenantId: string): Promise<User[]> => {
  const q = query(collection(db, 'users'), where('tenantId', '==', tenantId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    uid: doc.id,
    ...convertTimestamps(doc.data())
  })) as User[];
};
