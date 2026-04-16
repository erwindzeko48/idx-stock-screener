'use client';

interface Props {
  label: string;
  value: string | number;
  subValue?: string;
  color?: string;
  icon: React.ReactNode;
  glowColor?: string;
}

export function StatsCard({ label, value, subValue, color, icon, glowColor }: Props) {
  return (
    <div
      className="glass-card p-4 stat-card"
      style={glowColor ? { boxShadow: `0 0 20px ${glowColor}` } : undefined}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {label}
        </span>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{
            background: color ? `${color}15` : 'rgba(99, 120, 175, 0.1)',
            color: color ?? 'var(--text-secondary)',
          }}
        >
          {icon}
        </div>
      </div>
      <p
        className="mono text-2xl font-bold"
        style={{ color: color ?? 'var(--text-primary)' }}
      >
        {value}
      </p>
      {subValue && (
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          {subValue}
        </p>
      )}
    </div>
  );
}
