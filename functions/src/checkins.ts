import { CloudEvent } from 'firebase-functions/v2';
import { FirestoreEvent } from 'firebase-functions/v2/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

export const validateCheckin = async (
  event: CloudEvent<FirestoreEvent<any, any>>
) => {
  const { data } = event;
  const checkinData = data?.after?.data();
  
  if (!checkinData) {
    console.error('No checkin data found');
    return;
  }

  const db = admin.firestore();
  
  try {
    // Validate GPS checkin radius if method is 'gps'
    if (checkinData.method === 'gps') {
      const patrolPointDoc = await db
        .collection('patrolPoints')
        .doc(checkinData.patrolPointId)
        .get();
      
      if (!patrolPointDoc.exists) {
        throw new Error('Patrol point not found');
      }
      
      const patrolPoint = patrolPointDoc.data();
      const distance = calculateDistance(
        checkinData.location,
        patrolPoint.location
      );
      
      if (distance > patrolPoint.radiusM) {
        // Mark checkin as invalid
        await db.collection('checkins').doc(event.params?.checkinId).update({
          valid: false,
          validationError: 'Outside patrol point radius',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return;
      }
    }
    
    // Validate QR code if method is 'qr'
    if (checkinData.method === 'qr') {
      const patrolPointDoc = await db
        .collection('patrolPoints')
        .doc(checkinData.patrolPointId)
        .get();
      
      if (!patrolPointDoc.exists) {
        throw new Error('Patrol point not found');
      }
      
      const patrolPoint = patrolPointDoc.data();
      
      if (checkinData.qrCode !== patrolPoint.qrCode) {
        // Mark checkin as invalid
        await db.collection('checkins').doc(event.params?.checkinId).update({
          valid: false,
          validationError: 'Invalid QR code',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return;
      }
    }
    
    // Enrich checkin with additional data
    const enrichedData = {
      valid: true,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Get guard info for enrichment
    const guardDoc = await db.collection('users').doc(checkinData.guardId).get();
    if (guardDoc.exists) {
      enrichedData.guardName = guardDoc.data().displayName;
    }
    
    // Get patrol point info for enrichment
    const patrolPointDoc = await db
      .collection('patrolPoints')
      .doc(checkinData.patrolPointId)
      .get();
    
    if (patrolPointDoc.exists) {
      enrichedData.pointLabel = patrolPointDoc.data().label;
    }
    
    // Update checkin with enriched data
    await db.collection('checkins').doc(event.params?.checkinId).update(enrichedData);
    
    // Update compliance counters (could be moved to a separate function)
    await updateComplianceCounters(checkinData.siteId, checkinData.guardId);
    
    console.log(`Checkin ${event.params?.checkinId} validated successfully`);
    
  } catch (error) {
    console.error('Error validating checkin:', error);
    
    // Mark checkin as invalid with error
    await db.collection('checkins').doc(event.params?.checkinId).update({
      valid: false,
      validationError: error.message,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
};

// Helper function to calculate distance between two coordinates
function calculateDistance(
  coord1: { lat: number; lng: number },
  coord2: { lat: number; lng: number }
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = coord1.lat * Math.PI / 180;
  const φ2 = coord2.lat * Math.PI / 180;
  const Δφ = (coord2.lat - coord1.lat) * Math.PI / 180;
  const Δλ = (coord2.lng - coord1.lng) * Math.PI / 180;
  
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  return R * c; // Distance in meters
}

// Update compliance counters for reporting
async function updateComplianceCounters(siteId: string, guardId: string) {
  const db = admin.firestore();
  const today = new Date().toISOString().split('T')[0];
  
  try {
    // Update daily compliance counter
    const complianceRef = db.collection('compliance').doc(`${siteId}_${today}`);
    
    await db.runTransaction(async (transaction) => {
      const complianceDoc = await transaction.get(complianceRef);
      
      if (complianceDoc.exists) {
        const data = complianceDoc.data();
        transaction.update(complianceRef, {
          totalCheckins: (data.totalCheckins || 0) + 1,
          guardCheckins: {
            ...data.guardCheckins,
            [guardId]: (data.guardCheckins?.[guardId] || 0) + 1
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        transaction.set(complianceRef, {
          siteId,
          date: today,
          totalCheckins: 1,
          guardCheckins: {
            [guardId]: 1
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    });
    
  } catch (error) {
    console.error('Error updating compliance counters:', error);
  }
}
