import React, { useState } from 'react';

/**
 * DashboardCard - professional light theme with white cards
 * FIXED: 16px+ font sizes, white background, proper shadows
 */

function DashboardCard({ title, value, icon, color = 'var(--primary)', subtitle, trend, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--bg-primary)', // white
        border: `1px solid ${hovered ? color + '40' : 'var(--border-color)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '1.75rem 2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        minWidth: '220px',
        flex: '1',
        position: 'relative',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'var(--transition)',
        transform: hovered && onClick ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? 'var(--shadow-lg)' : 'var(--shadow-md)',
      }}
    >
      {/* Top accent bar */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: '4px',
        background: color,
        borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
      }} />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontSize: 'var(--font-size-sm)',
          fontWeight: 700,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}>{title}</span>

        {icon && (
          <span style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-md)',
            background: `${color}15`,
            border: `1px solid ${color}30`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
            fontSize: '20px',
          }}>
            {icon}
          </span>
        )}
      </div>

      {/* Value */}
      <div style={{
        fontSize: 'var(--font-size-4xl)',
        fontWeight: 800,
        color: 'var(--text-primary)',
        lineHeight: 1,
        letterSpacing: '-0.02em',
      }}>
        {value ?? '—'}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <div style={{
          fontSize: 'var(--font-size-base)',
          color: 'var(--text-secondary)',
          fontWeight: 500
        }}>
          {subtitle}
        </div>
      )}

      {/* Trend */}
      {trend && (
        <div style={{
          fontSize: 'var(--font-size-base)',
          color,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
        }}>
          {trend}
        </div>
      )}
    </div>
  );
}

export default DashboardCard;
