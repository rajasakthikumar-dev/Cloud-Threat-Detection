# Blockchain Integrity Testing Checklist

## Pre-Testing Verification

- [x] Frontend compiles: `Compiled successfully!`
- [x] Backend running on port 5000
- [x] No hardcoded users/emails in code
- [x] No hardcoded files in code
- [x] No hardcoded counts in code
- [x] No new Firestore collections created
- [x] Fabric network unchanged
- [x] S3 operations unchanged

---

## Test Scenarios

### ✅ TEST 1: Normal User - File Upload

**User**: Any normal user (e.g., `k@gmail.com`, `user1@test.com`)

**Steps**:
1. Login as normal user
2. Upload a file
3. Check My Files page
4. Check User Dashboard

**Expected Results**:
- [ ] File appears in My Files
- [ ] File has blockchain shield icon
- [ ] Dashboard "My Files" count increases by 1
- [ ] Dashboard "Blockchain Protected" count increases by 1

**Backend Logs to Check**:
```
[fileController.uploadFile] ...
Blockchain record created: <txId>
```

---

### ✅ TEST 2: Normal User - Successful Verification

**User**: Same user from TEST 1

**Steps**:
1. Go to My Files
2. Click "Verify Integrity" on the uploaded file
3. Observe toast message
4. Check User Dashboard

**Expected Results**:
- [ ] Toast shows: "✓ filename — Integrity Verified"
- [ ] Dashboard "Integrity Verified" increases to 1
- [ ] Verify same file again
- [ ] Dashboard "Integrity Verified" stays at 1 (not 2)

**Backend Logs to Check**:
```
[INTEGRITY SUCCESS] File: <filename> User: <email>
[INTEGRITY SUCCESS] Hash match confirmed
[INTEGRITY SUCCESS] Successfully logged to activity_logs
```

---

### ✅ TEST 3: Normal User - Hash Mismatch Detection

**User**: Same user from TEST 1

**Setup**: Modify file externally (S3 console) OR use existing test file

**Steps**:
1. Go to My Files
2. Click "Verify Integrity" on a modified file
3. Observe toast message
4. Check User Dashboard

**Expected Results**:
- [ ] Toast shows: "✗ filename — Integrity Alert: Hash Mismatch!"
- [ ] Dashboard "Integrity Failures" increases to 1
- [ ] Verify same file again
- [ ] Dashboard "Integrity Failures" stays at 1 (not 2)

**Backend Logs to Check**:
```
═══════════════════════════════════════════════════════
[INTEGRITY FAILURE DETECTED] File: <filename>
[INTEGRITY FAILURE] User: <email> ID: <userId>
[INTEGRITY FAILURE] Stored hash: <hash1>
[INTEGRITY FAILURE] Current hash: <hash2>
═══════════════════════════════════════════════════════
[INTEGRITY FAILURE] Attempting to log to activity_logs...
[INTEGRITY FAILURE] Successfully logged to activity_logs
[INTEGRITY FAILURE] Verified: Found X integrity_failure log(s) for user
```

---

### ✅ TEST 4: Admin - Global View

**User**: Admin account

**Steps**:
1. Login as admin
2. Navigate to Admin → Blockchain Integrity
3. Check statistics at top
4. Check Protected Files table

**Expected Results**:
- [ ] Protected Files count = total files with blockchain records (all users)
- [ ] Blockchain Records count = same as Protected Files
- [ ] Verified Files count = real unique verified files (from all users)
- [ ] Integrity Failures count = real unique failed files (from all users)
- [ ] Table shows files from multiple users (not just admin's files)
- [ ] Owner column shows actual uploader names/emails

**Example**:
```
Protected Files: 10
Blockchain Records: 10
Verified Files: 7
Integrity Failures: 2

Table shows:
- report.pdf (Owner: alice@example.com)
- data.csv (Owner: bob@example.com)
- image.png (Owner: admin@example.com)
- ...
```

**Backend Logs to Check**:
```
[getAdminBlockchainFiles] Called by admin: <admin-email>
[getAdminBlockchainFiles] Found X blockchain-protected files
[getAdminBlockchainFiles] Found Y unique verified files (from Z verification events)
[getAdminBlockchainFiles] Found A unique failed files (from B failure events)
[getAdminBlockchainFiles] Returning stats: { totalProtected: X, ..., verifiedFiles: Y, integrityFailures: A }
```

---

### ✅ TEST 5: Admin - Verify Any User's File

**User**: Admin account

**Steps**:
1. In Admin → Blockchain Integrity
2. Find a file uploaded by a normal user
3. Click "Verify" on that file
4. Observe result

**Expected Results**:
- [ ] Verification succeeds (admin authorized)
- [ ] Toast shows success or failure based on actual hash comparison
- [ ] Stats update correctly
- [ ] No authorization error

**Backend Logs to Check**:
```
Authorization check (owner OR admin)
isOwner: false
isAdmin: true
✓ Authorized to verify
```

---

### ✅ TEST 6: Admin - Upload & Verify Own File

**User**: Admin account

**Steps**:
1. Admin uploads a file
2. Admin verifies the file they uploaded
3. Check stats

**Expected Results**:
- [ ] Upload succeeds
- [ ] Blockchain record created
- [ ] Verification succeeds
- [ ] Admin's file counted in Protected Files
- [ ] Admin's verification counted in Verified Files

**Important**: Admin files treated same as normal user files (no special logic)

---

### ✅ TEST 7: Cross-User Isolation

**Users**: Two different normal users (UserA, UserB)

**Steps**:
1. UserA uploads `fileA.pdf` and verifies it
2. UserB uploads `fileB.pdf` and verifies it
3. UserA checks dashboard
4. UserB checks dashboard
5. Admin checks dashboard

**Expected Results**:

**UserA Dashboard**:
- [ ] Shows only UserA's files
- [ ] My Files = 1 (fileA.pdf only)
- [ ] Blockchain Protected = 1
- [ ] Integrity Verified = 1
- [ ] Does NOT show fileB.pdf

**UserB Dashboard**:
- [ ] Shows only UserB's files
- [ ] My Files = 1 (fileB.pdf only)
- [ ] Blockchain Protected = 1
- [ ] Integrity Verified = 1
- [ ] Does NOT show fileA.pdf

**Admin Dashboard**:
- [ ] Shows files from BOTH users
- [ ] Protected Files = 2 (minimum)
- [ ] Verified Files = 2 (if both verified successfully)
- [ ] Table lists both fileA.pdf and fileB.pdf with correct owners

---

### ✅ TEST 8: Multiple Verifications - Same File

**User**: Any user

**Steps**:
1. Upload a file
2. Verify it successfully (1st time)
3. Verify it successfully (2nd time)
4. Verify it successfully (3rd time)
5. Check dashboard

**Expected Results**:
- [ ] Toast shows success 3 times
- [ ] Dashboard "Integrity Verified" = 1 (not 3)
- [ ] 3 `integrity_verified` events in activity_logs
- [ ] Stats count unique files, not events

**Backend Logs to Check**:
```
[getUserStats] Unique verified files: 1 (from 3 verification events)
```

---

### ✅ TEST 9: Multiple Failures - Same File

**User**: Any user

**Steps**:
1. Upload a file
2. Modify file externally
3. Verify (1st failure)
4. Verify again (2nd failure)
5. Check dashboard

**Expected Results**:
- [ ] Toast shows failure 2 times
- [ ] Dashboard "Integrity Failures" = 1 (not 2)
- [ ] 2 `integrity_failure` events in activity_logs
- [ ] Stats count unique files, not events

**Backend Logs to Check**:
```
[getUserStats] Unique failed files: 1 (from 2 failure events)
```

---

### ✅ TEST 10: Integrity Failure Details (Admin)

**User**: Admin account

**Setup**: Ensure at least one integrity failure exists

**Steps**:
1. Navigate to Admin → Blockchain Integrity
2. Scroll to "Integrity Failures" section
3. Click on a failure row
4. Check Details modal

**Expected Results**:
- [ ] Failure table shows real failures (not dummy data)
- [ ] Each row shows: file name, owner, detection time
- [ ] Details modal shows:
  - File Name (real)
  - Owner (real email/name)
  - User ID (real UUID)
  - Detection Time (real timestamp)
  - Status: "INTEGRITY_ALERT"
  - Failure Reason: "Hash Mismatch"
  - Original SHA-256 (real hash)
  - Current SHA-256 (real hash, different from original)
  - Original S3 Version ID (real)
  - Current S3 Version ID (real)
  - Metadata (IP, device, browser if available)

**No Hardcoded Values**:
- [ ] File name is NOT "test.pdf" or "sample.txt"
- [ ] Owner is NOT "test@example.com" unless that's the real uploader
- [ ] Hashes are NOT "abc123..." or "xyz789..."

---

### ✅ TEST 11: Authorization - Normal User Cannot Verify Others' Files

**Users**: UserA, UserB

**Setup**: UserA uploads a file

**Steps**:
1. Login as UserB
2. Try to verify UserA's file (if possible via direct API call)

**Expected Results**:
- [ ] Verification denied
- [ ] Error: "You do not have access to verify this file"
- [ ] No event created

**Note**: Normal UI doesn't show other users' files, but test authorization at API level

---

### ✅ TEST 12: Blockchain Record Preservation

**User**: Any user

**Steps**:
1. Upload a file → blockchain records HASH_A
2. Modify file externally → new hash is HASH_B
3. Verify file → detects mismatch
4. Query blockchain for original record

**Expected Results**:
- [ ] Blockchain still stores HASH_A (original)
- [ ] Blockchain does NOT store HASH_B
- [ ] No new blockchain record created during verification
- [ ] Original record timestamp unchanged

**This Proves**:
- [ ] Verification does not overwrite original records
- [ ] Tamper detection works correctly
- [ ] Blockchain provides immutable audit trail

---

## Backend Log Checklist

During testing, watch backend console for:

### Success Verification
- [ ] `[INTEGRITY SUCCESS] File: <name> User: <email>`
- [ ] `[INTEGRITY SUCCESS] Hash match confirmed`
- [ ] `[INTEGRITY SUCCESS] Successfully logged to activity_logs`

### Failed Verification
- [ ] `[INTEGRITY FAILURE DETECTED] File: <name>`
- [ ] `[INTEGRITY FAILURE] Stored hash: <hash1>`
- [ ] `[INTEGRITY FAILURE] Current hash: <hash2>`
- [ ] `[INTEGRITY FAILURE] Successfully logged to activity_logs`
- [ ] `[INTEGRITY FAILURE] Verified: Found X integrity_failure log(s)`

### User Stats
- [ ] `[getUserStats] Called for userId: <uuid> email: <email>`
- [ ] `[getUserStats] Files by userId query returned: X documents`
- [ ] `[getUserStats] Unique verified files: Y (from Z verification events)`
- [ ] `[getUserStats] Unique failed files: A (from B failure events)`

### Admin Stats
- [ ] `[getAdminBlockchainFiles] Called by admin: <email>`
- [ ] `[getAdminBlockchainFiles] Found X blockchain-protected files`
- [ ] `[getAdminBlockchainFiles] Found Y unique verified files (from Z events)`
- [ ] `[getAdminBlockchainFiles] Found A unique failed files (from B events)`

---

## Failure Scenarios to Test

### ❌ What Should NOT Happen

- [ ] Dashboard shows 0 when files exist
- [ ] Counts increase indefinitely with repeated verifications of same file
- [ ] Admin sees only their own files in Blockchain Integrity
- [ ] Normal user sees other users' files in dashboard
- [ ] Hardcoded values appear anywhere
- [ ] Verification creates new blockchain records
- [ ] Original blockchain record is modified
- [ ] Authorization allows user to verify unowned files
- [ ] Stats count events instead of unique files

---

## Post-Testing Verification

After all tests:

- [ ] Frontend still compiles
- [ ] No errors in browser console
- [ ] No errors in backend logs (except expected authorization denials)
- [ ] Database contains real activity_logs with `integrity_verified` events
- [ ] Database contains real activity_logs with `integrity_failure` events
- [ ] No new Firestore collections created
- [ ] Fabric network still operational
- [ ] S3 files unchanged (except intentionally modified test files)

---

## Reporting Results

For each test, report:

1. **Test Number**: TEST X
2. **User**: Which account tested
3. **Result**: PASS / FAIL
4. **Evidence**: Screenshot OR backend log excerpt
5. **Issues**: Any unexpected behavior

**Example**:
```
TEST 2: PASS
User: k@gmail.com
Evidence: 
- Toast showed "✓ report.pdf — Integrity Verified"
- Dashboard "Integrity Verified" = 1
- Backend log: [INTEGRITY SUCCESS] Successfully logged
Issues: None
```

---

## Critical Success Criteria

The implementation is considered **COMPLETE** if:

- [x] Frontend compiles successfully
- [ ] Normal user can upload, verify (success/failure), see correct stats
- [ ] Admin can see all files, verify any file, see global stats
- [ ] Stats count unique files, not events
- [ ] No hardcoded users, files, or counts anywhere
- [ ] Authorization works correctly (owner OR admin)
- [ ] Blockchain records preserved during verification
- [ ] All existing functionality preserved (Fabric, S3, ML, auth)

---

**Generated**: 2025  
**Project**: AI Threat Detection - Generic Blockchain Integrity Testing
