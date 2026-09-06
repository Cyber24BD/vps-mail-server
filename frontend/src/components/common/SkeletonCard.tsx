import React from 'react';

interface SkeletonCardProps {
  lines?: number;
  height?: string;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ lines = 3, height }) => {
  return (
    <div
      className="card-standard"
      style={{
        padding: '20px',
        minHeight: height || '140px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="skeleton-shimmer" style={{ width: '40%', height: '18px' }} />
        <div className="skeleton-shimmer" style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
      </div>
      <div className="skeleton-shimmer" style={{ width: '60%', height: '32px' }} />
      {lines > 2 && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <div className="skeleton-shimmer" style={{ width: '30%', height: '14px' }} />
          <div className="skeleton-shimmer" style={{ width: '20%', height: '14px' }} />
        </div>
      )}
    </div>
  );
};
