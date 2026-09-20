import React, { useEffect, useState } from 'react';
import { FiLock, FiLogOut, FiClock, FiAlertTriangle, FiCpu } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { logoutUser } from '../services/api';

/**
 * RestrictedPage
 * ---------------
 * Shown when a restricted user tries to access any protected resource.
 * The api.js interceptor redirects here on any 403 ACCOUNT_RESTRICTED response.
 *
 * Displays:
 *  - Clear message that the account is temporarily restricted
 *  - Restriction reason (without exposing internal security details)
 *  - Expiry time if available
 *  - Source badge: manual vs ML Auto
 *  - Logout button (users can always log out even when restricted)
 *
 * Does NOT expose JWT internals, user IDs, or Firestore details.
 */
export default function RestrictedPage() {
  const { logout } = useAuth();
  const navigate   = useNavigate();
  const [info, setInfo] = useState(null);

  useEffect(() => {
    // Read restriction details stored by the api.js interceptor
    try {
      const raw = sessionStorage.getItem('restriction_info');
      if (raw) setInfo(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const handleLogout = async () => {
    try {
      // Best-effort — the backend /logout endpoint may also 403, but
      // we call it for activity logging; we log out locally regardless.
      await logoutUser();
    } catch { /* restricted users may not be able to hit logout endpoint */ }
    // Clear local session regardless
    logout();
    navigate('/login', { replace: true });
  };

  const isMLAuto        = info?.restrictionSource === 'ml_auto';
  const isAuthRule      = info?.restrictionSource === 'authentication_rule';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 50%, #fecaca 100%)',
      padding: '1.5rem',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '520px',
        background: 'white',
        border: '1px solid rgba(239,68,68,0.2)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(239,68,68,0.12)',
      }}>

        {/* Header strip */}
        <div style={{
          background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
        }}>
          <div style={{
            width: '72px', height: '72px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid rgba(255,255,255,0.3)',
          }}>
            <FiLock size={36} color="white" />
          </div>
          <h1 style={{
            color: 'white', margin: 0,
            fontSize: '1.5rem', fontWeight: 800, textAlign: 'center',
          }}>
            Account Temporarily Restricted
          </h1>
        </div>

        {/* Body */}
        <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Main message */}
          <p style={{
            margin: 0,
            fontSize: '1rem', color: '#374151', lineHeight: 1.6,
            textAlign: 'center',
          }}>
            {info?.message ||
              'Your account has been temporarily restricted. Please contact an administrator for assistance.'}
          </p>

          {/* Source badge */}
          {(isMLAuto || isAuthRule) && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              padding: '0.5rem 1rem',
              background: isAuthRule ? 'rgba(251,146,60,0.08)' : 'rgba(139,92,246,0.08)',
              border: `1px solid ${isAuthRule ? 'rgba(251,146,60,0.25)' : 'rgba(139,92,246,0.25)'}`,
              borderRadius: '999px',
              fontSize: '0.8rem', fontWeight: 600,
              color: isAuthRule ? '#d97706' : '#7c3aed',
              alignSelf: 'center',
            }}>
              {isAuthRule
                ? <><span>🔐</span> Detected by authentication behavior monitor</>
                : <><FiCpu size={14} /> Detected by automated security system (ML)</>
              }
            </div>
          )}

          {/* Details card */}
          <div style={{
            background: '#fef2f2',
            border: '1px solid rgba(239,68,68,0.15)',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.875rem',
          }}>

            {/* Reason */}
            {info?.restrictionReason && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
                <FiAlertTriangle size={16} color="#dc2626" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                    Reason
                  </p>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#374151', fontWeight: 500 }}>
                    {info.restrictionReason}
                  </p>
                </div>
              </div>
            )}

            {/* Expiry */}
            {info?.restrictionExpiry && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
                <FiClock size={16} color="#d97706" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                    Access restored at
                  </p>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#374151', fontWeight: 500 }}>
                    {info.restrictionExpiry}
                  </p>
                </div>
              </div>
            )}

            {/* No expiry info */}
            {!info?.restrictionExpiry && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
                <FiClock size={16} color="#6b7280" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#6b7280' }}>
                    Contact an administrator to have this restriction reviewed.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Guidance */}
          <p style={{
            margin: 0,
            fontSize: '0.85rem', color: '#6b7280',
            textAlign: 'center', lineHeight: 1.5,
          }}>
            Your files and data are safe. This restriction is temporary and does not affect your stored data.
            {!isMLAuto && !isAuthRule && ' An administrator can release this restriction manually.'}
            {isAuthRule && ' The restriction will lift automatically when the time expires.'}
          </p>

          {/* Logout button */}
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem',
              width: '100%', padding: '0.875rem',
              background: '#dc2626', border: 'none', borderRadius: '10px',
              color: 'white', fontSize: '1rem', fontWeight: 700,
              cursor: 'pointer',
              transition: 'background 0.2s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#b91c1c'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#dc2626'; }}
          >
            <FiLogOut size={18} />
            Sign Out
          </button>

          <p style={{
            margin: 0,
            fontSize: '0.8rem', color: '#9ca3af',
            textAlign: 'center',
          }}>
            You will be automatically redirected once the restriction expires.
          </p>
        </div>
      </div>
    </div>
  );
}
