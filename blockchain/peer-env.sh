#!/usr/bin/env bash
# Sets env vars for peer CLI commands against the test-network.
# Usage:  source ./peer-env.sh [org1|org2]
# Default: org1

FABRIC_ROOT=/home/rajasakthikumar/AI-Threat-Detection/AI-Threat-Detection/blockchain/fabric-samples
TESTNET=$FABRIC_ROOT/test-network

export PATH=$FABRIC_ROOT/bin:$PATH
export FABRIC_CFG_PATH=$FABRIC_ROOT/config
export CORE_PEER_TLS_ENABLED=true

ORG=${1:-org1}

if [ "$ORG" = "org2" ]; then
  export CORE_PEER_LOCALMSPID="Org2MSP"
  export CORE_PEER_ADDRESS=localhost:9051
  export CORE_PEER_TLS_ROOTCERT_FILE=$TESTNET/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt
  export CORE_PEER_MSPCONFIGPATH=$TESTNET/organizations/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp
else
  export CORE_PEER_LOCALMSPID="Org1MSP"
  export CORE_PEER_ADDRESS=localhost:7051
  export CORE_PEER_TLS_ROOTCERT_FILE=$TESTNET/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
  export CORE_PEER_MSPCONFIGPATH=$TESTNET/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
fi

export ORDERER_CA=$TESTNET/organizations/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem
export CHANNEL=mychannel
export CC_NAME=file-integrity
