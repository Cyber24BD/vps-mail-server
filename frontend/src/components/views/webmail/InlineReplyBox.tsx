import React, { useState, useRef, useEffect } from 'react';
import {
  Reply, ReplyAll, CornerUpRight, Send, Paperclip, X,
  Maximize2, Trash2, ChevronDown, Sparkles, Loader2,
  ShieldCheck, AlertTriangle, ShieldAlert, MoreHorizontal
} from 'lucide-react';
import { LexicalMailEditor } from '../../common/LexicalMailEditor';
import { api } from '../../../services/api';
import type { WebmailMessage, SpamCheckResult } from '../../../types';

export interface PopOutData {
  mode: 'reply' | 'reply_all' | 'forward';
  recipient: string;
  cc: string;
  bcc: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  files: File[];
}

interface InlineReplyBoxProps {
  message: WebmailMessage;
  activeMailbox: string;
  initialMode: 'reply' | 'reply_all' | 'forward';
  currentFolder: string;
  onClose: () => void;
  onSuccess: () => void;
  onPopOut: (data: PopOutData) => void;
}

const escapeHtml = (str: string = ''): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const formatBytes = (bytes: number) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const InlineReplyBox: React.FC<InlineReplyBoxProps> = ({
  message,
  activeMailbox,
  initialMode,
  currentFolder,
  onClose,
  onSuccess,
  onPopOut,
}) => {
  const [mode, setMode] = useState<'reply' | 'reply_all' | 'forward'>(initialMode);
  const [recipient, setRecipient] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [showSubjectEdit, setShowSubjectEdit] = useState(false);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [showQuotedText, setShowQuotedText] = useState(false);

  // Editor content
  const [replyHtml, setReplyHtml] = useState('');
  const [replyText, setReplyText] = useState('');

  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [checkingSpam, setCheckingSpam] = useState(false);
  const [spamResult, setSpamResult] = useState<SpamCheckResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Helper to parse comma-separated addresses
  const parseAddrs = (str?: string): string[] => {
    if (!str) return [];
    return str
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  };

  // Re-configure recipients and subject whenever mode or message changes
  useEffect(() => {
    const cleanSubj = message.subject || '';

    if (mode === 'reply') {
      setRecipient(message.sender);
      setCc('');
      setBcc('');
      setSubject(cleanSubj.toLowerCase().startsWith('re:') ? cleanSubj : `Re: ${cleanSubj}`);
      setShowCcBcc(false);
    } else if (mode === 'reply_all') {
      const myEmail = activeMailbox.toLowerCase();
      const senderEmail = message.sender.toLowerCase();
      const allAddrs = [...parseAddrs(message.recipient), ...parseAddrs(message.cc)];
      const uniqueCc = Array.from(
        new Set(
          allAddrs
            .map((a) => a.replace(/.*<([^>]+)>.*/, '$1').trim())
            .filter((a) => {
              const low = a.toLowerCase();
              return low && !low.includes(myEmail) && !senderEmail.includes(low);
            })
        )
      ).join(', ');

      setRecipient(message.sender);
      setCc(uniqueCc);
      setBcc('');
      setSubject(cleanSubj.toLowerCase().startsWith('re:') ? cleanSubj : `Re: ${cleanSubj}`);
      setShowCcBcc(Boolean(uniqueCc));
    } else if (mode === 'forward') {
      setRecipient('');
      setCc('');
      setBcc('');
      setSubject(cleanSubj.toLowerCase().startsWith('fwd:') ? cleanSubj : `Fwd: ${cleanSubj}`);
      setShowCcBcc(false);

      // In forward mode, pre-load original attachments
      if (message.attachments && message.attachments.length > 0) {
        Promise.all(
          message.attachments.map(async (att) => {
            try {
              const downloadUrl = api.getAttachmentDownloadUrl(message.id, att.index, currentFolder, activeMailbox);
              const res = await fetch(downloadUrl);
              const blob = await res.blob();
              return new File([blob], att.filename, { type: att.content_type || 'application/octet-stream' });
            } catch {
              return null;
            }
          })
        ).then((loaded) => {
          const valid = loaded.filter((f): f is File => f !== null);
          if (valid.length > 0) {
            setFiles(valid);
          }
        });
      }
    }
  }, [mode, message, activeMailbox, currentFolder]);

  // Smooth auto-scroll into view when opened
  useEffect(() => {
    containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
      setSpamResult(null);
    }
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setSpamResult(null);
  };

  const totalAttachmentSize = files.reduce((acc, f) => acc + f.size, 0);

  const handleCheckSpam = async () => {
    if (!subject && !replyText && !replyHtml) {
      setErrorMessage('Please type your message before checking spam score.');
      return;
    }
    setCheckingSpam(true);
    setErrorMessage(null);
    try {
      const attachNames = files.map((f) => f.name);
      const res = await api.checkSpamScore(subject, replyText, replyHtml, attachNames);
      setSpamResult(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to check spam score');
    } finally {
      setCheckingSpam(false);
    }
  };

  // Build full quoted body in Outlook / Gmail format
  const buildFinalPayloads = () => {
    const origBodyHtml = message.body_html || `<p>${escapeHtml(message.body_text || message.snippet || '')}</p>`;
    const origBodyText = message.body_text || message.snippet || '';

    let finalHtml = '';
    let finalText = '';

    if (mode === 'forward') {
      const forwardHeaderHtml = `
        <div style="border-top: 1px solid #E5E7EB; padding-top: 12px; margin-top: 20px; margin-bottom: 12px; color: #4B5563; font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <p style="margin: 0 0 6px 0; font-weight: 700; color: #111827;">---------- Forwarded message ---------</p>
          <p style="margin: 0 0 3px 0;"><strong>From:</strong> ${escapeHtml(message.sender)}</p>
          <p style="margin: 0 0 3px 0;"><strong>Date:</strong> ${escapeHtml(message.date)}</p>
          <p style="margin: 0 0 3px 0;"><strong>Subject:</strong> ${escapeHtml(message.subject)}</p>
          <p style="margin: 0 0 3px 0;"><strong>To:</strong> ${escapeHtml(message.recipient)}</p>
          ${message.cc ? `<p style="margin: 0 0 3px 0;"><strong>Cc:</strong> ${escapeHtml(message.cc)}</p>` : ''}
        </div>
        <div>${origBodyHtml}</div>
      `;
      finalHtml = `${replyHtml || '<p></p>'}${forwardHeaderHtml}`;
      finalText = `${replyText}\n\n---------- Forwarded message ---------\nFrom: ${message.sender}\nDate: ${message.date}\nSubject: ${message.subject}\nTo: ${message.recipient}\n\n${origBodyText}`;
    } else {
      // Outlook / Gmail formatted quoted reply
      const replyHeaderHtml = `
        <div class="gmail_quote" style="margin-top: 20px; padding-top: 14px; border-top: 1px solid #E5E7EB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="font-size: 12.5px; color: #4B5563; margin-bottom: 8px;">
            On ${escapeHtml(message.date)}, <strong>${escapeHtml(message.sender)}</strong> wrote:
          </div>
          <blockquote style="margin: 0 0 0 4px; border-left: 2px solid #CBD5E1; padding-left: 12px; color: #4B5563;">
            ${origBodyHtml}
          </blockquote>
        </div>
      `;
      finalHtml = `${replyHtml || '<p></p>'}${replyHeaderHtml}`;
      finalText = `${replyText}\n\nOn ${message.date}, ${message.sender} wrote:\n> ${origBodyText.replace(/\n/g, '\n> ')}`;
    }

    return { finalHtml, finalText };
  };

  const handleSend = async () => {
    if (!recipient.trim()) {
      setErrorMessage('Please enter at least one recipient email address.');
      return;
    }
    if (!subject.trim()) {
      setErrorMessage('Please provide an email subject.');
      return;
    }

    setSending(true);
    setErrorMessage(null);

    const { finalHtml, finalText } = buildFinalPayloads();

    try {
      if (files.length > 0) {
        const formData = new FormData();
        formData.append('recipient', recipient.trim());
        formData.append('subject', subject.trim());
        formData.append('body_text', finalText);
        formData.append('body_html', finalHtml);
        if (cc.trim()) formData.append('cc', cc.trim());
        if (bcc.trim()) formData.append('bcc', bcc.trim());
        if (activeMailbox) formData.append('mailbox', activeMailbox);

        files.forEach((f) => formData.append('files', f));
        await api.sendWebmail(formData);
      } else {
        await api.sendWebmailJson({
          recipient: recipient.trim(),
          subject: subject.trim(),
          body_text: finalText,
          body_html: finalHtml,
          cc: cc.trim() || undefined,
          bcc: bcc.trim() || undefined,
          mailbox: activeMailbox,
        });
      }

      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch email');
    } finally {
      setSending(false);
    }
  };

  // Keyboard shortcut: Ctrl+Enter / Cmd+Enter dispatches email
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePopOutClick = () => {
    const { finalHtml, finalText } = buildFinalPayloads();
    onPopOut({
      mode,
      recipient,
      cc,
      bcc,
      subject,
      bodyHtml: finalHtml,
      bodyText: finalText,
      files,
    });
  };

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      style={{
        margin: '12px 22px 18px',
        border: '1px solid #D1D5DB',
        borderRadius: '12px',
        backgroundColor: '#FFFFFF',
        boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'box-shadow 150ms ease, border-color 150ms ease',
      }}
    >
      {/* Top Header & Mode Switcher (Gmail / Outlook Style) */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid #E5E7EB',
          backgroundColor: '#F9FAFB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Mode Switcher Pill */}
          <div style={{ position: 'relative' }}>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
              style={{
                height: '30px',
                padding: '0 26px 0 30px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#111827',
                backgroundColor: '#FFFFFF',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                cursor: 'pointer',
                appearance: 'none',
              }}
            >
              <option value="reply">↩ Reply</option>
              <option value="reply_all">⇶ Reply All</option>
              <option value="forward">↪ Forward</option>
            </select>
            <div style={{ position: 'absolute', left: '8px', top: '7px', pointerEvents: 'none', color: '#4B5563' }}>
              {mode === 'reply' ? <Reply size={14} /> : mode === 'reply_all' ? <ReplyAll size={14} /> : <CornerUpRight size={14} />}
            </div>
            <ChevronDown size={13} style={{ position: 'absolute', right: '8px', top: '9px', pointerEvents: 'none', color: '#6B7280' }} />
          </div>

          {/* Recipient Display / Editable Input */}
          {mode === 'forward' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#4B5563' }}>To:</span>
              <input
                type="text"
                className="input-control"
                placeholder="colleague@domain.com, external@other.com"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                style={{ height: '30px', fontSize: '12px', width: '280px', backgroundColor: '#FFFFFF' }}
                autoFocus
              />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#374151' }}>
              <span style={{ fontWeight: 600, color: '#6B7280' }}>To:</span>
              <span style={{ fontWeight: 600, color: '#111827' }}>{recipient}</span>
            </div>
          )}

          {/* Cc / Bcc Toggle */}
          <button
            type="button"
            className="btn-ghost"
            style={{ fontSize: '11.5px', padding: '3px 8px', height: '26px' }}
            onClick={() => setShowCcBcc(!showCcBcc)}
          >
            {showCcBcc ? 'Hide Cc / Bcc' : 'Cc / Bcc'}
          </button>

          {/* Subject Toggle */}
          <button
            type="button"
            className="btn-ghost"
            style={{ fontSize: '11.5px', padding: '3px 8px', height: '26px' }}
            onClick={() => setShowSubjectEdit(!showSubjectEdit)}
            title="Edit Subject line"
          >
            {showSubjectEdit ? 'Hide Subject' : 'Edit Subject'}
          </button>
        </div>

        {/* Action Controls (Pop-out & Discard) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            className="btn-ghost"
            style={{ padding: '5px', height: '28px', width: '28px' }}
            onClick={handlePopOutClick}
            title="Pop out to floating compose window"
          >
            <Maximize2 size={14} color="#4B5563" />
          </button>
          <button
            type="button"
            className="btn-ghost"
            style={{ padding: '5px', height: '28px', width: '28px', color: '#C92A2A' }}
            onClick={onClose}
            title="Discard reply"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Expandable Cc & Bcc Inputs */}
      {showCcBcc && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '8px 14px', borderBottom: '1px solid #F1F3F5', backgroundColor: '#FAFAFA' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#4B5563', marginBottom: '3px' }}>
              Cc:
            </label>
            <input
              type="text"
              className="input-control"
              placeholder="cc@domain.com"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              style={{ height: '28px', fontSize: '12px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#4B5563', marginBottom: '3px' }}>
              Bcc:
            </label>
            <input
              type="text"
              className="input-control"
              placeholder="bcc@domain.com"
              value={bcc}
              onChange={(e) => setBcc(e.target.value)}
              style={{ height: '28px', fontSize: '12px' }}
            />
          </div>
        </div>
      )}

      {/* Expandable Subject Input */}
      {showSubjectEdit && (
        <div style={{ padding: '8px 14px', borderBottom: '1px solid #F1F3F5', backgroundColor: '#FAFAFA' }}>
          <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#4B5563', marginBottom: '3px' }}>
            Subject:
          </label>
          <input
            type="text"
            className="input-control"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={{ height: '28px', fontSize: '12px' }}
          />
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div
          style={{
            margin: '10px 14px 0',
            padding: '8px 12px',
            backgroundColor: '#FFF5F5',
            border: '1px solid #C92A2A',
            borderRadius: '6px',
            color: '#961C1C',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <AlertTriangle size={15} color="#C92A2A" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Rich Mail Editor Area */}
      <div style={{ padding: '12px 14px' }}>
        <LexicalMailEditor
          value={replyHtml || replyText}
          onChange={(html, text) => {
            setReplyHtml(html);
            setReplyText(text);
            setSpamResult(null);
          }}
          placeholder={`Reply to ${message.sender}... Use toolbar for styling or Ctrl+Enter to send.`}
          minHeight="160px"
        />
      </div>

      {/* Gmail-style Collapsible Trimmed Content Toggle ("...") */}
      <div style={{ padding: '0 14px 10px' }}>
        <button
          type="button"
          onClick={() => setShowQuotedText(!showQuotedText)}
          style={{
            background: 'none',
            border: '1px solid #E5E7EB',
            borderRadius: '4px',
            padding: '2px 8px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            color: '#6B7280',
            backgroundColor: '#F9FAFB',
          }}
          title={showQuotedText ? 'Hide quoted text' : 'Show quoted text'}
        >
          <MoreHorizontal size={13} />
          <span>{showQuotedText ? 'Hide quoted history' : '••• Show quoted history'}</span>
        </button>

        {showQuotedText && (
          <div
            style={{
              marginTop: '8px',
              padding: '10px 14px',
              borderLeft: '3px solid #CBD5E1',
              backgroundColor: '#F8F9FA',
              borderRadius: '0 6px 6px 0',
              fontSize: '12.5px',
              color: '#4B5563',
              maxHeight: '180px',
              overflowY: 'auto',
            }}
          >
            <div style={{ fontSize: '11.5px', color: '#6B7280', marginBottom: '6px' }}>
              <strong>From:</strong> {message.sender}<br />
              <strong>Date:</strong> {message.date}<br />
              <strong>Subject:</strong> {message.subject}
            </div>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {message.body_text || message.snippet}
            </div>
          </div>
        )}
      </div>

      {/* Attachments Section */}
      {files.length > 0 && (
        <div style={{ padding: '0 14px 10px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {files.map((file, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 8px',
                backgroundColor: '#F1F3F5',
                borderRadius: '6px',
                fontSize: '12px',
                border: '1px solid #E5E7EB',
              }}
            >
              <Paperclip size={12} color="#6B7280" />
              <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file.name}
              </span>
              <span style={{ fontSize: '10px', color: '#9CA3AF' }}>({formatBytes(file.size)})</span>
              <button
                type="button"
                onClick={() => removeFile(idx)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1px', display: 'flex' }}
              >
                <X size={12} color="#6B7280" />
              </button>
            </div>
          ))}
          <span style={{ fontSize: '11px', color: '#6B7280', alignSelf: 'center' }}>
            Total: {formatBytes(totalAttachmentSize)}
          </span>
        </div>
      )}

      {/* Live Spam Check Feedback */}
      {spamResult && (
        <div
          style={{
            margin: '0 14px 10px',
            padding: '10px 12px',
            borderRadius: '6px',
            backgroundColor: spamResult.verdict === 'clean' ? '#EBFBEE' : spamResult.verdict === 'warning' ? '#FFF9DB' : '#FFF5F5',
            border: `1px solid ${spamResult.verdict === 'clean' ? '#2B8A3E' : spamResult.verdict === 'warning' ? '#E67700' : '#C92A2A'}`,
            fontSize: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
            {spamResult.verdict === 'clean' ? (
              <ShieldCheck size={15} color="#1B5E20" />
            ) : spamResult.verdict === 'warning' ? (
              <AlertTriangle size={15} color="#A65D03" />
            ) : (
              <ShieldAlert size={15} color="#961C1C" />
            )}
            <span style={{ color: spamResult.verdict === 'clean' ? '#1B5E20' : spamResult.verdict === 'warning' ? '#A65D03' : '#961C1C' }}>
              Spam Score: {spamResult.score}/100 ({spamResult.risk_level.toUpperCase()})
            </span>
          </div>
          <p style={{ margin: '4px 0 0', color: '#374151' }}>{spamResult.recommendation}</p>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        type="file"
        multiple
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Bottom Action Footer (Send, Attach, Discard) */}
      <div
        style={{
          padding: '10px 14px',
          borderTop: '1px solid #E5E7EB',
          backgroundColor: '#FAFAFA',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Main Primary Send Button */}
          <button
            type="button"
            className="btn-primary"
            onClick={handleSend}
            disabled={sending}
            style={{ padding: '7px 18px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '7px', borderRadius: '8px' }}
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            <span>{sending ? 'Dispatching...' : 'Send'}</span>
          </button>

          {/* Attach Button */}
          <button
            type="button"
            className="btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            style={{ padding: '6px 12px', fontSize: '12px' }}
            title="Attach files"
          >
            <Paperclip size={14} />
            <span>Attach</span>
          </button>

          {/* Spam Check */}
          <button
            type="button"
            className="btn-secondary"
            onClick={handleCheckSpam}
            disabled={checkingSpam}
            style={{ padding: '6px 12px', fontSize: '12px' }}
            title="Check spam score before dispatch"
          >
            {checkingSpam ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} color="#E67700" />}
            <span>{checkingSpam ? 'Checking...' : 'Check Spam'}</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Ctrl + Enter to send</span>
          <button
            type="button"
            className="btn-ghost"
            onClick={onClose}
            style={{ padding: '6px', height: '28px', width: '28px', color: '#6B7280' }}
            title="Discard draft"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
export default InlineReplyBox;
