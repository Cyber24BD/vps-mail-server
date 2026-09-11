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
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'domains'
  | 'mailboxes'
  | 'aliases'
  | 'webmail'
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
}

export const SidebarCard: React.FC<SidebarCardProps> = ({
  currentTab,
  onSelectTab,
  domainCount,
  mailboxCount,
  userRole = 'admin',
}) => {
  const allNavItems: NavItem[] = [
    { id: 'dashboard', label: 'System Overview', icon: LayoutDashboard },
    { id: 'domains', label: 'Domains & DNS', icon: Globe, badge: domainCount },
    { id: 'mailboxes', label: 'Mailboxes & Quotas', icon: Users, badge: mailboxCount },
    { id: 'aliases', label: 'Aliases & Groups', icon: Forward },
    { id: 'webmail', label: 'Custom Webmail', icon: Mail },
    { id: 'security', label: 'Security & SSL', icon: ShieldCheck },
    { id: 'diagnostics', label: 'Diagnostics & Logs', icon: Activity },
    { id: 'settings', label: 'System Settings', icon: Sliders },
  ];

  const navItems = userRole === 'user'
    ? allNavItems.filter((item) => item.id === 'webmail')
    : allNavItems;

  return (
    <aside
      className="card-standard"
      style={{
        width: '260px',
        flexShrink: 0,
        borderRadius: '18px',
        padding: '16px 12px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: 'calc(100vh - 112px)',
        alignSelf: 'flex-start',
        position: 'sticky',
        top: '80px',
      }}
    >
      <div>
        <div style={{ padding: '8px 12px 14px', borderBottom: '1px solid #E5E7EB', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {userRole === 'user' ? 'Webmail Portal' : 'Control Center'}
          </span>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: isActive ? '1px solid #2D3139' : '1px solid transparent',
                  backgroundColor: isActive ? '#111827' : 'transparent',
                  color: isActive ? '#FFFFFF' : '#374151',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '13.5px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 150ms ease-out',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} />
                  <span>{item.label}</span>
                </div>

                {item.badge !== undefined && item.badge > 0 && (
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
              </button>
            );
          })}
        </nav>
      </div>

      <div
        style={{
          padding: '12px',
          borderTop: '1px solid #E5E7EB',
          marginTop: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#6B7280' }}>
          <HardDrive size={14} />
          <span>Storage Engine: Dovecot</span>
        </div>
        <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>
          MTA: Postfix | Antispam: Rspamd
        </div>
      </div>
    </aside>
  );
};
