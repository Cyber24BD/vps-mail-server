import React, { useState, useEffect } from 'react';
import { Mail, Send, Inbox, Trash2, AlertOctagon, FileText, Plus, Paperclip } from 'lucide-react';
import { api } from '../../services/api';
import { SkeletonCard } from '../common/SkeletonCard';
import { Modal } from '../common/Modal';
import type { WebmailMessage } from '../../types';


export const WebmailView: React.FC = () => {
  const [folders, setFolders] = useState<any[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string>('inbox');
  const [messages, setMessages] = useState<WebmailMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<WebmailMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  // Compose form
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const loadFoldersAndMessages = async (folder: string) => {
    try {
      const [fList, mList] = await Promise.all([
        api.getWebmailFolders(),
        api.getWebmailMessages(folder),
      ]);
      setFolders(fList);
      setMessages(mList);
      if (mList.length > 0) {
        setSelectedMessage(mList[0]);
      } else {
        setSelectedMessage(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFoldersAndMessages(currentFolder);
  }, [currentFolder]);

  const handleSend = async () => {
    if (!recipient || !subject || !body) return;
    setSending(true);
    try {
      await api.sendEmail(recipient, subject, body);
      setIsComposeOpen(false);
      setRecipient('');
      setSubject('');
      setBody('');
      alert('Email dispatched to SMTP queue successfully.');
      await loadFoldersAndMessages(currentFolder);
    } catch (err: any) {
      alert(err.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const getFolderIcon = (key: string) => {
    switch (key) {
      case 'inbox': return Inbox;
      case 'sent': return Send;
      case 'drafts': return FileText;
      case 'spam': return AlertOctagon;
      case 'trash': return Trash2;
      default: return Mail;
    }
  };

  if (loading) {
    return <SkeletonCard lines={6} height="400px" />;
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>Custom Webmail Client</h2>
          <p style={{ fontSize: '13px', color: '#6B7280' }}>
            Brandable corporate webmail interface connected directly to Dovecot IMAP and Postfix SMTP.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setIsComposeOpen(true)}>
          <Plus size={16} />
          <span>Compose Email</span>
        </button>
      </div>

      {/* Webmail Triple-Pane Layout */}
      <div
        className="card-standard"
        style={{
          display: 'grid',
          gridTemplateColumns: '180px 320px 1fr',
          minHeight: '600px',
          overflow: 'hidden',
          borderRadius: '16px',
        }}
      >
        {/* Pane 1: Folders List */}
        <div style={{ borderRight: '1px solid #E5E7EB', padding: '16px 10px', backgroundColor: '#F8F9FA' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF', padding: '0 8px 10px', textTransform: 'uppercase' }}>
            Folders
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {folders.map((f) => {
              const Icon = getFolderIcon(f.key);
              const isActive = currentFolder === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setCurrentFolder(f.key)}
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
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Icon size={16} />
                    <span>{f.name}</span>
                  </div>
                  {f.unread > 0 && (
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '1px 6px', borderRadius: '6px', backgroundColor: '#111827', color: '#FFF' }}>
                      {f.unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Pane 2: Message Threads */}
        <div style={{ borderRight: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', backgroundColor: '#FFFFFF' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E7EB', fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>
            {currentFolder} ({messages.length})
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {messages.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>
                Folder is empty
              </div>
            ) : (
              messages.map((m) => {
                const isSelected = selectedMessage?.id === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedMessage(m)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #F1F3F5',
                      backgroundColor: isSelected ? '#F1F3F5' : '#FFFFFF',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: m.is_read ? 500 : 700, color: '#111827' }}>
                        {m.sender}
                      </span>
                      <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                        {new Date(m.date).toLocaleDateString()}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: m.is_read ? 400 : 600, color: '#374151' }}>
                      {m.subject}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.snippet}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Pane 3: Reading Pane */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', backgroundColor: '#FFFFFF' }}>
          {selectedMessage ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ borderBottom: '1px solid #E5E7EB', paddingBottom: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
                  {selectedMessage.subject}
                </h3>
                <div style={{ fontSize: '13px', color: '#4B5563', display: 'flex', justifyContent: 'space-between' }}>
                  <span>From: <strong>{selectedMessage.sender}</strong></span>
                  <span>{new Date(selectedMessage.date).toLocaleString()}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
                  To: {selectedMessage.recipient}
                </div>
              </div>

              <div style={{ fontSize: '14px', lineHeight: 1.6, color: '#1F2937', whiteSpace: 'pre-wrap' }}>
                {selectedMessage.body_text || selectedMessage.snippet}
              </div>
            </div>
          ) : (
            <div style={{ margin: 'auto', textAlign: 'center', color: '#9CA3AF' }}>
              <Mail size={48} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontSize: '14px' }}>Select an email to read its contents</p>
            </div>
          )}
        </div>
      </div>

      {/* Compose Email Modal */}
      <Modal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        title="Compose Message"
        maxWidth="640px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Recipient</label>
            <input
              type="email"
              className="input-control"
              placeholder="colleague@domain.com"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Subject</label>
            <input
              type="text"
              className="input-control"
              placeholder="Email subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Message</label>
            <textarea
              className="input-control"
              rows={8}
              style={{ height: 'auto', minHeight: '160px', resize: 'vertical' }}
              placeholder="Write your email here..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
            <button className="btn-secondary" style={{ padding: '6px 12px' }} title="Attach file">
              <Paperclip size={14} />
              <span>Attach</span>
            </button>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-secondary" onClick={() => setIsComposeOpen(false)}>Discard</button>
              <button className="btn-primary" onClick={handleSend} disabled={sending}>
                <Send size={14} />
                <span>{sending ? 'Sending...' : 'Send Message'}</span>
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
