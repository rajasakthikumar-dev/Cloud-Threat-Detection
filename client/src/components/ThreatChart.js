import React from 'react';
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart,  Bar,
  PieChart,  Pie, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
} from 'recharts';

// ── Colour palette for charts ───────────────────────────────
const COLORS = {
  normal:         '#22c55e',
  attack:         '#ef4444',
  medium:         '#f59e0b',
  low:            '#38bdf8',
  DoS:            '#ef4444',
  Exploits:       '#f97316',
  Fuzzers:        '#a855f7',
  Generic:        '#06b6d4',
  Reconnaissance: '#3b82f6',
  Backdoor:       '#ec4899',
  Analysis:       '#eab308',
  Shellcode:      '#14b8a6',
  Worms:          '#f43f5e',
  Normal:         '#22c55e',
};

const PIE_COLORS = Object.values(COLORS);

const cardStyle = {
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '12px',
  padding: '20px',
};

const titleStyle = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: '16px',
};

const tooltipStyle = {
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '8px',
  color: '#e2e8f0',
  fontSize: '12px',
};

// ── Sub-components ──────────────────────────────────────────

/**
 * ThreatAreaChart
 * Shows normal vs attack traffic over time as stacked area chart.
 * data: [{ time, normal, attack }]
 */
export function ThreatAreaChart({ data = [] }) {
  return (
    <div style={cardStyle}>
      <div style={titleStyle}>Traffic Overview — Normal vs Attack</div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="gNormal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={COLORS.normal} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS.normal} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gAttack" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={COLORS.attack} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS.attack} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 11 }} />
          <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
          <Area type="monotone" dataKey="normal" stroke={COLORS.normal}
                fill="url(#gNormal)" strokeWidth={2} name="Normal" />
          <Area type="monotone" dataKey="attack" stroke={COLORS.attack}
                fill="url(#gAttack)" strokeWidth={2} name="Attack" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * AttackCategoryBar
 * Bar chart showing count per attack category.
 * data: [{ category, count }]
 */
export function AttackCategoryBar({ data = [] }) {
  return (
    <div style={cardStyle}>
      <div style={titleStyle}>Attack Categories</div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="category" tick={{ fill: '#64748b', fontSize: 10 }} angle={-20} textAnchor="end" />
          <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="count" name="Events" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[entry.category] || COLORS.medium}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * RiskLevelPie
 * Donut chart showing Low / Medium / High risk distribution.
 * data: [{ name, value }]
 */
export function RiskLevelPie({ data = [] }) {
  return (
    <div style={cardStyle}>
      <div style={titleStyle}>Risk Level Distribution</div>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={95}
            paddingAngle={3}
            dataKey="value"
            label={({ name, percent }) =>
              `${name} ${(percent * 100).toFixed(0)}%`
            }
            labelLine={false}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={
                  entry.name === 'High'   ? COLORS.attack :
                  entry.name === 'Medium' ? COLORS.medium :
                  COLORS.low
                }
              />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// Default export — generic wrapper used in ThreatMonitoring page
function ThreatChart({ type = 'area', data = [] }) {
  if (type === 'bar') return <AttackCategoryBar data={data} />;
  if (type === 'pie') return <RiskLevelPie data={data} />;
  return <ThreatAreaChart data={data} />;
}

export default ThreatChart;
