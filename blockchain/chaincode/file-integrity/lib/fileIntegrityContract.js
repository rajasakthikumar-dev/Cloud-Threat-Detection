'use strict';

/**
 * fileIntegrityContract.js
 * ─────────────────────────
 * Hyperledger Fabric chaincode — File Integrity Records
 *
 * Stores METADATA/HASH INFORMATION ONLY on the ledger.
 * Actual file contents are NEVER stored here.
 *
 * Ledger key scheme:
 *   Primary record : FILE::<fileId>::VERSION::<s3VersionId>
 *   Index entry    : FILEIDX::<fileId>::<s3VersionId>   (used by GetFileHistory)
 *
 * Functions:
 *   CreateFileIntegrityRecord  — write a new immutable record
 *   GetFileIntegrityRecord     — retrieve by fileId (returns most-recent version)
 *   GetFileVersionRecord       — retrieve by fileId + s3VersionId
 *   GetFileHistory             — return all versions for a fileId
 *   VerifyFileIntegrity        — compare a supplied sha256 against the stored one
 */

const stringify          = require('json-stringify-deterministic');
const sortKeysRecursive  = require('sort-keys-recursive');
const { Contract }       = require('fabric-contract-api');

// Regex: exactly 64 lowercase hex characters
const SHA256_RE = /^[0-9a-f]{64}$/;

/**
 * Build the primary ledger key for a file version record.
 * Using a deterministic composite key means the same fileId+versionId
 * always maps to the same key — duplicate inserts are detectable.
 */
function makeVersionKey(fileId, s3VersionId) {
    return `FILE::${fileId}::VERSION::${s3VersionId}`;
}

/**
 * Build the range-query prefix key for all versions of a fileId.
 * getStateByRange('FILEIDX::test-file-001::', 'FILEIDX::test-file-001::~')
 * returns every index entry for that file in lexicographic order.
 */
function makeIndexKey(fileId, s3VersionId) {
    return `FILEIDX::${fileId}::${s3VersionId}`;
}

function makeIndexPrefix(fileId) {
    // '~' has ASCII 126, higher than any printable char, so it acts as an
    // inclusive upper bound for the range scan.
    return {
        start: `FILEIDX::${fileId}::`,
        end:   `FILEIDX::${fileId}::~`,
    };
}

class FileIntegrityContract extends Contract {

    // ──────────────────────────────────────────────────────────
    // CreateFileIntegrityRecord
    // ──────────────────────────────────────────────────────────
    /**
     * Write a new immutable file integrity record to the ledger.
     *
     * @param {Context} ctx
     * @param {string}  fileId       — application-level file identifier
     * @param {string}  fileName     — original file name (e.g. report.pdf)
     * @param {string}  ownerId      — user/owner identifier
     * @param {string}  s3Key        — S3 object key (uploads/<userId>/...)
     * @param {string}  s3VersionId  — S3 VersionId returned by AWS on upload
     * @param {string}  sha256       — 64-char hex SHA-256 of the file bytes
     */
    async CreateFileIntegrityRecord(ctx, fileId, fileName, ownerId, s3Key, s3VersionId, sha256) {

        // ── Input validation ────────────────────────────────
        if (!fileId      || fileId.trim()      === '') throw new Error('fileId is required');
        if (!fileName    || fileName.trim()    === '') throw new Error('fileName is required');
        if (!ownerId     || ownerId.trim()     === '') throw new Error('ownerId is required');
        if (!s3Key       || s3Key.trim()       === '') throw new Error('s3Key is required');
        if (!s3VersionId || s3VersionId.trim() === '') throw new Error('s3VersionId is required');
        if (!sha256      || sha256.trim()      === '') throw new Error('sha256 is required');

        if (!SHA256_RE.test(sha256.trim())) {
            throw new Error(
                `Invalid sha256: "${sha256}". ` +
                'Must be exactly 64 lowercase hexadecimal characters.'
            );
        }

        // ── Duplicate protection ────────────────────────────
        // The same fileId + s3VersionId must never produce two records.
        const versionKey = makeVersionKey(fileId.trim(), s3VersionId.trim());
        const existing   = await ctx.stub.getState(versionKey);
        if (existing && existing.length > 0) {
            throw new Error(
                `A record for fileId "${fileId}" with s3VersionId "${s3VersionId}" ` +
                'already exists. Duplicate records are not permitted.'
            );
        }

        // ── Build the record ────────────────────────────────
        // Use Fabric transaction timestamp — NOT a client-supplied timestamp.
        // This prevents the client from backdating records.
        const txTimestamp = ctx.stub.getTxTimestamp();
        const timestampISO = new Date(
            txTimestamp.seconds.low * 1000 + Math.round(txTimestamp.nanos / 1e6)
        ).toISOString();

        const record = {
            docType:     'fileIntegrityRecord',
            fileId:       fileId.trim(),
            fileName:     fileName.trim(),
            ownerId:      ownerId.trim(),
            s3Key:        s3Key.trim(),
            s3VersionId:  s3VersionId.trim(),
            sha256:       sha256.trim(),
            timestamp:    timestampISO,
            txId:         ctx.stub.getTxID(),
        };

        // Write primary record (keyed by fileId + versionId)
        await ctx.stub.putState(
            versionKey,
            Buffer.from(stringify(sortKeysRecursive(record)))
        );

        // Write index entry so GetFileHistory can do a range scan
        const indexKey = makeIndexKey(fileId.trim(), s3VersionId.trim());
        await ctx.stub.putState(indexKey, Buffer.from(versionKey));

        return JSON.stringify(record);
    }

    // ──────────────────────────────────────────────────────────
    // GetFileIntegrityRecord
    // ──────────────────────────────────────────────────────────
    /**
     * Retrieve a file integrity record by fileId and s3VersionId.
     * (Named GetFileIntegrityRecord for simple single-version lookup.)
     *
     * @param {Context} ctx
     * @param {string}  fileId
     * @param {string}  s3VersionId
     */
    async GetFileIntegrityRecord(ctx, fileId, s3VersionId) {
        if (!fileId      || fileId.trim()      === '') throw new Error('fileId is required');
        if (!s3VersionId || s3VersionId.trim() === '') throw new Error('s3VersionId is required');

        const versionKey  = makeVersionKey(fileId.trim(), s3VersionId.trim());
        const recordBytes = await ctx.stub.getState(versionKey);

        if (!recordBytes || recordBytes.length === 0) {
            throw new Error(
                `No record found for fileId "${fileId}" with s3VersionId "${s3VersionId}".`
            );
        }

        return recordBytes.toString();
    }

    // ──────────────────────────────────────────────────────────
    // GetFileVersionRecord
    // ──────────────────────────────────────────────────────────
    /**
     * Retrieve a specific version record by fileId + s3VersionId.
     * Alias kept to satisfy the spec; internally identical to
     * GetFileIntegrityRecord.
     */
    async GetFileVersionRecord(ctx, fileId, s3VersionId) {
        return this.GetFileIntegrityRecord(ctx, fileId, s3VersionId);
    }

    // ──────────────────────────────────────────────────────────
    // GetFileHistory
    // ──────────────────────────────────────────────────────────
    /**
     * Return all integrity records for a given fileId in the order
     * they were stored on the ledger.
     *
     * Uses a range scan over index keys:
     *   FILEIDX::<fileId>::  →  FILEIDX::<fileId>::~
     *
     * @param {Context} ctx
     * @param {string}  fileId
     * @returns {string} JSON array of all version records
     */
    async GetFileHistory(ctx, fileId) {
        if (!fileId || fileId.trim() === '') throw new Error('fileId is required');

        const { start, end } = makeIndexPrefix(fileId.trim());
        const iterator        = await ctx.stub.getStateByRange(start, end);

        const records = [];
        let result = await iterator.next();

        while (!result.done) {
            // Each index entry value is the primary versionKey
            const versionKey  = result.value.value.toString('utf8');
            const recordBytes = await ctx.stub.getState(versionKey);

            if (recordBytes && recordBytes.length > 0) {
                try {
                    records.push(JSON.parse(recordBytes.toString()));
                } catch (_) {
                    // Malformed record — skip but don't crash the query
                }
            }
            result = await iterator.next();
        }
        await iterator.close();

        return JSON.stringify(records);
    }

    // ──────────────────────────────────────────────────────────
    // VerifyFileIntegrity
    // ──────────────────────────────────────────────────────────
    /**
     * Compare a supplied SHA-256 hash against the blockchain record.
     *
     * Returns:
     *   { "match": true,  "status": "INTEGRITY_VERIFIED" }
     *   { "match": false, "status": "INTEGRITY_ALERT",
     *     "storedSha256": "...", "suppliedSha256": "..." }
     *
     * @param {Context} ctx
     * @param {string}  fileId
     * @param {string}  s3VersionId
     * @param {string}  sha256       — the hash to verify against the record
     */
    async VerifyFileIntegrity(ctx, fileId, s3VersionId, sha256) {
        if (!fileId      || fileId.trim()      === '') throw new Error('fileId is required');
        if (!s3VersionId || s3VersionId.trim() === '') throw new Error('s3VersionId is required');
        if (!sha256      || sha256.trim()      === '') throw new Error('sha256 is required');

        // Retrieve the stored record
        const recordJSON  = await this.GetFileIntegrityRecord(ctx, fileId, s3VersionId);
        const record      = JSON.parse(recordJSON);
        const storedHash  = record.sha256;
        const supplied    = sha256.trim().toLowerCase();
        const match       = (storedHash === supplied);

        const result = {
            match,
            status:         match ? 'INTEGRITY_VERIFIED' : 'INTEGRITY_ALERT',
            fileId:         record.fileId,
            fileName:       record.fileName,
            s3VersionId:    record.s3VersionId,
            storedSha256:   storedHash,
            suppliedSha256: supplied,
            timestamp:      record.timestamp,
        };

        return JSON.stringify(result);
    }
}

module.exports = FileIntegrityContract;
