import React, { useState, useRef, useEffect } from 'react';
import {
  Send, Paperclip, X, ShieldCheck, AlertTriangle, ShieldAlert, Sparkles, Loader2, Save
} from 'lucide-react';
import { Modal } from '../../common/Modal';
import { LexicalMailEditor } from '../../common/LexicalMailEditor';
import { api } from '../../../services/api';
import type { SpamCheckResult } from '../../../types';

interface ComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  activeMailbox: string;
  initialRecipient?: string;
  initialSubject?: string;
  initialBodyHtml?: string;
  initialBodyText?: string;
  draftId?: string;
}

export const ComposerModal: React.FC<ComposerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  activeMailbox,
  initialRecipient = '',
  initialSubject = '',
  initialBodyHtml = '',
  initialBodyText = '',
  draftId,
}) => {
  const [recipient, setRecipient] = useState(initialRecipient);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState(initialSubject);
  const [bodyHtml, setBodyHtml] = useState(initialBodyHtml);
  const [bodyText, setBodyText] = useState(initialBodyText);
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [checkingSpam, setCheckingSpam] = useState(false);
  const [spamResult, setSpamResult] = useState<SpamCheckResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize initial values whenever modal opens or props change
  useEffect(() => {
    if (isOpen) {
      setRecipient(initialRecipient);
      setSubject(initialSubject);
      setBodyHtml(initialBodyHtml);
      setBodyText(initialBodyText);
      setCc('');
      setBcc('');
      setFiles([]);
      setErrorMessage(null);
      setSpamResult(null);
      setShowCcBcc(false);
    }
  }, [isOpen, initialRecipient, initialSubject, initialBodyHtml, initialBodyText]);

  const resetForm = () => {
    setRecipient('');
    setSubject('');
    setBodyHtml('');
    setBodyText('');
    setCc('');
    setBcc('');
    setFiles([]);
    setErrorMessage(null);
    setSpamResult(null);
    setShowCcBcc(false);
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

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
    if (!subject && !bodyText && !bodyHtml) {
      setErrorMessage('Please write subject or body before checking spam score.');
      return;
    }
    setCheckingSpam(true);
    setErrorMessage(null);
    try {
      const attachNames = files.map((f) => f.name);
      const res = await api.checkSpamScore(subject, bodyText, bodyHtml, attachNames);
      setSpamResult(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to check spam score');
    } finally {
      setCheckingSpam(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!subject && !bodyText && !bodyHtml && !recipient) {
      setErrorMessage('Cannot save an empty draft.');
      return;
    }

    setSavingDraft(true);
    setErrorMessage(null);
    try {
      await api.saveDraft({
        recipient: recipient.trim(),
        subject: subject.trim() || '(Draft)',
        body_text: bodyText,
        body_html: bodyHtml,
        cc: cc.trim() || undefined,
        bcc: bcc.trim() || undefined,
        mailbox: activeMailbox,
        draft_id: draftId,
      });

      resetForm();
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save draft');
    } finally {
      setSavingDraft(false);
    }
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

    try {
      if (files.length > 0) {
        // Send via multipart FormData
        const formData = new FormData();
        formData.append('recipient', recipient.trim());
        formData.append('subject', subject.trim());
        formData.append('body_text', bodyText);
        if (bodyHtml) formData.append('body_html', bodyHtml);
        if (cc.trim()) formData.append('cc', cc.trim());
        if (bcc.trim()) formData.append('bcc', bcc.trim());
        if (activeMailbox) formData.append('mailbox', activeMailbox);
        if (draftId) formData.append('draft_id', draftId);

        files.forEach((file) => {
          formData.append('files', file);
        });

        await api.sendWebmail(formData);
      } else {
        // Send via JSON endpoint
        await api.sendWebmailJson({
          recipient: recipient.trim(),
          subject: subject.trim(),
          body_text: bodyText,
          body_html: bodyHtml,
          cc: cc.trim() || undefined,
          bcc: bcc.trim() || undefined,
          mailbox: activeMailbox,
          draft_id: draftId,
        });
      }

      // Reset form completely so no lingering draft remains!
      resetForm();
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch email');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={draftId ? "Edit Draft Message" : "Compose Message"} maxWidth="780px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Sender Info Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            backgroundColor: '#F8F9FA',
            borderRadius: '8px',
            border: '1px solid #E5E7EB',
            fontSize: '12px',
          }}
        >
          <div>
            From: <strong style={{ color: '#111827' }}>{activeMailbox}</strong>
            {draftId && (
              <span style={{ marginLeft: '8px', padding: '2px 6px', backgroundColor: '#FFF9DB', border: '1px solid #E67700', borderRadius: '4px', color: '#A65D03', fontSize: '11px', fontWeight: 600 }}>
                Draft
              </span>
            )}
          </div>
          <button
            type="button"
            className="btn-ghost"
            style={{ fontSize: '11px', padding: '2px 6px', height: '22px' }}
            onClick={() => setShowCcBcc(!showCcBcc)}
          >
            {showCcBcc ? 'Hide Cc / Bcc' : 'Add Cc / Bcc'}
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#FFF5F5',
              border: '1px solid #C92A2A',
              borderRadius: '8px',
              color: '#961C1C',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertTriangle size={16} color="#C92A2A" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Recipient Field */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
            Recipient (To)
          </label>
          <input
            type="email"
            className="input-control"
            placeholder="colleague@domain.com"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            required
          />
        </div>

        {/* Cc & Bcc Fields */}
        {showCcBcc && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                Cc
              </label>
              <input
                type="text"
                className="input-control"
                placeholder="cc@domain.com"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                Bcc
              </label>
              <input
                type="text"
                className="input-control"
                placeholder="bcc@domain.com"
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Subject */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
            Subject
          </label>
          <input
            type="text"
            className="input-control"
            placeholder="Email subject line"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />
        </div>

        {/* Lexical Rich Email Designer */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
              Message Design (Lexical Editor)
            </label>
            <span style={{ fontSize: '11px', color: '#6B7280' }}>
              Rich HTML typography & custom templates
            </span>
          </div>
          <LexicalMailEditor
            value={bodyHtml || bodyText}
            onChange={(html, text) => {
              setBodyHtml(html);
              setBodyText(text);
              setSpamResult(null);
            }}
            placeholder="Compose your email message with rich styling, headings, or templates..."
            minHeight="220px"
          />
        </div>

        {/* Attachments Section */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
              Attachments ({files.length})
            </span>
            {files.length > 0 && (
              <span style={{ fontSize: '11px', color: '#6B7280' }}>
                Total: {formatBytes(totalAttachmentSize)} / 25 MB
              </span>
            )}
          </div>

          <input
            type="file"
            multiple
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {files.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
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
            </div>
          )}

          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '12px' }}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip size={14} />
            <span>Attach Files</span>
          </button>
        </div>

        {/* Live Spam Check Feedback */}
        {spamResult && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: spamResult.verdict === 'clean' ? '#EBFBEE' : spamResult.verdict === 'warning' ? '#FFF9DB' : '#FFF5F5',
              border: `1px solid ${spamResult.verdict === 'clean' ? '#2B8A3E' : spamResult.verdict === 'warning' ? '#E67700' : '#C92A2A'}`,
              fontSize: '12.5px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                {spamResult.verdict === 'clean' ? (
                  <ShieldCheck size={16} color="#1B5E20" />
                ) : spamResult.verdict === 'warning' ? (
                  <AlertTriangle size={16} color="#A65D03" />
                ) : (
                  <ShieldAlert size={16} color="#961C1C" />
                )}
                <span style={{ color: spamResult.verdict === 'clean' ? '#1B5E20' : spamResult.verdict === 'warning' ? '#A65D03' : '#961C1C' }}>
                  Spam Risk: {spamResult.score}/100 ({spamResult.risk_level.toUpperCase()})
                </span>
              </div>
              <span style={{ fontSize: '11px', color: '#4B5563' }}>{spamResult.verdict.toUpperCase()}</span>
            </div>
            <p style={{ margin: '0 0 6px', color: '#374151' }}>{spamResult.recommendation}</p>

            {spamResult.triggers.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '6px', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '6px' }}>
                {spamResult.triggers.map((t, idx) => (
                  <div key={idx} style={{ fontSize: '11px', color: '#4B5563' }}>
                    • {t.description} (+{t.points} pts)
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '10px',
            borderTop: '1px solid #E5E7EB',
            paddingTop: '14px',
          }}
        >
          <button
            type="button"
            className="btn-secondary"
            style={{ fontSize: '12px' }}
            onClick={handleCheckSpam}
            disabled={checkingSpam}
          >
            {checkingSpam ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} color="#E67700" />}
            <span>{checkingSpam ? 'Checking...' : 'Check Spam Score'}</span>
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleSaveDraft}
              disabled={savingDraft || sending}
              title="Save current message to Drafts"
            >
              {savingDraft ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              <span>{savingDraft ? 'Saving...' : 'Save Draft'}</span>
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                resetForm();
                onClose();
              }}
              disabled={sending || savingDraft}
            >
              Discard
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSend}
              disabled={sending || savingDraft}
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              <span>{sending ? 'Dispatching...' : 'Send Message'}</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
export default ComposerModal;
