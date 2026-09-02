import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { logoutUser } from '../services/api';
import { FiShield, FiLogOut, FiBell } from 'react-icons/fi';

/**
 * Navbar - professional light theme with dark navy header
 * FIXED: 16px+ font sizes, white text on dark navy
 */

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await Promise.race([
        logoutUser(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
      ]);
    } catch {
      // Swallow — client logout must always succeed
    } finally {
      logout();
      navigate('/login');
    }
  };

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || 'U';

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 2rem',
      height: '70px',
      background: 'var(--nav-bg)', // dark navy
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      position: 'sticky',
      top: 0,
      zIndex: 200,
      boxShadow: '0 2px 16px rgba(0, 0, 0, 0.1)',
    }}>
      {/* Brand */}
      <Link to={user?.role === 'admin' ? '/admin' : '/dashboard'} style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        textDecoration: 'none',
        fontWeight: 700,
        fontSize: 'var(--font-size-xl)',
        letterSpacing: '-0.02em',
        color: 'var(--text-white)',
      }}>
        <span style={{
          background: 'var(--primary)',
          borderRadius: 'var(--radius-md)',
          padding: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)',
        }}>
          <FiShield size={20} color="#fff" />
        </span>
        AI Threat Detection
      </Link>

      {/* Right section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.125rem' }}>
        {/* Notification bell */}
        <button
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: 'var(--radius-md)',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-white)',
            transition: 'var(--transition)',
          }}
          title="Alerts"
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'; }}
        >
          <FiBell size={18} />
        </button>

        {/* User badge */}
        {user && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.5rem 1rem 0.5rem 0.625rem',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: 'var(--radius-md)',
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 'var(--font-size-base)',
              fontWeight: 700,
            }}>
              {initials}
            </div>
            <span style={{
              fontSize: 'var(--font-size-base)',
              fontWeight: 600,
              color: 'var(--text-white)',
              maxWidth: '140px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {user.name || user.email}
            </span>
            <span style={{
              padding: '0.25rem 0.625rem',
              borderRadius: '999px',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              background: user.role === 'admin' ? 'var(--purple)' : 'var(--info)',
              color: '#fff',
              boxShadow: user.role === 'admin'
                ? '0 2px 8px rgba(139, 92, 246, 0.4)'
                : '0 2px 8px rgba(37, 99, 235, 0.4)',
            }}>
              {user.role}
            </span>
          </div>
        )}

        {/* Logout */}
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.625rem 1.125rem',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#fca5a5',
            cursor: 'pointer',
            fontSize: 'var(--font-size-base)',
            fontWeight: 600,
            transition: 'var(--transition)',
          }}
          onClick={handleLogout}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; }}
        >
          <FiLogOut size={16} />
          Logout
        </button>
      </div>
    </nav>
  );
}
