import React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Globe,
  Users,
  Forward,
  Mail,
  ShieldCheck,
  Activity,
  HardDrive,
  Sliders,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'domains'
  | 'mailboxes'
  | 'aliases'
  | 'webmail'
  | 'storage'
  | 'security'
  | 'diagnostics'
  | 'settings';

interface NavItem {
  id: NavTab;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

interface SidebarCardProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  domainCount: number;
  mailboxCount: number;
  userRole?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const SidebarCard: React.FC<SidebarCardProps> = ({
  currentTab,
  onSelectTab,
  domainCount,
  mailboxCount,
  userRole = 'admin',
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const allNavItems: NavItem[] = [
    { id: 'dashboard', label: 'System Overview', icon: LayoutDashboard },
    { id: 'domains', label: 'Domains & DNS', icon: Globe, badge: domainCount },
    { id: 'mailboxes', label: 'Mailboxes & Quotas', icon: Users, badge: mailboxCount },
    { id: 'aliases', label: 'Aliases & Groups', icon: Forward },
    { id: 'webmail', label: 'Corporate Webmail', icon: Mail },
    { id: 'storage', label: 'Storage & Media', icon: HardDrive },
    { id: 'security', label: 'Security & SSL', icon: ShieldCheck },
    { id: 'diagnostics', label: 'Diagnostics & Logs', icon: Activity },
    { id: 'settings', label: 'System Settings', icon: Sliders },
  ];

  const navItems = userRole === 'user'
    ? allNavItems.filter((item) => item.id === 'webmail' || item.id === 'storage')
    : allNavItems;

  return (
    <aside
      className="card-standard"
      style={{
        width: isCollapsed ? '64px' : '250px',
        flexShrink: 0,
        borderRadius: '16px',
        padding: isCollapsed ? '14px 8px' : '16px 12px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: 'calc(100vh - 112px)',
        alignSelf: 'flex-start',
        position: 'sticky',
        top: '80px',
        transition: 'width 200ms cubic-bezier(0.16, 1, 0.3, 1), padding 200ms ease',
        overflow: 'hidden',
      }}
    >
      <div>
        {/* Header with Title & Collapse Toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            padding: isCollapsed ? '0 0 12px' : '6px 8px 14px',
            borderBottom: '1px solid #E5E7EB',
            marginBottom: '10px',
          }}
        >
          {!isCollapsed && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#9CA3AF',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                whiteSpace: 'nowrap',
              }}
            >
              {userRole === 'user' ? 'Webmail Portal' : 'Control Center'}
            </span>
          )}

          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              style={{
                background: 'none',
                border: '1px solid #E5E7EB',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                color: '#6B7280',
                padding: 0,
              }}
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                title={isCollapsed ? item.label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isCollapsed ? 'center' : 'space-between',
                  padding: isCollapsed ? '10px 0' : '9px 12px',
                  borderRadius: '10px',
                  border: isActive ? '1px solid #2D3139' : '1px solid transparent',
                  backgroundColor: isActive ? '#111827' : 'transparent',
                  color: isActive ? '#FFFFFF' : '#374151',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 150ms ease-out',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} style={{ flexShrink: 0 }} />
                  {!isCollapsed && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
                </div>

                {!isCollapsed && item.badge !== undefined && item.badge > 0 && (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '1px 6px',
                      borderRadius: '6px',
                      backgroundColor: isActive ? '#374151' : '#F1F3F5',
                      color: isActive ? '#F9FAFB' : '#4B5563',
                    }}
                  >
                    {item.badge}
                  </span>
                )}

                {isCollapsed && item.badge !== undefined && item.badge > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '6px',
                      right: '8px',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: isActive ? '#40C057' : '#2B8A3E',
                    }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer System Info */}
      <div
        style={{
          padding: isCollapsed ? '10px 0 0' : '12px 6px 0',
          borderTop: '1px solid #E5E7EB',
          marginTop: '16px',
          textAlign: isCollapsed ? 'center' : 'left',
        }}
      >
        {isCollapsed ? (
          <div title="Dovecot IMAP + Postfix SMTP Engine" style={{ color: '#9CA3AF', display: 'flex', justifyContent: 'center' }}>
            <HardDrive size={16} />
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#6B7280' }}>
              <HardDrive size={14} />
              <span>Storage: Dovecot</span>
            </div>
            <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>
              MTA: Postfix | Antispam: Rspamd
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
