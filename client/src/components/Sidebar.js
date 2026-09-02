import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import {
  FiHome, FiFolder, FiAlertTriangle,
  FiUsers, FiFileText, FiShield, FiActivity,
  FiChevronLeft, FiChevronRight,
} from 'react-icons/fi';

/**
 * Sidebar - professional light theme with dark navy background
 * FIXED: 16px font sizes, white text on dark navy
 */

const userNav = [
  { to: '/dashboard', label: 'Dashboard',  Icon: FiHome },
  { to: '/files',     label: 'My Files',   Icon: FiFolder },
];

const adminNav = [
  { to: '/admin',               label: 'Admin Home',    Icon: FiShield },
  { to: '/admin/users',         label: 'User Mgmt',     Icon: FiUsers },
  { to: '/admin/user-activity', label: 'User Activity', Icon: FiActivity },
  { to: '/admin/logs',          label: 'Activity Logs', Icon: FiFileText },
  { to: '/threats',             label: 'Threats',       Icon: FiAlertTriangle },
];

const EXPANDED = 224;
const COLLAPSED = 64;

export default function Sidebar() {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const W = collapsed ? COLLAPSED : EXPANDED;

  const buildLinkStyle = (isActive) => ({
    display: 'flex',
    alignItems: 'center',
    gap: collapsed ? '0' : '0.75rem',
    padding: collapsed ? '0.875rem 0' : '0.875rem 1.125rem',
    justifyContent: collapsed ? 'center' : 'flex-start',
    color: isActive ? '#fff' : 'rgba(255, 255, 255, 0.7)',
    textDecoration: 'none',
    fontSize: 'var(--font-size-base)', // 16px
    fontWeight: isActive ? 600 : 500,
    borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
    background: isActive ? 'rgba(37, 99, 235, 0.15)' : 'transparent',
    transition: 'var(--transition)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  });

  const iconWrap = (isActive) => ({
    width: '36px',
    height: '36px',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    background: isActive ? 'rgba(37, 99, 235, 0.2)' : 'transparent',
    transition: 'var(--transition)',
  });

  const renderLinks = (items) =>
    items.map(({ to, label, Icon }) => {
      const isActive = location.pathname === to || location.pathname.startsWith(to + '/');
      return (
        <NavLink
          key={to}
          to={to}
          title={collapsed ? label : undefined}
          style={buildLinkStyle(isActive)}
          onMouseEnter={e => {
            if (!isActive) {
              e.currentTarget.style.color = '#fff';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            }
          }}
          onMouseLeave={e => {
            if (!isActive) {
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <span style={iconWrap(isActive)}>
            <Icon size={18} />
          </span>
          {!collapsed && (
            <span style={{ opacity: collapsed ? 0 : 1, transition: 'opacity 0.15s' }}>
              {label}
            </span>
          )}
        </NavLink>
      );
    });

  return (
    <aside style={{
      width: `${W}px`,
      minWidth: `${W}px`,
      background: 'var(--nav-bg)', // dark navy
      borderRight: '1px solid rgba(255, 255, 255, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      padding: '1rem 0',
      minHeight: 'calc(100vh - 70px)',
      position: 'relative',
      transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
      overflow: 'hidden',
    }}>
      {/* Collapse toggle */}
      <button
        style={{
          position: 'absolute',
          top: '1.25rem',
          right: collapsed ? '1rem' : '1rem',
          width: '30px',
          height: '30px',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(37, 99, 235, 0.2)',
          border: '1px solid rgba(37, 99, 235, 0.3)',
          color: 'var(--primary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'var(--transition)',
        }}
        onClick={() => setCollapsed(c => !c)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37, 99, 235, 0.3)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(37, 99, 235, 0.2)'; }}
      >
        {collapsed ? <FiChevronRight size={16} /> : <FiChevronLeft size={16} />}
      </button>

      <div style={{ marginTop: '3.25rem' }}>
        {/* General nav */}
        {!collapsed && (
          <span style={{
            padding: '0.625rem 1.125rem',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 700,
            color: 'rgba(255, 255, 255, 0.5)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginTop: '0.625rem',
            marginBottom: '0.375rem',
            display: 'block'
          }}>
            General
          </span>
        )}
        {collapsed && <div style={{ height: '0.625rem' }} />}
        {renderLinks(userNav)}

        {/* Admin nav */}
        {user?.role === 'admin' && (
          <>
            {!collapsed && (
              <span style={{
                padding: '0.625rem 1.125rem',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                color: 'rgba(255, 255, 255, 0.5)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginTop: '1.25rem',
                marginBottom: '0.375rem',
                display: 'block'
              }}>
                Administration
              </span>
            )}
            {collapsed && <div style={{ height: '1.25rem' }} />}
            {renderLinks(adminNav)}
          </>
        )}
      </div>
    </aside>
  );
}
