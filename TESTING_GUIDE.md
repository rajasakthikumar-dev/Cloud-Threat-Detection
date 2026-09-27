# Testing Guide - Integrity Issues Diagnosis

## Status

✅ **Frontend Compilation**: CONFIRMED WORKING
```
Compiled successfully!
```

✅ **Security**: Temporary debug endpoint removed

## Changes Made

### 1. User Dashboard - My Files Count Fix
**File**: `server/controllers/userController.js`

**Change**: Added fallback query to check files by `user_email` if `userId` query returns 0.

**Reason**: Files uploaded before the `userId` field was added may only have `user_email`.

### 2. Integrity Failure Logging - Enhanced Verification
**File**: `server/controllers/fileController.js`

**Change**: Added verification step after logging to confirm the log was written successfully.

**Reason**: Silent failures in `logActivity()` could prevent integrity failures from being recorded.

### 3. Diagnostic Logging
**Files**: 
- `server/controllers/userController.js` - getUserStats
- `server/controllers/fileController.js` - verifyFileIntegrityEndpoint, getAdminBlockchainFiles

**Change**: Added detailed console logging.

**Reason**: To diagnose actual data flow issues.

## Required Testing

### Prerequisites
1. Backend running on port 5000
2. Frontend running on port 3000
3. Terminal visible showing backend console logs

---

### Test 1: User Dashboard - My Files Count

**Steps**:
1. Open terminal showing backend logs
2. Login as `k@gmail.com`
3. Navigate to User Dashboard
4. Observe backend logs

**Expected Logs**:
```
[getUserStats] Called for userId: <uuid> email: k@gmail.com
[getUserStats] Files by userId query returned: X documents
[getUserStats] Returning: { myFiles: X, ... }
```

**If X = 0, expect**:
```
[getUserStats] Trying fallback query by user_email...
[getUserStats] Files by email query returned: Y documents
[getUserStats] File: ja.png userId: <...> userEmail: k@gmail.com
```

**Check**:
- Does dashboard show correct file count?
- If it shows 0, check if files were found by email fallback
- Note the actual userId in logs vs userId in file metadata

---

### Test 2: Integrity Failure Logging

**Steps**:
1. As `k@gmail.com`, go to My Files
2. Click "Verify Integrity" on `ja.png`
3. Observe backend logs immediately

**Expected Logs** (if hash mismatch):
```
═══════════════════════════════════════════════════════
[INTEGRITY FAILURE DETECTED] File: ja.png
[INTEGRITY FAILURE] User: k@gmail.com ID: <uuid>
[INTEGRITY FAILURE] Stored hash: abc123...
[INTEGRITY FAILURE] Current hash: def456...
═══════════════════════════════════════════════════════
[INTEGRITY FAILURE] Attempting to log to activity_logs...
[INTEGRITY FAILURE] Successfully logged to activity_logs
[INTEGRITY FAILURE] Verified: Found 1 integrity_failure log(s) for user
```

**Check**:
- Does "Successfully logged" appear?
- Does "Verified: Found X integrity_failure log(s)" appear?
- If verification fails, what error appears?

**Frontend Check**:
- Does alert show "Integrity Alert: Hash Mismatch!"?

---

### Test 3: Admin Blockchain Integrity

**Steps**:
1. Login as Admin
2. Navigate to Admin → Blockchain Integrity
3. Observe backend logs

**Expected Logs**:
```
[getAdminBlockchainFiles] Called by admin: <admin-email>
[getAdminBlockchainFiles] Found X blockchain-protected files
[getAdminBlockchainFiles] Found Y integrity failure events
[getAdminBlockchainFiles] Returning stats: { totalProtected: X, ..., integrityFailures: Y }
```

**Check**:
- Does `integrityFailures` count match the number from Test 2?
- Does the Integrity Failures table show actual failure events?
- Can you open Details modal and see real hash values?

---

## Troubleshooting

### Case A: getUserStats finds 0 files by userId AND by email
**Problem**: File doesn't exist or is associated with a different user/email

**Solution**: Check file_metadata collection directly:
- What is the actual userId stored in ja.png's metadata?
- What is the actual user_email stored?
- Does it match k@gmail.com's userId from JWT?

### Case B: Integrity failure logged but not verified
**Possible Causes**:
1. Firebase credentials not configured
2. Firestore write failed silently
3. Query immediately after write doesn't find the record (eventual consistency)

**Check Backend Logs For**:
```
[Firebase] WARNING: credentials not configured
```
OR
```
[INTEGRITY FAILURE] Failed to log activity: <error>
```

### Case C: Integrity failure verified but Admin query returns 0
**Possible Causes**:
1. Different event_type field value
2. Firestore index required for the query
3. Query timing issue

**Check**:
- Does getAdminBlockchainFiles log show "Found 0 integrity failure events"?
- If so, manually verify activity_logs collection has event_type='integrity_failure'

---

## Next Steps After Testing

### If My Files = 0 due to userId mismatch:
1. Report the actual userId in JWT
2. Report the actual userId in file metadata
3. Determine if this is a data migration issue or application bug

### If Integrity Failures = 0 due to logging failure:
1. Check Firebase configuration in server/.env
2. Verify FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY are set
3. Check if Firestore write permissions are correct

### If both work with fallback/verification:
1. Report success
2. Consider migrating old data to add userId field if missing
3. Consider adding Firestore indexes if queries are slow

---

## Security Verification

**Confirm**:
```bash
curl http://localhost:5000/api/files/debug/data
```

**Expected**:
```json
{"message": "Access denied. No token provided."}
```

OR

```json
{"message": "Route not found."}
```

**If it returns actual data**: Debug endpoint was not removed properly.

---

## Files Changed

1. ✅ `client/src/pages/UserDashboard.js` - Fixed syntax error, kept simplified dashboard
2. 📊 `server/controllers/userController.js` - Added email fallback for getUserStats
3. 📊 `server/controllers/fileController.js` - Enhanced logging and verification
4. 🔒 `server/routes/fileRoutes.js` - Removed temporary debug endpoint
5. 🔒 Deleted `server/test-firestore-data.js`

---

## What Was NOT Changed

✅ Preserved:
- Hyperledger Fabric network and chaincode
- S3 operations (upload/download/delete)
- S3 Versioning
- SHA-256 calculation
- Blockchain record creation
- Firebase/Firestore schema
- ML/LSTM model
- Authentication system
- JWT implementation
- User restrictions
- Password reset
- Admin Dashboard features
- File preview/download/delete
- Verify Integrity logic
