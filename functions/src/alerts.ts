import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import { CloudEvent } from 'firebase-functions/v2';
import { FirestoreEvent } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

export const createSOSAlert = async (request: CallableRequest) => {
  const { auth, data } = request;
  
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { siteId, location, type = 'SOS' } = data;
  
  if (!siteId || !location) {
    throw new HttpsError('invalid-argument', 'Missing required fields');
  }
  
  const db = admin.firestore();
  
  try {
    // Get user information
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
    
    // Create alert document
    const alertData = {
      siteId,
      guardId: auth.uid,
      type,
      location,
      createdBy: auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      tenantId: userData.tenantId,
      status: 'active'
    };
    
    const alertRef = await db.collection('alerts').add(alertData);
    
    console.log(`SOS Alert ${alertRef.id} created by guard ${auth.uid}`);
    
    return {
      success: true,
      alertId: alertRef.id
    };
    
  } catch (error) {
    console.error('Error creating SOS alert:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', 'Failed to create SOS alert');
  }
};

export const notifySOSAlert = async (
  event: CloudEvent<FirestoreEvent<any, any>>
) => {
  const { data } = event;
  const alertData = data?.after?.data();
  
  if (!alertData) {
    console.error('No alert data found');
    return;
  }
  
  const db = admin.firestore();
  
  try {
    // Get all supervisors and admins for immediate notification
    const supervisorsSnapshot = await db.collection('users')
      .where('tenantId', '==', alertData.tenantId)
      .where('status', '==', 'active')
      .get();
    
    const emergencyTokens: string[] = [];
    
    // Collect FCM tokens from supervisors and admins
    for (const doc of supervisorsSnapshot.docs) {
      const userData = doc.data();
      if ((userData.roles.includes('supervisor') || userData.roles.includes('admin')) 
          && userData.fcmToken) {
        emergencyTokens.push(userData.fcmToken);
      }
    }
    
    if (emergencyTokens.length === 0) {
      console.log('No supervisors/admins with FCM tokens found for emergency');
      return;
    }
    
    // Get site and guard information
    const [siteDoc, guardDoc] = await Promise.all([
      db.collection('sites').doc(alertData.siteId).get(),
      db.collection('users').doc(alertData.guardId).get()
    ]);
    
    const siteName = siteDoc.exists ? siteDoc.data().name : 'Unknown Site';
    const guardName = guardDoc.exists ? guardDoc.data().displayName : 'Unknown Guard';
    
    // Send high-priority FCM notifications
    const message = {
      notification: {
        title: '🚨 EMERGENCY SOS ALERT',
        body: `${guardName} has triggered an SOS alert at ${siteName}`
      },
      data: {
        type: 'sos_alert',
        alertId: event.params?.alertId || '',
        siteId: alertData.siteId,
        guardId: alertData.guardId,
        priority: 'emergency',
        location: JSON.stringify(alertData.location)
      },
      android: {
        priority: 'high',
        notification: {
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true
        }
      },
      apns: {
        headers: {
          'apns-priority': '10'
        },
        payload: {
          aps: {
            alert: {
              title: '🚨 EMERGENCY SOS ALERT',
              body: `${guardName} has triggered an SOS alert at ${siteName}`
            },
            sound: 'default',
            badge: 1
          }
        }
      },
      tokens: emergencyTokens
    };
    
    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log(`Sent ${response.successCount} SOS notifications, ${response.failureCount} failed`);
    
    // Log emergency notification
    await db.collection('notifications').add({
      type: 'sos_alert',
      alertId: event.params?.alertId,
      guardId: alertData.guardId,
      siteId: alertData.siteId,
      recipients: emergencyTokens.length,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      tenantId: alertData.tenantId,
      priority: 'emergency'
    });
    
    // Also send SMS/Email notifications if configured
    await sendEmergencyNotifications(alertData, siteName, guardName);
    
  } catch (error) {
    console.error('Error sending SOS alert notifications:', error);
  }
};

// Function to handle SOS alert response
export const respondToAlert = async (request: CallableRequest) => {
  const { auth, data } = request;
  
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { alertId, response } = data;
  
  if (!alertId || !response) {
    throw new HttpsError('invalid-argument', 'Missing required fields');
  }
  
  const db = admin.firestore();
  
  try {
    // Verify user has supervisor/admin role
    const userDoc = await db.collection('users').doc(auth.uid).get();
    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'User not found');
    }
    
    const userData = userDoc.data();
    if (!userData.roles.includes('supervisor') && !userData.roles.includes('admin')) {
      throw new HttpsError('permission-denied', 'Only supervisors can respond to alerts');
    }
    
    // Update alert with response
    await db.collection('alerts').doc(alertId).update({
      handledBy: auth.uid,
      handledAt: admin.firestore.FieldValue.serverTimestamp(),
      response,
      status: 'handled',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return { success: true };
    
  } catch (error) {
    console.error('Error responding to alert:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', 'Failed to respond to alert');
  }
};

// Helper function to send additional emergency notifications
async function sendEmergencyNotifications(
  alertData: any, 
  siteName: string, 
  guardName: string
) {
  // This would integrate with SMS/Email services
  // For now, just log the action
  console.log(`Emergency notifications would be sent for SOS alert:`, {
    guard: guardName,
    site: siteName,
    location: alertData.location,
    time: new Date().toISOString()
  });
  
  // TODO: Integrate with services like:
  // - Twilio for SMS
  // - SendGrid for Email
  // - Emergency services API if configured
}
