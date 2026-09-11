import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  RefreshCw,
  CheckCircle2,
  User,
  ChevronDown,
} from 'lucide-react';
import { api } from '../../services/api';
import { SkeletonCard } from '../common/SkeletonCard';
import { FolderSidebar } from './webmail/FolderSidebar';
import { MailListView } from './webmail/MailListView';
import { MessageViewer } from './webmail/MessageViewer';
import { ComposerModal, type InitialAttachmentItem } from './webmail/ComposerModal';
import type {
  WebmailMessage,
  FolderStat,
  MailboxStorageSummary,
  MailboxAccountItem,
} from '../../types';

export const WebmailView: React.FC = () => {
  const [accounts, setAccounts] = useState<MailboxAccountItem[]>([]);
  const [activeMailbox, setActiveMailbox] = useState<string>('');
  const [folders, setFolders] = useState<FolderStat[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string>('inbox');
  const [storage, setStorage] = useState<MailboxStorageSummary | null>(null);
  const [messages, setMessages] = useState<WebmailMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<WebmailMessage | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [testLoading, setTestLoading] = useState(false);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Folder sidebar collapse state
  const [isFolderCollapsed, setIsFolderCollapsed] = useState(false);

  // Live Sync status tracking
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [sseConnected, setSseConnected] = useState(false);

  // Composer reply/forward/draft initial state
  const [composerState, setComposerState] = useState<{
    recipient: string;
    cc?: string;
    bcc?: string;
    subject: string;
    bodyHtml: string;
    bodyText: string;
    attachments?: InitialAttachmentItem[];
    draftId?: string;
  }>({ recipient: '', cc: '', bcc: '', subject: '', bodyHtml: '', bodyText: '', attachments: [] });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  // Show transient toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  // 1. Fetch available accounts
  const loadAccounts = async () => {
    try {
      const accList = await api.getWebmailAccounts();
      setAccounts(accList);
      if (accList.length > 0 && !activeMailbox) {
        setActiveMailbox(accList[0].email);
      }
    } catch (err) {
      console.error('Failed to load accounts:', err);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  // 2. Fetch folders & storage summary
  const loadFolders = useCallback(async (mb: string) => {
    try {
      const summary = await api.getWebmailFolders(mb);
      setFolders(summary.folders);
      setStorage(summary);
      setLastSyncTime(new Date());
    } catch (err) {
      console.error('Failed to load folders:', err);
    }
  }, []);

  // 3. Fetch messages for folder and auto-load message details
  const loadMessages = useCallback(
    async (folder: string, mb: string, search?: string, targetId?: string, silent: boolean = false) => {
      if (!silent) setIsSyncing(true);
      try {
        const mList = await api.getWebmailMessages(folder, mb, search);
        setMessages(mList);
        setSelectedIds(new Set());
        if (mList.length > 0) {
          const target = targetId
            ? mList.find((m) => m.id === targetId) || mList[0]
            : mList[0];
          try {
            const detail = await api.getWebmailMessage(target.id, folder, mb);
            setSelectedMessage(detail);
          } catch {
            setSelectedMessage(target);
          }
        } else {
          setSelectedMessage(null);
        }
        setLastSyncTime(new Date());
      } catch (err) {
        console.error('Failed to load messages:', err);
      } finally {
        setLoading(false);
        setIsSyncing(false);
      }
    },
    []
  );

  // Trigger full sync
  const handleManualSync = async () => {
    if (!activeMailbox) return;
    setIsSyncing(true);
    await Promise.all([
      loadFolders(activeMailbox),
      loadMessages(currentFolder, activeMailbox, searchQuery),
    ]);
    setIsSyncing(false);
  };

  // Fetch data when active mailbox or current folder changes
  useEffect(() => {
    if (activeMailbox) {
      loadFolders(activeMailbox);
      loadMessages(currentFolder, activeMailbox, searchQuery);
    }
  }, [activeMailbox, currentFolder, loadFolders, loadMessages]);

  // Handle Search Debounce
  useEffect(() => {
    if (!activeMailbox) return;
    const timer = setTimeout(() => {
      loadMessages(currentFolder, activeMailbox, searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, activeMailbox, currentFolder, loadMessages]);

  // 4. Real-time Server-Sent Events (SSE) listener with Auto-Reconnect
  useEffect(() => {
    if (!activeMailbox) return;

    let isMounted = true;

    const connectSSE = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const token = localStorage.getItem('corpmail_token');
      const sseUrl = `/api/v1/webmail/events?mailbox=${encodeURIComponent(activeMailbox)}${
        token ? `&token=${encodeURIComponent(token)}` : ''
      }`;

      try {
        const es = new EventSource(sseUrl);
        eventSourceRef.current = es;

        es.onopen = () => {
          if (isMounted) {
            setSseConnected(true);
          }
        };

        es.addEventListener('new_mail', (e: any) => {
          try {
            const data = JSON.parse(e.data);
            const subj = data.subject || 'New Message';
            const senderInfo = data.sender ? ` from ${data.sender}` : '';
            showToast(`📩 New email${senderInfo}: "${subj}"`);
            loadFolders(activeMailbox);
            if (currentFolder === 'inbox' || currentFolder === data.folder) {
              loadMessages(currentFolder, activeMailbox, searchQuery, undefined, true);
            }
          } catch {
            loadFolders(activeMailbox);
            loadMessages(currentFolder, activeMailbox, searchQuery, undefined, true);
          }
        });

        es.addEventListener('message_moved', () => {
          loadFolders(activeMailbox);
          loadMessages(currentFolder, activeMailbox, searchQuery, undefined, true);
        });

        es.addEventListener('message_deleted', () => {
          loadFolders(activeMailbox);
          loadMessages(currentFolder, activeMailbox, searchQuery, undefined, true);
        });

        es.addEventListener('bulk_action_completed', () => {
          loadFolders(activeMailbox);
          loadMessages(currentFolder, activeMailbox, searchQuery, undefined, true);
        });

        es.onerror = () => {
          if (isMounted) {
            setSseConnected(false);
          }
          es.close();
          // Schedule reconnect attempt
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMounted) {
              connectSSE();
            }
          }, 5000);
        };
      } catch (err) {
        console.warn('SSE connection failed:', err);
      }
    };

    connectSSE();

    // 5. Automatic Background Polling Fallback (every 10 seconds)
    const pollInterval = setInterval(() => {
      if (activeMailbox) {
        loadFolders(activeMailbox);
        loadMessages(currentFolder, activeMailbox, searchQuery, selectedMessage?.id, true);
      }
    }, 10000);

    // 6. Window Focus / Tab Return Immediate Sync
    const handleFocusSync = () => {
      if (document.visibilityState === 'visible' && activeMailbox) {
        loadFolders(activeMailbox);
        loadMessages(currentFolder, activeMailbox, searchQuery, selectedMessage?.id, true);
      }
    };
    window.addEventListener('focus', handleFocusSync);
    document.addEventListener('visibilitychange', handleFocusSync);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      clearTimeout(reconnectTimeoutRef.current);
      window.removeEventListener('focus', handleFocusSync);
      document.removeEventListener('visibilitychange', handleFocusSync);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [activeMailbox, currentFolder, searchQuery, loadFolders, loadMessages, selectedMessage?.id]);

  // Select a message and load detail (marks as read)
  const handleSelectMessage = async (msg: WebmailMessage) => {
    setSelectedMessage(msg);
    try {
      const detail = await api.getWebmailMessage(msg.id, currentFolder, activeMailbox);
      setSelectedMessage(detail);
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, is_read: true } : m))
      );
      setFolders((prev) =>
        prev.map((f) => {
          if (f.key === currentFolder && f.unread > 0) {
            return { ...f, unread: Math.max(0, f.unread - 1) };
          }
          return f;
        })
      );
    } catch {
      // Keep basic message
    }
  };

  // Selection toggle
  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(messages.map((m) => m.id)));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  // Bulk Actions
  const handleBulkAction = async (action: string, targetFolder?: string) => {
    if (selectedIds.size === 0) return;
    try {
      await api.executeWebmailBulk(
        action,
        Array.from(selectedIds),
        currentFolder,
        targetFolder,
        activeMailbox
      );
      showToast(`Action '${action}' applied to ${selectedIds.size} messages.`);
      await loadFolders(activeMailbox);
      await loadMessages(currentFolder, activeMailbox, searchQuery);
    } catch (err: any) {
      alert(err.message || 'Bulk operation failed');
    }
  };

  // Single Message Actions
  const handleDeleteMessage = async (msgId: string) => {
    try {
      await api.deleteWebmailMessage(msgId, currentFolder, activeMailbox);
      showToast(currentFolder === 'trash' ? 'Message deleted permanently.' : 'Message moved to Trash.');
      await loadFolders(activeMailbox);
      await loadMessages(currentFolder, activeMailbox, searchQuery);
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    }
  };

  const handleMoveMessage = async (msgId: string, toFolder: string) => {
    try {
      await api.moveWebmailMessage(msgId, currentFolder, toFolder, activeMailbox);
      showToast(`Message moved to ${toFolder}.`);
      await loadFolders(activeMailbox);
      await loadMessages(currentFolder, activeMailbox, searchQuery);
    } catch (err: any) {
      alert(err.message || 'Move failed');
    }
  };

  const handleMarkSpam = async (msgId: string) => {
    try {
      await api.markWebmailSpam(msgId, currentFolder, activeMailbox);
      showToast('Message moved to Spam and reported.');
      await loadFolders(activeMailbox);
      await loadMessages(currentFolder, activeMailbox, searchQuery);
    } catch (err: any) {
      alert(err.message || 'Failed to mark spam');
    }
  };

  const handleMarkHam = async (msgId: string) => {
    try {
      await api.markWebmailHam(msgId, activeMailbox);
      showToast('Message restored to Inbox.');
      await loadFolders(activeMailbox);
      await loadMessages(currentFolder, activeMailbox, searchQuery);
    } catch (err: any) {
      alert(err.message || 'Failed to restore message');
    }
  };

  // HTML embed & sanitization helpers for Forward & Reply
  const escapeHtml = (str: string = ''): string => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const sanitizeForEmbed = (html?: string, text?: string): string => {
    if (html && html.trim()) {
      let clean = html;
      const bodyMatch = clean.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      if (bodyMatch && bodyMatch[1]) {
        clean = bodyMatch[1];
      }
      clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      clean = clean.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
      return clean;
    }
    if (text && text.trim()) {
      return text
        .split(/\r?\n/)
        .map((line) => `<p>${line.trim() ? escapeHtml(line) : '<br/>'}</p>`)
        .join('');
    }
    return '<p></p>';
  };

  // Reply, Reply All & Forward
  const handleReply = async (msg: WebmailMessage) => {
    let fullMsg = msg;
    if (!fullMsg.body_html && !fullMsg.body_text) {
      try {
        fullMsg = await api.getWebmailMessage(msg.id, currentFolder, activeMailbox);
      } catch {
        fullMsg = msg;
      }
    }
    const cleanSubject = fullMsg.subject || '';
    const reSubject = cleanSubject.toLowerCase().startsWith('re:') ? cleanSubject : `Re: ${cleanSubject}`;
    const quote = `\n\n--- Original Message ---\nFrom: ${fullMsg.sender}\nDate: ${fullMsg.date}\n\n${fullMsg.body_text || fullMsg.snippet || ''}`;
    setComposerState({
      recipient: fullMsg.sender,
      cc: '',
      bcc: '',
      subject: reSubject,
      bodyHtml: `<p><br/></p><blockquote style="border-left: 2px solid #D1D5DB; padding-left: 12px; margin-left: 0; color: #4B5563;"><p style="margin:0 0 6px 0;"><strong>From:</strong> ${escapeHtml(fullMsg.sender)}<br/><strong>Date:</strong> ${escapeHtml(fullMsg.date)}</p>${sanitizeForEmbed(fullMsg.body_html, fullMsg.body_text)}</blockquote>`,
      bodyText: quote,
      attachments: [],
      draftId: undefined,
    });
    setIsComposeOpen(true);
  };

  const handleReplyAll = async (msg: WebmailMessage) => {
    let fullMsg = msg;
    if (!fullMsg.body_html && !fullMsg.body_text) {
      try {
        fullMsg = await api.getWebmailMessage(msg.id, currentFolder, activeMailbox);
      } catch {
        fullMsg = msg;
      }
    }
    const parseAddrs = (str?: string): string[] => {
      if (!str) return [];
      return str
        .split(/[,;]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    };

    const myEmail = activeMailbox.toLowerCase();
    const senderEmail = fullMsg.sender.toLowerCase();

    // Collect all candidates from recipient (To) and CC, exclude self and sender
    const candidateAddrs = [...parseAddrs(fullMsg.recipient), ...parseAddrs(fullMsg.cc)];
    const uniqueCc = Array.from(
      new Set(
        candidateAddrs
          .map((a) => a.replace(/.*<([^>]+)>.*/, '$1').trim())
          .filter((a) => {
            const low = a.toLowerCase();
            return low && !low.includes(myEmail) && !senderEmail.includes(low);
          })
      )
    ).join(', ');

    const cleanSubject = fullMsg.subject || '';
    const reSubject = cleanSubject.toLowerCase().startsWith('re:') ? cleanSubject : `Re: ${cleanSubject}`;
    const quote = `\n\n--- Original Message ---\nFrom: ${fullMsg.sender}\nDate: ${fullMsg.date}\n\n${fullMsg.body_text || fullMsg.snippet || ''}`;
    setComposerState({
      recipient: fullMsg.sender,
      cc: uniqueCc,
      bcc: '',
      subject: reSubject,
      bodyHtml: `<p><br/></p><blockquote style="border-left: 2px solid #D1D5DB; padding-left: 12px; margin-left: 0; color: #4B5563;"><p style="margin:0 0 6px 0;"><strong>From:</strong> ${escapeHtml(fullMsg.sender)}<br/><strong>Date:</strong> ${escapeHtml(fullMsg.date)}</p>${sanitizeForEmbed(fullMsg.body_html, fullMsg.body_text)}</blockquote>`,
      bodyText: quote,
      attachments: [],
      draftId: undefined,
    });
    setIsComposeOpen(true);
  };

  const handleForward = async (msg: WebmailMessage) => {
    let fullMsg = msg;
    if (!fullMsg.body_html && !fullMsg.body_text) {
      try {
        fullMsg = await api.getWebmailMessage(msg.id, currentFolder, activeMailbox);
      } catch {
        fullMsg = msg;
      }
    }

    const cleanSubject = fullMsg.subject || '';
    const fwdSubject = cleanSubject.toLowerCase().startsWith('fwd:') ? cleanSubject : `Fwd: ${cleanSubject}`;

    const forwardedContentHtml = sanitizeForEmbed(fullMsg.body_html, fullMsg.body_text);
    const forwardHeaderHtml = `
      <p><br/></p>
      <div style="border-top: 1px solid #E5E7EB; padding-top: 12px; margin-top: 16px; margin-bottom: 12px; color: #4B5563; font-size: 13px;">
        <p style="margin: 0 0 6px 0; font-weight: 700; color: #111827;">---------- Forwarded message ---------</p>
        <p style="margin: 0 0 3px 0;"><strong>From:</strong> ${escapeHtml(fullMsg.sender)}</p>
        <p style="margin: 0 0 3px 0;"><strong>Date:</strong> ${escapeHtml(fullMsg.date)}</p>
        <p style="margin: 0 0 3px 0;"><strong>Subject:</strong> ${escapeHtml(cleanSubject)}</p>
        <p style="margin: 0 0 3px 0;"><strong>To:</strong> ${escapeHtml(fullMsg.recipient)}</p>
        ${fullMsg.cc ? `<p style="margin: 0 0 3px 0;"><strong>Cc:</strong> ${escapeHtml(fullMsg.cc)}</p>` : ''}
      </div>
      <div>${forwardedContentHtml}</div>
    `;

    const forwardHeaderText = `\n\n---------- Forwarded message ---------\nFrom: ${fullMsg.sender}\nDate: ${fullMsg.date}\nSubject: ${cleanSubject}\nTo: ${fullMsg.recipient}${fullMsg.cc ? `\nCc: ${fullMsg.cc}` : ''}\n\n${fullMsg.body_text || fullMsg.snippet || ''}`;

    // Collect attachments from the message being forwarded
    const initialAtts = (fullMsg.attachments || []).map((att) => ({
      filename: att.filename,
      size: att.size,
      contentType: att.content_type,
      downloadUrl: api.getAttachmentDownloadUrl(fullMsg.id, att.index, currentFolder, activeMailbox),
    }));

    setComposerState({
      recipient: '',
      cc: '',
      bcc: '',
      subject: fwdSubject,
      bodyHtml: forwardHeaderHtml,
      bodyText: forwardHeaderText,
      attachments: initialAtts,
      draftId: undefined,
    });
    setIsComposeOpen(true);
  };

  const handleEditDraft = (msg: WebmailMessage) => {
    setComposerState({
      recipient: msg.recipient || '',
      cc: msg.cc || '',
      bcc: '',
      subject: msg.subject || '',
      bodyHtml: msg.body_html || '',
      bodyText: msg.body_text || msg.snippet || '',
      attachments: [],
      draftId: msg.id,
    });
    setIsComposeOpen(true);
  };

  // Test Delivery
  const handleTestDelivery = async () => {
    setTestLoading(true);
    try {
      await api.injectTestEmail(activeMailbox, 'welcome');
      showToast('Sample incoming email successfully injected into Inbox!');
      await loadFolders(activeMailbox);
      if (currentFolder === 'inbox') {
        await loadMessages('inbox', activeMailbox, searchQuery);
      }
    } catch (err: any) {
      alert(err.message || 'Test delivery failed');
    } finally {
      setTestLoading(false);
    }
  };

  // Empty Folder (Trash / Spam)
  const handleEmptyFolder = async (folderKey: string) => {
    if (!confirm(`Are you sure you want to permanently clear all messages in ${folderKey}?`)) return;
    try {
      const allIds = messages.map((m) => m.id);
      if (allIds.length > 0) {
        await api.executeWebmailBulk('delete', allIds, folderKey, undefined, activeMailbox);
        showToast(`Cleared ${folderKey}.`);
        await loadFolders(activeMailbox);
        await loadMessages(folderKey, activeMailbox, searchQuery);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to empty folder');
    }
  };

  if (loading && accounts.length === 0) {
    return <SkeletonCard lines={6} height="100%" />;
  }

  return (
    <div
      className="animate-fade-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: '100%',
        minHeight: 0,
        gap: '8px',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 9999,
            backgroundColor: '#111827',
            color: '#FFFFFF',
            padding: '10px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          }}
        >
          <CheckCircle2 size={16} color="#40C057" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Toolbar - Compact & Integrated */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '2px 4px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: 0, letterSpacing: '-0.02em' }}>
            Corporate Webmail
          </h2>

          {/* Real-time Status Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 9px',
              backgroundColor: sseConnected ? '#EBFBEE' : '#FFF9DB',
              border: `1px solid ${sseConnected ? '#2B8A3E' : '#E67700'}`,
              borderRadius: '20px',
              fontSize: '11.5px',
              fontWeight: 600,
              color: sseConnected ? '#1B5E20' : '#A65D03',
            }}
            title={`${sseConnected ? 'Connected to live push notification stream' : 'Syncing via periodic polling'} (Updated ${lastSyncTime.toLocaleTimeString()})`}
          >
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: sseConnected ? '#2B8A3E' : '#E67700',
              }}
              className={isSyncing ? 'animate-ping' : ''}
            />
            <span>{isSyncing ? 'Syncing...' : sseConnected ? 'Live Sync' : 'Polling'}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Mailbox Switcher for Admins / Users */}
          {accounts.length > 1 ? (
            <div style={{ position: 'relative' }}>
              <select
                value={activeMailbox}
                onChange={(e) => setActiveMailbox(e.target.value)}
                style={{
                  height: '34px',
                  padding: '0 28px 0 10px',
                  borderRadius: '6px',
                  border: '1px solid #D1D5DB',
                  backgroundColor: '#FFFFFF',
                  color: '#111827',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  appearance: 'none',
                }}
              >
                {accounts.map((acc) => (
                  <option key={acc.email} value={acc.email}>
                    {acc.full_name} ({acc.email})
                  </option>
                ))}
              </select>
              <ChevronDown
                size={13}
                style={{ position: 'absolute', right: '8px', top: '10px', pointerEvents: 'none', color: '#6B7280' }}
              />
            </div>
          ) : accounts.length === 1 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 10px',
                backgroundColor: '#FFFFFF',
                borderRadius: '6px',
                border: '1px solid #E5E7EB',
                fontSize: '12.5px',
                fontWeight: 600,
                color: '#374151',
              }}
            >
              <User size={13} color="#6B7280" />
              <span>{accounts[0].email}</span>
            </div>
          ) : null}

          {/* Manual Refresh Button */}
          <button
            type="button"
            className="btn-secondary"
            onClick={handleManualSync}
            disabled={isSyncing}
            style={{ padding: '6px 10px', height: '34px' }}
            title="Check for new mail"
          >
            <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
            <span style={{ fontSize: '12px' }}>{isSyncing ? 'Syncing' : 'Sync'}</span>
          </button>

          {/* Compose Button */}
          <button
            type="button"
            className="btn-primary"
            style={{ padding: '6px 14px', height: '34px', fontSize: '13px' }}
            onClick={() => {
              setComposerState({ recipient: '', cc: '', bcc: '', subject: '', bodyHtml: '', bodyText: '', attachments: [], draftId: undefined });
              setIsComposeOpen(true);
            }}
          >
            <Plus size={15} />
            <span>Compose</span>
          </button>
        </div>
      </div>

      {/* Triple-Pane Webmail Workspace - Fills Remaining Viewport */}
      <div
        className="card-standard"
        style={{
          display: 'flex',
          flex: 1,
          height: 'calc(100% - 46px)',
          minHeight: 0,
          overflow: 'hidden',
          borderRadius: '12px',
          padding: 0,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        {/* Pane 1: Folders Sidebar */}
        <FolderSidebar
          folders={folders}
          currentFolder={currentFolder}
          onSelectFolder={setCurrentFolder}
          storage={storage}
          onEmptyFolder={handleEmptyFolder}
          onTestDelivery={handleTestDelivery}
          testLoading={testLoading}
          isCollapsed={isFolderCollapsed}
          onToggleCollapse={() => setIsFolderCollapsed(!isFolderCollapsed)}
        />

        {/* Pane 2: Message Threads List */}
        <MailListView
          currentFolder={currentFolder}
          messages={messages}
          selectedMessage={selectedMessage}
          onSelectMessage={handleSelectMessage}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onBulkAction={handleBulkAction}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Pane 3: Reading Pane */}
        <MessageViewer
          message={selectedMessage}
          currentFolder={currentFolder}
          activeMailbox={activeMailbox}
          onReply={handleReply}
          onReplyAll={handleReplyAll}
          onForward={handleForward}
          onDelete={handleDeleteMessage}
          onMove={handleMoveMessage}
          onMarkSpam={handleMarkSpam}
          onMarkHam={handleMarkHam}
          onEditDraft={handleEditDraft}
        />
      </div>

      {/* Modern Lexical Compose Modal */}
      {isComposeOpen && (
        <ComposerModal
          key={composerState.draftId ? `draft-${composerState.draftId}` : `composer-${Date.now()}`}
          isOpen={isComposeOpen}
          onClose={() => {
            setIsComposeOpen(false);
            setComposerState({ recipient: '', cc: '', bcc: '', subject: '', bodyHtml: '', bodyText: '', attachments: [], draftId: undefined });
          }}
          onSuccess={() => {
            showToast('Email dispatched to SMTP queue and saved to Sent folder.');
            setIsComposeOpen(false);
            setComposerState({ recipient: '', cc: '', bcc: '', subject: '', bodyHtml: '', bodyText: '', attachments: [], draftId: undefined });
            loadFolders(activeMailbox);
            if (currentFolder === 'sent' || currentFolder === 'drafts') {
              loadMessages(currentFolder, activeMailbox, searchQuery);
            }
          }}
          activeMailbox={activeMailbox}
          initialRecipient={composerState.recipient}
          initialCc={composerState.cc}
          initialBcc={composerState.bcc}
          initialSubject={composerState.subject}
          initialBodyHtml={composerState.bodyHtml}
          initialBodyText={composerState.bodyText}
          initialAttachments={composerState.attachments}
          draftId={composerState.draftId}
        />
      )}
    </div>
  );
};
