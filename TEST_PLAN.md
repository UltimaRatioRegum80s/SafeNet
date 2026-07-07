# NaborNet Test Plan

This document defines the testing strategy for maintaining app stability during closed beta.

---

## Priority-1 E2E Tests (Playwright)

These tests validate critical user flows and must pass before any release:

### 1. LegalGate Consent Flow
- **Test**: LegalGate blocks app access until Terms and Privacy are accepted
- **Steps**: Load app → Verify consent modal appears → Cannot proceed without checking both boxes → Accept → App becomes accessible
- **Pass criteria**: User cannot interact with app until consent is given

### 2. Verified User Can Create Incident
- **Test**: A verified user can successfully create an incident
- **Steps**: Login as verified user → Navigate to report form → Fill required fields → Submit → Verify success response
- **Pass criteria**: Incident is created and appears in the feed

### 3. Unverified User Cannot Create Incident
- **Test**: An unverified user is blocked from creating incidents
- **Steps**: Login as unverified user → Attempt to access report form → Verify guardrail message appears
- **Pass criteria**: User sees verification prompt, form is not accessible

### 4. Kill Switch Blocks Incident Creation
- **Test**: When `INCIDENT_CREATION_ENABLED=false`, incident creation returns 503
- **Steps**: Set kill switch → Attempt to create incident → Verify 503 response
- **Pass criteria**: API returns "Incident reporting temporarily disabled"
- **Note**: Only run if kill switch flag exists in environment

---

## Extended/Non-Blocking Tests

Tests in `e2e/extended/` are potentially flaky due to timing or environment factors. They do not block releases but should be monitored.

### Offline Indicator Appears (Extended)
- **Test**: Offline indicator displays when network is unavailable
- **Steps**: Load app → Simulate offline → Verify offline indicator is visible
- **Pass criteria**: User sees clear indication they are offline
- **Note**: Moved to extended suite due to service worker timing variability in CI/headless environments

---

## Minimum Unit Tests (Future Priority)

These tests cover critical internal logic:

### syncEngine Tests
- Retry logic respects exponential backoff delays
- Max retries (5) marks incident as error
- Sync skips when already syncing or offline

### offlineDb Tests
- `enqueueIncident` creates valid PendingIncident with idempotencyKey
- `updateIncidentStatus` correctly transitions states
- `purgeOldIncidents` removes items older than threshold
- `getPendingIncidents` returns only pending status items

### Idempotency Key Generation
- Keys include client instance ID
- Keys are unique across calls
- Keys persist correctly in IndexedDB

---

## Manual Smoke Checklist

Run through this checklist before any deployment:

### Kill Switches
- [ ] `INCIDENT_CREATION_ENABLED=false` blocks POST /api/incidents
- [ ] `OFFLINE_SYNC_ENABLED=false` blocks offline sync submissions
- [ ] `SIGNUP_MODE=whitelist` blocks non-whitelisted registrations

### Auth Flow
- [ ] Login works for existing users
- [ ] Registration blocked for non-whitelisted emails
- [ ] Password reset email sends (sandbox limitation acknowledged)
- [ ] Email verification banner appears for unverified users
- [ ] Logout clears session and offline data

### Consent Gate
- [ ] LegalGate appears on first visit
- [ ] Both checkboxes required to proceed
- [ ] Consent persists after accepting
- [ ] Version change triggers re-consent

### Mobile Layout (375px)
- [ ] Navigation is accessible
- [ ] Forms are usable
- [ ] Map displays correctly
- [ ] Buttons are tappable (min 44px touch target)
- [ ] Text is readable without zooming

### Offline/PWA
- [ ] App installs as PWA
- [ ] App shell loads when offline
- [ ] Offline indicator appears when disconnected
- [ ] Queued incidents show pending status
- [ ] Sync occurs when connection returns

---

## Test Environment Notes

- E2E tests require `E2E_TEST_MODE=true` to access test-only endpoints
- Test users created via E2E endpoints are isolated from production data
- Kill switch tests should be run in isolation to avoid affecting other tests

---

## How to Run Tests Locally

### Prerequisites
- Ensure `E2E_TEST_MODE=true` is set (Playwright config handles this automatically via webServer command)
- Install Playwright browsers: `npx playwright install chromium`

### CORE Tests (Blocking - must pass)
Runs all tests in `e2e/*.spec.ts` (excludes extended):
```bash
npx playwright test e2e/*.spec.ts --reporter=line
```

**Files included:**
- `e2e/smoke.spec.ts` - Health check and basic navigation
- `e2e/legal-gate.spec.ts` - Consent flow validation
- `e2e/incident-creation.spec.ts` - Verified/unverified user incident creation
- `e2e/kill-switch.spec.ts` - Kill switch behavior and auth flow

### EXTENDED Tests (Non-blocking - may be flaky)
Runs all tests in `e2e/extended/`:
```bash
npx playwright test e2e/extended --reporter=line
```

**Files included:**
- `e2e/extended/offline-indicator.spec.ts` - Service worker and offline detection (potentially flaky due to SW timing)

### Full Suite (All tests)
Runs both core and extended:
```bash
npx playwright test --reporter=line
```

### View HTML Report
After any test run:
```bash
npx playwright show-report
```

---

## CI Configuration

**Core tests** run on every push and PR (blocking).
**Extended tests** are run manually or on a nightly schedule (non-blocking).

### GitHub Actions Workflow

**File:** `.github/workflows/e2e.yml`

**Triggers:**
- Push to `main` or `master` branch
- Pull request to `main` or `master` branch

**Steps:**
1. Checkout repository
2. Setup Node.js 20
3. Install dependencies (`npm ci`)
4. Install Playwright browsers (`npx playwright install chromium --with-deps`)
5. Start server with `E2E_TEST_MODE=true npm run dev` (polls `http://localhost:5000` for readiness)
6. Run CORE tests: `E2E_TEST_MODE=true npx playwright test e2e/*.spec.ts --reporter=line`
7. Upload artifacts on failure

**Estimated Runtime:** ~3-5 minutes (depends on GitHub Actions queue)

### Viewing Artifacts on Failure

When a CI run fails:
1. Go to the GitHub Actions tab in your repository
2. Click on the failed workflow run
3. Scroll to the "Artifacts" section at the bottom
4. Download `playwright-report` or `test-results` to view screenshots, videos, and traces

**Artifacts retained for:** 7 days

### CI Secrets Required

- `DATABASE_URL` - PostgreSQL connection string (set in GitHub repository secrets)

> ⚠️ **CRITICAL: Use a TEST database, NOT production!**
> 
> E2E tests create and delete test users (matching `e2e-test-*@test.local`). The `DATABASE_URL` secret in GitHub **must point to a dedicated test/staging database**, never production.
> 
> **Safe setup:**
> - Create a separate Neon/Postgres branch or database for CI
> - Use the same schema but isolated data
> - The cleanup endpoint only deletes users matching the E2E pattern, but using prod is still risky
