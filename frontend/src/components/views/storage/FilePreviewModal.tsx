import React, { useState, useEffect } from 'react';
import {
  X, Download, Trash2, AlertTriangle, FileText, Image as ImageIcon,
  Film, File, Eye, Copy, Check, ShieldCheck
} from 'lucide-react';
import type { StorageFileItem } from '../../../types';
import { api } from '../../../services/api';

interface FilePreviewModalProps {
  file: StorageFileItem | null;
  mailbox?: string;
  onClose: () => void;
  onDelete?: (file: StorageFileItem) => void;
}

const MAX_PREVIEW_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const formatBytes = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  file,
  mailbox,
  onClose,
  onDelete,
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedSha, setCopiedSha] = useState(false);

  useEffect(() => {
    if (!file) {
      setBlobUrl(null);
      setTextContent(null);
      return;
    }

    // If file > 10MB, do not fetch for inline preview
    if (file.filesize > MAX_PREVIEW_SIZE_BYTES) {
      return;
    }

    let isMounted = true;
    const fetchBlob = async () => {
      setLoading(true);
      setError(null);
      try {
        const previewUrl = api.getStoragePreviewUrl(file.id, mailbox);
        const token = api.getToken();
        const res = await fetch(previewUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!res.ok) {
          throw new Error(`Failed to load file preview (${res.status} ${res.statusText})`);
        }

        const isText =
          file.content_type.startsWith('text/') ||
          file.content_type === 'application/json' ||
          file.filename.endsWith('.csv') ||
          file.filename.endsWith('.log') ||
          file.filename.endsWith('.sql');

        if (isText) {
          const text = await res.text();
          if (isMounted) setTextContent(text.slice(0, 100000)); // Cap at 100k chars
        } else {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          if (isMounted) setBlobUrl(url);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Unable to preview file.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchBlob();

    return () => {
      isMounted = false;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [file, mailbox]);

  if (!file) return null;

  const isOversized = file.filesize > MAX_PREVIEW_SIZE_BYTES;
  const isImage = file.content_type.startsWith('image/');
  const isPdf = file.content_type === 'application/pdf';
  const isVideo = file.content_type.startsWith('video/');
  const isAudio = file.content_type.startsWith('audio/');

  const downloadUrl = api.getStorageDownloadUrl(file.id, mailbox);

  const copySha = () => {
    if (file.sha256) {
      navigator.clipboard.writeText(file.sha256);
      setCopiedSha(true);
      setTimeout(() => setCopiedSha(false), 2000);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '24px',
      }}
      onClick={onClose}
    >
      <div
        className="card-standard"
        style={{
          width: '100%',
          maxWidth: isPdf ? '900px' : isImage ? '800px' : '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '16px',
          overflow: 'hidden',
          backgroundColor: '#FFFFFF',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#F9FAFB',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: '#EFF6FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {isImage ? (
                <ImageIcon size={18} color="#1D4ED8" />
              ) : isPdf ? (
                <FileText size={18} color="#DC2626" />
              ) : isVideo || isAudio ? (
                <Film size={18} color="#7C3AED" />
              ) : (
                <File size={18} color="#4B5563" />
              )}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <h3
                style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#111827',
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={file.filename}
              >
                {file.filename}
              </h3>
              <div style={{ fontSize: '11.5px', color: '#6B7280', display: 'flex', gap: '8px', marginTop: '2px' }}>
                <span>{formatBytes(file.filesize)}</span>
                <span>•</span>
                <span>{file.content_type}</span>
                {file.is_shared && (
                  <>
                    <span>•</span>
                    <span style={{ color: '#1D4ED8', fontWeight: 600 }}>Zero-Copy Shared</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <a
              href={downloadUrl}
              download={file.filename}
              className="btn-primary"
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              <Download size={13} />
              <span>Download</span>
            </a>

            {onDelete && (
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '6px 10px', fontSize: '12px', color: '#DC2626', borderColor: '#FCA5A5' }}
                onClick={() => {
                  if (confirm(`Permanently delete "${file.filename}" to reclaim ${formatBytes(file.filesize)} of VPS disk storage?`)) {
                    onDelete(file);
                    onClose();
                  }
                }}
                title="Delete to reclaim space"
              >
                <Trash2 size={13} />
              </button>
            )}

            <button
              type="button"
              className="btn-ghost"
              style={{ padding: '6px', height: '28px', width: '28px' }}
              onClick={onClose}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Modal Body / Preview Pane */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '340px',
            backgroundColor: '#F3F4F6',
          }}
        >
          {isOversized ? (
            /* Over 10MB Barrier Notice */
            <div
              style={{
                maxWidth: '480px',
                textAlign: 'center',
                padding: '32px 24px',
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E5E7EB',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: '#FEF3C7',
                  color: '#D97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <AlertTriangle size={28} />
              </div>
              <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>
                Preview Exceeds 10 MB Limit
              </h4>
              <p style={{ fontSize: '13px', color: '#6B7280', lineHeight: 1.5, margin: '0 0 20px' }}>
                This file is <strong>{formatBytes(file.filesize)}</strong>. Direct inline rendering is restricted to 
                files under 10 MB to protect browser performance and memory. You can download the file to inspect it locally.
              </p>
              <a
                href={downloadUrl}
                download={file.filename}
                className="btn-primary"
                style={{ padding: '9px 24px', fontSize: '13.5px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <Download size={15} />
                <span>Download Full File ({formatBytes(file.filesize)})</span>
              </a>
            </div>
          ) : loading ? (
            <div style={{ textAlign: 'center', color: '#6B7280', fontSize: '13px' }}>
              <div className="animate-spin" style={{ display: 'inline-block', marginBottom: '8px' }}>
                <Eye size={24} color="#1D4ED8" />
              </div>
              <div>Generating secure preview...</div>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#DC2626' }}>
              <AlertTriangle size={24} style={{ marginBottom: '8px' }} />
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{error}</div>
            </div>
          ) : isImage && blobUrl ? (
            <div style={{ textAlign: 'center', maxWidth: '100%' }}>
              <img
                src={blobUrl}
                alt={file.filename}
                style={{
                  maxWidth: '100%',
                  maxHeight: '65vh',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  objectFit: 'contain',
                }}
              />
            </div>
          ) : isPdf && blobUrl ? (
            <iframe
              src={blobUrl}
              title={file.filename}
              style={{
                width: '100%',
                height: '65vh',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: '#FFFFFF',
              }}
            />
          ) : isVideo && blobUrl ? (
            <video
              src={blobUrl}
              controls
              style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: '8px' }}
            />
          ) : isAudio && blobUrl ? (
            <audio src={blobUrl} controls style={{ width: '100%', maxWidth: '400px' }} />
          ) : textContent !== null ? (
            <div
              style={{
                width: '100%',
                height: '60vh',
                backgroundColor: '#FFFFFF',
                borderRadius: '8px',
                border: '1px solid #E5E7EB',
                padding: '16px',
                overflowY: 'auto',
                fontFamily: 'monospace',
                fontSize: '12px',
                lineHeight: 1.5,
                color: '#1F2937',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {textContent}
            </div>
          ) : (
            /* Fallback generic document card */
            <div
              style={{
                textAlign: 'center',
                padding: '36px 20px',
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E5E7EB',
                maxWidth: '420px',
              }}
            >
              <FileText size={48} color="#4B5563" style={{ opacity: 0.5, marginBottom: '12px' }} />
              <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#111827', margin: '0 0 6px' }}>
                {file.filename}
              </h4>
              <p style={{ fontSize: '12.5px', color: '#6B7280', margin: '0 0 16px' }}>
                Inline preview not available for this MIME type. Download the file to view it with your local applications.
              </p>
              <a
                href={downloadUrl}
                download={file.filename}
                className="btn-primary"
                style={{ padding: '8px 20px', fontSize: '13px' }}
              >
                <Download size={14} />
                <span>Download File</span>
              </a>
            </div>
          )}
        </div>

        {/* Modal Footer (Metadata & Sharing details) */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #E5E7EB',
            backgroundColor: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: '#6B7280',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {file.subject && (
              <span>
                <strong>Email:</strong> {file.subject}
              </span>
            )}
            {file.shared_with && file.shared_with.length > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#1D4ED8' }}>
                <ShieldCheck size={14} />
                <span>Shared with {file.shared_with.join(', ')}</span>
              </span>
            )}
          </div>

          {file.sha256 && (
            <button
              type="button"
              className="btn-ghost"
              onClick={copySha}
              style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 6px' }}
              title="Click to copy SHA-256 integrity hash"
            >
              {copiedSha ? <Check size={12} color="#059669" /> : <Copy size={12} />}
              <span>SHA-256: {file.sha256.substring(0, 12)}...</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
