import React from 'react';
import {
  Inbox,
  Send,
  FileText,
  AlertOctagon,
  Trash2,
  Archive,
  HardDrive,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { FolderStat, MailboxStorageSummary } from '../../../types';

interface FolderSidebarProps {
  folders: FolderStat[];
  currentFolder: string;
  onSelectFolder: (key: string) => void;
  storage: MailboxStorageSummary | null;
  onEmptyFolder?: (folderKey: string) => void;
  onTestDelivery?: () => void;
  testLoading?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const FolderSidebar: React.FC<FolderSidebarProps> = ({
  folders,
  currentFolder,
  onSelectFolder,
  storage,
  onEmptyFolder,
  onTestDelivery,
  testLoading = false,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const getFolderIcon = (key: string) => {
    switch (key.toLowerCase()) {
      case 'inbox':
        return Inbox;
      case 'sent':
        return Send;
      case 'drafts':
        return FileText;
      case 'spam':
        return AlertOctagon;
      case 'trash':
        return Trash2;
      case 'archive':
        return Archive;
      default:
        return Inbox;
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const defaultFolders: FolderStat[] = [
    { key: 'inbox', name: 'Inbox', unread: 0, total: 0 },
    { key: 'sent', name: 'Sent', unread: 0, total: 0 },
    { key: 'drafts', name: 'Drafts', unread: 0, total: 0 },
    { key: 'spam', name: 'Spam', unread: 0, total: 0 },
    { key: 'trash', name: 'Trash', unread: 0, total: 0 },
    { key: 'archive', name: 'Archive', unread: 0, total: 0 },
  ];
  const displayFolders = folders && folders.length > 0 ? folders : defaultFolders;

  const quotaPercent = storage ? storage.quota_percent : 0;
  const quotaColor = quotaPercent > 84 ? '#C92A2A' : quotaPercent > 65 ? '#E67700' : '#2B8A3E';

  return (
    <div
      style={{
        width: isCollapsed ? '56px' : '185px',
        borderRight: '1px solid #E5E7EB',
        padding: isCollapsed ? '12px 6px' : '12px 8px',
        backgroundColor: '#F8F9FA',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        flexShrink: 0,
        transition: 'width 180ms cubic-bezier(0.16, 1, 0.3, 1), padding 180ms ease',
        overflow: 'hidden',
      }}
    >
      <div>
        {/* Top Label & Collapse Button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            padding: isCollapsed ? '0 0 10px' : '2px 6px 10px',
            borderBottom: '1px solid #E5E7EB',
            marginBottom: '8px',
          }}
        >
          {!isCollapsed && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#9CA3AF',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                whiteSpace: 'nowrap',
              }}
            >
              Folders
            </span>
          )}

          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={isCollapsed ? 'Expand folders' : 'Collapse folders'}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '22px',
                height: '22px',
                borderRadius: '4px',
                color: '#6B7280',
                padding: 0,
              }}
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          )}
        </div>

        {/* Folders List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {displayFolders.map((f) => {
            const Icon = getFolderIcon(f.key);
            const isActive = currentFolder.toLowerCase() === f.key.toLowerCase();
            return (
              <button
                key={f.key}
                onClick={() => onSelectFolder(f.key)}
                title={isCollapsed ? `${f.name}${f.unread > 0 ? ` (${f.unread} unread)` : ''}` : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isCollapsed ? 'center' : 'space-between',
                  padding: isCollapsed ? '8px 0' : '7px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                  boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  color: isActive ? '#111827' : '#4B5563',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 150ms ease',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon size={15} strokeWidth={isActive ? 2.2 : 1.8} color={isActive ? '#111827' : '#6B7280'} />
                  {!isCollapsed && <span style={{ whiteSpace: 'nowrap' }}>{f.name}</span>}
                </div>

                {!isCollapsed && f.unread > 0 && (
                  <span
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: '5px',
                      backgroundColor: '#111827',
                      color: '#FFFFFF',
                    }}
                  >
                    {f.unread}
                  </span>
                )}

                {isCollapsed && f.unread > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '5px',
                      right: '6px',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: '#C92A2A',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Empty Trash / Spam Button */}
        {!isCollapsed && (currentFolder === 'trash' || currentFolder === 'spam') && onEmptyFolder && (
          <div style={{ marginTop: '10px', padding: '0 4px' }}>
            <button
              onClick={() => onEmptyFolder(currentFolder)}
              className="btn-danger"
              style={{
                width: '100%',
                fontSize: '11px',
                padding: '5px 8px',
                justifyContent: 'center',
              }}
            >
              <Trash2 size={12} />
              <span>Empty {currentFolder === 'trash' ? 'Trash' : 'Spam'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Footer Storage & Test Injection */}
      <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {!isCollapsed && onTestDelivery && (
          <button
            onClick={onTestDelivery}
            disabled={testLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '6px 8px',
              borderRadius: '6px',
              border: '1px dashed #D1D5DB',
              backgroundColor: '#FFFFFF',
              color: '#374151',
              fontSize: '11.5px',
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            title="Inject sample test email into Inbox"
          >
            <Sparkles size={13} color="#E67700" />
            <span>{testLoading ? 'Injecting...' : 'Test Mail Injection'}</span>
          </button>
        )}

        {/* Storage Widget */}
        {storage && (
          <div
            title={`Disk usage: ${formatBytes(storage.bytes_used)} of ${formatBytes(storage.quota_bytes)} (${storage.quota_percent}%)`}
            style={{
              padding: isCollapsed ? '8px 4px' : '10px 8px',
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              border: '1px solid #E5E7EB',
              textAlign: isCollapsed ? 'center' : 'left',
            }}
          >
            {isCollapsed ? (
              <div style={{ color: quotaColor, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <HardDrive size={14} />
                <span style={{ fontSize: '10px', fontWeight: 700 }}>{storage.quota_percent}%</span>
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '5px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#4B5563' }}>
                    <HardDrive size={12} />
                    <span>Quota</span>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: quotaColor }}>
                    {storage.quota_percent}%
                  </span>
                </div>

                <div
                  style={{
                    height: '5px',
                    backgroundColor: '#F1F3F5',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    marginBottom: '4px',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, storage.quota_percent)}%`,
                      backgroundColor: quotaColor,
                      borderRadius: '4px',
                      transition: 'width 250ms ease',
                    }}
                  />
                </div>

                <div style={{ fontSize: '10.5px', color: '#6B7280', whiteSpace: 'nowrap' }}>
                  {formatBytes(storage.bytes_used)} / {formatBytes(storage.quota_bytes)}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
