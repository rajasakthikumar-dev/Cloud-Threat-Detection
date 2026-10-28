import React, { useEffect, useState } from 'react';
import {
  FiShield, FiCheckCircle, FiAlertTriangle, FiFileText,
  FiDatabase, FiLock, FiX, FiEye, FiClock, FiAlertCircle, FiRotateCcw,
} from 'react-icons/fi';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { getAdminBlockchainFiles, verifyFileIntegrity, getFileHistory, getIntegrityFailures, getAdminRecoveryHistory } from '../services/api';
import { toast } from 'react-toastify';

/**
 * BlockchainIntegrity - Admin-only page for monitoring file integrity records
 * Shows real blockchain-protected files and provides verification capabilities
 */

export default function BlockchainIntegrity() {
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState([]);
  const [integrityFailures, setIntegrityFailures] = useState([]);
  const [recoveryHistory, setRecoveryHistory] = useState([]);
  const [recoveryStats, setRecoveryStats] = useState({
    totalRecoveries: 0,
    successfulRecoveries: 0,
    failedRecoveries: 0,
    blockchainRecorded: 0,
    uniqueUsers: 0,
    uniqueFiles: 0,
  });
  const [stats, setStats] = useState({
    totalProtected: 0,
    blockchainRecorded: 0,
    verified: 0,
    failures: 0,
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [verifying, setVerifying] = useState(null);
  const [viewingHistory, setViewingHistory] = useState(null);
  const [viewingFailure, setViewingFailure] = useState(null);
  const [viewingRecovery, setViewingRecovery] = useState(null);

  useEffect(() => {
    fetchProtectedFiles();
    fetchIntegrityFailures();
    fetchRecoveryHistory();
  }, []);

  async function fetchProtectedFiles() {
    try {
      setLoading(true);
      // Use admin-specific endpoint to get all blockchain-protected files
      const res = await getAdminBlockchainFiles();
      const allFiles = res.data.files || [];
      const serverStats = res.data.stats || {};
      
      setFiles(allFiles);
      
      // Use stats from backend including verified files and integrity failures
      setStats({
        totalProtected: serverStats.totalProtected || allFiles.length,
        blockchainRecorded: serverStats.blockchainRecorded || allFiles.length,
        verified: serverStats.verifiedFiles || 0, // Real unique verified files count
        failures: serverStats.integrityFailures || 0, // Real unique failed files count
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load protected files');
    } finally {
      setLoading(false);
    }
  }

  async function fetchIntegrityFailures() {
    try {
      const res = await getIntegrityFailures();
      setIntegrityFailures(res.data.failures || []);
    } catch (err) {
      console.error('Failed to load integrity failures:', err);
    }
  }

  async function fetchRecoveryHistory() {
    try {
      const res = await getAdminRecoveryHistory();
      setRecoveryHistory(res.data.recoveries || []);
      setRecoveryStats(res.data.stats || {
        totalRecoveries: 0,
        successfulRecoveries: 0,
        failedRecoveries: 0,
        blockchainRecorded: 0,
        uniqueUsers: 0,
        uniqueFiles: 0,
      });
    } catch (err) {
      console.error('Failed to load recovery history:', err);
    }
  }

  async function handleVerifyIntegrity(file) {
    setVerifying(file.key);
    try {
      const res = await verifyFileIntegrity(file.key);
      const verification = res.data.verification;
      
      setSelectedFile({
        ...file,
        verification,
      });
      
      if (verification.match) {
        toast.success(`✓ ${file.name} — Integrity Verified`);
      } else {
        toast.error(`✗ ${file.name} — Integrity Alert: Hash Mismatch!`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed');
    } finally {
      setVerifying(null);
    }
  }

  async function handleViewHistory(file) {
    setVerifying(file.key);
    try {
      const res = await getFileHistory(file.key);
      setViewingHistory({
        file,
        history: res.data.history || [],
        fileId: res.data.fileId,
        currentVersion: res.data.currentVersion,
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load history');
    } finally {
      setVerifying(null);
    }
  }

  const sectionTitle = {
    fontSize: 'var(--font-size-xs)',
    fontWeight: 700,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: '1rem',
    marginTop: '0.25rem',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-page)' }}>
      <Navbar />
      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar />
        <main style={{ flex: 1, padding: '2rem', overflow: 'auto' }}>
          
          {/* Header */}
          <div style={{ marginBottom: '2rem', animation: 'fadeInUp 0.35s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '0.5rem' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-lg)',
                background: 'linear-gradient(135deg, var(--primary) 0%, #1e40af 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-md)',
              }}>
                <FiShield size={24} color="white" />
              </div>
              <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Blockchain Integrity
              </h1>
            </div>
            <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', fontWeight: 500, marginLeft: '62px' }}>
              Tamper-proof file integrity verification powered by Hyperledger Fabric
            </p>
          </div>

          {/* Stats Cards */}
          <p style={sectionTitle}>Integrity Overview</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
            <StatCard
              title="Protected Files"
              value={stats.totalProtected}
              icon={<FiFileText />}
              color="var(--primary)"
              subtitle="Files with blockchain records"
            />
            <StatCard
              title="Blockchain Records"
              value={stats.blockchainRecorded}
              icon={<FiDatabase />}
              color="var(--success)"
              subtitle="Immutable integrity records"
            />
            <StatCard
              title="Verified Files"
              value={stats.verified}
              icon={<FiCheckCircle />}
              color="var(--info)"
              subtitle="Successfully verified"
            />
            <StatCard
              title="Integrity Failures"
              value={stats.failures}
              icon={<FiAlertTriangle />}
              color="var(--danger)"
              subtitle="Hash mismatch detections"
            />
          </div>

          {/* Protected Files Table */}
          <p style={sectionTitle}>Protected Files</p>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              Loading protected files...
            </div>
          ) : files.length === 0 ? (
            <div style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              padding: '3rem',
              textAlign: 'center',
              color: 'var(--text-muted)',
            }}>
              <FiShield size={48} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
              <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: '0.5rem' }}>
                No blockchain-protected files found
              </p>
              <p style={{ fontSize: 'var(--font-size-sm)' }}>
                Upload files to create blockchain integrity records
              </p>
            </div>
          ) : (
            <ProtectedFilesTable
              files={files}
              verifying={verifying}
              onVerify={handleVerifyIntegrity}
              onViewHistory={handleViewHistory}
              onViewDetails={setSelectedFile}
            />
          )}

          {/* Details Modal */}
          {selectedFile && (
            <DetailsModal file={selectedFile} onClose={() => setSelectedFile(null)} />
          )}

          {/* History Modal */}
          {viewingHistory && (
            <HistoryModal data={viewingHistory} onClose={() => setViewingHistory(null)} />
          )}

          {/* Integrity Failures Section */}
          {integrityFailures.length > 0 && (
            <>
              <p style={{ ...sectionTitle, marginTop: '2.5rem' }}>Integrity Failures</p>
              <div style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-md)',
              }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'var(--bg-secondary)' }}>
                      <tr>
                        {['File Name', 'Owner', 'Detection Time', 'Status', 'Details'].map(h => (
                          <th key={h} style={{
                            padding: '0.875rem 1rem',
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 700,
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            textAlign: 'left',
                            borderBottom: '2px solid var(--border-color)',
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {integrityFailures.map(failure => (
                        <tr key={failure.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'var(--transition)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <td style={{ padding: '0.875rem 1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <FiAlertCircle size={16} color="var(--danger)" />
                              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {failure.metadata?.fileName || 'Unknown'}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '0.875rem 1rem', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                            {failure.userEmail}
                          </td>
                          <td style={{ padding: '0.875rem 1rem', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                            {failure.timestamp ? new Date(failure.timestamp).toLocaleString('en-GB', {
                              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                            }) : '—'}
                          </td>
                          <td style={{ padding: '0.875rem 1rem' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.375rem',
                              padding: '0.25rem 0.75rem',
                              borderRadius: 'var(--radius-md)',
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: 600,
                              background: 'var(--danger-bg)',
                              color: 'var(--danger)',
                            }}>
                              <FiAlertTriangle size={12} />
                              HASH MISMATCH
                            </span>
                          </td>
                          <td style={{ padding: '0.875rem 1rem' }}>
                            <button
                              onClick={() => setViewingFailure(failure)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.375rem',
                                padding: '0.375rem 0.875rem',
                                borderRadius: 'var(--radius-md)',
                                background: 'var(--primary-bg)',
                                color: 'var(--primary)',
                                border: '1px solid transparent',
                                fontSize: 'var(--font-size-sm)',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'var(--transition)',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.color = 'white'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'var(--primary-bg)'; e.currentTarget.style.color = 'var(--primary)'; }}
                            >
                              <FiEye size={14} />
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Failure Details Modal */}
          {viewingFailure && (
            <FailureDetailsModal failure={viewingFailure} onClose={() => setViewingFailure(null)} />
          )}

          {/* Recovery History Section */}
          {(recoveryHistory.length > 0 || recoveryStats.totalRecoveries > 0) && (
            <>
              <p style={{ ...sectionTitle, marginTop: '2.5rem' }}>File Recovery History</p>
              
              {/* Recovery Stats Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <RecoveryStatCard
                  label="Total Recoveries"
                  value={recoveryStats.totalRecoveries}
                  icon={<FiRotateCcw size={18} />}
                  color="var(--warning)"
                />
                <RecoveryStatCard
                  label="Successful"
                  value={recoveryStats.successfulRecoveries}
                  icon={<FiCheckCircle size={18} />}
                  color="var(--success)"
                />
                <RecoveryStatCard
                  label="Failed"
                  value={recoveryStats.failedRecoveries}
                  icon={<FiAlertTriangle size={18} />}
                  color="var(--danger)"
                />
                <RecoveryStatCard
                  label="Blockchain Audited"
                  value={recoveryStats.blockchainRecorded}
                  icon={<FiDatabase size={18} />}
                  color="var(--info)"
                />
                <RecoveryStatCard
                  label="Unique Users"
                  value={recoveryStats.uniqueUsers}
                  icon={<FiFileText size={18} />}
                  color="var(--primary)"
                />
                <RecoveryStatCard
                  label="Unique Files"
                  value={recoveryStats.uniqueFiles}
                  icon={<FiFileText size={18} />}
                  color="var(--primary)"
                />
              </div>

              {/* Recovery History Table */}
              <div style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-md)',
              }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'var(--bg-secondary)' }}>
                      <tr>
                        {['File Name', 'User', 'Recovery Date', 'Status', 'Blockchain', 'Details'].map(h => (
                          <th key={h} style={{
                            padding: '0.875rem 1rem',
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 700,
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            textAlign: 'left',
                            borderBottom: '2px solid var(--border-color)',
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recoveryHistory.map((recovery, idx) => (
                        <tr key={recovery.id || idx} style={{ borderBottom: '1px solid var(--border-color)', transition: 'var(--transition)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <td style={{ padding: '0.875rem 1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <FiFileText size={16} color="var(--warning)" />
                              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {recovery.fileName || 'Unknown'}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '0.875rem 1rem', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                            {recovery.userEmail || recovery.userId || '—'}
                          </td>
                          <td style={{ padding: '0.875rem 1rem', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                            {recovery.recoveredAt || recovery.timestamp ? new Date(recovery.recoveredAt || recovery.timestamp).toLocaleString('en-GB', {
                              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                            }) : '—'}
                          </td>
                          <td style={{ padding: '0.875rem 1rem' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.375rem',
                              padding: '0.25rem 0.75rem',
                              borderRadius: 'var(--radius-md)',
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: 600,
                              background: recovery.status === 'success' ? 'var(--success-light)' : recovery.status === 'failed' ? 'var(--danger-light)' : 'var(--warning-light)',
                              color: recovery.status === 'success' ? 'var(--success)' : recovery.status === 'failed' ? 'var(--danger)' : 'var(--warning)',
                            }}>
                              {recovery.status === 'success' ? <FiCheckCircle size={12} /> : <FiAlertTriangle size={12} />}
                              {recovery.status?.toUpperCase() || 'UNKNOWN'}
                            </span>
                          </td>
                          <td style={{ padding: '0.875rem 1rem' }}>
                            {recovery.blockchainRecorded ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.375rem',
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 600,
                                color: 'var(--success)',
                              }}>
                                <FiCheckCircle size={12} />
                                Recorded
                              </span>
                            ) : (
                              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                                —
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '0.875rem 1rem' }}>
                            <button
                              onClick={() => setViewingRecovery(recovery)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.375rem',
                                padding: '0.375rem 0.875rem',
                                borderRadius: 'var(--radius-md)',
                                background: 'var(--primary-bg)',
                                color: 'var(--primary)',
                                border: '1px solid transparent',
                                fontSize: 'var(--font-size-sm)',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'var(--transition)',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.color = 'white'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'var(--primary-bg)'; e.currentTarget.style.color = 'var(--primary)'; }}
                            >
                              <FiEye size={14} />
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Recovery Details Modal */}
          {viewingRecovery && (
            <RecoveryDetailsModal recovery={viewingRecovery} onClose={() => setViewingRecovery(null)} />
          )}

        </main>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color, subtitle }) {
  return (
    <div style={{
      background: 'var(--bg-primary)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)',
      padding: '1.5rem',
      boxShadow: 'var(--shadow-sm)',
      transition: 'var(--transition)',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: 'var(--radius-md)',
          background: `${color}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color,
        }}>
          {React.cloneElement(icon, { size: 22 })}
        </div>
        <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color, lineHeight: 1 }}>
          {value}
        </div>
      </div>
      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
        {title}
      </div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
        {subtitle}
      </div>
    </div>
  );
}

function ProtectedFilesTable({ files, verifying, onVerify, onViewHistory, onViewDetails }) {
  const formatTimestamp = (ts) => {
    if (!ts) return '—';
    try {
      const date = new Date(ts);
      if (isNaN(date.getTime())) return '—';
      return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return '—';
    }
  };

  return (
    <div style={{
      background: 'var(--bg-primary)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-md)',
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'var(--bg-secondary)' }}>
            <tr>
              {['File Name', 'Owner', 'S3 Version ID', 'SHA-256', 'Blockchain', 'Uploaded', 'Actions'].map(h => (
                <th key={h} style={{
                  padding: '0.875rem 1rem',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  textAlign: 'left',
                  borderBottom: '2px solid var(--border-color)',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {files.map(file => (
              <tr key={file.key} style={{ borderBottom: '1px solid var(--border-color)', transition: 'var(--transition)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <td style={{ padding: '0.875rem 1rem', fontSize: 'var(--font-size-base)', color: 'var(--text-primary)', fontWeight: 500 }}>
                  {file.name}
                </td>
                <td style={{ padding: '0.875rem 1rem', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                  {file.uploadedBy || '—'}
                </td>
                <td style={{ padding: '0.875rem 1rem', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  {file.s3VersionId ? file.s3VersionId.substring(0, 20) + '...' : '—'}
                </td>
                <td style={{ padding: '0.875rem 1rem', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  {file.sha256 ? file.sha256.substring(0, 16) + '...' : '—'}
                </td>
                <td style={{ padding: '0.875rem 1rem' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.375rem 0.75rem',
                    borderRadius: '999px',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 700,
                    background: file.blockchainStatus === 'recorded' ? 'var(--success-light)' : 'var(--danger-light)',
                    color: file.blockchainStatus === 'recorded' ? 'var(--success)' : 'var(--danger)',
                    textTransform: 'uppercase',
                  }}>
                    {file.blockchainStatus === 'recorded' ? <FiCheckCircle size={12} /> : <FiAlertTriangle size={12} />}
                    {file.blockchainStatus || 'unknown'}
                  </span>
                </td>
                <td style={{ padding: '0.875rem 1rem', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                  {formatTimestamp(file.uploadedAt)}
                </td>
                <td style={{ padding: '0.875rem 1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <ActionButton
                      icon={<FiCheckCircle size={14} />}
                      label="Verify"
                      color="var(--success)"
                      onClick={() => onVerify(file)}
                      disabled={verifying === file.key}
                    />
                    <ActionButton
                      icon={<FiClock size={14} />}
                      label="History"
                      color="var(--info)"
                      onClick={() => onViewHistory(file)}
                      disabled={verifying === file.key}
                    />
                    <ActionButton
                      icon={<FiEye size={14} />}
                      label="Details"
                      color="var(--primary)"
                      onClick={() => onViewDetails(file)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActionButton({ icon, label, color, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: '0.5rem 0.875rem',
        fontSize: 'var(--font-size-xs)',
        fontWeight: 600,
        color: color,
        background: `${color}15`,
        border: `1px solid ${color}40`,
        borderRadius: 'var(--radius-md)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'var(--transition)',
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={e => !disabled && (e.currentTarget.style.background = `${color}25`)}
      onMouseLeave={e => !disabled && (e.currentTarget.style.background = `${color}15`)}
    >
      {icon}
      {label}
    </button>
  );
}

function DetailsModal({ file, onClose }) {
  const v = file.verification;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '2rem',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: 'var(--radius-lg)',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: 'var(--shadow-xl)',
        border: '1px solid var(--border-color)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <FiLock size={24} color="var(--primary)" />
            <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              File Integrity Details
            </h2>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '0.5rem',
          }}>
            <FiX size={20} />
          </button>
        </div>

        <div style={{ padding: '1.5rem' }}>
          <DetailRow label="File Name" value={file.name} />
          <DetailRow label="Owner" value={file.uploadedBy} />
          <DetailRow label="File Key" value={file.key} mono />
          <DetailRow label="S3 Version ID" value={file.s3VersionId} mono />
          <DetailRow label="SHA-256 Hash" value={file.sha256} mono />
          <DetailRow label="Blockchain Status" value={file.blockchainStatus} badge={file.blockchainStatus === 'recorded' ? 'success' : 'danger'} />
          <DetailRow label="Upload Timestamp" value={file.uploadedAt ? new Date(file.uploadedAt).toLocaleString() : '—'} />

          {v && (
            <>
              <div style={{ height: '1px', background: 'var(--border-color)', margin: '1.5rem 0' }} />
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
                Verification Result
              </h3>
              <DetailRow
                label="Status"
                value={v.status}
                badge={v.match ? 'success' : 'danger'}
              />
              <DetailRow label="Hash Match" value={v.match ? 'TRUE' : 'FALSE'} badge={v.match ? 'success' : 'danger'} />
              <DetailRow label="Current SHA-256" value={v.currentSha256} mono />
              <DetailRow label="Stored SHA-256" value={v.storedSha256} mono />
              <DetailRow label="Blockchain Timestamp" value={v.timestamp ? new Date(v.timestamp).toLocaleString() : '—'} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function HistoryModal({ data, onClose }) {
  const formatTimestamp = (ts) => {
    if (!ts) return '—';
    try {
      const date = new Date(ts);
      if (isNaN(date.getTime())) return '—';
      return date.toLocaleString();
    } catch {
      return '—';
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '2rem',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: 'var(--radius-lg)',
        maxWidth: '800px',
        width: '100%',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: 'var(--shadow-xl)',
        border: '1px solid var(--border-color)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <FiClock size={24} color="var(--info)" />
            <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Blockchain Version History
            </h2>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '0.5rem',
          }}>
            <FiX size={20} />
          </button>
        </div>

        <div style={{ padding: '1.5rem' }}>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            <strong>File:</strong> {data.file.name}
          </p>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '1.5rem', fontFamily: 'monospace' }}>
            File ID: {data.fileId}
          </p>

          {data.history.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
              No version history found on blockchain
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {data.history.map((record, i) => (
                <div key={i} style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <FiDatabase size={16} color="var(--primary)" />
                    <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Version {data.history.length - i}
                    </span>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      {formatTimestamp(record.timestamp)}
                    </span>
                  </div>
                  <DetailRow label="S3 Version ID" value={record.s3VersionId} mono small />
                  <DetailRow label="SHA-256" value={record.sha256} mono small />
                  <DetailRow label="Owner ID" value={record.ownerId} small />
                  <DetailRow label="Transaction ID" value={record.txId} mono small />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono, badge, small }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: small ? '0.5rem 0' : '0.75rem 0',
      borderBottom: '1px solid var(--border-color)',
    }}>
      <span style={{ fontSize: small ? 'var(--font-size-xs)' : 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
        {label}
      </span>
      {badge ? (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '0.25rem 0.75rem',
          borderRadius: '999px',
          fontSize: 'var(--font-size-xs)',
          fontWeight: 700,
          background: badge === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
          color: badge === 'success' ? 'var(--success)' : 'var(--danger)',
          textTransform: 'uppercase',
        }}>
          {value}
        </span>
      ) : (
        <span style={{
          fontSize: small ? 'var(--font-size-xs)' : 'var(--font-size-sm)',
          color: 'var(--text-primary)',
          fontFamily: mono ? 'monospace' : 'inherit',
          maxWidth: '400px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'right',
        }} title={value}>
          {value || '—'}
        </span>
      )}
    </div>
  );
}


function RecoveryStatCard({ label, value, icon, color }) {
  return (
    <div style={{
      background: 'var(--bg-primary)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-lg)',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      boxShadow: 'var(--shadow-sm)',
      transition: 'var(--transition)',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: 'var(--radius-md)',
          background: `${color}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color,
        }}>
          {icon}
        </div>
        <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color, lineHeight: 1 }}>
          {value}
        </div>
      </div>
      <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
        {label}
      </div>
    </div>
  );
}

function RecoveryDetailsModal({ recovery, onClose }) {
  const truncateHash = (hash) => {
    if (!hash) return '—';
    if (hash.length <= 24) return hash;
    return `${hash.substring(0, 12)}...${hash.substring(hash.length - 12)}`;
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1.5rem',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-xl)',
          width: '100%',
          maxWidth: '720px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-2xl)',
          animation: 'scaleIn 0.2s ease',
        }}
      >
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.5rem',
          borderBottom: '2px solid var(--border-color)',
          background: 'var(--bg-secondary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-lg)',
              background: recovery.status === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: recovery.status === 'success' ? 'var(--success)' : 'var(--danger)',
            }}>
              <FiRotateCcw size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                File Recovery Details
              </h3>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', margin: 0 }}>
                Blockchain-verified recovery operation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.5rem',
              display: 'flex',
              transition: 'var(--transition)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem', overflow: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <RecoveryDetailRow label="File Name" value={recovery.fileName || 'Unknown'} />
            <RecoveryDetailRow label="File Key" value={recovery.fileKey || '—'} />
            <RecoveryDetailRow label="User Email" value={recovery.userEmail || recovery.userId || '—'} />
            <RecoveryDetailRow label="Recovery Date" value={recovery.recoveredAt || recovery.timestamp ? new Date(recovery.recoveredAt || recovery.timestamp).toLocaleString() : '—'} />
            <RecoveryDetailRow label="Status" value={
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.25rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                background: recovery.status === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
                color: recovery.status === 'success' ? 'var(--success)' : 'var(--danger)',
              }}>
                {recovery.status === 'success' ? <FiCheckCircle size={12} /> : <FiAlertTriangle size={12} />}
                {recovery.status?.toUpperCase() || 'UNKNOWN'}
              </span>
            } />
            <RecoveryDetailRow label="Blockchain Recorded" value={
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 600,
                color: recovery.blockchainRecorded ? 'var(--success)' : 'var(--text-muted)',
              }}>
                {recovery.blockchainRecorded ? <><FiCheckCircle size={14} /> Yes</> : '—'}
              </span>
            } />
          </div>

          {/* Hash Information */}
          <div style={{ marginTop: '1.5rem' }}>
            <p style={{
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '0.75rem',
            }}>
              Hash Verification
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{
                background: 'var(--info-bg)',
                border: '1px solid var(--info)',
                borderRadius: 'var(--radius-md)',
                padding: '0.875rem',
              }}>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                  Blockchain Trusted SHA-256
                </p>
                <p style={{
                  fontSize: 'var(--font-size-sm)',
                  fontFamily: 'monospace',
                  color: 'var(--info)',
                  fontWeight: 600,
                  wordBreak: 'break-all',
                  margin: 0,
                }} title={recovery.trustedSha256 || recovery.originalHash}>
                  {recovery.trustedSha256 || recovery.originalHash || 'N/A'}
                </p>
              </div>
              <div style={{
                background: recovery.status === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
                border: `1px solid ${recovery.status === 'success' ? 'var(--success)' : 'var(--danger)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '0.875rem',
              }}>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                  Restored SHA-256
                </p>
                <p style={{
                  fontSize: 'var(--font-size-sm)',
                  fontFamily: 'monospace',
                  color: recovery.status === 'success' ? 'var(--success)' : 'var(--danger)',
                  fontWeight: 600,
                  wordBreak: 'break-all',
                  margin: 0,
                }} title={recovery.restoredSha256 || recovery.restoredHash}>
                  {recovery.restoredSha256 || recovery.restoredHash || 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Version Information */}
          <div style={{ marginTop: '1.5rem' }}>
            <p style={{
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '0.75rem',
            }}>
              Version Information
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <RecoveryDetailRow label="Original S3 Version ID" value={recovery.originalVersionId || '—'} mono />
              {recovery.blockchainTxId && (
                <RecoveryDetailRow label="Blockchain Transaction ID" value={truncateHash(recovery.blockchainTxId)} mono />
              )}
            </div>
          </div>

          {/* Error Information */}
          {recovery.error && (
            <div style={{ marginTop: '1.5rem' }}>
              <p style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: '0.75rem',
              }}>
                Error Details
              </p>
              <div style={{
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger)',
                borderRadius: 'var(--radius-md)',
                padding: '0.875rem',
              }}>
                <p style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--danger)',
                  fontWeight: 500,
                  margin: 0,
                }}>
                  {recovery.error}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '1rem 1.5rem',
          borderTop: '2px solid var(--border-color)',
          background: 'var(--bg-secondary)',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.625rem 1.5rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--primary)',
              color: 'white',
              border: 'none',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'var(--transition)',
              boxShadow: 'var(--shadow-md)',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function RecoveryDetailRow({ label, value, mono = false }) {
  return (
    <div>
      <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
        {label}
      </p>
      <p style={{
        fontSize: 'var(--font-size-sm)',
        fontWeight: 600,
        color: 'var(--text-primary)',
        margin: 0,
        fontFamily: mono ? 'monospace' : 'inherit',
        wordBreak: 'break-all',
      }}>
        {typeof value === 'string' ? value : value}
      </p>
    </div>
  );
}

function FailureDetailsModal({ failure, onClose }) {
  const metadata = failure.metadata || {};
  
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1.5rem',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-xl)',
          width: '100%',
          maxWidth: '720px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-2xl)',
          animation: 'scaleIn 0.2s ease',
        }}
      >
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.5rem',
          borderBottom: '2px solid var(--border-color)',
          background: 'var(--bg-secondary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--danger-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--danger)',
            }}>
              <FiAlertCircle size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Integrity Failure Details
              </h3>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', margin: 0 }}>
                Hash mismatch detection event
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.5rem',
              display: 'flex',
              transition: 'var(--transition)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem', overflow: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <FailureDetailRow label="File Name" value={metadata.fileName || 'Unknown'} />
            <FailureDetailRow label="Owner" value={failure.userEmail} />
            <FailureDetailRow label="Detection Time" value={failure.timestamp ? new Date(failure.timestamp).toLocaleString() : '—'} />
            <FailureDetailRow label="IP Address" value={failure.ipAddress || '—'} />
            <FailureDetailRow label="Device" value={failure.device || '—'} />
            <FailureDetailRow label="OS" value={failure.os || '—'} />
            <FailureDetailRow label="Browser" value={failure.browser || '—'} />
            <FailureDetailRow label="Verification Status" value={
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.25rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                background: 'var(--danger-bg)',
                color: 'var(--danger)',
              }}>
                <FiAlertTriangle size={12} />
                {metadata.verificationStatus || 'INTEGRITY_ALERT'}
              </span>
            } />
          </div>

          {/* Hash Comparison */}
          <div style={{ marginTop: '1.5rem' }}>
            <p style={{
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '0.75rem',
            }}>
              Hash Comparison
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{
                background: 'var(--success-bg)',
                border: '1px solid var(--success)',
                borderRadius: 'var(--radius-md)',
                padding: '0.875rem',
              }}>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                  Blockchain Recorded SHA-256
                </p>
                <p style={{
                  fontSize: 'var(--font-size-sm)',
                  fontFamily: 'monospace',
                  color: 'var(--success)',
                  fontWeight: 600,
                  wordBreak: 'break-all',
                  margin: 0,
                }}>
                  {metadata.storedSha256 || 'N/A'}
                </p>
              </div>
              <div style={{
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger)',
                borderRadius: 'var(--radius-md)',
                padding: '0.875rem',
              }}>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                  Current Computed SHA-256
                </p>
                <p style={{
                  fontSize: 'var(--font-size-sm)',
                  fontFamily: 'monospace',
                  color: 'var(--danger)',
                  fontWeight: 600,
                  wordBreak: 'break-all',
                  margin: 0,
                }}>
                  {metadata.currentSha256 || 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Version Information */}
          <div style={{ marginTop: '1.5rem' }}>
            <p style={{
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '0.75rem',
            }}>
              Version Information
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <FailureDetailRow label="Stored Version ID" value={metadata.storedVersionId || '—'} mono />
              <FailureDetailRow label="Current Version ID" value={metadata.currentVersionId || '—'} mono />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '1rem 1.5rem',
          borderTop: '2px solid var(--border-color)',
          background: 'var(--bg-secondary)',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.625rem 1.5rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--primary)',
              color: 'white',
              border: 'none',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'var(--transition)',
              boxShadow: 'var(--shadow-md)',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function FailureDetailRow({ label, value, mono = false }) {
  return (
    <div>
      <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
        {label}
      </p>
      <p style={{
        fontSize: 'var(--font-size-sm)',
        fontWeight: 600,
        color: 'var(--text-primary)',
        margin: 0,
        fontFamily: mono ? 'monospace' : 'inherit',
        wordBreak: 'break-all',
      }}>
        {typeof value === 'string' ? value : value}
      </p>
    </div>
  );
}
