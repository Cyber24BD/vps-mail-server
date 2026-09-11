import React from 'react';
import {
  Search, CheckSquare, Square, Trash2,
  MailCheck, Mail, AlertOctagon, Paperclip, Zap
} from 'lucide-react';
import type { WebmailMessage } from '../../../types';

interface MailListViewProps {
  currentFolder: string;
  messages: WebmailMessage[];
  selectedMessage: WebmailMessage | null;
  onSelectMessage: (msg: WebmailMessage) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string, e: React.MouseEvent) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkAction: (action: string, targetFolder?: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const MailListView: React.FC<MailListViewProps> = ({
  currentFolder,
  messages,
  selectedMessage,
  onSelectMessage,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onBulkAction,
  searchQuery,
  onSearchChange,
}) => {
  const isAllSelected = messages.length > 0 && selectedIds.size === messages.length;
  const isSomeSelected = selectedIds.size > 0;

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const now = new Date();
      if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div
      style={{
        width: '360px',
        borderRight: '1px solid #E5E7EB',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        flexShrink: 0,
      }}
    >
      {/* Search Header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #E5E7EB' }}>
        <div style={{ position: 'relative' }}>
          <Search
            size={15}
            color="#9CA3AF"
            style={{ position: 'absolute', left: '10px', top: '10px' }}
          />
          <input
            type="text"
            className="input-control"
            placeholder="Search sender, subject, body..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              paddingLeft: '32px',
              height: '34px',
              fontSize: '12.5px',
              backgroundColor: '#F9FAFB',
            }}
          />
        </div>
      </div>

      {/* Bulk Action & Controls Header */}
      <div
        style={{
          padding: '8px 14px',
          borderBottom: '1px solid #F1F3F5',
          backgroundColor: isSomeSelected ? '#F8F9FA' : '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '38px',
          fontSize: '12px',
          fontWeight: 600,
          color: '#4B5563',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn-ghost"
            style={{ padding: '2px', height: '22px', width: '22px' }}
            onClick={isAllSelected ? onDeselectAll : onSelectAll}
            title={isAllSelected ? 'Deselect all' : 'Select all'}
          >
            {isAllSelected ? (
              <CheckSquare size={16} color="#111827" />
            ) : isSomeSelected ? (
              <CheckSquare size={16} color="#4B5563" />
            ) : (
              <Square size={16} color="#9CA3AF" />
            )}
          </button>
          <span>
            {isSomeSelected
              ? `${selectedIds.size} of ${messages.length} selected`
              : `${currentFolder.toUpperCase()} (${messages.length})`}
          </span>
        </div>

        {/* Bulk Action Buttons */}
        {isSomeSelected && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              className="btn-ghost"
              style={{ padding: '4px', height: '26px', width: '26px' }}
              onClick={() => onBulkAction('mark_read')}
              title="Mark as read"
            >
              <MailCheck size={14} color="#111827" />
            </button>
            <button
              className="btn-ghost"
              style={{ padding: '4px', height: '26px', width: '26px' }}
              onClick={() => onBulkAction('mark_unread')}
              title="Mark as unread"
            >
              <Mail size={14} color="#111827" />
            </button>
            <button
              className="btn-ghost"
              style={{ padding: '4px', height: '26px', width: '26px' }}
              onClick={() => onBulkAction('mark_spam')}
              title="Mark as spam"
            >
              <AlertOctagon size={14} color="#E67700" />
            </button>
            <select
              style={{
                fontSize: '11px',
                height: '24px',
                padding: '0 4px',
                borderRadius: '6px',
                border: '1px solid #D1D5DB',
                backgroundColor: '#FFFFFF',
              }}
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  onBulkAction('move', e.target.value);
                  e.target.value = '';
                }
              }}
              title="Move selected to..."
            >
              <option value="" disabled>Move to...</option>
              {currentFolder !== 'inbox' && <option value="inbox">Inbox</option>}
              {currentFolder !== 'archive' && <option value="archive">Archive</option>}
              {currentFolder !== 'spam' && <option value="spam">Spam</option>}
              {currentFolder !== 'trash' && <option value="trash">Trash</option>}
            </select>
            <button
              className="btn-ghost"
              style={{ padding: '4px', height: '26px', width: '26px' }}
              onClick={() => onBulkAction('delete')}
              title="Delete selected"
            >
              <Trash2 size={14} color="#C92A2A" />
            </button>
          </div>
        )}
      </div>

      {/* Message List */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {messages.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>
            No messages in this folder
          </div>
        ) : (
          messages.map((m) => {
            const isSelected = selectedMessage?.id === m.id;
            const isChecked = selectedIds.has(m.id);

            return (
              <div
                key={m.id}
                onClick={() => onSelectMessage(m)}
                style={{
                  padding: '12px 14px',
                  borderBottom: '1px solid #F1F3F5',
                  backgroundColor: isSelected ? '#F1F3F5' : isChecked ? '#F9FAFB' : '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  position: 'relative',
                  borderLeft: !m.is_read ? '3px solid #1971C2' : '3px solid transparent',
                  transition: 'background-color 100ms ease',
                }}
              >
                {/* Row 1: Checkbox, Sender/Recipient, Date */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <div
                      onClick={(e) => onToggleSelect(m.id, e)}
                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      {isChecked ? (
                        <CheckSquare size={14} color="#111827" />
                      ) : (
                        <Square size={14} color="#D1D5DB" />
                      )}
                    </div>
                    {currentFolder === 'drafts' && (
                      <span style={{ padding: '1px 5px', fontSize: '10px', borderRadius: '4px', backgroundColor: '#FFF9DB', border: '1px solid #E67700', color: '#A65D03', fontWeight: 700, flexShrink: 0 }}>
                        DRAFT
                      </span>
                    )}
                    {m.is_internal && (
                      <span
                        style={{
                          padding: '1px 5px',
                          fontSize: '10px',
                          borderRadius: '4px',
                          backgroundColor: '#EFF6FF',
                          border: '1px solid #BFDBFE',
                          color: '#1D4ED8',
                          fontWeight: 600,
                          flexShrink: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                        }}
                        title="Direct Company Message"
                      >
                        <Zap size={10} />
                        DIRECT
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: m.is_read ? 500 : 700,
                        color: m.is_read ? '#374151' : '#111827',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {currentFolder === 'sent' || currentFolder === 'drafts'
                        ? `To: ${m.recipient.split('<')[0].replace(/"/g, '').trim() || m.recipient}`
                        : (m.sender.split('<')[0].replace(/"/g, '').trim() || m.sender)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {m.has_attachment && (
                      <Paperclip size={12} color="#6B7280" />
                    )}
                    <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                      {formatDate(m.date)}
                    </span>
                  </div>
                </div>

                {/* Row 2: Subject */}
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: m.is_read ? 500 : 700,
                    color: m.is_read ? '#4B5563' : '#111827',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    paddingLeft: '22px',
                    fontStyle: !m.subject || m.subject === '(No Subject)' ? 'italic' : 'normal',
                  }}
                >
                  {m.subject || '(No Subject)'}
                </div>

                {/* Row 3: Snippet preview */}
                <div
                  style={{
                    fontSize: '12px',
                    color: '#6B7280',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    paddingLeft: '22px',
                  }}
                >
                  {m.snippet || '(No content)'}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
