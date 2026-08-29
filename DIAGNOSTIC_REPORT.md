# AI-Threat-Detection Admin Dashboard Diagnostic Report
## READ-ONLY AUDIT — NO CODE CHANGES MADE

**Date:** 2026-08-26  
**Status:** COMPLETE  
**Auditor:** Kiro AI Assistant

---

## EXECUTIVE SUMMARY

The Admin Dashboard displays **REAL** Firebase/Firestore data for most components, but there is **ONE CRITICAL BUG** preventing the User Management page from displaying the data correctly.

**Root Cause:** The React `UserManagement.js` component uses MongoDB-style `_id` field names, but the Firebase Firestore backend returns `id` (without underscore). This causes the React component to fail to match users correctly, resulting in invisible/broken user rows.

**Good News:**
- ✅ Backend APIs return real Firestore data
- ✅ Firebase logging (`logActivity`, `logThreat`) works correctly
- ✅ Activity Logs display real data
- ✅ Threat Monitoring displays real data
- ✅ Dashboard KPIs display real Firestore counts
- ✅ S3 file integration works correctly

**Issue Found:**
- ❌ User Management page uses wrong field name (`_id` instead of `id`)

---

## 1. CONFIRMED WORKING ✅

### Backend Systems

| Component | Status | Evidence |
|-----------|--------|----------|
| Firebase Admin SDK | ✅ Working | Prints "[Firebase] Admin SDK initialised." |
| Firestore Database | ✅ Working | Successfully read/write all collections |
| Firebase Authentication | ✅ Working | User login/registration functional |
| AWS S3 Integration | ✅ Working | File upload/download/delete functional |
| FastAPI ML Service | ✅ Working | Threat analysis returns predictions |
| LSTM Model | ✅ Working | Returns attack predictions |
| Socket.io Real-time | ✅ Working | Real-time threat alerts broadcasting |

### Firestore Collections (Real Data Verified)

```
USERS collection:          9 documents
  - testuser_1786776053@test.local / user / Test User
  - admintest_1786776054@test.local / admin / Fake Admin
  - r@gmail.com / admin / raja
  - testuser_1786776434@test.local / user / Test User
  - test@example.com / user / Test User
  [... 4 more users]

ACTIVITY_LOGS collection:  32 documents
  - login / s@gmail.com / 2026-08-26T15:25:14.589Z
  - login / r@gmail.com / 2026-08-15T05:56:49.740Z
  - login / s@gmail.com / 2026-08-26T10:47:35.240Z
  - file_delete / s3test_1787717224920@test.local / 2026-08-26T04:07:33.825Z
  - login / r@gmail.com / 2026-08-26T15:28:59.995Z
  [... 27 more logs]

THREAT_LOGS collection:    2 documents
  - Attack / High / 99.9699% / hacker_1786776653@evil.com
  - Attack / High / 99.9699% / testuser_1786776434@test.local

FILE_METADATA collection:  2 documents
  - Screenshot from 2026-08-15 11-54-59.png / 359024 bytes / s@gmail.com
  - Screenshot from 2026-08-15 11-54-59.png / 359024 bytes / s@gmail.com
```

### Backend API Endpoints (All Return Real Data)

| Endpoint | Returns | Status |
|----------|---------|--------|
| `GET /api/users` | Real Firestore users | ✅ Working |
| `GET /api/users/admin/stats` | Real counts from Firestore | ✅ Working |
| `GET /api/logs` | Real activity_logs collection | ✅ Working |
| `GET /api/threats/recent` | Real threat_logs collection | ✅ Working |
| `GET /api/files` | Real file_metadata collection | ✅ Working |
| `POST /api/threats/analyze` | Real LSTM predictions | ✅ Working |

### Logging Functions (Correctly Implemented)

**`logActivity()` — Located in:** `server/config/firebase.js`

**Writes to:** `activity_logs` collection

**Called by:**
- `authController.register()` → `user_created` event
- `authController.login()` → `login` event  
- `authController.login()` (failed) → `login_failed` event
- `fileController.uploadFile()` → `file_upload` event
- `fileController.downloadFile()` → `file_download` event
- `fileController.deleteFile()` → `file_delete` event
- `threatController.analyzeActivity()` → `threat_detected` event
- `userController.deleteUser()` → `user_deleted` event
- `userController.updateRole()` → `role_changed` event

**✅ Result:** Activity logging is comprehensive and working correctly.

---

**`logThreat()` — Located in:** `server/config/firebase.js`

**Writes to:** `threat_logs` collection

**Called by:**
- `threatController.analyzeActivity()` → After ML prediction

**✅ Result:** Threat logging works correctly. Only called when ML service detects a threat (not on normal logins).

---

### Frontend React Pages (Data Flow Status)

| Page | API Call | Data Source | Status |
|------|----------|-------------|--------|
| AdminDashboard | `getAdminStats()`, `getRecentThreats()` | Real Firestore | ✅ Working |
| ActivityLogs | `getActivityLogs()` | Real activity_logs | ✅ Working |
| ThreatMonitoring | `getThreats()`, `getThreatStats()` | Real threat_logs | ✅ Working |
| FileManagement | `getFiles()` | Real file_metadata + S3 | ✅ Working |
| UserManagement | `getAllUsers()` | Real users collection | ❌ **BUG** (see below) |

---

## 2. CONFIGURATION PROBLEMS

### ⚠️ Firestore Index Required

**Issue:** File listing queries require a composite index.

**Error Message:**
```
The query requires an index. You can create it here:
https://console.firebase.google.com/v1/r/project/ai-threat-detection-272ec/firestore/indexes
```

**Query:** `collection('file_metadata').where('userId', '==', ...).orderBy('uploadedAt', 'desc')`

**Impact:** File listing may fail for users with multiple files.

**Solution:** Click the Firebase Console URL to create the index (one-time, 2-5 minutes).

**Severity:** Low (workaround: upload files triggers error with auto-fix link)

---

## 3. CODE/INTEGRATION PROBLEMS

### ❌ CRITICAL BUG: User Management Page Field Name Mismatch

**Location:** `client/src/pages/UserManagement.js`

**Problem:** Component uses MongoDB-style `_id` field, but Firestore backend returns `id`.

**Affected Lines:**

```javascript
Line 52:  setUsers(prev => prev.filter(u => u._id !== id));
Line 61:  setUsers(prev => prev.map(u => u._id === id ? { ...u, role: newRole } : u));
Line 106: <tr key={u._id}>
Line 121: onClick={() => handleRoleToggle(u._id, u.role)}
Line 126: onClick={() => handleDelete(u._id, u.name)}
```

**Backend Response Format (Correct):**
```json
{
  "users": [
    {
      "id": "35da8356-e79b-4eef-b7da-7aa02f8aff48",
      "email": "r@gmail.com",
      "role": "admin",
      "name": "raja",
      "createdAt": "2024-08-15T05:56:49.740Z"
    }
  ]
}
```

**React Component Expects (Incorrect):**
```javascript
u._id  // ❌ Does not exist in Firestore response
```

**Impact:**
- User rows render but `key={u._id}` is undefined → React errors
- Delete/role toggle buttons receive undefined ID → API calls fail
- User data displays but actions don't work

**Root Cause:** Developer used MongoDB conventions (`_id`) instead of Firestore conventions (`id`).

**Evidence:**
- Backend `listUsers()` in `userController.js` returns `id` (line 23: `return { id: doc.id, ...doc.data() }`)
- Backend `getAllUsers()` in `firebase.js` returns `id` (line 234: `return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))`)

---

## 4. MOCK/STATIC DATA

### ⚠️ Dashboard Placeholder Data (Not a Real Issue)

**Location:** `client/src/pages/AdminDashboard.js`

**Line 35-39:**
```javascript
const PLACEHOLDER = {
  stats:  { users: 0, files: 0, threats: 0, alerts: 0 },
  area:   [],
  bar:    [],
  pie:    [{ name: 'Low', value: 60 }, { name: 'Medium', value: 30 }, { name: 'High', value: 10 }],
  recent: [],
};
```

**Status:** ✅ **NOT A PROBLEM**

**Explanation:**
- This is a **temporary loading state** placeholder
- Line 57: `async function fetchAll()` replaces placeholders with real API data
- Placeholders only show during initial page load
- Once API responds, all data is real Firestore data

**Verification:**
- Line 62: `setStats({ users: d.totalUsers, files: d.totalFiles, ... })` ← Real data
- Line 63-65: Sets real `area`, `bar`, `pie`, `recent` from API

**Conclusion:** This is proper React loading state pattern, not fake data.

---

## 5. FIRESTORE LOGGING AUDIT

### Activity Logging Flow

```
User Action
  ↓
Backend Controller (auth/file/threat/user)
  ↓
await logActivity({ userId, userEmail, event_type, details, ip_address, metadata })
  ↓
Firebase firestore().collection('activity_logs').add({ ... })
  ↓
Admin Dashboard → GET /api/logs
  ↓
ActivityLogs.js displays real data
```

**Events Currently Logged:**
- `user_created` — User registration
- `login` — Successful login
- `login_failed` — Failed login attempt
- `file_upload` — File uploaded to S3
- `file_download` — Pre-signed URL generated
- `file_delete` — File deleted from S3
- `threat_detected` — ML detected threat
- `user_deleted` — Admin deleted user
- `role_changed` — Admin changed user role

**✅ Status:** Activity logging is comprehensive and working correctly.

**Verification:** 32 real activity logs exist in Firestore with proper timestamps and details.

---

### Threat Logging Flow

```
User submits network data
  ↓
POST /api/threats/analyze
  ↓
Forward to FastAPI ML service (localhost:8000)
  ↓
LSTM model prediction
  ↓
await logThreat({ userId, userEmail, attack_type, risk_level, confidence_score, source_ip, raw_input })
  ↓
Firebase firestore().collection('threat_logs').add({ ... })
  ↓
Admin Dashboard → GET /api/threats/recent
  ↓
ThreatMonitoring.js displays real data
```

**Threats Currently Logged:**
- Attack / High / 99.9699% / hacker_1786776653@evil.com
- Attack / High / 99.9699% / testuser_1786776434@test.local

**✅ Status:** Threat logging is working correctly.

**Note:** Normal logins are NOT logged as threats. Only ML predictions are logged to `threat_logs`. Normal activities go to `activity_logs`.

---

## 6. ADMIN USERS AUDIT

### How User Management Currently Works

**Backend (Correct):**

1. `GET /api/users` → `userController.listUsers()`
2. Calls `getAllUsers()` from Firebase config
3. Returns real Firestore users:

```javascript
const users = await getAllUsers();  // Firestore query
const safe  = users.map(({ passwordHash, ...u }) => u);  // Remove password
return res.json({ users: safe });
```

4. Response format:
```json
{
  "users": [
    { "id": "35da8356-...", "email": "r@gmail.com", "role": "admin", "name": "raja" },
    { "id": "6beceb9a-...", "email": "test@example.com", "role": "user", "name": "Test User" }
  ]
}
```

**Frontend (Buggy):**

1. `UserManagement.js` calls `getAllUsers()` API
2. Receives real data
3. **BUG:** Component uses `u._id` instead of `u.id`
4. Result: React cannot match users correctly

**Why Users Are Not "Fake":**
- ✅ Backend returns real Firebase Authentication users from Firestore
- ✅ Data comes from `users` collection (verified with 9 real users)
- ✅ Email addresses match Firebase Authentication
- ❌ Frontend cannot display them correctly due to field name mismatch

**Proof:** Firestore audit shows 9 real users:
```
- testuser_1786776053@test.local / user / Test User
- admintest_1786776054@test.local / admin / Fake Admin
- r@gmail.com / admin / raja
- testuser_1786776434@test.local / user / Test User
- test@example.com / user / Test User
[... 4 more]
```

---

## 7. S3 AUDIT

### Files in S3 Dashboard Count

**Dashboard Shows:** 2 files  
**Firestore Shows:** 2 file_metadata documents  
**S3 Bucket Shows:** 2 objects (verified via S3 integration test)

**Files:**
1. Screenshot from 2026-08-15 11-54-59.png / 359024 bytes / s@gmail.com
2. Screenshot from 2026-08-15 11-54-59.png / 359024 bytes / s@gmail.com (duplicate)

**Why 2 Files?**
- User uploaded the same file twice (different upload sessions)
- Each upload creates a unique S3 key: `uploads/{userId}/{uuid}-{filename}`
- Both are legitimate application uploads

**Test Files:**
- ✅ No test files remain in S3
- ✅ S3 integration test file `test-file-1787717251281.txt` was properly deleted after test

**Dashboard Counting Logic:**
```javascript
// server/controllers/userController.js line 148
const filesSnap = await db.collection(COLLECTIONS.FILE_METADATA).get();
// Returns: { totalFiles: filesSnap.size }  ← Real count
```

**✅ Status:** S3 file counting is accurate. No test files included.

---

## 8. DASHBOARD API AUDIT

### Dashboard Card Data Flow

| Card | API Endpoint | Backend Query | Data Source | Status |
|------|--------------|---------------|-------------|--------|
| **Total Users** | `/api/users/admin/stats` | `db.collection('users').get()` | Real Firestore users | ✅ Real (9) |
| **Files in S3** | `/api/users/admin/stats` | `db.collection('file_metadata').get()` | Real file metadata | ✅ Real (2) |
| **Threats Logged** | `/api/users/admin/stats` | `db.collection('threat_logs').get()` | Real threat logs | ✅ Real (2) |
| **Active Alerts** | `/api/users/admin/stats` | Filter threats < 24h old | Real threat logs | ✅ Real (calculated) |

**Code Verification:**
```javascript
// client/src/pages/AdminDashboard.js line 62
setStats({ 
  users: d.totalUsers,      // ← Real Firestore count
  files: d.totalFiles,      // ← Real Firestore count
  threats: d.totalThreats,  // ← Real Firestore count
  alerts: d.activeAlerts    // ← Real Firestore count (< 24h)
});
```

---

### Dashboard Chart Data Flow

| Chart | API Endpoint | Data Source | Status |
|-------|--------------|-------------|--------|
| **Traffic Overview** | `/api/users/admin/stats` | `trafficTimeline: []` | ⚠️ Empty (not implemented) |
| **Attack Categories** | `/api/users/admin/stats` | Real threat_logs aggregation | ✅ Real data |
| **Risk Distribution** | `/api/users/admin/stats` | Real threat_logs counts | ✅ Real data |
| **Recent Threats** | `/api/threats/recent` | Real threat_logs (last 20) | ✅ Real data |

**Traffic Timeline Issue:**
```javascript
// server/controllers/userController.js line 191
trafficTimeline: [],   // populated by a separate analytics job
```

**Status:** ⚠️ Traffic timeline is intentionally empty (requires analytics job not yet implemented).

**Other Charts:** All use real Firestore data.

---

## 9. ROOT CAUSE CLASSIFICATION

| Problem | Category | Severity | Status |
|---------|----------|----------|--------|
| User Management field mismatch (`_id` vs `id`) | **Frontend Bug** | 🔴 Critical | Code fix needed |
| Firestore composite index missing | **Configuration** | 🟡 Medium | One-time setup |
| Traffic timeline empty | **Feature Not Implemented** | 🟢 Low | Future enhancement |

**Primary Issue:** Frontend code bug (MongoDB conventions used with Firestore backend).

**NOT Issues:**
- ❌ Firebase Authentication (working correctly)
- ❌ Firestore logging (working correctly)
- ❌ Backend APIs (returning real data)
- ❌ S3 integration (working correctly)
- ❌ ML model (working correctly)
- ❌ Fake/mock data (only temporary loading placeholders)

---

## 10. RECOMMENDED FIX PLAN

### Priority 1: Critical Bug (User Management)

**File:** `client/src/pages/UserManagement.js`

**Changes Required:**
```javascript
// Line 52: Replace
setUsers(prev => prev.filter(u => u._id !== id));
// With:
setUsers(prev => prev.filter(u => u.id !== id));

// Line 61: Replace
setUsers(prev => prev.map(u => u._id === id ? { ...u, role: newRole } : u));
// With:
setUsers(prev => prev.map(u => u.id === id ? { ...u, role: newRole } : u));

// Line 106: Replace
<tr key={u._id}>
// With:
<tr key={u.id}>

// Line 121: Replace
onClick={() => handleRoleToggle(u._id, u.role)}
// With:
onClick={() => handleRoleToggle(u.id, u.role)}

// Line 126: Replace
onClick={() => handleDelete(u._id, u.name)}
// With:
onClick={() => handleDelete(u.id, u.name)}
```

**Test:** After fix, verify user delete/role toggle works in User Management page.

---

### Priority 2: Firestore Index (One-time Setup)

**Action:**
1. Upload a file via the File Management page
2. Check Node.js server logs for Firestore error
3. Click the Firebase Console URL in the error
4. Firebase auto-creates the index
5. Wait 2-5 minutes for index to build

**No code changes needed.**

---

### Priority 3: Traffic Timeline (Future Enhancement)

**Recommended Approach:**
1. Create analytics aggregation job (cron or Cloud Function)
2. Pre-compute daily traffic stats from activity_logs
3. Store in `analytics_timeline` collection
4. Update `getAdminStats()` to read from this collection

**Not urgent** — Dashboard works without this chart.

---

## VERIFICATION TESTS

### Test 1: Backend APIs Return Real Data ✅

```bash
cd server
node _test_apis.js
```

**Expected:**
- Total Users: 9
- Total Files: 2
- Total Threats: 2
- Activity Logs: 32
- Recent Threats: 2

**Actual:** ✅ All counts match Firestore

---

### Test 2: Firestore Data Exists ✅

```bash
cd server
node _firestore_audit.js
```

**Result:**
```
USERS:          9 documents
ACTIVITY_LOGS:  32 documents
THREAT_LOGS:    2 documents
FILE_METADATA:  2 documents
```

**Status:** ✅ Real data confirmed

---

### Test 3: User Management Bug ❌

**Steps:**
1. Login as admin
2. Go to User Management page
3. Try to delete a user
4. Try to toggle a user role

**Expected:** Actions should work  
**Actual:** ❌ Actions fail (undefined ID passed to API)

**Reason:** Frontend uses `u._id` (undefined) instead of `u.id`

---

## SUMMARY

### What's Working (Most of the System)

✅ **Backend Infrastructure:**
- Firebase Admin SDK initialized
- Firestore database operational
- AWS S3 integration functional
- FastAPI ML service running
- LSTM model making predictions
- Socket.io real-time alerts working

✅ **Data Flow:**
- User registration/login creates Firestore records
- Activity logging working (32 real logs)
- Threat logging working (2 real threats)
- File uploads create S3 objects + Firestore metadata
- Admin APIs return real Firestore data

✅ **Frontend Pages (Mostly):**
- Admin Dashboard displays real KPIs
- Activity Logs displays real activity_logs
- Threat Monitoring displays real threat_logs
- File Management displays real S3 files

### What's Broken (One Critical Bug)

❌ **User Management Page:**
- Frontend uses wrong field name (`_id` instead of `id`)
- User data loads but actions (delete/role toggle) fail
- **5 lines of code need to be changed**

### What Needs Configuration

⚠️ **Firestore Index:**
- Composite index for file_metadata queries
- One-time setup via Firebase Console
- Takes 2-5 minutes

---

## CONCLUSION

The Admin Dashboard is **NOT using fake/mock data**. It's using **real Firebase/Firestore data** throughout. There is ONE critical frontend bug preventing the User Management page from working correctly.

**The fix is simple:** Change 5 occurrences of `_id` to `id` in `UserManagement.js`.

**No changes needed to:**
- Firebase configuration
- Firestore structure
- Backend APIs
- Logging functions
- ML system
- S3 integration

**The diagnostic is complete. Awaiting approval to implement the fix.**

---

## FILES INSPECTED (No Changes Made)

### Backend Files
- `server/config/firebase.js`
- `server/config/aws.js`
- `server/controllers/authController.js`
- `server/controllers/fileController.js`
- `server/controllers/userController.js`
- `server/controllers/threatController.js`
- `server/routes/authRoutes.js`
- `server/routes/fileRoutes.js`
- `server/routes/userRoutes.js`
- `server/routes/threatRoutes.js`
- `server/middleware/authMiddleware.js`
- `server/middleware/roleMiddleware.js`
- `server/server.js`

### Frontend Files
- `client/src/App.js`
- `client/src/pages/AdminDashboard.js`
- `client/src/pages/UserManagement.js`
- `client/src/pages/ActivityLogs.js`
- `client/src/pages/ThreatMonitoring.js`
- `client/src/pages/FileManagement.js`
- `client/src/services/api.js`

### Test Scripts Created (Read-Only)
- `server/_firestore_audit.js` — Firestore data verification
- `server/_test_apis.js` — API response testing
- `server/_check_user.js` — User lookup verification

---

**END OF DIAGNOSTIC REPORT**
