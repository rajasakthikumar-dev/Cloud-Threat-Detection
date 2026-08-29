import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { FiShield, FiLogOut, FiBell, FiUser } from 'react-icons/fi';
import { logoutUser } from '../services/api';

const styles = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    height: '60px',
    background: '#1e293b',
    borderBottom: '1px solid #334155',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: '#38bdf8',
    textDecoration: 'none',
    fontWeight: 700,
    fontSize: '18px',
    letterSpacing: '0.02em',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  userBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    background: '#0f172a',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#94a3b8',
  },
  rolePill: {
    padding: '2px 8px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 14px',
    background: 'transparent',
    border: '1px solid #475569',
    borderRadius: '8px',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'all 0.2s',
  },
};

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      // Record logout event in Firestore before clearing local state.
      // Fire-and-forget with a short timeout — user must be logged out
      // even if the request fails (expired token, network issue, etc.).
      await Promise.race([
        logoutUser(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
      ]);
    } catch {
      // Swallow errors — logout must always succeed on the client side.
    } finally {
      logout();
      navigate('/login');
    }
  };

  const roleColor = user?.role === 'admin'
    ? { background: '#7c3aed', color: '#fff' }
    : { background: '#0369a1', color: '#fff' };

  return (
    <nav style={styles.nav}>
      {/* Brand */}
      <Link to={user?.role === 'admin' ? '/admin' : '/dashboard'} style={styles.brand}>
        <FiShield size={22} />
        AI Threat Detection
      </Link>

      {/* Right side */}
      <div style={styles.right}>
        {/* Notification bell placeholder */}
        <FiBell size={18} color="#64748b" title="Alerts" />

        {/* User info */}
        {user && (
          <div style={styles.userBadge}>
            <FiUser size={14} />
            <span>{user.name || user.email}</span>
            <span style={{ ...styles.rolePill, ...roleColor }}>{user.role}</span>
          </div>
        )}

        {/* Logout */}
        <button
          style={styles.logoutBtn}
          onClick={handleLogout}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#475569'; e.currentTarget.style.color = '#94a3b8'; }}
        >
          <FiLogOut size={14} />
          Logout
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
