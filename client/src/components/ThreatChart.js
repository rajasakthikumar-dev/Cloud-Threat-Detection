import React from 'react';
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart,  Bar,
  PieChart,  Pie, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
} from 'recharts';

/**
 * ThreatChart.js - Professional light theme with large readable fonts
 * REDESIGNED: White cards, dark text, 14-16px fonts, professional SOC dashboard appearance
 * 
 * All charts use REAL DATA from Firestore threat_logs collection.
 * NO hard-coded fake data.
 */

// Professional cybersecurity color palette
const COLORS = {
  // Risk levels
  normal:  '#22c55e',  // Green
  attack:  '#ef4444',  // Red
  low:     '#22c55e',  // Green
  medium:  '#f59e0b',  // Amber/Orange
  high:    '#ef4444',  // Red
  
  // Attack categories (if used)
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

// Card style - professional light theme
const cardStyle = {
  background: 'var(--bg-primary)',  // White
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-lg)',
  padding: '2rem',
  boxShadow: 'var(--shadow-md)',
  marginBottom: '1.5rem',
};

// Card title style - large and readable
const titleStyle = {
  fontSize: '1.25rem',  // 20px
  fontWeight: 700,
  color: 'var(--text-primary)',  // Dark navy
  marginBottom: '1.5rem',
  letterSpacing: '-0.02em',
};

// Tooltip style - clean and readable
const tooltipStyle = {
  background: 'var(--bg-primary)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)',
  fontSize: '0.9375rem',  // 15px
  padding: '0.75rem 1rem',
  boxShadow: 'var(--shadow-lg)',
};

// Axis text - dark and highly readable (14-15px)
const axisProps = { 
  fill: 'var(--text-secondary)', 
  fontSize: 14,
  fontWeight: 500
};

// Grid - subtle
const gridProps = { 
  strokeDasharray: '3 3', 
  stroke: 'var(--border-color)',
  opacity: 0.5
};

// Legend style - readable
const legendStyle = { 
  fontSize: '0.9375rem',  // 15px
  color: 'var(--text-primary)',
  fontWeight: 500
};

/* ══════════════════════════════════════════════════════════════
   TRAFFIC OVERVIEW — NORMAL VS ATTACK
   ══════════════════════════════════════════════════════════════
   
   DATA SOURCE: Real threat_logs from Firestore
   Aggregated by date showing Normal (Low risk) vs Attack (Medium/High risk)
   
   Backend: getThreatStats() in threatController.js
   - Groups threats by date
   - Counts Low risk as "normal"
   - Counts Medium/High risk as "attack"
   
   If no data: Shows empty state message
   ══════════════════════════════════════════════════════════════ */
export function ThreatAreaChart({ data = [] }) {
  const hasData = data && data.length > 0;
  
  return (
    <div style={cardStyle}>
      <div style={titleStyle}>Traffic Overview — Normal vs Attack</div>
      {!hasData ? (
        <div style={{
          padding: '4rem 2rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: 'var(--font-size-base)',
        }}>
          <p style={{ marginBottom: '0.5rem', fontWeight: 600 }}>
            No threat data available for the selected period.
          </p>
          <p style={{ fontSize: 'var(--font-size-sm)' }}>
            Traffic analysis will appear here once threat detections are recorded.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
            <defs>
              <linearGradient id="gNormal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={COLORS.normal} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS.normal} stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="gAttack" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={COLORS.attack} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS.attack} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis 
              dataKey="time" 
              tick={axisProps}
              height={50}
            />
            <YAxis 
              tick={axisProps}
              label={{ 
                value: 'Detections', 
                angle: -90, 
                position: 'insideLeft',
                style: { ...axisProps, fontSize: 13 }
              }}
            />
            <Tooltip 
              contentStyle={tooltipStyle}
              labelStyle={{ fontWeight: 600, marginBottom: '0.25rem' }}
            />
            <Legend 
              wrapperStyle={legendStyle}
              iconType="circle"
            />
            <Area 
              type="monotone" 
              dataKey="normal" 
              stroke={COLORS.normal}
              fill="url(#gNormal)" 
              strokeWidth={2.5} 
              name="Normal"
              dot={{ fill: COLORS.normal, r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Area 
              type="monotone" 
              dataKey="attack" 
              stroke={COLORS.attack}
              fill="url(#gAttack)" 
              strokeWidth={2.5} 
              name="Attack"
              dot={{ fill: COLORS.attack, r: 3 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ATTACK CATEGORIES
   ══════════════════════════════════════════════════════════════
   
   DATA SOURCE: Real attack_type from Firestore threat_logs
   
   Backend: getThreatStats() in threatController.js
   - Aggregates by attack_type field
   - Counts occurrences of each attack category
   
   Current ML model returns: "Normal" or "Attack"
   If model provides specific categories (DoS, Probe, etc.), they appear here
   
   If no data: Shows empty state message
   ══════════════════════════════════════════════════════════════ */
export function AttackCategoryBar({ data = [] }) {
  const hasData = data && data.length > 0;
  
  return (
    <div style={cardStyle}>
      <div style={titleStyle}>Attack Categories</div>
      {!hasData ? (
        <div style={{
          padding: '4rem 2rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: 'var(--font-size-base)',
        }}>
          <p style={{ marginBottom: '0.5rem', fontWeight: 600 }}>
            No attack categories recorded.
          </p>
          <p style={{ fontSize: 'var(--font-size-sm)' }}>
            Attack type distribution will appear here as threats are detected.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 10, right: 20, bottom: 50, left: 10 }}>
            <CartesianGrid {...gridProps} />
            <XAxis 
              dataKey="category" 
              tick={{ ...axisProps, fontSize: 13 }}
              angle={-20} 
              textAnchor="end"
              height={80}
            />
            <YAxis 
              tick={axisProps}
              label={{ 
                value: 'Count', 
                angle: -90, 
                position: 'insideLeft',
                style: { ...axisProps, fontSize: 13 }
              }}
            />
            <Tooltip 
              contentStyle={tooltipStyle}
              cursor={{ fill: 'var(--bg-secondary)' }}
            />
            <Bar 
              dataKey="count" 
              name="Detections" 
              radius={[8, 8, 0, 0]}
              maxBarSize={80}
            >
              {data.map((entry, i) => (
                <Cell 
                  key={`cell-${i}`} 
                  fill={COLORS[entry.category] || COLORS.medium} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   RISK LEVEL DISTRIBUTION
   ══════════════════════════════════════════════════════════════
   
   DATA SOURCE: Real risk_level from Firestore threat_logs
   
   Backend: getThreatStats() in threatController.js
   - Counts Low, Medium, High risk threats
   - Returns actual distribution
   
   Shows percentages and actual counts
   
   Colors:
   - Low: Green
   - Medium: Amber/Orange
   - High: Red
   
   If no data: Shows empty state message
   ══════════════════════════════════════════════════════════════ */
export function RiskLevelPie({ data = [] }) {
  const hasData = data && data.length > 0 && data.some(d => d.value > 0);
  
  return (
    <div style={cardStyle}>
      <div style={titleStyle}>Risk Level Distribution</div>
      {!hasData ? (
        <div style={{
          padding: '4rem 2rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: 'var(--font-size-base)',
        }}>
          <p style={{ marginBottom: '0.5rem', fontWeight: 600 }}>
            No risk data available.
          </p>
          <p style={{ fontSize: 'var(--font-size-sm)' }}>
            Risk level distribution will appear here as threats are analyzed.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={75}
              outerRadius={115}
              paddingAngle={3}
              dataKey="value"
              label={({ name, percent, value }) => 
                value > 0 ? `${name}: ${(percent * 100).toFixed(0)}%` : null
              }
              labelLine={true}
              style={{ 
                fontSize: '0.9375rem',  // 15px
                fill: 'var(--text-primary)', 
                fontWeight: 600 
              }}
            >
              {data.map((entry, i) => {
                let fillColor = COLORS.low;
                if (entry.name === 'High') fillColor = COLORS.high;
                else if (entry.name === 'Medium') fillColor = COLORS.medium;
                
                return (
                  <Cell 
                    key={`cell-${i}`} 
                    fill={fillColor}
                    stroke="var(--bg-primary)"
                    strokeWidth={2}
                  />
                );
              })}
            </Pie>
            <Tooltip 
              contentStyle={tooltipStyle}
              formatter={(value, name) => [`${value} detections`, name]}
            />
            <Legend 
              wrapperStyle={legendStyle}
              iconType="circle"
              layout="horizontal"
              verticalAlign="bottom"
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   DEFAULT EXPORT (Backward compatibility)
   ══════════════════════════════════════════════════════════════ */
function ThreatChart({ type = 'area', data = [] }) {
  if (type === 'bar') return <AttackCategoryBar data={data} />;
  if (type === 'pie') return <RiskLevelPie data={data} />;
  return <ThreatAreaChart data={data} />;
}

export default ThreatChart;
