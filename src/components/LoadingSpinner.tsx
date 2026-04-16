'use client';

export function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="relative w-12 h-12">
        <div
          className="absolute inset-0 rounded-full animate-spin"
          style={{
            border: '2px solid transparent',
            borderTopColor: '#3b82f6',
            borderRightColor: '#6366f1',
          }}
        />
        <div
          className="absolute inset-2 rounded-full animate-spin"
          style={{
            border: '2px solid transparent',
            borderTopColor: '#22c55e',
            animationDirection: 'reverse',
            animationDuration: '0.7s',
          }}
        />
      </div>
      <p className="text-sm animate-pulse" style={{ color: 'var(--text-muted)' }}>
        Mengambil data Yahoo Finance...
      </p>
    </div>
  );
}

export function TableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(15, 23, 42, 0.4)', animationDelay: `${i * 50}ms` }}
        >
          <div className="skeleton h-4 w-16 rounded" />
          <div className="skeleton h-3 w-32 rounded" />
          <div className="flex-1" />
          <div className="skeleton h-4 w-20 rounded" />
          <div className="skeleton h-4 w-24 rounded" />
          <div className="skeleton h-5 w-24 rounded-full" />
          <div className="skeleton h-4 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}
