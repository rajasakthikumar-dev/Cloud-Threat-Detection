import React, { useEffect, useState } from 'react';
import { FiRefreshCw, FiSearch, FiRotateCcw, FiCheckCircle, FiXCircle, FiAlertCircle, FiEye, FiDownload, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { getRecoveryHistory, deleteRecoveryRecord, getFileUrl } from '../services/api';
import { useAuth } from '../App';

/* ── Recovery Status Badge Component ── */
function StatusBadge({ status }) {
  const STATUS_CONFIG = {
    success: { bg: '#dcfce7', color: '#16a34a', icon: FiCheckCircle, label: 'Success' },
    failed:  { bg: '#fee2e2', color: '#dc2626', icon: FiXCircle, label: 'Failed' },
    partial: { bg: '#fef3c7', color: '#d97706', icon: FiAlertCircle, label: 'Partial' },
  };
  
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.partial;
  const Icon = cfg.icon;
  
  return (
    <span style={{ 
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '0.375rem 0.75rem', 
      borderRadius: '999px', 
      fontSize: '11px', 
      fontWeight: 700, 
      background: cfg.bg, 
      color: cfg.color, 
      whiteSpace: 'nowrap',
      textTransform: 'uppercase',
      letterSpacing: '0.05em'
    }}>
      <Icon size={12} />
      {cfg.label}
    </span>
  );
}

/* ── Glass card styles ── */
const gc = (extra = {}) => ({
  background: 'rgba(255,255,255,0.22)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.35)',
  borderRadius: '16px',
  boxShadow: '0 4px 20px rgba(2,132,199,0.10)',
  ...extra,
});

export default function RecoveredFiles() {
  const { initializing } = useAuth();
  const [recoveries, setRecoveries] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    if (initializing) return;
    
    setError(null);
    setSpinning(true);
    
    try {
      const res = await getRecoveryHistory();
      const fetchedRecoveries = res.data.recoveries || [];
      setRecoveries(fetchedRecoveries);
      
      if (fetchedRecoveries.length === 0 && !error) {
        setError(null);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to load recovery history.';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally { 
      setLoading(false); 
      setSpinning(false); 
    }
  };

  useEffect(() => {
    if (!initializing) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initializing]);

  const handleDownload = async (fileKey, fileName) => {
    try {
      const res = await getFileUrl(fileKey);
      const a = document.createElement('a');
      a.href = res.data.url;
      a.download = fileName;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`Downloading ${fileName}...`);
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Could not generate download link.';
      toast.error(errorMsg);
    }
  };

  const handleView = async (fileKey, fileName) => {
    try {
      const res = await getFileUrl(fileKey);
      window.open(res.data.url, '_blank');
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Could not generate view link.';
      toast.error(errorMsg);
    }
  };

  const handleDelete = async (recovery) => {
    const confirmMsg = `Delete recovery record for "${recovery.fileName}"? This will also remove the file from My Files if it exists.`;
    if (!window.confirm(confirmMsg)) return;
    
    try {
      // Delete the recovery record by its ID
      await deleteRecoveryRecord(recovery.id);
      toast.success(`Recovery record for "${recovery.fileName}" deleted successfully.`);
      
      // Reload the entire list from backend to ensure consistency
      await load();
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to delete recovery record.';
      toast.error(errorMsg);
    }
  };

  const formatTimestamp = (ts) => {
    if (!ts) return '—';
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      if (isNaN(date.getTime())) return '—';
      
      return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(date).replace(',', '');
    } catch {
      return '—';
    }
  };

  const truncateHash = (hash) => {
    if (!hash) return '—';
    if (hash.length <= 16) return hash;
    return `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`;
  };

  const filtered = recoveries.filter(r => {
    const matchSearch = !search ||
      r.fileName?.toLowerCase().includes(search.toLowerCase()) ||
      r.fileKey?.toLowerCase().includes(search.toLowerCase()) ||
      r.status?.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      minHeight: '100vh', 
      background: 'linear-gradient(160deg, #dbeafe 0%, #bfdbfe 40%, #93c5fd 80%, #60a5fa 100%)' 
    }}>
      <Navbar />
      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar />
        <main style={{ flex: 1, padding: '28px', overflow: 'auto' }}>

          {/* Header */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{ 
                width: '38px', 
                height: '38px', 
                borderRadius: '11px', 
                background: 'linear-gradient(135deg, #f59e0b, #d97706)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                boxShadow: '0 4px 12px rgba(245,158,11,0.35)' 
              }}>
                <FiRotateCcw size={18} color="#fff" />
              </div>
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                Recovered Files
              </h1>
            </div>
            <p style={{ fontSize: '14px', color: 'rgba(15,23,42,0.55)', fontWeight: 500 }}>
              History of blockchain-verified file recovery operations
            </p>
          </div>

          {/* Main content card */}
          <div style={gc({ padding: '20px' })}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <p style={{ 
                fontSize: '11px', 
                fontWeight: 700, 
                color: 'rgba(15,23,42,0.45)', 
                textTransform: 'uppercase', 
                letterSpacing: '0.1em', 
                margin: 0 
              }}>
                Recovery History ({filtered.length})
              </p>
              <button
                onClick={load}
                disabled={spinning}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '5px', 
                  background: 'rgba(14,165,233,0.12)', 
                  border: '1px solid rgba(14,165,233,0.25)', 
                  borderRadius: '8px', 
                  color: '#0369a1', 
                  padding: '5px 10px', 
                  fontSize: '12px', 
                  fontWeight: 600, 
                  cursor: spinning ? 'not-allowed' : 'pointer',
                  opacity: spinning ? 0.6 : 1
                }}
              >
                <FiRefreshCw size={12} style={{ animation: spinning ? 'spin 1s linear infinite' : 'none' }} /> 
                Refresh
              </button>
            </div>

            {/* Search */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              background: 'rgba(255,255,255,0.45)', 
              border: '1px solid rgba(14,165,233,0.20)', 
              borderRadius: '10px', 
              padding: '8px 12px', 
              marginBottom: '16px' 
            }}>
              <FiSearch size={14} color="rgba(15,23,42,0.4)" />
              <input
                style={{ 
                  flex: 1, 
                  background: 'none', 
                  border: 'none', 
                  outline: 'none', 
                  color: '#0f172a', 
                  fontSize: '13px', 
                  fontFamily: 'inherit' 
                }}
                placeholder="Search by filename or status…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(15,23,42,0.04)' }}>
                    {['File Name', 'Recovery Date', 'Status', 'Original Hash', 'Restored Hash', 'Blockchain TX', 'Actions'].map(h => (
                      <th key={h} style={{ 
                        padding: '10px 14px', 
                        fontSize: '11px', 
                        fontWeight: 700, 
                        color: 'rgba(15,23,42,0.40)', 
                        textTransform: 'uppercase', 
                        letterSpacing: '0.08em', 
                        textAlign: 'left' 
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} style={{ 
                        padding: '28px', 
                        textAlign: 'center', 
                        color: 'rgba(15,23,42,0.4)', 
                        fontSize: '13px' 
                      }}>
                        Loading recovery history…
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ 
                        padding: '40px 28px', 
                        textAlign: 'center' 
                      }}>
                        <FiRotateCcw size={48} color="rgba(15,23,42,0.2)" style={{ marginBottom: '12px' }} />
                        <p style={{ 
                          fontSize: '15px', 
                          fontWeight: 600, 
                          color: 'rgba(15,23,42,0.5)', 
                          margin: '0 0 4px 0' 
                        }}>
                          {search ? 'No recovery records match your search.' : 'No recovered files yet.'}
                        </p>
                        <p style={{ 
                          fontSize: '13px', 
                          color: 'rgba(15,23,42,0.35)', 
                          margin: 0 
                        }}>
                          Recovery operations will appear here after you recover files from File Management.
                        </p>
                      </td>
                    </tr>
                  ) : filtered.map((r, i) => (
                    <tr 
                      key={r.id || i} 
                      style={{ 
                        borderTop: '1px solid rgba(15,23,42,0.06)', 
                        transition: 'background 0.15s' 
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(14,165,233,0.04)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ 
                          fontSize: '13px', 
                          fontWeight: 600, 
                          color: '#0369a1' 
                        }}>
                          {r.fileName || r.fileKey || '—'}
                        </span>
                      </td>
                      <td style={{ 
                        padding: '11px 14px', 
                        fontSize: '12px', 
                        color: 'rgba(15,23,42,0.45)' 
                      }}>
                        {formatTimestamp(r.completedAt || r.startedAt)}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <StatusBadge status={r.status} />
                      </td>
                      <td style={{ 
                        padding: '11px 14px', 
                        fontSize: '11px', 
                        fontFamily: 'monospace', 
                        color: 'rgba(15,23,42,0.45)' 
                      }}>
                        <span title={r.trustedOriginalSha256}>
                          {truncateHash(r.trustedOriginalSha256)}
                        </span>
                      </td>
                      <td style={{ 
                        padding: '11px 14px', 
                        fontSize: '11px', 
                        fontFamily: 'monospace', 
                        color: 'rgba(15,23,42,0.45)' 
                      }}>
                        <span title={r.restoredSha256}>
                          {truncateHash(r.restoredSha256)}
                        </span>
                      </td>
                      <td style={{ 
                        padding: '11px 14px', 
                        fontSize: '11px', 
                        fontFamily: 'monospace', 
                        color: 'rgba(15,23,42,0.45)' 
                      }}>
                        {r.blockchainTransactionId ? (
                          <span 
                            style={{ 
                              color: '#16a34a', 
                              fontWeight: 600 
                            }}
                            title={r.blockchainTransactionId}
                          >
                            {truncateHash(r.blockchainTransactionId)}
                          </span>
                        ) : (
                          <span style={{ color: 'rgba(15,23,42,0.25)' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {r.status === 'success' && r.fileKey && (
                            <>
                              <button
                                onClick={() => handleView(r.fileKey, r.fileName)}
                                style={{ 
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: 'rgba(14,165,233,0.12)', 
                                  border: '1px solid rgba(14,165,233,0.25)', 
                                  borderRadius: '8px', 
                                  color: '#0369a1', 
                                  padding: '6px 10px', 
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                <FiEye size={12} />
                                View
                              </button>
                              <button
                                onClick={() => handleDownload(r.fileKey, r.fileName)}
                                style={{ 
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: 'rgba(34,197,94,0.12)', 
                                  border: '1px solid rgba(34,197,94,0.25)', 
                                  borderRadius: '8px', 
                                  color: '#16a34a', 
                                  padding: '6px 10px', 
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                <FiDownload size={12} />
                                Download
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDelete(r)}
                            style={{ 
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: 'rgba(239,68,68,0.12)', 
                              border: '1px solid rgba(239,68,68,0.25)', 
                              borderRadius: '8px', 
                              color: '#dc2626', 
                              padding: '6px 10px', 
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <FiTrash2 size={12} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Add spin animation for refresh button */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
