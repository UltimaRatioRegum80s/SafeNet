import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Initialize Firebase Admin SDK
const serviceAccount = JSON.parse(
  readFileSync(resolve('./serviceAccountKey.json'), 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`,
  storageBucket: `${serviceAccount.project_id}.appspot.com`
});

const db = admin.firestore();
const auth = admin.auth();

interface DemoUser {
  email: string;
  password: string;
  displayName: string;
  roles: string[];
  phone?: string;
}

interface DemoTenant {
  name: string;
  billingPlan: 'basic' | 'professional' | 'enterprise';
}

interface DemoSite {
  name: string;
  geofence: {
    type: 'circle';
    center: { lat: number; lng: number };
    radius: number;
  };
}

interface DemoPatrolPoint {
  label: string;
  location: { lat: number; lng: number };
  radiusM: number;
  order: number;
}

async function seedDatabase() {
  console.log('🌱 Starting database seeding...');

  try {
    // Create demo tenant
    const demoTenant: DemoTenant = {
      name: 'Downtown Security Corp',
      billingPlan: 'professional'
    };

    console.log('📊 Creating demo tenant...');
    const tenantRef = await db.collection('tenants').add({
      ...demoTenant,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    const tenantId = tenantRef.id;
    console.log(`✅ Created tenant: ${tenantId}`);

    // Create demo users
    const demoUsers: DemoUser[] = [
      {
        email: 'admin@demo.com',
        password: 'password',
        displayName: 'System Administrator',
        roles: ['admin'],
        phone: '+1234567890'
      },
      {
        email: 'supervisor@demo.com',
        password: 'password',
        displayName: 'John Smith',
        roles: ['supervisor'],
        phone: '+1234567891'
      },
      {
        email: 'guard@demo.com',
        password: 'password',
        displayName: 'Officer Sarah Chen',
        roles: ['guard'],
        phone: '+1234567892'
      },
      {
        email: 'client@demo.com',
        password: 'password',
        displayName: 'Property Manager',
        roles: ['client'],
        phone: '+1234567893'
      }
    ];

    console.log('👥 Creating demo users...');
    const userIds: string[] = [];
    
    for (const demoUser of demoUsers) {
      // Create Firebase Auth user
      const userRecord = await auth.createUser({
        email: demoUser.email,
        password: demoUser.password,
        displayName: demoUser.displayName,
        phoneNumber: demoUser.phone
      });

      // Set custom claims for roles and tenant
      await auth.setCustomUserClaims(userRecord.uid, {
        roles: demoUser.roles,
        tenantId: tenantId
      });

      // Create Firestore user document
      await db.collection('users').doc(userRecord.uid).set({
        tenantId: tenantId,
        roles: demoUser.roles,
        displayName: demoUser.displayName,
        email: demoUser.email,
        phone: demoUser.phone,
        status: 'active',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      userIds.push(userRecord.uid);
      console.log(`✅ Created user: ${demoUser.email} (${userRecord.uid})`);
    }

    const [adminId, supervisorId, guardId, clientId] = userIds;

    // Create demo site
    const demoSite: DemoSite = {
      name: 'Downtown Plaza',
      geofence: {
        type: 'circle',
        center: { lat: 37.7749, lng: -122.4194 },
        radius: 200
      }
    };

    console.log('🏢 Creating demo site...');
    const siteRef = await db.collection('sites').add({
      ...demoSite,
      tenantId: tenantId,
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: adminId,
      updatedBy: adminId
    });
    const siteId = siteRef.id;
    console.log(`✅ Created site: ${siteId}`);

    // Create demo patrol points
    const demoPatrolPoints: DemoPatrolPoint[] = [
      {
        label: 'Main Entrance Gate',
        location: { lat: 37.7749, lng: -122.4194 },
        radiusM: 10,
        order: 1
      },
      {
        label: 'Parking Garage Level 2',
        location: { lat: 37.7759, lng: -122.4184 },
        radiusM: 15,
        order: 2
      },
      {
        label: 'Building A Lobby',
        location: { lat: 37.7739, lng: -122.4204 },
        radiusM: 10,
        order: 3
      },
      {
        label: 'Security Office',
        location: { lat: 37.7754, lng: -122.4189 },
        radiusM: 8,
        order: 4
      },
      {
        label: 'Emergency Exit - East',
        location: { lat: 37.7744, lng: -122.4174 },
        radiusM: 12,
        order: 5
      }
    ];

    console.log('📍 Creating demo patrol points...');
    const patrolPointIds: string[] = [];
    
    for (const point of demoPatrolPoints) {
      const qrCode = `WOLVES_PATROL_${point.label.toUpperCase().replace(/\s+/g, '_')}_${Date.now()}`;
      
      const pointRef = await db.collection('patrolPoints').add({
        ...point,
        siteId: siteId,
        qrCode: qrCode,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: supervisorId,
        updatedBy: supervisorId
      });
      
      patrolPointIds.push(pointRef.id);
      console.log(`✅ Created patrol point: ${point.label} (${pointRef.id})`);
    }

    // Create demo route
    console.log('🗺️ Creating demo route...');
    const routeRef = await db.collection('routes').add({
      siteId: siteId,
      name: 'Standard Evening Patrol',
      pointIds: patrolPointIds,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: supervisorId,
      updatedBy: supervisorId
    });
    console.log(`✅ Created route: ${routeRef.id}`);

    // Create demo shift
    console.log('⏰ Creating demo shift...');
    const now = new Date();
    const shiftStart = new Date(now.getTime() - 4 * 60 * 60 * 1000); // 4 hours ago
    const shiftEnd = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours from now

    await db.collection('shifts').add({
      siteId: siteId,
      guardId: guardId,
      startAt: admin.firestore.Timestamp.fromDate(shiftStart),
      endAt: admin.firestore.Timestamp.fromDate(shiftEnd),
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: supervisorId,
      updatedBy: supervisorId
    });
    console.log('✅ Created active shift');

    // Create demo check-ins
    console.log('✔️ Creating demo check-ins...');
    const checkInTimes = [
      new Date(now.getTime() - 3 * 60 * 60 * 1000), // 3 hours ago
      new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
      new Date(now.getTime() - 1 * 60 * 60 * 1000), // 1 hour ago
      new Date(now.getTime() - 30 * 60 * 1000),     // 30 minutes ago
    ];

    for (let i = 0; i < Math.min(checkInTimes.length, patrolPointIds.length); i++) {
      await db.collection('checkins').add({
        siteId: siteId,
        patrolPointId: patrolPointIds[i],
        guardId: guardId,
        timestamp: admin.firestore.Timestamp.fromDate(checkInTimes[i]),
        location: demoPatrolPoints[i].location,
        batteryPct: 87 - (i * 5),
        method: i % 2 === 0 ? 'qr' : 'gps',
        valid: true,
        pointLabel: demoPatrolPoints[i].label,
        guardName: 'Officer Sarah Chen',
        createdAt: admin.firestore.Timestamp.fromDate(checkInTimes[i]),
        createdBy: guardId
      });
      console.log(`✅ Created check-in: ${demoPatrolPoints[i].label}`);
    }

    // Create demo incidents
    console.log('🚨 Creating demo incidents...');
    const demoIncidents = [
      {
        category: 'suspicious',
        severity: 'high',
        description: 'Suspicious individual observed near the main entrance. Person was taking photos of security cameras and access points.',
        location: { lat: 37.7749, lng: -122.4194 },
        status: 'open',
        createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000)
      },
      {
        category: 'maintenance',
        severity: 'medium',
        description: 'Broken light fixture in parking garage level 2. Area is poorly lit and may pose safety risk.',
        location: { lat: 37.7759, lng: -122.4184 },
        status: 'in-progress',
        assignedTo: guardId,
        createdAt: new Date(now.getTime() - 4 * 60 * 60 * 1000)
      },
      {
        category: 'maintenance',
        severity: 'low',
        description: 'Visitor had difficulty with badge reader at main lobby. Issue resolved by manual override.',
        location: { lat: 37.7739, lng: -122.4204 },
        status: 'resolved',
        assignedTo: guardId,
        resolvedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
        createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000)
      }
    ];

    for (const incident of demoIncidents) {
      await db.collection('incidents').add({
        ...incident,
        siteId: siteId,
        photos: [],
        createdAt: admin.firestore.Timestamp.fromDate(incident.createdAt),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: guardId,
        updatedBy: guardId
      });
      console.log(`✅ Created incident: ${incident.description.substring(0, 50)}...`);
    }

    // Create compliance tracking data
    console.log('📈 Creating compliance data...');
    const today = new Date().toISOString().split('T')[0];
    await db.collection('compliance').doc(`${siteId}_${today}`).set({
      siteId: siteId,
      date: today,
      totalCheckins: 4,
      expectedCheckins: 6,
      guardCheckins: {
        [guardId]: 4
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('✅ Created compliance data');

    // Create additional tenant for testing multi-tenancy
    console.log('🏢 Creating additional tenant for multi-tenancy testing...');
    const secondTenantRef = await db.collection('tenants').add({
      name: 'Metro Property Management',
      billingPlan: 'basic',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`✅ Created second tenant: ${secondTenantRef.id}`);

    // Create test user for second tenant
    const secondTenantUser = await auth.createUser({
      email: 'guard2@demo.com',
      password: 'password',
      displayName: 'Officer Mike Johnson'
    });

    await auth.setCustomUserClaims(secondTenantUser.uid, {
      roles: ['guard'],
      tenantId: secondTenantRef.id
    });

    await db.collection('users').doc(secondTenantUser.uid).set({
      tenantId: secondTenantRef.id,
      roles: ['guard'],
      displayName: 'Officer Mike Johnson',
      email: 'guard2@demo.com',
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`✅ Created user for second tenant: guard2@demo.com`);

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📝 Demo Account Credentials:');
    console.log('Admin: admin@demo.com / password');
    console.log('Supervisor: supervisor@demo.com / password');
    console.log('Guard: guard@demo.com / password');
    console.log('Client: client@demo.com / password');
    console.log('Guard (Tenant 2): guard2@demo.com / password');
    console.log('\n🚀 You can now start the application and login with these accounts.');
    console.log('\n📊 Available test data:');
    console.log(`- 1 main tenant: ${demoTenant.name}`);
    console.log(`- 1 additional tenant: Metro Property Management`);
    console.log(`- 5 users across both tenants`);
    console.log(`- 1 site: ${demoSite.name}`);
    console.log(`- ${demoPatrolPoints.length} patrol points`);
    console.log(`- 1 patrol route`);
    console.log(`- 1 active shift`);
    console.log(`- 4 check-ins`);
    console.log(`- 3 incidents (open, in-progress, resolved)`);
    console.log(`- Compliance tracking data`);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

// Run the seed function
seedDatabase()
  .then(() => {
    console.log('\n✅ Seeding process completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Seeding process failed:', error);
    process.exit(1);
  });
