import React, { useState } from 'react';
import {
  Mail, Reply, CornerUpRight, Trash2, AlertOctagon,
  Download, Paperclip, File, Image as ImageIcon, Edit3, Zap,
  ReplyAll
} from 'lucide-react';
import type { WebmailMessage } from '../../../types';
import { api } from '../../../services/api';

interface MessageViewerProps {
  message: WebmailMessage | null;
  currentFolder: string;
  activeMailbox: string;
  onReply: (msg: WebmailMessage) => void;
  onReplyAll?: (msg: WebmailMessage) => void;
  onForward: (msg: WebmailMessage) => void;
  onDelete: (msgId: string) => void;
  onMove: (msgId: string, toFolder: string) => void;
  onMarkSpam: (msgId: string) => void;
  onMarkHam: (msgId: string) => void;
  onEditDraft?: (msg: WebmailMessage) => void;
}

const getInitials = (nameOrEmail: string): string => {
  if (!nameOrEmail) return '?';
  const clean = nameOrEmail.trim().replace(/^["']|["']$/g, '');
  if (clean.includes('@')) {
    const local = clean.split('@')[0];
    return local.substring(0, 2).toUpperCase();
  }
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.substring(0, 2).toUpperCase();
};

const formatBytes = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export const MessageViewer: React.FC<MessageViewerProps> = ({
  message,
  currentFolder,
  activeMailbox,
  onReply,
  onReplyAll,
  onForward,
  onDelete,
  onMove,
  onMarkSpam,
  onMarkHam,
  onEditDraft,
}) => {
  const [viewMode, setViewMode] = useState<'html' | 'text'>('html');
  const [allowRemoteImages, setAllowRemoteImages] = useState(false);

  // Process HTML body for image privacy (always call Hook before early return)
  const sanitizedHtml = React.useMemo(() => {
    if (!message || !message.body_html) return '';
    if (allowRemoteImages) return message.body_html;
    // Replace src="http..." with placeholder if remote
    return message.body_html.replace(
      /(<img[^>]+src=["'])(https?:\/\/[^"']+)(["'][^>]*>)/gi,
      '$1data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="100%" height="100%" fill="%23f1f3f5"/><text x="10" y="24" fill="%236b7280" font-size="11">Image Blocked</text></svg>$3'
    );
  }, [message, allowRemoteImages]);

  if (!message) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          color: '#9CA3AF',
        }}
      >
        <Mail size={48} strokeWidth={1.5} style={{ opacity: 0.4, marginBottom: '12px' }} />
        <div style={{ fontSize: '15px', fontWeight: 600, color: '#4B5563' }}>No Message Selected</div>
        <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '4px' }}>
          Select an email from the list to view its contents and attachments.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        overflowY: 'auto',
      }}
    >
      {/* Top Action Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 24px',
          borderBottom: '1px solid #E5E7EB',
          backgroundColor: '#FAFAFA',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {currentFolder.toLowerCase() === 'drafts' ? (
            <button
              className="btn-primary"
              style={{ padding: '6px 14px', fontSize: '12px' }}
              onClick={() => onEditDraft?.(message)}
            >
              <Edit3 size={14} />
              <span>Continue Editing Draft</span>
            </button>
          ) : (
            <>
              <button
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={() => onReply(message)}
                title="Reply to sender"
              >
                <Reply size={14} />
                <span>Reply</span>
              </button>
              {onReplyAll && (
                <button
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                  onClick={() => onReplyAll(message)}
                  title="Reply to sender and all recipients"
                >
                  <ReplyAll size={14} />
                  <span>Reply All</span>
                </button>
              )}
              <button
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={() => onForward(message)}
                title="Forward message"
              >
                <CornerUpRight size={14} />
                <span>Forward</span>
              </button>
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <select
            style={{
              fontSize: '12px',
              height: '30px',
              padding: '0 8px',
              borderRadius: '8px',
              border: '1px solid #D1D5DB',
              backgroundColor: '#FFFFFF',
            }}
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                onMove(message.id, e.target.value);
                e.target.value = '';
              }
            }}
          >
            <option value="" disabled>Move to...</option>
            {currentFolder !== 'inbox' && <option value="inbox">Inbox</option>}
            {currentFolder !== 'archive' && <option value="archive">Archive</option>}
            {currentFolder !== 'spam' && <option value="spam">Spam</option>}
            {currentFolder !== 'trash' && <option value="trash">Trash</option>}
          </select>

          {currentFolder === 'spam' ? (
            <button
              className="btn-secondary"
              style={{ padding: '6px 10px', fontSize: '12px' }}
              onClick={() => onMarkHam(message.id)}
              title="Not Spam (Move to Inbox)"
            >
              <span>Not Spam</span>
            </button>
          ) : (
            <button
              className="btn-secondary"
              style={{ padding: '6px 10px', fontSize: '12px' }}
              onClick={() => onMarkSpam(message.id)}
              title="Report Spam"
            >
              <AlertOctagon size={14} color="#E67700" />
            </button>
          )}

          <button
            className="btn-secondary"
            style={{ padding: '6px 10px', fontSize: '12px', color: '#C92A2A', borderColor: '#FCA5A5' }}
            onClick={() => onDelete(message.id)}
            title={currentFolder === 'trash' ? 'Delete Permanently' : 'Move to Trash'}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Message Header */}
      <div style={{ padding: '24px 28px', borderBottom: '1px solid #F1F3F5' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.4 }}>
            {message.subject}
          </h1>
          {message.is_internal && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: '#EFF6FF',
                color: '#1D4ED8',
                border: '1px solid #BFDBFE',
                borderRadius: '6px',
                padding: '3px 10px',
                fontSize: '11px',
                fontWeight: 600,
                flexShrink: 0,
              }}
              title="Delivered directly within the organization via instant fast-path"
            >
              <Zap size={13} />
              Direct Company Message
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Avatar Circle */}
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: '#111827',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '14px',
                flexShrink: 0,
              }}
            >
              {getInitials(message.sender)}
            </div>

            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                {message.sender}
              </div>
              <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
                To: <span style={{ color: '#374151' }}>{message.recipient}</span>
                {message.cc && (
                  <span style={{ marginLeft: '8px' }}>
                    Cc: <span style={{ color: '#374151' }}>{message.cc}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: '#6B7280' }}>
              {new Date(message.date).toLocaleString()}
            </div>
            {message.body_html && message.body_text && (
              <div style={{ marginTop: '4px', display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === 'html' ? 'text' : 'html')}
                  style={{
                    fontSize: '11px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid #E5E7EB',
                    backgroundColor: '#F9FAFB',
                    cursor: 'pointer',
                    color: '#4B5563',
                  }}
                >
                  {viewMode === 'html' ? 'View Plain Text' : 'View HTML'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Remote Images Privacy Notice */}
        {message.body_html && !allowRemoteImages && message.body_html.includes('<img') && (
          <div
            style={{
              marginTop: '16px',
              padding: '8px 12px',
              backgroundColor: '#FFF9DB',
              border: '1px solid #E67700',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#A65D03',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Remote images are blocked to protect your privacy.</span>
            <button
              onClick={() => setAllowRemoteImages(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#111827',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '12px',
                textDecoration: 'underline',
              }}
            >
              Load Images
            </button>
          </div>
        )}
      </div>

      {/* Attachments Section */}
      {message.attachments && message.attachments.length > 0 && (
        <div style={{ padding: '16px 28px', backgroundColor: '#F8F9FA', borderBottom: '1px solid #E5E7EB' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#4B5563', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Paperclip size={14} />
            <span>Attachments ({message.attachments.length})</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {message.attachments.map((att) => {
              const isImg = att.content_type.startsWith('image/');
              const downloadUrl = api.getAttachmentDownloadUrl(message.id, att.index, currentFolder, activeMailbox);

              return (
                <div
                  key={att.index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    maxWidth: '260px',
                  }}
                >
                  {isImg ? <ImageIcon size={18} color="#1971C2" /> : <File size={18} color="#4B5563" />}
                  <div style={{ overflow: 'hidden', flex: 1 }}>
                    <div
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#111827',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={att.filename}
                    >
                      {att.filename}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>{formatBytes(att.size)}</span>
                      {att.is_shared && (
                        <span
                          style={{
                            fontSize: '9.5px',
                            fontWeight: 700,
                            padding: '0 4px',
                            borderRadius: '3px',
                            backgroundColor: '#EFF6FF',
                            color: '#1D4ED8',
                            border: '1px solid #BFDBFE',
                          }}
                          title="Zero-copy internal shared attachment"
                        >
                          ZERO-COPY
                        </span>
                      )}
                    </div>
                  </div>
                  <a
                    href={downloadUrl}
                    download={att.filename}
                    className="btn-ghost"
                    style={{ padding: '4px', height: '26px', width: '26px' }}
                    title="Download attachment"
                  >
                    <Download size={14} color="#111827" />
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Message Body Content */}
      <div style={{ padding: '24px 28px', flex: 1 }}>
        {viewMode === 'html' && message.body_html ? (
          <iframe
            title="Email Content"
            srcDoc={`<!DOCTYPE html><html><head><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.6;color:#1F2937;margin:0;padding:8px;}img{max-width:100%;height:auto;}pre{background:#f8f9fa;padding:8px;border-radius:6px;overflow-x:auto;}</style></head><body>${sanitizedHtml}</body></html>`}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            style={{
              width: '100%',
              minHeight: '400px',
              border: 'none',
              backgroundColor: '#FFFFFF',
            }}
          />
        ) : (
          <div
            style={{
              fontSize: '14px',
              lineHeight: 1.6,
              color: '#1F2937',
              whiteSpace: 'pre-wrap',
              fontFamily: 'inherit',
            }}
          >
            {message.body_text || message.snippet}
          </div>
        )}
      </div>
    </div>
  );
};
