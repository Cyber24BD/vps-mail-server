import React from 'react';
import { Server, Shield, LogOut } from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';

interface HeaderProps {
  publicIp: string;
  isBootstrap: boolean;
  onLogout: () => void;
  currentUser?: string;
}

export const Header: React.FC<HeaderProps> = ({
  publicIp,
  isBootstrap,
  onLogout,
  currentUser,
}) => {
  return (
    <header
      style={{
        height: '64px',
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            backgroundColor: '#111827',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
          }}
        >
          <Shield size={20} strokeWidth={2.2} />
        </div>
        <div>
          <h1 style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.2px', color: '#111827' }}>
            Corporate Mail Platform
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6B7280' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Server size={11} /> {publicIp}
            </span>
            <span>•</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="pulse-dot-active" /> Infrastructure Active
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {isBootstrap ? (
          <StatusBadge status="warning" label="BOOTSTRAP MODE (IP:8080)" />
        ) : (
          <StatusBadge status="verified" label="PRODUCTION READY" />
        )}

        {currentUser && (
          <span style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>
            {currentUser}
          </span>
        )}

        <button
          onClick={onLogout}
          className="btn-secondary"
          style={{ padding: '6px 12px', fontSize: '13px', borderRadius: '6px' }}
          title="Sign out"
        >
          <LogOut size={14} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
};
