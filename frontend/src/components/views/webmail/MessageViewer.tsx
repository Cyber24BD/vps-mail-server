import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mail, Reply, CornerUpRight, Trash2, AlertOctagon,
  Download, Paperclip, File, Image as ImageIcon, Edit3, Zap,
  ReplyAll
} from 'lucide-react';
import type { WebmailMessage } from '../../../types';
import { api } from '../../../services/api';
import { InlineReplyBox, type PopOutData } from './InlineReplyBox';

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
  onSendSuccess?: () => void;
  onPopOut?: (data: PopOutData) => void;
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
  onReply: _onReply,
  onReplyAll,
  onForward: _onForward,
  onDelete,
  onMove,
  onMarkSpam,
  onMarkHam,
  onEditDraft,
  onSendSuccess,
  onPopOut,
}) => {
  const [viewMode, setViewMode] = useState<'html' | 'text'>('html');
  const [allowRemoteImages, setAllowRemoteImages] = useState(false);
  const [inlineReplyMode, setInlineReplyMode] = useState<'reply' | 'reply_all' | 'forward' | null>(null);
  const replyBoxRef = useRef<HTMLDivElement>(null);
  const [iframeHeight, setIframeHeight] = useState<number>(650);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const updateIframeHeight = useCallback(() => {
    try {
      const doc = iframeRef.current?.contentDocument || iframeRef.current?.contentWindow?.document;
      if (doc) {
        const scrollH = Math.max(
          doc.body?.scrollHeight || 0,
          doc.documentElement?.scrollHeight || 0,
          doc.body?.offsetHeight || 0,
          500
        );
        setIframeHeight(scrollH + 30);
      }
    } catch {
      setIframeHeight(700);
    }
  }, []);

  // Reset inline reply state and recalculate iframe height when message changes
  useEffect(() => {
    setInlineReplyMode(null);
    const timer = setTimeout(updateIframeHeight, 100);
    return () => clearTimeout(timer);
  }, [message?.id, updateIframeHeight]);

  const handleTriggerInline = (mode: 'reply' | 'reply_all' | 'forward') => {
    setInlineReplyMode(mode);
    setTimeout(() => {
      replyBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 60);
  };

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
                onClick={() => handleTriggerInline('reply')}
                title="Reply to sender"
              >
                <Reply size={14} />
                <span>Reply</span>
              </button>
              {onReplyAll && (
                <button
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                  onClick={() => handleTriggerInline('reply_all')}
                  title="Reply to sender and all recipients"
                >
                  <ReplyAll size={14} />
                  <span>Reply All</span>
                </button>
              )}
              <button
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={() => handleTriggerInline('forward')}
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
      <div style={{ padding: '16px 22px', borderBottom: '1px solid #F1F3F5' }}>
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

      {/* Message Body Content - Expands Full */}
      <div style={{ padding: '18px 22px', flex: 1, minHeight: '550px', display: 'flex', flexDirection: 'column' }}>
        {viewMode === 'html' && message.body_html ? (
          <iframe
            ref={iframeRef}
            title="Email Content"
            onLoad={updateIframeHeight}
            srcDoc={`<!DOCTYPE html><html><head><style>html,body{margin:0;padding:10px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.65;color:#1F2937;}img{max-width:100%;height:auto;}pre{background:#f8f9fa;padding:10px;border-radius:6px;overflow-x:auto;}table{max-width:100%;border-collapse:collapse;}</style></head><body>${sanitizedHtml}</body></html>`}
            sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            style={{
              width: '100%',
              height: `${iframeHeight}px`,
              minHeight: '500px',
              border: 'none',
              backgroundColor: '#FFFFFF',
              display: 'block',
            }}
          />
        ) : (
          <div
            style={{
              fontSize: '14.5px',
              lineHeight: 1.65,
              color: '#1F2937',
              whiteSpace: 'pre-wrap',
              fontFamily: 'inherit',
              minHeight: '400px',
              padding: '6px 4px',
            }}
          >
            {message.body_text || message.snippet}
          </div>
        )}
      </div>

      {/* Inline Reply / Quick Action Workspace (Gmail & Outlook Style) */}
      {currentFolder.toLowerCase() !== 'drafts' && (
        <div ref={replyBoxRef} style={{ borderTop: '1px solid #F1F3F5', backgroundColor: '#FFFFFF' }}>
          {inlineReplyMode !== null ? (
            <InlineReplyBox
              message={message}
              activeMailbox={activeMailbox}
              initialMode={inlineReplyMode}
              currentFolder={currentFolder}
              onClose={() => setInlineReplyMode(null)}
              onSuccess={() => {
                setInlineReplyMode(null);
                onSendSuccess?.();
              }}
              onPopOut={(data) => {
                setInlineReplyMode(null);
                onPopOut?.(data);
              }}
            />
          ) : (
            <div
              style={{
                padding: '14px 22px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                backgroundColor: '#FFFFFF',
              }}
            >
              {/* Outlook / Gmail style inline prompt card */}
              <div
                onClick={() => handleTriggerInline('reply')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#F8FAFC',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#CBD5E1';
                  e.currentTarget.style.backgroundColor = '#F1F5F9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#E2E8F0';
                  e.currentTarget.style.backgroundColor = '#F8FAFC';
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: '#2563EB',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {getInitials(activeMailbox)}
                </div>
                <span style={{ fontSize: '13px', color: '#64748B' }}>
                  Reply to <strong style={{ color: '#1E293B' }}>{message.sender}</strong>...
                </span>
              </div>

              {/* Quick Action Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '7px 14px', fontSize: '12.5px', borderRadius: '8px' }}
                  onClick={() => handleTriggerInline('reply')}
                  title="Reply to sender"
                >
                  <Reply size={14} />
                  <span>Reply</span>
                </button>
                {onReplyAll && (
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '7px 14px', fontSize: '12.5px', borderRadius: '8px' }}
                    onClick={() => handleTriggerInline('reply_all')}
                    title="Reply to sender and all recipients"
                  >
                    <ReplyAll size={14} />
                    <span>Reply All</span>
                  </button>
                )}
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '7px 14px', fontSize: '12.5px', borderRadius: '8px' }}
                  onClick={() => handleTriggerInline('forward')}
                  title="Forward message"
                >
                  <CornerUpRight size={14} />
                  <span>Forward</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
