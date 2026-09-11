import React, { useState, useEffect, useCallback } from 'react';
import {
  HardDrive, Search, Trash2, Eye, Download, RefreshCw, AlertTriangle,
  FileText, Image as ImageIcon, Film, Archive, File, CheckSquare, Square,
  ShieldCheck, Loader2, ArrowUpDown, ChevronDown
} from 'lucide-react';
import type { StorageFileItem, StorageStats, MailboxAccountItem } from '../../../types';
import { api } from '../../../services/api';
import { FilePreviewModal } from './FilePreviewModal';

const formatBytes = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export const StorageView: React.FC = () => {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [files, setFiles] = useState<StorageFileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & State
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('date_desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Mailboxes for admin switching
  const [mailboxes, setMailboxes] = useState<MailboxAccountItem[]>([]);
  const [activeMailbox, setActiveMailbox] = useState<string>('');

  // Preview Modal
  const [previewFile, setPreviewFile] = useState<StorageFileItem | null>(null);

  // Bulk deletion loading
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<StorageFileItem | null>(null);

  // Load available mailboxes (if admin)
  useEffect(() => {
    const fetchMailboxes = async () => {
      try {
        const res = await api.getWebmailAccounts();
        if (res && res.length > 0) {
          setMailboxes(res);
          setActiveMailbox(res[0].email);
        }
      } catch {
        // Standard user token might not have mailboxes listing permission
      }
    };
    fetchMailboxes();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const mbParam = activeMailbox || undefined;
      const [statsRes, filesRes] = await Promise.all([
        api.getStorageStats(mbParam),
        api.getStorageFiles({
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
          search: searchQuery.trim() || undefined,
          sort_by: sortBy,
          mailbox: mbParam,
        }),
      ]);
      setStats(statsRes);
      setFiles(filesRes.files || []);
      setSelectedIds(new Set());
    } catch (err: any) {
      setError(err.message || 'Failed to load storage files');
    } finally {
      setLoading(false);
    }
  }, [activeMailbox, selectedCategory, searchQuery, sortBy]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Checkbox selection
  const toggleSelect = (id: string) => {
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

  const selectAll = () => {
    if (selectedIds.size === files.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(files.map((f) => f.id)));
    }
  };

  // Single file delete
  const handleDeleteSingle = async (file: StorageFileItem) => {
    setDeleting(true);
    try {
      await api.deleteStorageFile(file.id, activeMailbox || undefined);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete file');
    } finally {
      setDeleting(false);
      setFileToDelete(null);
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      await api.bulkDeleteStorageFiles(Array.from(selectedIds), activeMailbox || undefined);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete selected files');
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'images':
        return <ImageIcon size={16} color="#1D4ED8" />;
      case 'documents':
        return <FileText size={16} color="#DC2626" />;
      case 'media':
        return <Film size={16} color="#7C3AED" />;
      case 'archives':
        return <Archive size={16} color="#D97706" />;
      default:
        return <File size={16} color="#4B5563" />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
            Storage & Media Vault
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            Manage attachments, zero-copy shared files, and reclaim VPS disk space.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {mailboxes.length > 1 && (
            <div style={{ position: 'relative' }}>
              <select
                value={activeMailbox}
                onChange={(e) => setActiveMailbox(e.target.value)}
                style={{
                  fontSize: '13px',
                  height: '34px',
                  padding: '0 28px 0 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: '#FFFFFF',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  appearance: 'none',
                }}
              >
                {mailboxes.map((mb) => (
                  <option key={mb.email} value={mb.email}>
                    {mb.email}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '10px', pointerEvents: 'none', color: '#6B7280' }} />
            </div>
          )}

          <button
            type="button"
            className="btn-secondary"
            onClick={fetchData}
            disabled={loading || deleting}
            style={{ fontSize: '13px', padding: '6px 12px' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Storage Quota & Breakdown Card */}
      {stats && (
        <div className="card-standard" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--status-info-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <HardDrive size={20} color="#1D4ED8" />
              </div>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Storage Quota Used</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {formatBytes(stats.total_bytes_used)}{' '}
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>
                    / {formatBytes(stats.quota_bytes)} ({stats.percent_used}%)
                  </span>
                </div>
              </div>
            </div>

            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
              <strong>{stats.total_files}</strong> total files stored
            </div>
          </div>

          {/* Progress Bar */}
          <div
            style={{
              height: '8px',
              backgroundColor: '#E5E7EB',
              borderRadius: '4px',
              overflow: 'hidden',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, Math.max(1, stats.percent_used))}%`,
                backgroundColor: stats.percent_used > 85 ? '#DC2626' : stats.percent_used > 60 ? '#D97706' : '#1D4ED8',
                transition: 'width 300ms ease',
              }}
            />
          </div>

          {/* Category Breakdown Badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: '#EFF6FF',
                border: '1px solid #BFDBFE',
                fontSize: '12px',
                color: '#1E40AF',
              }}
            >
              <ImageIcon size={13} />
              <span>Images: <strong>{formatBytes(stats.breakdown.images.bytes)}</strong> ({stats.breakdown.images.count})</span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                fontSize: '12px',
                color: '#991B1B',
              }}
            >
              <FileText size={13} />
              <span>Documents: <strong>{formatBytes(stats.breakdown.documents.bytes)}</strong> ({stats.breakdown.documents.count})</span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: '#F5F3FF',
                border: '1px solid #DDD6FE',
                fontSize: '12px',
                color: '#5B21B6',
              }}
            >
              <Film size={13} />
              <span>Media: <strong>{formatBytes(stats.breakdown.media.bytes)}</strong> ({stats.breakdown.media.count})</span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: '#FFFBEB',
                border: '1px solid #FDE68A',
                fontSize: '12px',
                color: '#92400E',
              }}
            >
              <Archive size={13} />
              <span>Archives: <strong>{formatBytes(stats.breakdown.archives.bytes)}</strong> ({stats.breakdown.archives.count})</span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: '#F3F4F6',
                border: '1px solid #E5E7EB',
                fontSize: '12px',
                color: '#374151',
              }}
            >
              <File size={13} />
              <span>Others: <strong>{formatBytes(stats.breakdown.others.bytes)}</strong> ({stats.breakdown.others.count})</span>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div
        className="card-standard"
        style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* Category Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflowX: 'auto', paddingBottom: '2px' }}>
          {[
            { id: 'all', label: 'All Files' },
            { id: 'images', label: 'Images' },
            { id: 'documents', label: 'Documents' },
            { id: 'media', label: 'Media' },
            { id: 'archives', label: 'Archives' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: selectedCategory === cat.id ? 600 : 500,
                border: 'none',
                backgroundColor: selectedCategory === cat.id ? '#111827' : 'transparent',
                color: selectedCategory === cat.id ? '#FFFFFF' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search & Sort */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#9CA3AF' }} />
            <input
              type="text"
              placeholder="Search filename or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                height: '32px',
                paddingLeft: '32px',
                paddingRight: '10px',
                fontSize: '12.5px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                backgroundColor: '#FFFFFF',
              }}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                fontSize: '12.5px',
                height: '32px',
                padding: '0 24px 0 8px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                backgroundColor: '#FFFFFF',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                appearance: 'none',
              }}
            >
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="size_desc">Largest First</option>
              <option value="size_asc">Smallest First</option>
              <option value="name_asc">Name (A-Z)</option>
            </select>
            <ArrowUpDown size={12} style={{ position: 'absolute', right: '8px', top: '10px', pointerEvents: 'none', color: '#9CA3AF' }} />
          </div>
        </div>
      </div>

      {/* Bulk Action Banner */}
      {selectedIds.size > 0 && (
        <div
          style={{
            padding: '10px 16px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#991B1B' }}>
            {selectedIds.size} {selectedIds.size === 1 ? 'file' : 'files'} selected
          </div>
          <button
            type="button"
            className="btn-primary"
            style={{
              backgroundColor: '#DC2626',
              borderColor: '#DC2626',
              fontSize: '12px',
              padding: '5px 12px',
            }}
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={deleting}
          >
            <Trash2 size={13} />
            <span>Delete Selected</span>
          </button>
        </div>
      )}

      {/* Files Table */}
      <div className="card-standard" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 10px', color: '#1D4ED8' }} />
            <div style={{ fontSize: '13px' }}>Loading files...</div>
          </div>
        ) : error ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: '#DC2626', fontSize: '13px' }}>
            <AlertTriangle size={24} style={{ margin: '0 auto 8px' }} />
            <div>{error}</div>
          </div>
        ) : files.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <HardDrive size={40} strokeWidth={1.5} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>No Files Found</div>
            <p style={{ fontSize: '13px', margin: '4px 0 0' }}>
              {searchQuery ? 'No files match your search query.' : 'Attachments uploaded or received will appear in this vault.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-subtle)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '10px 14px', width: '36px' }}>
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ padding: '2px', height: '20px', width: '20px' }}
                      onClick={selectAll}
                      title="Select all"
                    >
                      {selectedIds.size === files.length && files.length > 0 ? (
                        <CheckSquare size={15} color="#111827" />
                      ) : selectedIds.size > 0 ? (
                        <CheckSquare size={15} color="#4B5563" />
                      ) : (
                        <Square size={15} color="#9CA3AF" />
                      )}
                    </button>
                  </th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>File Name</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Size</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Subject / Email</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Access & Permissions</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Date</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => {
                  const isChecked = selectedIds.has(file.id);
                  const downloadUrl = api.getStorageDownloadUrl(file.id, activeMailbox || undefined);

                  return (
                    <tr
                      key={file.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        backgroundColor: isChecked ? '#F9FAFB' : '#FFFFFF',
                        transition: 'background-color 100ms ease',
                      }}
                    >
                      <td style={{ padding: '12px 14px' }}>
                        <div
                          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          onClick={() => toggleSelect(file.id)}
                        >
                          {isChecked ? (
                            <CheckSquare size={15} color="#111827" />
                          ) : (
                            <Square size={15} color="#D1D5DB" />
                          )}
                        </div>
                      </td>

                      {/* File Name & Icon */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', maxWidth: '300px' }}>
                          <div
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '6px',
                              backgroundColor: 'var(--surface-subtle)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {getCategoryIcon(file.category)}
                          </div>
                          <div style={{ overflow: 'hidden' }}>
                            <div
                              style={{
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                cursor: 'pointer',
                              }}
                              title={file.filename}
                              onClick={() => setPreviewFile(file)}
                            >
                              {file.filename}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {file.content_type}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Size */}
                      <td style={{ padding: '12px 14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                        {formatBytes(file.filesize)}
                      </td>

                      {/* Subject */}
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', maxWidth: '200px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file.subject || '-'}>
                          {file.subject || '-'}
                        </div>
                      </td>

                      {/* Access / Shared badge */}
                      <td style={{ padding: '12px 14px' }}>
                        {file.is_shared && file.shared_with.length > 0 ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              backgroundColor: '#EFF6FF',
                              border: '1px solid #BFDBFE',
                              color: '#1D4ED8',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                            title={`Shared with: ${file.shared_with.join(', ')}`}
                          >
                            <ShieldCheck size={12} />
                            <span>Shared ({file.shared_with.length})</span>
                          </span>
                        ) : (
                          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                            Private
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: '12px' }}>
                        {file.created_at ? new Date(file.created_at).toLocaleDateString() : '-'}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ padding: '4px', height: '28px', width: '28px' }}
                            onClick={() => setPreviewFile(file)}
                            title="Preview file"
                          >
                            <Eye size={14} color="#111827" />
                          </button>

                          <a
                            href={downloadUrl}
                            download={file.filename}
                            className="btn-ghost"
                            style={{ padding: '4px', height: '28px', width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Download file"
                          >
                            <Download size={14} color="#111827" />
                          </a>

                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ padding: '4px', height: '28px', width: '28px', color: '#DC2626' }}
                            onClick={() => setFileToDelete(file)}
                            title="Delete file to free space"
                          >
                            <Trash2 size={14} color="#DC2626" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* File Preview Modal */}
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          mailbox={activeMailbox || undefined}
          onClose={() => setPreviewFile(null)}
          onDelete={(f) => handleDeleteSingle(f)}
        />
      )}

      {/* Delete Single Confirmation Modal */}
      {fileToDelete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={() => setFileToDelete(null)}
        >
          <div
            className="card-standard"
            style={{ width: '100%', maxWidth: '440px', padding: '24px', borderRadius: '12px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', color: '#DC2626' }}>
              <AlertTriangle size={22} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#111827' }}>
                Reclaim Disk Storage?
              </h3>
            </div>
            <p style={{ fontSize: '13px', color: '#4B5563', lineHeight: 1.5, margin: '0 0 20px' }}>
              Are you sure you want to permanently delete <strong>{fileToDelete.filename}</strong>? 
              This will immediately remove the file from VPS disk storage and free up <strong>{formatBytes(fileToDelete.filesize)}</strong>.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setFileToDelete(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ backgroundColor: '#DC2626', borderColor: '#DC2626' }}
                onClick={() => handleDeleteSingle(fileToDelete)}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete & Free Space'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={() => setDeleteConfirmOpen(false)}
        >
          <div
            className="card-standard"
            style={{ width: '100%', maxWidth: '440px', padding: '24px', borderRadius: '12px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', color: '#DC2626' }}>
              <AlertTriangle size={22} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#111827' }}>
                Bulk Delete {selectedIds.size} Files?
              </h3>
            </div>
            <p style={{ fontSize: '13px', color: '#4B5563', lineHeight: 1.5, margin: '0 0 20px' }}>
              Are you sure you want to permanently remove these {selectedIds.size} files? 
              They will be unlinked from the server disk immediately to reclaim quota.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ backgroundColor: '#DC2626', borderColor: '#DC2626' }}
                onClick={handleBulkDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : `Delete ${selectedIds.size} Files`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default StorageView;
