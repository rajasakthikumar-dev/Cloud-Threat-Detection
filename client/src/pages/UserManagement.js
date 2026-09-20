import React, { useEffect, useState } from 'react';
import {
  FiSearch, FiUsers, FiTrash2, FiEdit2, FiUser, FiShield,
  FiAlertTriangle, FiUnlock, FiLock, FiX, FiCpu, FiClock,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import {
  getAllUsers, deleteUser, updateUserRole,
  restrictUser, releaseRestriction,
} from '../services/api';
import { useAuth } from '../App';

/**
 * UserManagement — admin-only user list with role management
 * MODULE 1 COMPLETE:
 *   - Security Status (Normal / Warning / Restricted)
 *   - ML Risk Score column
 *   - Restriction Status column  (Not Restricted / Temporary Restricted)
 *   - Restriction Reason column  (manual text or ML attack type)
 *   - Expiry column              (countdown until auto-release)
 *   - Manual restriction modal   (preset reasons + custom + duration picker)
 *   - ML-auto restriction badge  (shows "ML Auto" source tag)
 *   - Release Restriction button (admin only)
 *   - All existing columns and actions preserved unchanged
 */

// ── Preset restriction reasons ───────────────────────────────
const PRESET_REASONS = [
  'Suspicious login activity',
  'Multiple failed login attempts',
  'Unusual file access pattern',
  'Policy violation',
  'Account under investigation',
  'Temporary security hold',
  '__custom__',
];
const PRESET_LABELS = {
  'Suspicious login activity':      'Suspicious login activity',
  'Multiple failed login attempts':  'Multiple failed login attempts',
  'Unusual file access pattern':    'Unusual file access pattern',
  'Policy violation':               'Policy violation',
  'Account under investigation':    'Account under investigation',
  'Temporary security hold':        'Temporary security hold',
  '__custom__':                     'Custom reason…',
};

// ── Duration options ─────────────────────────────────────────
const DURATION_OPTIONS = [
  { label: '15 minutes', value: 15    },
  { label: '30 minutes', value: 30    },
  { label: '1 hour',     value: 60    },
  { label: '2 hours',    value: 120   },
  { label: '6 hours',    value: 360   },
  { label: '12 hours',   value: 720   },
  { label: '24 hours',   value: 1440  },
  { label: '3 days',     value: 4320  },
  { label: '7 days',     value: 10080 },
];

// ── Helpers ──────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    }).format(d);
  } catch { return '—'; }
}

function formatExpiry(expiryIso) {
  if (!expiryIso) return '—';
  const diff = new Date(expiryIso).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const totalMins = Math.floor(diff / 60000);
  const days  = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);
  const mins  = totalMins % 60;
  if (days > 0)  return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

// ─────────────────────────────────────────────────────────────
export default function UserManagement() {
  const { initializing } = useAuth();

  const [users,   setUsers]   = useState([]);
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // Restriction modal state
  const [modalTarget,  setModalTarget]  = useState(null);   // { id, name }
  const [modalReason,  setModalReason]  = useState(PRESET_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [modalExpiry,  setModalExpiry]  = useState(30);
  const [modalBusy,    setModalBusy]    = useState(false);

  // ── Load users ──────────────────────────────────────────
  useEffect(() => {
    if (initializing) return;
    async function fetchUsers() {
      setError(null);
      try {
        const res = await getAllUsers();
        setUsers(res.data.users || []);
      } catch (err) {
        const msg = err.response?.data?.message || 'Failed to load users.';
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, [initializing]);

  // ── Existing: delete ────────────────────────────────────
  const handleDelete = async (id, name) => {
    if (!window.confirm(`Remove user "${name}"? This cannot be undone.`)) return;
    try {
      await deleteUser(id);
      setUsers(prev => prev.filter(u => u.id !== id));
      toast.success(`User "${name}" removed.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete user.');
    }
  };

  // ── Existing: role toggle ───────────────────────────────
  const handleRoleToggle = async (id, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await updateUserRole(id, newRole);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role: newRole } : u));
      toast.success(`Role updated to "${newRole}".`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update role.');
    }
  };

  // ── MODULE 1: open restriction modal ───────────────────
  const openRestrictModal = (id, name) => {
    setModalTarget({ id, name });
    setModalReason(PRESET_REASONS[0]);
    setCustomReason('');
    setModalExpiry(30);
  };

  const closeModal = () => {
    if (!modalBusy) setModalTarget(null);
  };

  // ── MODULE 1: confirm restriction ──────────────────────
  const handleConfirmRestrict = async () => {
    if (!modalTarget) return;

    const finalReason = modalReason === '__custom__'
      ? (customReason.trim() || 'No reason provided')
      : modalReason;

    setModalBusy(true);
    try {
      const res = await restrictUser(modalTarget.id, finalReason, modalExpiry);
      const expiry = res.data.restrictionExpiry || null;
      const durationLabel = DURATION_OPTIONS.find(o => o.value === modalExpiry)?.label || `${modalExpiry} min`;

      setUsers(prev => prev.map(u =>
        u.id === modalTarget.id ? {
          ...u,
          restricted:        true,
          security_status:   'Restricted',
          restrictionStatus: 'Temporary Restricted',
          restrictionReason: finalReason,
          restrictionSource: 'manual',
          restrictedBy:      'admin',
          restrictionExpiry: expiry,
        } : u
      ));

      toast.success(`"${modalTarget.name}" restricted for ${durationLabel}.`);
      setModalTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to restrict account.');
    } finally {
      setModalBusy(false);
    }
  };

  // ── MODULE 1: release restriction ──────────────────────
  const handleRelease = async (id, name) => {
    if (!window.confirm(`Release restriction for "${name}"?`)) return;
    try {
      await releaseRestriction(id);
      setUsers(prev => prev.map(u =>
        u.id === id ? {
          ...u,
          restricted:        false,
          security_status:   'Normal',
          restrictionStatus: 'Not Restricted',
          restrictionReason: null,
          restrictionSource: null,
          restrictedBy:      null,
          restrictionExpiry: null,
        } : u
      ));
      toast.success(`Restriction released for "${name}".`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to release restriction.');
    }
  };

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  // ── Style helpers ───────────────────────────────────────
  const rolePill = (role) => ({
    display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
    padding: '0.375rem 0.75rem', borderRadius: '999px',
    fontSize: 'var(--font-size-xs)', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    background: role === 'admin' ? 'rgba(139,92,246,0.15)' : 'var(--info-light)',
    color:      role === 'admin' ? 'var(--purple)' : 'var(--info)',
    border: `1px solid ${role === 'admin' ? 'rgba(139,92,246,0.3)' : 'rgba(6,182,212,0.3)'}`,
  });

  const securityBadge = (status) => {
    const map = {
      Normal:     { bg: 'var(--success-light)', color: 'var(--success)', border: 'rgba(34,197,94,0.3)'  },
      Warning:    { bg: 'var(--warning-light)', color: 'var(--warning)', border: 'rgba(251,146,60,0.3)' },
      Restricted: { bg: 'var(--danger-light)',  color: 'var(--danger)',  border: 'rgba(239,68,68,0.3)'  },
    };
    const c = map[status] || map.Normal;
    return {
      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
      padding: '0.375rem 0.75rem', borderRadius: '999px',
      fontSize: 'var(--font-size-xs)', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.05em',
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
    };
  };

  const iconBtn = (color, onClick, title, Icon, disabled = false) => (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        background: `${color}18`,
        border: `1px solid ${color}30`,
        borderRadius: 'var(--radius-md)',
        color: disabled ? 'var(--text-muted)' : color,
        padding: '0.5rem 0.625rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex', alignItems: 'center',
        transition: 'var(--transition)',
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = `${color}30`; }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = `${color}18`; }}
    >
      <Icon size={16} />
    </button>
  );

  // ── Render ──────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-page)' }}>
      <Navbar />
      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar />
        <main style={{ flex: 1, padding: '2rem', overflow: 'auto' }}>

          {/* ── Header ── */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: 'var(--radius-lg)',
                background: 'var(--primary)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-md)',
              }}>
                <FiUsers size={24} color="white" />
              </div>
              <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                User Management
              </h1>
            </div>
            <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', marginLeft: '62px' }}>
              Manage registered users, roles, security status, and account restrictions
            </p>
          </div>

          {/* ── Card ── */}
          <div style={{
            background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-md)',
          }}>
            {/* Toolbar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '1rem',
              padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)', flexWrap: 'wrap',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1,
                background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)', padding: '0.625rem 1rem', minWidth: '250px',
              }}>
                <FiSearch size={18} color="var(--text-muted)" />
                <input
                  style={{
                    flex: 1, background: 'none', border: 'none', outline: 'none',
                    color: 'var(--text-primary)', fontSize: 'var(--font-size-base)', fontFamily: 'inherit',
                  }}
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <span style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', fontWeight: 500 }}>
                {filtered.length} user{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: 'var(--bg-secondary)' }}>
                  <tr>
                    {[
                      'User', 'Email', 'Role', 'Joined',
                      'Security Status', 'Risk',
                      'Restriction Status', 'Restriction Reason', 'Expiry',
                      'Actions',
                    ].map(h => (
                      <th key={h} style={{
                        padding: '0.875rem 1rem',
                        fontSize: 'var(--font-size-sm)', fontWeight: 700,
                        color: 'var(--text-secondary)', textTransform: 'uppercase',
                        letterSpacing: '0.05em', textAlign: 'left',
                        borderBottom: '2px solid var(--border-color)',
                        whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={10} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      Loading users…
                    </td></tr>
                  ) : error ? (
                    <tr><td colSpan={10} style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger)' }}>
                      {error}
                    </td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={10} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      {search ? 'No users match your search.' : 'No users found.'}
                    </td></tr>
                  ) : filtered.map(u => {
                    const isRestricted = u.restricted === true;
                    const isMlAuto     = u.restrictionSource === 'ml_auto';
                    const restStatus   = u.restrictionStatus  || (isRestricted ? 'Temporary Restricted' : 'Not Restricted');
                    const restReason   = u.restrictionReason  || null;
                    const restExpiry   = u.restrictionExpiry  || null;
                    const secStatus    = u.security_status    || 'Normal';

                    return (
                      <tr key={u.id}
                        style={{ borderBottom: '1px solid var(--border-color)', transition: 'var(--transition)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        {/* User */}
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', color: 'var(--text-primary)', fontWeight: 600, fontSize: 'var(--font-size-base)' }}>
                            {u.role === 'admin' ? (
                              <div style={{
                                width: '32px', height: '32px', borderRadius: 'var(--radius-md)',
                                background: 'linear-gradient(135deg, var(--purple), var(--purple-2))',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                <FiShield size={16} color="white" />
                              </div>
                            ) : (
                              <div style={{
                                width: '32px', height: '32px', borderRadius: 'var(--radius-md)',
                                background: isRestricted ? 'var(--danger-light)' : 'var(--info-light)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                {isRestricted
                                  ? <FiLock size={16} color="var(--danger)" />
                                  : <FiUser size={16} color="var(--info)" />
                                }
                              </div>
                            )}
                            {u.name}
                          </span>
                        </td>

                        {/* Email */}
                        <td style={{ padding: '0.875rem 1rem', fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                          {u.email}
                        </td>

                        {/* Role */}
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <span style={rolePill(u.role)}>{u.role}</span>
                        </td>

                        {/* Joined */}
                        <td style={{ padding: '0.875rem 1rem', fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {formatDate(u.createdAt)}
                        </td>

                        {/* Security Status */}
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <span style={securityBadge(secStatus)}>
                            {secStatus === 'Warning'    && <FiAlertTriangle size={11} />}
                            {secStatus === 'Restricted' && <FiLock size={11} />}
                            {secStatus}
                          </span>
                        </td>

                        {/* ML Risk Score */}
                        <td style={{ padding: '0.875rem 1rem' }}>
                          {u.risk_score > 0 ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                              fontSize: 'var(--font-size-sm)', fontWeight: 700,
                              color: u.risk_score >= 30 ? 'var(--danger)' : u.risk_score >= 10 ? 'var(--warning)' : 'var(--success)',
                            }}>
                              <FiCpu size={12} />
                              {u.risk_score}
                            </span>
                          ) : (
                            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>

                        {/* Restriction Status */}
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                              padding: '0.25rem 0.625rem', borderRadius: '999px',
                              fontSize: 'var(--font-size-xs)', fontWeight: 600,
                              background: isRestricted ? 'var(--danger-light)' : 'var(--bg-secondary)',
                              color:      isRestricted ? 'var(--danger)' : 'var(--text-muted)',
                              border: `1px solid ${isRestricted ? 'rgba(239,68,68,0.3)' : 'var(--border-color)'}`,
                              whiteSpace: 'nowrap',
                            }}>
                              {isRestricted ? <FiLock size={11} /> : <FiUnlock size={11} />}
                              {restStatus}
                            </span>
                            {/* Source badge — honest labeling */}
                            {isRestricted && (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                fontSize: 'var(--font-size-xs)',
                                color: isMlAuto ? 'var(--purple)' : 
                                       u.restrictionSource === 'authentication_rule' ? 'var(--warning)' : 'var(--text-muted)',
                                background: isMlAuto ? 'rgba(139,92,246,0.1)' : 
                                            u.restrictionSource === 'authentication_rule' ? 'rgba(251,146,60,0.1)' : 'var(--bg-secondary)',
                                border: `1px solid ${isMlAuto ? 'rgba(139,92,246,0.25)' : 
                                        u.restrictionSource === 'authentication_rule' ? 'rgba(251,146,60,0.25)' : 'var(--border-color)'}`,
                                padding: '0.125rem 0.5rem', borderRadius: '999px',
                              }}>
                                {isMlAuto && <><FiCpu size={10} /> ML Auto</>}
                                {u.restrictionSource === 'authentication_rule' && <><FiAlertTriangle size={10} /> Auth Rule</>}
                                {!isMlAuto && u.restrictionSource !== 'authentication_rule' && <>Manual</>}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Restriction Reason */}
                        <td style={{ padding: '0.875rem 1rem', maxWidth: '220px' }}>
                          {restReason ? (
                            <span style={{
                              fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)',
                              display: 'block', overflow: 'hidden',
                              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }} title={restReason}>
                              {restReason}
                            </span>
                          ) : (
                            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>

                        {/* Expiry */}
                        <td style={{ padding: '0.875rem 1rem', whiteSpace: 'nowrap' }}>
                          {isRestricted && restExpiry ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                              fontSize: 'var(--font-size-xs)', color: 'var(--warning)',
                              background: 'var(--warning-light)', border: '1px solid rgba(251,146,60,0.3)',
                              padding: '0.25rem 0.625rem', borderRadius: '999px', fontWeight: 600,
                            }}>
                              <FiClock size={11} />
                              {formatExpiry(restExpiry)}
                            </span>
                          ) : (
                            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <span style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {/* Role toggle — always available */}
                            {iconBtn('var(--primary)', () => handleRoleToggle(u.id, u.role), `Switch to ${u.role === 'admin' ? 'user' : 'admin'}`, FiEdit2)}

                            {/* Restrict / Release — only for non-admin users */}
                            {u.role !== 'admin' && (
                              isRestricted
                                ? iconBtn('var(--success)', () => handleRelease(u.id, u.name), 'Release restriction', FiUnlock)
                                : iconBtn('var(--warning)', () => openRestrictModal(u.id, u.name), 'Restrict account', FiAlertTriangle)
                            )}

                            {/* Delete */}
                            {iconBtn('var(--danger)', () => handleDelete(u.id, u.name), 'Delete user', FiTrash2)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* ════════════════════════════════════════════════════
          RESTRICTION MODAL
          ════════════════════════════════════════════════════ */}
      {modalTarget && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '1rem',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '520px', width: '100%',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
            }}
          >
            {/* Modal header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-color)',
              background: 'var(--warning-light)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <FiLock size={20} color="var(--warning)" />
                <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Restrict Account
                </h2>
              </div>
              <button
                onClick={closeModal}
                disabled={modalBusy}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', padding: '0.25rem',
                  display: 'flex', alignItems: 'center',
                }}
              >
                <FiX size={20} />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Target user info */}
              <div style={{
                padding: '0.875rem 1rem',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                fontSize: 'var(--font-size-base)',
                color: 'var(--text-secondary)',
              }}>
                Applying a <strong style={{ color: 'var(--text-primary)' }}>temporary restriction</strong> to:{' '}
                <strong style={{ color: 'var(--warning)' }}>{modalTarget.name}</strong>
              </div>

              {/* Reason selector */}
              <div>
                <label style={{
                  display: 'block', marginBottom: '0.5rem',
                  fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)',
                }}>
                  Restriction Reason
                </label>
                <select
                  value={modalReason}
                  onChange={e => setModalReason(e.target.value)}
                  disabled={modalBusy}
                  style={{
                    width: '100%', padding: '0.625rem 0.875rem',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--font-size-base)',
                    fontFamily: 'inherit',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {PRESET_REASONS.map(r => (
                    <option key={r} value={r}>{PRESET_LABELS[r]}</option>
                  ))}
                </select>

                {/* Custom reason textarea */}
                {modalReason === '__custom__' && (
                  <textarea
                    value={customReason}
                    onChange={e => setCustomReason(e.target.value)}
                    disabled={modalBusy}
                    placeholder="Enter specific restriction reason…"
                    maxLength={500}
                    rows={3}
                    style={{
                      marginTop: '0.75rem',
                      width: '100%', padding: '0.625rem 0.875rem',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--font-size-base)',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                )}
              </div>

              {/* Duration selector */}
              <div>
                <label style={{
                  display: 'block', marginBottom: '0.5rem',
                  fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)',
                }}>
                  Restriction Duration
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {DURATION_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setModalExpiry(opt.value)}
                      disabled={modalBusy}
                      style={{
                        padding: '0.375rem 0.875rem',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 600,
                        cursor: modalBusy ? 'not-allowed' : 'pointer',
                        transition: 'var(--transition)',
                        border: modalExpiry === opt.value
                          ? '2px solid var(--warning)'
                          : '1px solid var(--border-color)',
                        background: modalExpiry === opt.value
                          ? 'var(--warning-light)'
                          : 'var(--bg-secondary)',
                        color: modalExpiry === opt.value
                          ? 'var(--warning)'
                          : 'var(--text-secondary)',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notice */}
              <p style={{
                margin: 0, padding: '0.625rem 0.875rem',
                background: 'rgba(251,146,60,0.08)',
                border: '1px solid rgba(251,146,60,0.25)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}>
                This restriction is <strong>temporary</strong>. The account will auto-release after the selected duration,
                or you can manually release it at any time.
              </p>
            </div>

            {/* Modal footer */}
            <div style={{
              display: 'flex', justifyContent: 'flex-end', gap: '0.75rem',
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
            }}>
              <button
                onClick={closeModal}
                disabled={modalBusy}
                style={{
                  padding: '0.625rem 1.25rem',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--font-size-base)',
                  fontWeight: 600,
                  cursor: modalBusy ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRestrict}
                disabled={modalBusy || (modalReason === '__custom__' && !customReason.trim())}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.625rem 1.25rem',
                  background: 'var(--warning)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  color: 'white',
                  fontSize: 'var(--font-size-base)',
                  fontWeight: 700,
                  cursor: (modalBusy || (modalReason === '__custom__' && !customReason.trim())) ? 'not-allowed' : 'pointer',
                  opacity: (modalBusy || (modalReason === '__custom__' && !customReason.trim())) ? 0.6 : 1,
                  transition: 'var(--transition)',
                }}
              >
                <FiLock size={16} />
                {modalBusy ? 'Restricting…' : 'Apply Restriction'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
