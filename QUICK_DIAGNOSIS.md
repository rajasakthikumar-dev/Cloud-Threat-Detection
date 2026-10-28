# Integrity Verify Button - Quick Diagnosis

## 🎯 Run This First

```bash
cd /home/rajasakthikumar/AI-Threat-Detection/AI-Threat-Detection

# Check what's in your database RIGHT NOW
node check-firestore-blockchain-status.js
```

**This will tell you EXACTLY why the button is missing.**

---

## 📊 What The Output Means

### If you see: `blockchainStatus = 'recorded': 0 (0%)`

**Problem:** No files have blockchain protection  
**Cause:** Either:
- Files uploaded before blockchain was integrated (legacy data)
- Blockchain failed during every upload (network issue)

**Fix:** Check if Fabric network is running ⬇️

---

### If you see: `blockchainStatus = 'failed': X files`

**Problem:** Blockchain transactions failed during upload  
**Cause:** Fabric network was down or misconfigured

**Fix:** 
1. Start Fabric network (see below)
2. Upload new test file
3. Old files need re-upload

---

### If you see: `blockchainStatus = 'recorded': X files (100%)`

**Problem:** Database is correct, but button still missing  
**Cause:** Frontend issue (rare)

**Fix:**
1. Open browser DevTools (F12)
2. Check Console for errors
3. Verify API response includes `blockchainStatus` field

---

## 🚀 Quick Fixes

### Fix 1: Start Fabric Network

```bash
cd blockchain/fabric-samples/test-network

# Check status
docker ps -a | grep hyperledger

# If containers not running or unhealthy:
./network.sh down
./network.sh up createChannel -c mychannel

# Deploy chaincode
./network.sh deployCC -ccn file-integrity \
  -ccp ../../chaincode/file-integrity \
  -ccl javascript
```

### Fix 2: Test Blockchain Connection

```bash
cd server
node -e "require('./config/fabricGateway').getContract() \
  .then(() => console.log('✓ Blockchain Connected')) \
  .catch(e => console.error('✗ Failed:', e.message))"
```

**Expected:** `✓ Blockchain Connected`  
**If failed:** Check Fabric network containers

### Fix 3: Upload New Test File

```bash
# Run the automated test
./diagnose-integrity-button.sh

# OR manually:
# 1. Open browser to http://localhost:3000
# 2. Login
# 3. Navigate to File Management
# 4. Upload a small test file
# 5. Refresh page
# 6. Check if Integrity Verify button appears
```

---

## 🔍 Server Logs

**Watch uploads in real-time:**

```bash
# Terminal 1: Monitor logs
tail -f server/logs/*.log 2>/dev/null | grep -i "blockchain\|upload"

# Terminal 2: Upload file through UI

# Look for:
# ✓ [fileController.uploadFile] Blockchain record created
# ✗ [fileController.uploadFile] Blockchain recording failed
```

---

## ⚡ 30-Second Diagnosis

```bash
# 1. Check database
node check-firestore-blockchain-status.js | grep "recorded"

# 2. Check Fabric
docker ps | grep hyperledger | wc -l
# Should show 3-4 containers

# 3. Test connection
cd server && node -e "require('./config/fabricGateway').getContract() \
  .then(() => console.log('OK')).catch(() => console.log('FAIL'))"

# 4. Upload test file and refresh page
```

---

## 🎬 Complete Workflow Test

**Run the full diagnostic:**

```bash
./diagnose-integrity-button.sh
```

**What it does:**
1. ✓ Checks server is running
2. ✓ Logs you in
3. ✓ Uploads a test file
4. ✓ Verifies blockchain recording
5. ✓ Checks button condition
6. ✓ Tests verification endpoint

**Output will say:**
- "✓ Integrity Verify button SHOULD appear" → Success
- "✗ Integrity Verify button WILL NOT appear" → Shows why + fix

---

## 🆘 Most Likely Issue

**Scenario:** Fabric network not running

```bash
# Quick fix (< 2 minutes)
cd blockchain/fabric-samples/test-network
./network.sh up createChannel -c mychannel
./network.sh deployCC -ccn file-integrity -ccp ../../chaincode/file-integrity -ccl javascript

# Upload new test file
# Button should appear immediately
```

---

## 📋 Checklist

Before reporting issue as "fixed":

- [ ] `node check-firestore-blockchain-status.js` shows `blockchainStatus: 'recorded'`
- [ ] Fabric network containers running: `docker ps | grep hyperledger`
- [ ] Backend can connect: `node -e "require('./server/config/fabricGateway').getContract()..."`
- [ ] Upload new test file through UI
- [ ] Refresh File Management page
- [ ] **Integrity Verify button appears** next to new file
- [ ] Click button → Success toast: "✓ File — Integrity Verified"

---

## 🎯 TL;DR

```bash
# The button is missing because files lack blockchainStatus='recorded'
# Most likely cause: Fabric network not running

# Quick fix:
cd blockchain/fabric-samples/test-network && ./network.sh up
cd ../../.. && node check-firestore-blockchain-status.js
# Upload new file → Button should appear
```

---

**Next Step:** Run `node check-firestore-blockchain-status.js`

The output will tell you exactly what to do next.
