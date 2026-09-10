import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Radio, RefreshCw, CheckCircle2, User, ChevronDown
} from 'lucide-react';
import { api } from '../../services/api';
import { SkeletonCard } from '../common/SkeletonCard';
import { FolderSidebar } from './webmail/FolderSidebar';
import { MailListView } from './webmail/MailListView';
import { MessageViewer } from './webmail/MessageViewer';
import { ComposerModal } from './webmail/ComposerModal';
import type {
  WebmailMessage, FolderStat, MailboxStorageSummary, MailboxAccountItem
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

  // Composer reply/forward initial state
  const [composerState, setComposerState] = useState<{
    recipient: string;
    subject: string;
    bodyHtml: string;
    bodyText: string;
  }>({ recipient: '', subject: '', bodyHtml: '', bodyText: '' });

  const eventSourceRef = useRef<EventSource | null>(null);

  // Show transient toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
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
    } catch (err) {
      console.error('Failed to load folders:', err);
    }
  }, []);

  // 3. Fetch messages for folder
  const loadMessages = useCallback(async (folder: string, mb: string, search?: string) => {
    try {
      const mList = await api.getWebmailMessages(folder, mb, search);
      setMessages(mList);
      setSelectedIds(new Set());
      // If selected message is still in list, keep it, else select first
      if (mList.length > 0) {
        setSelectedMessage(mList[0]);
      } else {
        setSelectedMessage(null);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoading(false);
    }
  }, []);

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

  // 4. Real-time Server-Sent Events (SSE) listener
  useEffect(() => {
    if (!activeMailbox) return;

    const token = localStorage.getItem('corpmail_token');
    const sseUrl = `/api/v1/webmail/events?mailbox=${encodeURIComponent(activeMailbox)}${token ? `&token=${token}` : ''}`;

    try {
      const es = new EventSource(sseUrl);
      eventSourceRef.current = es;

      es.addEventListener('new_mail', (e: any) => {
        try {
          const data = JSON.parse(e.data);
          showToast(`New email received in ${data.folder || 'Inbox'}`);
          loadFolders(activeMailbox);
          if (currentFolder === 'inbox' || currentFolder === data.folder) {
            loadMessages(currentFolder, activeMailbox, searchQuery);
          }
        } catch {
          loadFolders(activeMailbox);
          loadMessages(currentFolder, activeMailbox, searchQuery);
        }
      });

      es.addEventListener('message_moved', () => {
        loadFolders(activeMailbox);
        loadMessages(currentFolder, activeMailbox, searchQuery);
      });

      es.addEventListener('message_deleted', () => {
        loadFolders(activeMailbox);
        loadMessages(currentFolder, activeMailbox, searchQuery);
      });

      es.addEventListener('bulk_action_completed', () => {
        loadFolders(activeMailbox);
        loadMessages(currentFolder, activeMailbox, searchQuery);
      });

      es.onerror = () => {
        es.close();
      };
    } catch (err) {
      console.warn('SSE not supported or failed to connect:', err);
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [activeMailbox, currentFolder, searchQuery, loadFolders, loadMessages]);

  // Select a message and load detail (marks as read)
  const handleSelectMessage = async (msg: WebmailMessage) => {
    setSelectedMessage(msg);
    try {
      const detail = await api.getWebmailMessage(msg.id, currentFolder, activeMailbox);
      setSelectedMessage(detail);
      // Update read status in local messages list & folders
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, is_read: true } : m))
      );
      loadFolders(activeMailbox);
    } catch (err) {
      console.error('Failed to load message detail:', err);
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

  // Reply & Forward
  const handleReply = (msg: WebmailMessage) => {
    const quote = `\n\n--- Original Message ---\nFrom: ${msg.sender}\nDate: ${msg.date}\n\n${msg.body_text || msg.snippet}`;
    setComposerState({
      recipient: msg.sender,
      subject: msg.subject.startsWith('Re:') ? msg.subject : `Re: ${msg.subject}`,
      bodyHtml: `<p></p><blockquote style="border-left: 2px solid #D1D5DB; padding-left: 12px; margin-left: 0; color: #4B5563;"><strong>From:</strong> ${msg.sender}<br/><strong>Date:</strong> ${msg.date}<br/><br/>${msg.body_html || msg.body_text || ''}</blockquote>`,
      bodyText: quote,
    });
    setIsComposeOpen(true);
  };

  const handleForward = (msg: WebmailMessage) => {
    setComposerState({
      recipient: '',
      subject: msg.subject.startsWith('Fwd:') ? msg.subject : `Fwd: ${msg.subject}`,
      bodyHtml: `<p></p><hr/><p><strong>---------- Forwarded message ---------</strong><br/><strong>From:</strong> ${msg.sender}<br/><strong>Subject:</strong> ${msg.subject}<br/><strong>Date:</strong> ${msg.date}</p>${msg.body_html || msg.body_text || ''}`,
      bodyText: `\n\n---------- Forwarded message ---------\nFrom: ${msg.sender}\nSubject: ${msg.subject}\nDate: ${msg.date}\n\n${msg.body_text || msg.snippet}`,
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
    return <SkeletonCard lines={6} height="520px" />;
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
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
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          }}
        >
          <CheckCircle2 size={16} color="#40C057" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Action & Mailbox Switcher Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: 0 }}>
              Corporate Webmail
            </h2>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                backgroundColor: '#EBFBEE',
                border: '1px solid #2B8A3E',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#1B5E20',
              }}
            >
              <Radio size={12} color="#2B8A3E" className="animate-pulse" />
              <span>Real-Time Sync Active</span>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: '4px 0 0' }}>
            High-performance webmail connected directly to Dovecot IMAP and Postfix SMTP.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Mailbox Switcher for Admins / Users */}
          {accounts.length > 1 ? (
            <div style={{ position: 'relative' }}>
              <select
                value={activeMailbox}
                onChange={(e) => setActiveMailbox(e.target.value)}
                style={{
                  height: '38px',
                  padding: '0 32px 0 12px',
                  borderRadius: '8px',
                  border: '1.5px solid #2D3139',
                  backgroundColor: '#FFFFFF',
                  color: '#111827',
                  fontSize: '13px',
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
                size={14}
                style={{ position: 'absolute', right: '10px', top: '12px', pointerEvents: 'none', color: '#6B7280' }}
              />
            </div>
          ) : accounts.length === 1 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                backgroundColor: '#FFFFFF',
                borderRadius: '8px',
                border: '1px solid #E5E7EB',
                fontSize: '13px',
                fontWeight: 600,
                color: '#111827',
              }}
            >
              <User size={14} color="#6B7280" />
              <span>{accounts[0].email}</span>
            </div>
          ) : null}

          {/* Refresh Button */}
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              loadFolders(activeMailbox);
              loadMessages(currentFolder, activeMailbox, searchQuery);
            }}
            title="Refresh folder"
          >
            <RefreshCw size={14} />
          </button>

          {/* Compose Button */}
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setComposerState({ recipient: '', subject: '', bodyHtml: '', bodyText: '' });
              setIsComposeOpen(true);
            }}
          >
            <Plus size={16} />
            <span>Compose Email</span>
          </button>
        </div>
      </div>

      {/* Triple-Pane Webmail Workspace */}
      <div
        className="card-standard"
        style={{
          display: 'flex',
          height: 'calc(100vh - 210px)',
          minHeight: '620px',
          overflow: 'hidden',
          borderRadius: '16px',
          padding: 0,
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
          onForward={handleForward}
          onDelete={handleDeleteMessage}
          onMove={handleMoveMessage}
          onMarkSpam={handleMarkSpam}
          onMarkHam={handleMarkHam}
        />
      </div>

      {/* Modern Compose Modal */}
      <ComposerModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={() => {
          showToast('Email dispatched to SMTP queue and saved to Sent folder.');
          loadFolders(activeMailbox);
          if (currentFolder === 'sent') {
            loadMessages('sent', activeMailbox, searchQuery);
          }
        }}
        activeMailbox={activeMailbox}
        initialRecipient={composerState.recipient}
        initialSubject={composerState.subject}
        initialBodyHtml={composerState.bodyHtml}
        initialBodyText={composerState.bodyText}
      />
    </div>
  );
};
