import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { validateCheckin } from './checkins';
import { createIncidentHandler, notifyIncidentAssignment } from './incidents';
import { createSOSAlert, notifySOSAlert } from './alerts';
import { generateQRCode } from './qr';

// Initialize Firebase Admin
admin.initializeApp();

// Set global options
setGlobalOptions({
  region: 'us-central1',
});

// Checkin validation and processing
export const onCheckinCreate = onDocumentCreated(
  'checkins/{checkinId}',
  validateCheckin
);

// Incident processing
export const createIncident = onCall(createIncidentHandler);

export const onIncidentCreate = onDocumentCreated(
  'incidents/{incidentId}',
  notifyIncidentAssignment
);

// SOS/Alert processing
export const createSOS = onCall(createSOSAlert);

export const onAlertCreate = onDocumentCreated(
  'alerts/{alertId}',
  notifySOSAlert
);

// QR Code generation
export const generatePatrolPointQR = onCall(generateQRCode);

// Dashboard summary function
export const getDashboardSummary = onCall(async (request) => {
  const { siteId, from, to } = request.data;
  const { auth } = request;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    const db = admin.firestore();
    const fromDate = new Date(from);
    const toDate = new Date(to);

    // Get checkins for the period
    const checkinsSnapshot = await db.collection('checkins')
      .where('siteId', '==', siteId)
      .where('timestamp', '>=', fromDate)
      .where('timestamp', '<=', toDate)
      .get();

    // Get incidents for the period
    const incidentsSnapshot = await db.collection('incidents')
      .where('siteId', '==', siteId)
      .where('createdAt', '>=', fromDate)
      .where('createdAt', '<=', toDate)
      .get();

    // Get patrol points for compliance calculation
    const patrolPointsSnapshot = await db.collection('patrolPoints')
      .where('siteId', '==', siteId)
      .get();

    const totalPatrolPoints = patrolPointsSnapshot.size;
    const totalCheckins = checkinsSnapshot.size;
    const totalIncidents = incidentsSnapshot.size;
    const openIncidents = incidentsSnapshot.docs.filter(
      doc => doc.data().status === 'open'
    ).length;

    // Calculate compliance (simplified)
    const expectedCheckins = totalPatrolPoints * 24; // Assuming 24 patrols per day
    const compliance = totalCheckins > 0 ? 
      Math.min((totalCheckins / expectedCheckins) * 100, 100) : 0;

    return {
      totalCheckins,
      totalIncidents,
      openIncidents,
      compliance: Math.round(compliance * 10) / 10,
      period: { from, to }
    };
  } catch (error) {
    console.error('Error getting dashboard summary:', error);
    throw new HttpsError('internal', 'Failed to get dashboard summary');
  }
});

// Health check endpoint
export const healthCheck = onRequest((req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});
