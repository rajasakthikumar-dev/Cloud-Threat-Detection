import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../App';
import {
  FiHome, FiFolder, FiAlertTriangle,
  FiUsers, FiFileText, FiShield, FiActivity,
} from 'react-icons/fi';

const WIDTH = 220;

const styles = {
  sidebar: {
    width: `${WIDTH}px`,
    minWidth: `${WIDTH}px`,
    background: '#1e293b',
    borderRight: '1px solid #334155',
    display: 'flex',
    flexDirection: 'column',
    padding: '16px 0',
    minHeight: 'calc(100vh - 60px)',
  },
  section: {
    padding: '8px 16px 4px',
    fontSize: '10px',
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginTop: '8px',
  },
  link: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 20px',
    color: '#94a3b8',
    textDecoration: 'none',
    fontSize: '14px',
    borderLeft: '3px solid transparent',
    transition: 'all 0.15s',
  },
  activeLink: {
    color: '#38bdf8',
    borderLeft: '3px solid #38bdf8',
    background: 'rgba(56,189,248,0.06)',
  },
};

// Nav items for all authenticated users (normal users only see these)
const userNav = [
  { to: '/dashboard', label: 'Dashboard', Icon: FiHome },
  { to: '/files',     label: 'My Files',  Icon: FiFolder },
];

// Extra items visible to admins only
const adminNav = [
  { to: '/admin',               label: 'Admin Home',    Icon: FiShield },
  { to: '/admin/users',         label: 'User Management', Icon: FiUsers },
  { to: '/admin/user-activity', label: 'User Activity', Icon: FiActivity },
  { to: '/admin/logs',          label: 'Activity Logs', Icon: FiFileText },
  { to: '/threats',             label: 'Threats',       Icon: FiAlertTriangle },
];

function Sidebar() {
  const { user } = useAuth();

  const linkStyle = ({ isActive }) =>
    isActive ? { ...styles.link, ...styles.activeLink } : styles.link;

  return (
    <aside style={styles.sidebar}>
      {/* General section */}
      <span style={styles.section}>General</span>
      {userNav.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} style={linkStyle}>
          <Icon size={16} />
          {label}
        </NavLink>
      ))}

      {/* Admin section — only rendered for admin users */}
      {user?.role === 'admin' && (
        <>
          <span style={{ ...styles.section, marginTop: '20px' }}>Administration</span>
          {adminNav.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} style={linkStyle}>
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </>
      )}
    </aside>
  );
}

export default Sidebar;
