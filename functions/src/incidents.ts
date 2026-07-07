import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import { CloudEvent } from 'firebase-functions/v2';
import { FirestoreEvent } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

export const createIncidentHandler = async (request: CallableRequest) => {
  const { auth, data } = request;
  
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const {
    siteId,
    category,
    severity,
    description,
    location,
    photos
  } = data;
  
  // Validate required fields
  if (!siteId || !category || !severity || !description) {
    throw new HttpsError('invalid-argument', 'Missing required fields');
  }
  
  const db = admin.firestore();
  
  try {
    // Verify user has access to this site
    const userDoc = await db.collection('users').doc(auth.uid).get();
    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'User not found');
    }
    
    const userData = userDoc.data();
    
    // Verify site belongs to user's tenant
    const siteDoc = await db.collection('sites').doc(siteId).get();
    if (!siteDoc.exists) {
      throw new HttpsError('not-found', 'Site not found');
    }
    
    if (siteDoc.data().tenantId !== userData.tenantId) {
      throw new HttpsError('permission-denied', 'Access denied to this site');
    }
    
    // Create incident document
    const incidentData = {
      siteId,
      category,
      severity,
      description,
      location: location || null,
      photos: photos || [],
      status: 'open',
      createdBy: auth.uid,
      updatedBy: auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      tenantId: userData.tenantId
    };
    
    const incidentRef = await db.collection('incidents').add(incidentData);
    
    console.log(`Incident ${incidentRef.id} created by user ${auth.uid}`);
    
    return {
      success: true,
      incidentId: incidentRef.id
    };
    
  } catch (error) {
    console.error('Error creating incident:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', 'Failed to create incident');
  }
};

export const notifyIncidentAssignment = async (
  event: CloudEvent<FirestoreEvent<any, any>>
) => {
  const { data } = event;
  const incidentData = data?.after?.data();
  
  if (!incidentData) {
    console.error('No incident data found');
    return;
  }
  
  const db = admin.firestore();
  
  try {
    // Get supervisors for this tenant to notify
    const supervisorsSnapshot = await db.collection('users')
      .where('tenantId', '==', incidentData.tenantId)
      .where('roles', 'array-contains', 'supervisor')
      .where('status', '==', 'active')
      .get();
    
    const supervisorTokens: string[] = [];
    
    // Collect FCM tokens from supervisors
    for (const doc of supervisorsSnapshot.docs) {
      const userData = doc.data();
      if (userData.fcmToken) {
        supervisorTokens.push(userData.fcmToken);
      }
    }
    
    if (supervisorTokens.length === 0) {
      console.log('No supervisors with FCM tokens found');
      return;
    }
    
    // Get site information for notification
    const siteDoc = await db.collection('sites').doc(incidentData.siteId).get();
    const siteName = siteDoc.exists ? siteDoc.data().name : 'Unknown Site';
    
    // Get creator information
    const creatorDoc = await db.collection('users').doc(incidentData.createdBy).get();
    const creatorName = creatorDoc.exists ? creatorDoc.data().displayName : 'Unknown User';
    
    // Send FCM notifications
    const message = {
      notification: {
        title: `New ${incidentData.severity.toUpperCase()} Incident`,
        body: `${incidentData.category} reported by ${creatorName} at ${siteName}`
      },
      data: {
        type: 'incident',
        incidentId: event.params?.incidentId || '',
        siteId: incidentData.siteId,
        severity: incidentData.severity,
        category: incidentData.category
      },
      tokens: supervisorTokens
    };
    
    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log(`Sent ${response.successCount} incident notifications, ${response.failureCount} failed`);
    
    // Log notification in Firestore
    await db.collection('notifications').add({
      type: 'incident_created',
      incidentId: event.params?.incidentId,
      recipients: supervisorTokens.length,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      tenantId: incidentData.tenantId
    });
    
  } catch (error) {
    console.error('Error sending incident notifications:', error);
  }
};

// Function to assign incident to a user
export const assignIncident = async (request: CallableRequest) => {
  const { auth, data } = request;
  
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { incidentId, assigneeId } = data;
  
  if (!incidentId || !assigneeId) {
    throw new HttpsError('invalid-argument', 'Missing required fields');
  }
  
  const db = admin.firestore();
  
  try {
    // Verify user has supervisor role
    const userDoc = await db.collection('users').doc(auth.uid).get();
    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'User not found');
    }
    
    const userData = userDoc.data();
    if (!userData.roles.includes('supervisor') && !userData.roles.includes('admin')) {
      throw new HttpsError('permission-denied', 'Only supervisors can assign incidents');
    }
    
    // Update incident
    await db.collection('incidents').doc(incidentId).update({
      assignedTo: assigneeId,
      status: 'in-progress',
      updatedBy: auth.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return { success: true };
    
  } catch (error) {
    console.error('Error assigning incident:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', 'Failed to assign incident');
  }
};
