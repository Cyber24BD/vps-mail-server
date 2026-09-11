import React from 'react';
import {
  Inbox, Send, FileText, AlertOctagon, Trash2, Archive, HardDrive, Sparkles
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
}

export const FolderSidebar: React.FC<FolderSidebarProps> = ({
  folders,
  currentFolder,
  onSelectFolder,
  storage,
  onEmptyFolder,
  onTestDelivery,
  testLoading = false,
}) => {
  const getFolderIcon = (key: string) => {
    switch (key.toLowerCase()) {
      case 'inbox': return Inbox;
      case 'sent': return Send;
      case 'drafts': return FileText;
      case 'spam': return AlertOctagon;
      case 'trash': return Trash2;
      case 'archive': return Archive;
      default: return Inbox;
    }
  };

  // Format bytes to human-readable string
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
  // design.md section 2.3: 0-65% nominal (#2B8A3E), 66-84% elevated (#E67700), 85-100% critical (#C92A2A)
  const quotaColor = quotaPercent > 84 ? '#C92A2A' : quotaPercent > 65 ? '#E67700' : '#2B8A3E';

  return (
    <div
      style={{
        width: '210px',
        borderRight: '1px solid #E5E7EB',
        padding: '16px 10px',
        backgroundColor: '#F8F9FA',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}
    >
      <div>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#9CA3AF',
            padding: '0 8px 10px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Mail Folders
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {displayFolders.map((f) => {
            const Icon = getFolderIcon(f.key);
            const isActive = currentFolder.toLowerCase() === f.key.toLowerCase();
            return (
              <button
                key={f.key}
                onClick={() => onSelectFolder(f.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                  boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                  color: isActive ? '#111827' : '#4B5563',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 150ms ease-out',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon size={16} strokeWidth={1.8} color={isActive ? '#111827' : '#6B7280'} />
                  <span>{f.name}</span>
                </div>
                {f.unread > 0 && (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '6px',
                      backgroundColor: '#111827',
                      color: '#FFFFFF',
                    }}
                  >
                    {f.unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Action if in Trash or Spam */}
        {(currentFolder === 'trash' || currentFolder === 'spam') && onEmptyFolder && (
          <div style={{ marginTop: '12px', padding: '0 8px' }}>
            <button
              onClick={() => onEmptyFolder(currentFolder)}
              className="btn-danger"
              style={{
                width: '100%',
                fontSize: '12px',
                padding: '6px 8px',
                justifyContent: 'center',
              }}
            >
              <Trash2 size={13} />
              <span>Empty {currentFolder === 'trash' ? 'Trash' : 'Spam'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Storage and Test Tools Footer */}
      <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Test Email Injection Button */}
        {onTestDelivery && (
          <button
            onClick={onTestDelivery}
            disabled={testLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '7px 10px',
              borderRadius: '8px',
              border: '1px dashed #D1D5DB',
              backgroundColor: '#FFFFFF',
              color: '#374151',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
            title="Inject test incoming email into this mailbox"
          >
            <Sparkles size={14} color="#E67700" />
            <span>{testLoading ? 'Injecting...' : 'Test Incoming Email'}</span>
          </button>
        )}

        {/* Quota Progress */}
        {storage && (
          <div
            style={{
              padding: '12px 10px',
              backgroundColor: '#FFFFFF',
              borderRadius: '10px',
              border: '1px solid #E5E7EB',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: '#4B5563' }}>
                <HardDrive size={13} />
                <span>Storage</span>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: quotaColor }}>
                {storage.quota_percent}%
              </span>
            </div>

            <div
              style={{
                height: '6px',
                backgroundColor: '#F1F3F5',
                borderRadius: '5px',
                overflow: 'hidden',
                marginBottom: '6px',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, storage.quota_percent)}%`,
                  backgroundColor: quotaColor,
                  borderRadius: '5px',
                  transition: 'width 300ms ease',
                }}
              />
            </div>

            <div style={{ fontSize: '11px', color: '#6B7280' }}>
              {formatBytes(storage.bytes_used)} of {formatBytes(storage.quota_bytes)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
