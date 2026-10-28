#!/bin/bash

# End-to-end Integrity Verification Workflow Test
# =================================================

API_URL="http://localhost:5000/api"
TEST_EMAIL="integrity-test-$(date +%s)@example.com"
TEST_PASSWORD="Test@123456"
TEST_FILE="test-uploads/test-verification.txt"

echo "=========================================="
echo "Integrity Verification Workflow Test"
echo "=========================================="
echo ""

# Step 1: Register new user
echo "Step 1: Registering new test user..."
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Integrity Test User\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

echo "$REGISTER_RESPONSE" | jq '.' 2>/dev/null || echo "$REGISTER_RESPONSE"

if echo "$REGISTER_RESPONSE" | grep -q "token"; then
  echo "✅ User registered successfully"
else
  echo "❌ Registration failed"
  exit 1
fi

TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.token')
echo "Token: ${TOKEN:0:50}..."
echo ""

# Step 2: Upload test file
echo "Step 2: Uploading test file..."
UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/files/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$TEST_FILE")

echo "$UPLOAD_RESPONSE" | jq '.' 2>/dev/null || echo "$UPLOAD_RESPONSE"

if echo "$UPLOAD_RESPONSE" | grep -q "key"; then
  echo "✅ File uploaded successfully"
  FILE_KEY=$(echo "$UPLOAD_RESPONSE" | jq -r '.file.key')
  echo "File Key: $FILE_KEY"
else
  echo "❌ Upload failed"
  exit 1
fi
echo ""

# Step 3: Get file list and check blockchainStatus
echo "Step 3: Fetching file list..."
sleep 2  # Allow time for blockchain recording
FILES_RESPONSE=$(curl -s -X GET "$API_URL/files" \
  -H "Authorization: Bearer $TOKEN")

echo "$FILES_RESPONSE" | jq '.files[] | {name, blockchainStatus, sha256, s3VersionId}' 2>/dev/null

BLOCKCHAIN_STATUS=$(echo "$FILES_RESPONSE" | jq -r '.files[0].blockchainStatus')
echo ""
echo "Blockchain Status: $BLOCKCHAIN_STATUS"

if [ "$BLOCKCHAIN_STATUS" = "recorded" ]; then
  echo "✅ File has blockchainStatus='recorded'"
else
  echo "⚠️  File has blockchainStatus='$BLOCKCHAIN_STATUS'"
  echo "   (Button will not appear unless status is 'recorded')"
fi
echo ""

# Step 4: Verify file integrity
if [ "$BLOCKCHAIN_STATUS" = "recorded" ]; then
  echo "Step 4: Verifying file integrity..."
  ENCODED_KEY=$(echo -n "$FILE_KEY" | jq -sRr @uri)
  VERIFY_RESPONSE=$(curl -s -X POST "$API_URL/files/verify/$ENCODED_KEY" \
    -H "Authorization: Bearer $TOKEN")
  
  echo "$VERIFY_RESPONSE" | jq '.' 2>/dev/null || echo "$VERIFY_RESPONSE"
  
  MATCH=$(echo "$VERIFY_RESPONSE" | jq -r '.verification.match')
  if [ "$MATCH" = "true" ]; then
    echo "✅ Integrity verification PASSED - file is unchanged"
  else
    echo "❌ Integrity verification FAILED - hash mismatch"
  fi
else
  echo "Step 4: SKIPPED - No blockchain record to verify against"
fi

echo ""
echo "=========================================="
echo "Test Complete"
echo "=========================================="
