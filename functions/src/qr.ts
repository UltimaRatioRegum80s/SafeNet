import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { createCanvas } from 'canvas';
import * as QRCode from 'qrcode';

export const generateQRCode = async (request: CallableRequest) => {
  const { auth, data } = request;
  
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { patrolPointId, label, siteId } = data;
  
  if (!patrolPointId || !label) {
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
    if (siteId) {
      const siteDoc = await db.collection('sites').doc(siteId).get();
      if (!siteDoc.exists) {
        throw new HttpsError('not-found', 'Site not found');
      }
      
      if (siteDoc.data().tenantId !== userData.tenantId) {
        throw new HttpsError('permission-denied', 'Access denied to this site');
      }
    }
    
    // Generate unique QR code string
    const qrCodeValue = `WOLVES_PATROL_${patrolPointId}_${Date.now()}`;
    
    // Generate QR code as base64 image
    const qrCodeDataURL = await QRCode.toDataURL(qrCodeValue, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256
    });
    
    // Update patrol point with QR code
    await db.collection('patrolPoints').doc(patrolPointId).update({
      qrCode: qrCodeValue,
      qrCodeImage: qrCodeDataURL,
      updatedBy: auth.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`QR code generated for patrol point ${patrolPointId}`);
    
    return {
      success: true,
      qrCode: qrCodeValue,
      qrCodeImage: qrCodeDataURL
    };
    
  } catch (error) {
    console.error('Error generating QR code:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', 'Failed to generate QR code');
  }
};

// Function to generate a printable QR sheet for a site
export const generateQRSheet = async (request: CallableRequest) => {
  const { auth, data } = request;
  
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { siteId } = data;
  
  if (!siteId) {
    throw new HttpsError('invalid-argument', 'Site ID is required');
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
    
    // Get all patrol points for this site
    const patrolPointsSnapshot = await db.collection('patrolPoints')
      .where('siteId', '==', siteId)
      .orderBy('order')
      .get();
    
    if (patrolPointsSnapshot.empty) {
      throw new HttpsError('not-found', 'No patrol points found for this site');
    }
    
    const siteName = siteDoc.data().name;
    const patrolPoints = patrolPointsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Generate QR codes for each patrol point if not already present
    const qrCodePromises = patrolPoints.map(async (point) => {
      if (!point.qrCode) {
        const qrCodeValue = `WOLVES_PATROL_${point.id}_${Date.now()}`;
        const qrCodeDataURL = await QRCode.toDataURL(qrCodeValue, {
          errorCorrectionLevel: 'M',
          type: 'image/png',
          quality: 0.92,
          margin: 1,
          width: 200
        });
        
        // Update the patrol point with QR code
        await db.collection('patrolPoints').doc(point.id).update({
          qrCode: qrCodeValue,
          qrCodeImage: qrCodeDataURL,
          updatedBy: auth.uid,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        return {
          ...point,
          qrCode: qrCodeValue,
          qrCodeImage: qrCodeDataURL
        };
      }
      
      // Generate QR image if missing
      if (!point.qrCodeImage && point.qrCode) {
        const qrCodeDataURL = await QRCode.toDataURL(point.qrCode, {
          errorCorrectionLevel: 'M',
          type: 'image/png',
          quality: 0.92,
          margin: 1,
          width: 200
        });
        
        await db.collection('patrolPoints').doc(point.id).update({
          qrCodeImage: qrCodeDataURL,
          updatedBy: auth.uid,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        return {
          ...point,
          qrCodeImage: qrCodeDataURL
        };
      }
      
      return point;
    });
    
    const updatedPatrolPoints = await Promise.all(qrCodePromises);
    
    // Create printable sheet metadata
    const qrSheet = {
      siteId,
      siteName,
      patrolPoints: updatedPatrolPoints.map(point => ({
        id: point.id,
        label: point.label,
        qrCode: point.qrCode,
        qrCodeImage: point.qrCodeImage,
        order: point.order
      })),
      generatedBy: auth.uid,
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      tenantId: userData.tenantId
    };
    
    // Store the QR sheet for reference
    const sheetRef = await db.collection('qrSheets').add(qrSheet);
    
    console.log(`QR sheet generated for site ${siteId} with ${updatedPatrolPoints.length} points`);
    
    return {
      success: true,
      sheetId: sheetRef.id,
      siteName,
      patrolPoints: qrSheet.patrolPoints
    };
    
  } catch (error) {
    console.error('Error generating QR sheet:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', 'Failed to generate QR sheet');
  }
};
