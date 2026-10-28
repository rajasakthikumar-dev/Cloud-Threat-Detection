#!/bin/bash

# Diagnostic Script: Integrity Verify Button Investigation
# This script tests the complete file upload → blockchain → display workflow

echo "══════════════════════════════════════════════════════════════════════"
echo "  INTEGRITY VERIFY BUTTON DIAGNOSTIC"
echo "══════════════════════════════════════════════════════════════════════"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE="http://localhost:5000/api"
TEST_FILE="/tmp/test-integrity-check.txt"

# Check if server is running
echo -e "${BLUE}[1/8] Checking server status...${NC}"
if ! curl -s "$API_BASE/auth/login" > /dev/null 2>&1; then
    echo -e "${RED}✗ Server not responding at $API_BASE${NC}"
    echo "Please start the server with: cd server && node index.js"
    exit 1
fi
echo -e "${GREEN}✓ Server is running${NC}"
echo ""

# Prompt for credentials
echo -e "${BLUE}[2/8] Please provide test account credentials${NC}"
read -p "Email: " EMAIL
read -s -p "Password: " PASSWORD
echo ""
echo ""

# Login
echo -e "${BLUE}[3/8] Authenticating...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token // empty')

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
    echo -e "${RED}✗ Authentication failed${NC}"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

USER_ID=$(echo "$LOGIN_RESPONSE" | jq -r '.user.id')
USER_EMAIL=$(echo "$LOGIN_RESPONSE" | jq -r '.user.email')
USER_ROLE=$(echo "$LOGIN_RESPONSE" | jq -r '.user.role')

echo -e "${GREEN}✓ Authenticated as $USER_EMAIL (Role: $USER_ROLE, ID: $USER_ID)${NC}"
echo ""

# Create test file
echo -e "${BLUE}[4/8] Creating test file...${NC}"
TIMESTAMP=$(date +%s)
echo "Test file for integrity verification - Timestamp: $TIMESTAMP" > "$TEST_FILE"
TEST_CONTENT=$(cat "$TEST_FILE")
echo "Created: $TEST_FILE"
echo "Content: $TEST_CONTENT"
echo ""

# Upload test file
echo -e "${BLUE}[5/8] Uploading file to S3 and blockchain...${NC}"
UPLOAD_RESPONSE=$(curl -s -X POST "$API_BASE/files/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$TEST_FILE")

echo "Upload Response:"
echo "$UPLOAD_RESPONSE" | jq '.'

FILE_KEY=$(echo "$UPLOAD_RESPONSE" | jq -r '.file.key // empty')
FILE_SHA256=$(echo "$UPLOAD_RESPONSE" | jq -r '.file.sha256 // empty')
FILE_S3_VERSION=$(echo "$UPLOAD_RESPONSE" | jq -r '.file.s3VersionId // empty')
BLOCKCHAIN_STATUS=$(echo "$UPLOAD_RESPONSE" | jq -r '.file.blockchainStatus // empty')

if [ -z "$FILE_KEY" ] || [ "$FILE_KEY" == "null" ]; then
    echo -e "${RED}✗ Upload failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ File uploaded${NC}"
echo "  Key: $FILE_KEY"
echo "  SHA-256: $FILE_SHA256"
echo "  S3 VersionId: $FILE_S3_VERSION"
echo "  Blockchain Status: $BLOCKCHAIN_STATUS"
echo ""

# Check blockchain status
if [ "$BLOCKCHAIN_STATUS" != "recorded" ]; then
    echo -e "${YELLOW}⚠ WARNING: Blockchain status is '$BLOCKCHAIN_STATUS', not 'recorded'${NC}"
    echo "  This means the Integrity Verify button will NOT appear!"
    echo "  Check Fabric network status and server logs for blockchain errors."
    echo ""
fi

# Fetch file list
echo -e "${BLUE}[6/8] Fetching file list from /api/files...${NC}"
FILES_RESPONSE=$(curl -s -X GET "$API_BASE/files" \
  -H "Authorization: Bearer $TOKEN")

echo "Files Response:"
echo "$FILES_RESPONSE" | jq '.'

# Find our uploaded file in the list
FILE_IN_LIST=$(echo "$FILES_RESPONSE" | jq --arg key "$FILE_KEY" '.files[] | select(.key == $key)')

if [ -z "$FILE_IN_LIST" ]; then
    echo -e "${RED}✗ Uploaded file not found in file list${NC}"
    exit 1
fi

echo -e "${GREEN}✓ File found in list${NC}"
echo ""

# Extract fields from the list response
LIST_BLOCKCHAIN_STATUS=$(echo "$FILE_IN_LIST" | jq -r '.blockchainStatus // empty')
LIST_SHA256=$(echo "$FILE_IN_LIST" | jq -r '.sha256 // empty')
LIST_S3_VERSION=$(echo "$FILE_IN_LIST" | jq -r '.s3VersionId // empty')

echo "File metadata in list:"
echo "  blockchainStatus: $LIST_BLOCKCHAIN_STATUS"
echo "  sha256: $LIST_SHA256"
echo "  s3VersionId: $LIST_S3_VERSION"
echo ""

# Check button rendering condition
echo -e "${BLUE}[7/8] Checking Integrity Verify button condition...${NC}"
echo ""
echo "Frontend condition (from FileManagement.js line 261):"
echo "  {f.blockchainStatus === 'recorded' && actionBtn(...)}"
echo ""

if [ "$LIST_BLOCKCHAIN_STATUS" == "recorded" ]; then
    echo -e "${GREEN}✓ CONDITION MET: blockchainStatus === 'recorded'${NC}"
    echo -e "${GREEN}  → Integrity Verify button SHOULD be rendered${NC}"
else
    echo -e "${RED}✗ CONDITION FAILED: blockchainStatus is '$LIST_BLOCKCHAIN_STATUS'${NC}"
    echo -e "${RED}  → Integrity Verify button will NOT be rendered${NC}"
    echo ""
    echo "ROOT CAUSE IDENTIFIED:"
    if [ -z "$LIST_BLOCKCHAIN_STATUS" ] || [ "$LIST_BLOCKCHAIN_STATUS" == "null" ]; then
        echo "  • blockchainStatus field is missing or null"
        echo "  • This indicates either:"
        echo "    1. Upload occurred before blockchain integration was added"
        echo "    2. Firestore document is missing the blockchainStatus field"
        echo "    3. Backend failed to save blockchainStatus after upload"
    else
        echo "  • blockchainStatus is '$LIST_BLOCKCHAIN_STATUS' (expected: 'recorded')"
        echo "  • This indicates:"
        echo "    1. Blockchain transaction failed during upload"
        echo "    2. Fabric network connection issue"
        echo "    3. Chaincode invocation error"
    fi
    echo ""
fi

# Test verification endpoint (if blockchain recorded)
if [ "$LIST_BLOCKCHAIN_STATUS" == "recorded" ]; then
    echo -e "${BLUE}[8/8] Testing integrity verification endpoint...${NC}"
    VERIFY_RESPONSE=$(curl -s -X POST "$API_BASE/files/verify/$(echo "$FILE_KEY" | jq -sRr @uri)" \
      -H "Authorization: Bearer $TOKEN")
    
    echo "Verification Response:"
    echo "$VERIFY_RESPONSE" | jq '.'
    
    VERIFY_MATCH=$(echo "$VERIFY_RESPONSE" | jq -r '.verification.match // empty')
    
    if [ "$VERIFY_MATCH" == "true" ]; then
        echo -e "${GREEN}✓ Integrity verification PASSED${NC}"
    elif [ "$VERIFY_MATCH" == "false" ]; then
        echo -e "${YELLOW}⚠ Integrity verification FAILED (hash mismatch)${NC}"
    else
        echo -e "${RED}✗ Verification endpoint error${NC}"
    fi
else
    echo -e "${BLUE}[8/8] Skipping verification test (no blockchain record)${NC}"
fi

echo ""
echo "══════════════════════════════════════════════════════════════════════"
echo "  DIAGNOSTIC SUMMARY"
echo "══════════════════════════════════════════════════════════════════════"
echo ""

if [ "$LIST_BLOCKCHAIN_STATUS" == "recorded" ]; then
    echo -e "${GREEN}✓ Integrity Verify button SHOULD appear for this file${NC}"
    echo ""
    echo "If the button still does not appear in the UI:"
    echo "  1. Open browser DevTools (F12) → Console tab"
    echo "  2. Check for JavaScript errors"
    echo "  3. Inspect the file row element in the DOM"
    echo "  4. Verify that blockchainStatus='recorded' in React DevTools"
    echo "  5. Check that the conditional rendering logic is working"
else
    echo -e "${RED}✗ Integrity Verify button WILL NOT appear${NC}"
    echo ""
    echo "To fix this issue:"
    echo "  1. Check Fabric network status:"
    echo "     cd blockchain/fabric-samples/test-network"
    echo "     docker ps -a | grep hyperledger"
    echo ""
    echo "  2. Check server logs for blockchain errors:"
    echo "     grep -i 'fabric\|blockchain' server/logs/*.log"
    echo ""
    echo "  3. Test blockchain connectivity:"
    echo "     cd server && node -e \"require('./config/fabricGateway').getContract().then(() => console.log('✓ Connected')).catch(e => console.error('✗ Failed:', e.message))\""
    echo ""
    echo "  4. For existing files without blockchain records:"
    echo "     • They cannot be retroactively verified"
    echo "     • Only new uploads will have blockchain protection"
    echo "     • Consider uploading a fresh copy if verification is needed"
fi

echo ""
echo "Test file remains at: $TEST_FILE"
echo "You can manually verify integrity in the UI after refreshing the File Management page."
echo ""
