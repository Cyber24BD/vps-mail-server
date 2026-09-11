import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Shield,
  ShieldCheck,
  HardDrive,
  Key,
  BarChart3,
  Edit3,
  Search,
  RefreshCw,
  Download,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  Mail,
  Calendar,
  Eye,
  EyeOff,
  Database,
  Sparkles,
} from 'lucide-react';
import { api } from '../../services/api';
import { StatusBadge } from '../common/StatusBadge';
import { SkeletonCard } from '../common/SkeletonCard';
import { Modal } from '../common/Modal';
import { MetricCard } from '../common/MetricCard';
import type { Mailbox, Domain, MailboxStorageBreakdown } from '../../types';

export const MailboxesView: React.FC = () => {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [quotaFilter, setQuotaFilter] = useState<'all' | 'normal' | 'warning' | 'critical'>('all');
  const [sortBy, setSortBy] = useState<'quota_desc' | 'used_desc' | 'name_asc' | 'messages_desc' | 'created_desc'>('quota_desc');

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedMailbox, setSelectedMailbox] = useState<Mailbox | null>(null);
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isBreakdownModalOpen, setIsBreakdownModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Create Form states
  const [newDomainId, setNewDomainId] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [newDept, setNewDept] = useState('General');
  const [newQuotaMb, setNewQuotaMb] = useState(5120);
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Quota Modal states
  const [targetQuotaMb, setTargetQuotaMb] = useState(5120);
  const [savingQuota, setSavingQuota] = useState(false);

  // Password Modal states
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [copiedReset, setCopiedReset] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Breakdown Modal states
  const [breakdownData, setBreakdownData] = useState<MailboxStorageBreakdown | null>(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [recalculatingSingle, setRecalculatingSingle] = useState(false);

  // Edit Modal states
  const [editFullName, setEditFullName] = useState('');
  const [editDept, setEditDept] = useState('General');
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [editAutoReplyEnabled, setEditAutoReplyEnabled] = useState(false);
  const [editAutoReplySubject, setEditAutoReplySubject] = useState('');
  const [editAutoReplyBody, setEditAutoReplyBody] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete state
  const [deleting, setDeleting] = useState(false);

  // Copy email feedback
  const [copiedEmailId, setCopiedEmailId] = useState<string | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const loadData = async () => {
    try {
      const [mbs, doms] = await Promise.all([
        api.listMailboxes(),
        api.listDomains(),
      ]);
      setMailboxes(mbs);
      setDomains(doms);
      if (doms.length > 0 && !newDomainId) {
        setNewDomainId(doms[0].id);
      }
    } catch (err) {
      console.error('Failed to load mailboxes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Strong password generator
  const generateStrongPassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
    let pwd = '';
    const cryptoObj = window.crypto || (window as any).msCrypto;
    const values = new Uint32Array(16);
    cryptoObj.getRandomValues(values);
    for (let i = 0; i < 16; i++) {
      pwd += chars[values[i] % chars.length];
    }
    return pwd;
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  // Recalculate all storage
  const handleRecalculateAll = async () => {
    setRefreshingAll(true);
    try {
      await api.recalculateAllMailboxesUsage();
      await loadData();
      showToast('Disk usage successfully synced for all mailboxes.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to recalculate storage', 'error');
    } finally {
      setRefreshingAll(false);
    }
  };

  // Toggle mailbox active / suspended
  const handleToggleStatus = async (mb: Mailbox) => {
    const nextStatus = !mb.is_active;
    try {
      setMailboxes((prev) =>
        prev.map((m) => (m.id === mb.id ? { ...m, is_active: nextStatus } : m))
      );
      await api.updateMailbox(mb.id, { is_active: nextStatus });
      showToast(`Mailbox ${mb.email} is now ${nextStatus ? 'Active' : 'Suspended'}.`);
    } catch (err: any) {
      showToast(err.message || 'Failed to update mailbox status', 'error');
      loadData();
    }
  };

  // Copy email to clipboard
  const handleCopyEmail = (id: string, email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmailId(id);
    setTimeout(() => setCopiedEmailId(null), 2000);
  };

  // CSV Report Export
  const handleExportCsv = () => {
    if (filteredMailboxes.length === 0) {
      showToast('No mailboxes to export', 'info');
      return;
    }
    const headers = [
      'Email',
      'Full Name',
      'Department',
      'Status',
      'Role',
      'Quota (MB)',
      'Storage Used (MB)',
      'Usage %',
      'Messages Count',
      'Auto-Reply',
      'Created At',
    ];
    const rows = filteredMailboxes.map((mb) => {
      const qMb = Math.round(mb.quota_bytes / (1024 * 1024));
      const uMb = Math.round(mb.bytes_used / (1024 * 1024));
      const pct = qMb > 0 ? Math.round((uMb / qMb) * 100) : 0;
      return [
        mb.email,
        `"${mb.full_name.replace(/"/g, '""')}"`,
        mb.department || 'General',
        mb.is_active ? 'Active' : 'Suspended',
        mb.is_admin ? 'Admin' : 'User',
        qMb,
        uMb,
        `${pct}%`,
        mb.messages_used,
        mb.auto_reply_enabled ? 'Enabled' : 'Disabled',
        mb.created_at,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `mailboxes_quota_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Mailbox report exported as CSV.', 'success');
  };

  // Open Quota Modal
  const openQuotaModal = (mb: Mailbox) => {
    setSelectedMailbox(mb);
    setTargetQuotaMb(Math.round(mb.quota_bytes / (1024 * 1024)));
    setIsQuotaModalOpen(true);
  };

  const handleSaveQuota = async () => {
    if (!selectedMailbox) return;
    setSavingQuota(true);
    try {
      await api.updateMailbox(selectedMailbox.id, { quota_mb: Number(targetQuotaMb) });
      setIsQuotaModalOpen(false);
      showToast(`Storage quota for ${selectedMailbox.email} set to ${targetQuotaMb >= 1024 ? `${targetQuotaMb / 1024} GB` : `${targetQuotaMb} MB`}.`);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update quota', 'error');
    } finally {
      setSavingQuota(false);
    }
  };

  // Open Password Reset Modal
  const openPasswordModal = (mb: Mailbox) => {
    setSelectedMailbox(mb);
    const generated = generateStrongPassword();
    setResetPasswordVal(generated);
    setShowResetPassword(true);
    setCopiedReset(false);
    setIsPasswordModalOpen(true);
  };

  const handleSavePassword = async () => {
    if (!selectedMailbox || !resetPasswordVal.trim()) return;
    setSavingPassword(true);
    try {
      await api.updateMailbox(selectedMailbox.id, { password: resetPasswordVal });
      setIsPasswordModalOpen(false);
      showToast(`Password successfully reset for ${selectedMailbox.email}.`);
    } catch (err: any) {
      showToast(err.message || 'Failed to reset password', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  // Open Storage Breakdown Modal
  const openBreakdownModal = async (mb: Mailbox) => {
    setSelectedMailbox(mb);
    setIsBreakdownModalOpen(true);
    setLoadingBreakdown(true);
    try {
      const data = await api.getMailboxBreakdown(mb.id);
      setBreakdownData(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load storage breakdown', 'error');
    } finally {
      setLoadingBreakdown(false);
    }
  };

  const handleRecalculateSingle = async () => {
    if (!selectedMailbox) return;
    setRecalculatingSingle(true);
    try {
      await api.recalculateMailboxUsage(selectedMailbox.id);
      const data = await api.getMailboxBreakdown(selectedMailbox.id);
      setBreakdownData(data);
      await loadData();
      showToast(`Disk usage recalculated for ${selectedMailbox.email}.`);
    } catch (err: any) {
      showToast(err.message || 'Failed to recalculate storage', 'error');
    } finally {
      setRecalculatingSingle(false);
    }
  };

  // Open Edit Profile & Auto-reply Modal
  const openEditModal = (mb: Mailbox) => {
    setSelectedMailbox(mb);
    setEditFullName(mb.full_name);
    setEditDept(mb.department || 'General');
    setEditIsAdmin(mb.is_admin);
    setEditAutoReplyEnabled(mb.auto_reply_enabled);
    setEditAutoReplySubject(mb.auto_reply_subject || '');
    setEditAutoReplyBody(mb.auto_reply_body || '');
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedMailbox) return;
    setSavingEdit(true);
    try {
      await api.updateMailbox(selectedMailbox.id, {
        full_name: editFullName,
        department: editDept,
        is_admin: editIsAdmin,
        auto_reply_enabled: editAutoReplyEnabled,
        auto_reply_subject: editAutoReplySubject,
        auto_reply_body: editAutoReplyBody,
      });
      setIsEditModalOpen(false);
      showToast(`Settings updated for ${selectedMailbox.email}.`);
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update mailbox settings', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  // Open Delete Modal
  const openDeleteModal = (mb: Mailbox) => {
    setSelectedMailbox(mb);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedMailbox) return;
    setDeleting(true);
    try {
      await api.deleteMailbox(selectedMailbox.id);
      setIsDeleteModalOpen(false);
      showToast(`Mailbox ${selectedMailbox.email} permanently deleted.`, 'info');
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete mailbox', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Create Mailbox
  const handleCreate = async () => {
    if (!newUsername || !newFullName || !newPassword || !newDomainId) {
      setCreateError('Please complete all required fields.');
      return;
    }

    const domain = domains.find((d) => d.id === newDomainId);
    if (!domain) return;

    setCreating(true);
    setCreateError(null);

    try {
      await api.createMailbox({
        domain_id: domain.id,
        email: `${newUsername.toLowerCase().trim()}@${domain.name}`,
        full_name: newFullName,
        password: newPassword,
        quota_mb: Number(newQuotaMb),
        department: newDept,
        is_admin: newIsAdmin,
      });

      setIsCreateOpen(false);
      setNewUsername('');
      setNewFullName('');
      setNewPassword('');
      showToast(`New mailbox ${newUsername.toLowerCase().trim()}@${domain.name} created!`);
      await loadData();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create mailbox');
    } finally {
      setCreating(false);
    }
  };

  // Top Aggregated Metrics
  const metrics = useMemo(() => {
    const totalCount = mailboxes.length;
    const activeCount = mailboxes.filter((m) => m.is_active).length;
    const suspendedCount = totalCount - activeCount;

    const totalQuotaBytes = mailboxes.reduce((acc, m) => acc + (m.quota_bytes || 0), 0);
    const totalUsedBytes = mailboxes.reduce((acc, m) => acc + (m.bytes_used || 0), 0);

    const overallPct =
      totalQuotaBytes > 0 ? Math.round((totalUsedBytes / totalQuotaBytes) * 100) : 0;

    let warningCount = 0;
    let criticalCount = 0;

    mailboxes.forEach((m) => {
      if (m.quota_bytes > 0) {
        const pct = (m.bytes_used / m.quota_bytes) * 100;
        if (pct >= 90) criticalCount++;
        else if (pct >= 80) warningCount++;
      }
    });

    return {
      totalCount,
      activeCount,
      suspendedCount,
      totalQuotaFormatted: formatBytes(totalQuotaBytes),
      totalUsedFormatted: formatBytes(totalUsedBytes),
      overallPct,
      warningCount,
      criticalCount,
      totalAlerts: warningCount + criticalCount,
    };
  }, [mailboxes]);

  // Distinct departments for filter dropdown
  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    mailboxes.forEach((m) => {
      if (m.department) set.add(m.department);
    });
    return Array.from(set).sort();
  }, [mailboxes]);

  // Filtered & Sorted Mailboxes
  const filteredMailboxes = useMemo(() => {
    let result = [...mailboxes];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (m) =>
          m.full_name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.username.toLowerCase().includes(q) ||
          (m.department && m.department.toLowerCase().includes(q))
      );
    }

    // Domain filter
    if (domainFilter) {
      result = result.filter((m) => m.domain_id === domainFilter);
    }

    // Department filter
    if (deptFilter) {
      result = result.filter((m) => (m.department || 'General') === deptFilter);
    }

    // Status filter
    if (statusFilter === 'active') {
      result = result.filter((m) => m.is_active);
    } else if (statusFilter === 'suspended') {
      result = result.filter((m) => !m.is_active);
    }

    // Quota health filter
    if (quotaFilter === 'critical') {
      result = result.filter((m) => m.quota_bytes > 0 && (m.bytes_used / m.quota_bytes) * 100 >= 90);
    } else if (quotaFilter === 'warning') {
      result = result.filter((m) => {
        if (m.quota_bytes <= 0) return false;
        const p = (m.bytes_used / m.quota_bytes) * 100;
        return p >= 80 && p < 90;
      });
    } else if (quotaFilter === 'normal') {
      result = result.filter((m) => {
        if (m.quota_bytes <= 0) return true;
        return (m.bytes_used / m.quota_bytes) * 100 < 80;
      });
    }

    // Sorting
    result.sort((a, b) => {
      const pctA = a.quota_bytes > 0 ? (a.bytes_used / a.quota_bytes) * 100 : 0;
      const pctB = b.quota_bytes > 0 ? (b.bytes_used / b.quota_bytes) * 100 : 0;

      switch (sortBy) {
        case 'quota_desc':
          return pctB - pctA;
        case 'used_desc':
          return b.bytes_used - a.bytes_used;
        case 'name_asc':
          return a.full_name.localeCompare(b.full_name);
        case 'messages_desc':
          return b.messages_used - a.messages_used;
        case 'created_desc':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return result;
  }, [mailboxes, searchQuery, domainFilter, deptFilter, statusFilter, quotaFilter, sortBy]);

  if (loading) {
    return <SkeletonCard lines={6} height="360px" />;
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Toast Feedback */}
      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 9999,
            padding: '12px 18px',
            borderRadius: '8px',
            backgroundColor:
              toastMsg.type === 'error'
                ? '#FFF5F5'
                : toastMsg.type === 'info'
                ? '#E7F5FF'
                : '#EBFBEE',
            border: `1px solid ${
              toastMsg.type === 'error'
                ? '#C92A2A'
                : toastMsg.type === 'info'
                ? '#1971C2'
                : '#2B8A3E'
            }`,
            color:
              toastMsg.type === 'error'
                ? '#961C1C'
                : toastMsg.type === 'info'
                ? '#114E87'
                : '#1B5E20',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}
        >
          {toastMsg.type === 'error' ? (
            <AlertTriangle size={16} />
          ) : (
            <CheckCircle2 size={16} />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Header & Primary Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Mailbox &amp; Quota Administration
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Enterprise provisioning, storage allocation, password management, and Maildir quota supervision.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="btn-secondary"
            onClick={handleRecalculateAll}
            disabled={refreshingAll || mailboxes.length === 0}
            title="Scan Maildir and recalculate storage usage for all mailboxes"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={refreshingAll ? 'animate-spin' : ''} />
            <span>{refreshingAll ? 'Recalculating...' : 'Sync Disk'}</span>
          </button>

          <button
            className="btn-secondary"
            onClick={handleExportCsv}
            disabled={mailboxes.length === 0}
            title="Export filtered mailboxes as CSV report"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          <button
            className="btn-primary"
            onClick={() => {
              setNewUsername('');
              setNewFullName('');
              setNewPassword(generateStrongPassword());
              setCreateError(null);
              setIsCreateOpen(true);
            }}
            disabled={domains.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            <span>New Mailbox</span>
          </button>
        </div>
      </div>

      {/* Executive Metrics Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        <MetricCard
          title="Total Mailboxes"
          value={metrics.totalCount}
          subtitle={`${metrics.activeCount} active · ${metrics.suspendedCount} suspended`}
          icon={Users}
        />
        <MetricCard
          title="Storage Allocated"
          value={metrics.totalQuotaFormatted}
          subtitle={`Across ${metrics.totalCount} employee accounts`}
          icon={HardDrive}
        />
        <MetricCard
          title="Storage Consumed"
          value={metrics.totalUsedFormatted}
          subtitle={`${metrics.overallPct}% of total system allocation`}
          icon={Database}
          variant="dark"
        />
        <MetricCard
          title="Quota Alerts"
          value={metrics.totalAlerts}
          subtitle={
            metrics.totalAlerts === 0
              ? 'All mailboxes within safe limits'
              : `${metrics.criticalCount} critical (>90%) · ${metrics.warningCount} warning (>80%)`
          }
          icon={AlertTriangle}
          trend={
            metrics.totalAlerts > 0
              ? { value: `${metrics.totalAlerts} Alert`, isPositive: false }
              : { value: 'Healthy', isPositive: true }
          }
        />
      </div>

      {/* Search & Filter Toolbar */}
      <div
        className="card-standard"
        style={{
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              className="input-control"
              placeholder="Search by name, email, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '34px', width: '100%' }}
            />
          </div>

          {/* Domain Filter */}
          <div style={{ minWidth: '160px' }}>
            <select
              className="input-control"
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
            >
              <option value="">All Domains</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  @{d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Department Filter */}
          <div style={{ minWidth: '150px' }}>
            <select
              className="input-control"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              <option value="">All Departments</option>
              {departmentOptions.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Account Status Filter */}
          <div style={{ minWidth: '130px' }}>
            <select
              className="input-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="suspended">Suspended Only</option>
            </select>
          </div>

          {/* Quota Health Filter */}
          <div style={{ minWidth: '140px' }}>
            <select
              className="input-control"
              value={quotaFilter}
              onChange={(e) => setQuotaFilter(e.target.value as any)}
            >
              <option value="all">All Quotas</option>
              <option value="normal">Normal (&lt;80%)</option>
              <option value="warning">Warning (80-90%)</option>
              <option value="critical">Critical (&gt;90%)</option>
            </select>
          </div>

          {/* Sort By */}
          <div style={{ minWidth: '170px' }}>
            <select
              className="input-control"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="quota_desc">Sort: Quota % (High)</option>
              <option value="used_desc">Sort: Storage Used (High)</option>
              <option value="name_asc">Sort: Employee Name (A-Z)</option>
              <option value="messages_desc">Sort: Messages Count</option>
              <option value="created_desc">Sort: Newest First</option>
            </select>
          </div>
        </div>

        {/* Active Filter Indicator */}
        {(searchQuery || domainFilter || deptFilter || statusFilter !== 'all' || quotaFilter !== 'all') && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: 'var(--text-muted)',
              paddingTop: '6px',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <span>
              Showing <strong>{filteredMailboxes.length}</strong> of <strong>{mailboxes.length}</strong> accounts
            </span>
            <button
              onClick={() => {
                setSearchQuery('');
                setDomainFilter('');
                setDeptFilter('');
                setStatusFilter('all');
                setQuotaFilter('all');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontWeight: 600,
                textDecoration: 'underline',
              }}
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Main Mailboxes Table View */}
      {domains.length === 0 ? (
        <div className="card-standard" style={{ padding: '40px', textAlign: 'center' }}>
          <Shield size={40} style={{ color: '#9CA3AF', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>No Verified Domains</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            You need to add and verify a corporate domain under "Domains &amp; DNS" before provisioning employee accounts.
          </p>
        </div>
      ) : filteredMailboxes.length === 0 ? (
        <div className="card-standard" style={{ padding: '40px', textAlign: 'center' }}>
          <Users size={40} style={{ color: '#9CA3AF', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {mailboxes.length === 0 ? 'No Mailboxes Created' : 'No Mailboxes Match Search'}
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 16px' }}>
            {mailboxes.length === 0
              ? 'Provision employee email accounts with customized disk quotas.'
              : 'Try broadening your search keywords or clearing active filters.'}
          </p>
          {mailboxes.length === 0 && (
            <button
              className="btn-primary"
              onClick={() => {
                setNewPassword(generateStrongPassword());
                setIsCreateOpen(true);
              }}
            >
              Create First Mailbox
            </button>
          )}
        </div>
      ) : (
        <div className="card-standard" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8F9FA', borderBottom: '1.5px solid var(--border-subtle)' }}>
                  <th style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Employee &amp; Account
                  </th>
                  <th style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Department
                  </th>
                  <th style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--text-secondary)', minWidth: '220px' }}>
                    Disk Quota &amp; Storage
                  </th>
                  <th style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Status &amp; Flags
                  </th>
                  <th style={{ padding: '14px 18px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredMailboxes.map((mb) => {
                  const quotaMb = Math.round(mb.quota_bytes / (1024 * 1024));
                  const usedMb = Math.round(mb.bytes_used / (1024 * 1024));
                  const percent = quotaMb > 0 ? Math.min(100, Math.round((usedMb / quotaMb) * 100)) : 0;
                  const isWarning = percent >= 80 && percent < 90;
                  const isCritical = percent >= 90;

                  return (
                    <tr
                      key={mb.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      {/* Employee & Email */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '8px',
                              backgroundColor: mb.is_admin ? '#111827' : '#F1F3F5',
                              color: mb.is_admin ? '#FFFFFF' : '#111827',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '13px',
                              flexShrink: 0,
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            {getInitials(mb.full_name)}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                {mb.full_name}
                              </span>
                              {mb.is_admin && (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    backgroundColor: '#111827',
                                    color: '#FFFFFF',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                  }}
                                  title="Administrator privileges enabled"
                                >
                                  <ShieldCheck size={11} />
                                  Admin
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                              <span
                                style={{
                                  fontSize: '12px',
                                  color: 'var(--text-secondary)',
                                  fontFamily: 'monospace',
                                }}
                              >
                                {mb.email}
                              </span>
                              <button
                                onClick={() => handleCopyEmail(mb.id, mb.email)}
                                title="Copy email address"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '2px',
                                  color: copiedEmailId === mb.id ? '#2B8A3E' : 'var(--text-muted)',
                                }}
                              >
                                {copiedEmailId === mb.id ? <Check size={12} /> : <Copy size={12} />}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Department */}
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            padding: '3px 9px',
                            borderRadius: '6px',
                            backgroundColor: 'var(--surface-subtle)',
                            color: 'var(--text-secondary)',
                            fontSize: '12px',
                            fontWeight: 500,
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          {mb.department || 'General'}
                        </span>
                      </td>

                      {/* Quota & Storage Bar */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '5px', color: 'var(--text-secondary)' }}>
                          <span style={{ fontWeight: 600 }}>
                            {formatBytes(mb.bytes_used)} / {formatBytes(mb.quota_bytes)}
                          </span>
                          <span
                            style={{
                              fontWeight: 700,
                              color: isCritical
                                ? '#C92A2A'
                                : isWarning
                                ? '#E67700'
                                : '#2B8A3E',
                            }}
                          >
                            {percent}%
                          </span>
                        </div>
                        <div
                          style={{
                            width: '100%',
                            height: '7px',
                            backgroundColor: '#E5E7EB',
                            borderRadius: '4px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${percent}%`,
                              height: '100%',
                              background: isCritical
                                ? 'linear-gradient(90deg, #C92A2A 0%, #FA5252 100%)'
                                : isWarning
                                ? 'linear-gradient(90deg, #E67700 0%, #FCC419 100%)'
                                : 'linear-gradient(90deg, #2B8A3E 0%, #40C057 100%)',
                              borderRadius: '4px',
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            marginTop: '4px',
                          }}
                        >
                          <Mail size={11} />
                          <span>{mb.messages_used.toLocaleString()} messages</span>
                        </div>
                      </td>

                      {/* Status & Flags */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                          <button
                            onClick={() => handleToggleStatus(mb)}
                            style={{
                              border: 'none',
                              background: 'none',
                              cursor: 'pointer',
                              padding: 0,
                            }}
                            title={mb.is_active ? 'Click to suspend mailbox' : 'Click to activate mailbox'}
                          >
                            <StatusBadge status={mb.is_active ? 'active' : 'offline'} />
                          </button>

                          {mb.auto_reply_enabled && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: '#E7F5FF',
                                border: '1px solid #1971C2',
                                color: '#114E87',
                                fontSize: '10px',
                                fontWeight: 600,
                              }}
                              title={mb.auto_reply_subject || 'Out of Office Active'}
                            >
                              <Calendar size={10} />
                              Out of Office
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            onClick={() => openQuotaModal(mb)}
                            className="btn-secondary"
                            style={{ padding: '6px 8px' }}
                            title="Resize storage quota"
                          >
                            <HardDrive size={14} />
                          </button>

                          <button
                            onClick={() => openPasswordModal(mb)}
                            className="btn-secondary"
                            style={{ padding: '6px 8px' }}
                            title="Reset mailbox password"
                          >
                            <Key size={14} />
                          </button>

                          <button
                            onClick={() => openBreakdownModal(mb)}
                            className="btn-secondary"
                            style={{ padding: '6px 8px' }}
                            title="Storage folder breakdown & disk recalculation"
                          >
                            <BarChart3 size={14} />
                          </button>

                          <button
                            onClick={() => openEditModal(mb)}
                            className="btn-secondary"
                            style={{ padding: '6px 8px' }}
                            title="Edit account & Out-of-Office auto-reply"
                          >
                            <Edit3 size={14} />
                          </button>

                          <button
                            onClick={() => openDeleteModal(mb)}
                            style={{
                              background: 'none',
                              border: '1px solid transparent',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              color: '#C92A2A',
                              padding: '6px 8px',
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}
                            title="Delete mailbox and Maildir storage"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Modal: Create Mailbox */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Provision New Employee Mailbox"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {createError && (
            <div
              style={{
                padding: '10px 12px',
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
              <AlertTriangle size={16} />
              <span>{createError}</span>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Corporate Domain
            </label>
            <select
              className="input-control"
              value={newDomainId}
              onChange={(e) => setNewDomainId(e.target.value)}
            >
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  @{d.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Username / Handle
              </label>
              <input
                type="text"
                className="input-control"
                placeholder="e.g. john.doe"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
              />
              {newUsername && newDomainId && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Preview: {newUsername.toLowerCase().trim()}@
                  {domains.find((d) => d.id === newDomainId)?.name}
                </span>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Full Name
              </label>
              <input
                type="text"
                className="input-control"
                placeholder="John Doe"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>Temporary Password</label>
              <button
                type="button"
                onClick={() => setNewPassword(generateStrongPassword())}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Sparkles size={12} />
                Generate Strong
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type={showNewPassword ? 'text' : 'password'}
                className="input-control"
                placeholder="Enter password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ paddingRight: '36px', width: '100%' }}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Department
              </label>
              <select
                className="input-control"
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
              >
                <option value="General">General</option>
                <option value="Administration">Administration</option>
                <option value="Engineering">Engineering</option>
                <option value="Marketing">Marketing</option>
                <option value="Finance">Finance</option>
                <option value="Support">Support</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Storage Quota
              </label>
              <select
                className="input-control"
                value={newQuotaMb}
                onChange={(e) => setNewQuotaMb(Number(e.target.value))}
              >
                <option value={1024}>1 GB</option>
                <option value={2048}>2 GB</option>
                <option value={5120}>5 GB (Standard)</option>
                <option value={10240}>10 GB</option>
                <option value={25600}>25 GB</option>
                <option value={51200}>50 GB</option>
              </select>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: 'var(--surface-subtle)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <input
              type="checkbox"
              id="newIsAdmin"
              checked={newIsAdmin}
              onChange={(e) => setNewIsAdmin(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="newIsAdmin" style={{ fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              Grant System Administrator Privileges
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button className="btn-secondary" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleCreate} disabled={creating}>
              {creating ? 'Provisioning Maildir...' : 'Create Mailbox'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* Modal: Resize Quota */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isQuotaModalOpen}
        onClose={() => setIsQuotaModalOpen(false)}
        title="Adjust Storage Quota"
      >
        {selectedMailbox && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: 'var(--surface-subtle)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedMailbox.full_name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                {selectedMailbox.email}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Current usage: <strong>{formatBytes(selectedMailbox.bytes_used)}</strong> of{' '}
                <strong>{formatBytes(selectedMailbox.quota_bytes)}</strong>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                Preset Allocation
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {[
                  { label: '1 GB', mb: 1024 },
                  { label: '2 GB', mb: 2048 },
                  { label: '5 GB', mb: 5120 },
                  { label: '10 GB', mb: 10240 },
                  { label: '25 GB', mb: 25600 },
                  { label: '50 GB', mb: 51200 },
                  { label: '100 GB', mb: 102400 },
                ].map((item) => (
                  <button
                    key={item.mb}
                    type="button"
                    onClick={() => setTargetQuotaMb(item.mb)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      backgroundColor: targetQuotaMb === item.mb ? '#111827' : '#FFFFFF',
                      color: targetQuotaMb === item.mb ? '#FFFFFF' : 'var(--text-primary)',
                      border: `1px solid ${targetQuotaMb === item.mb ? '#111827' : 'var(--border-subtle)'}`,
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Custom Quota (Megabytes)
              </label>
              <input
                type="number"
                className="input-control"
                min={256}
                max={1048576}
                value={targetQuotaMb}
                onChange={(e) => setTargetQuotaMb(Math.max(1, Number(e.target.value)))}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Equivalent to: {(targetQuotaMb / 1024).toFixed(2)} GB
              </span>
            </div>

            {/* Warning if new quota is less than used */}
            {targetQuotaMb * 1024 * 1024 < selectedMailbox.bytes_used && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#FFF5F5',
                  border: '1px solid #C92A2A',
                  color: '#961C1C',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertTriangle size={15} />
                <span>
                  Warning: The new quota ({formatBytes(targetQuotaMb * 1024 * 1024)}) is less than the current
                  disk space used ({formatBytes(selectedMailbox.bytes_used)}). The mailbox will reject new incoming mail.
                </span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button className="btn-secondary" onClick={() => setIsQuotaModalOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSaveQuota} disabled={savingQuota}>
                {savingQuota ? 'Updating Quota...' : 'Apply New Quota'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* Modal: Password Reset */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        title="Reset Mailbox Password"
      >
        {selectedMailbox && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: 'var(--surface-subtle)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {selectedMailbox.full_name} ({selectedMailbox.email})
              </span>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600 }}>New Password</label>
                <button
                  type="button"
                  onClick={() => {
                    const pwd = generateStrongPassword();
                    setResetPasswordVal(pwd);
                    setCopiedReset(false);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Sparkles size={12} />
                  Generate New
                </button>
              </div>

              <div style={{ position: 'relative' }}>
                <input
                  type={showResetPassword ? 'text' : 'password'}
                  className="input-control"
                  value={resetPasswordVal}
                  onChange={(e) => setResetPasswordVal(e.target.value)}
                  style={{ paddingRight: '70px', width: '100%', fontFamily: 'monospace' }}
                />
                <div
                  style={{
                    position: 'absolute',
                    right: '6px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(resetPasswordVal);
                      setCopiedReset(true);
                      setTimeout(() => setCopiedReset(false), 2000);
                    }}
                    title="Copy password"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      color: copiedReset ? '#2B8A3E' : 'var(--text-muted)',
                    }}
                  >
                    {copiedReset ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    title={showResetPassword ? 'Hide' : 'Show'}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {showResetPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Updating this password immediately re-hashes credentials and invalidates active IMAP/SMTP sessions.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button className="btn-secondary" onClick={() => setIsPasswordModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleSavePassword}
                disabled={savingPassword || !resetPasswordVal.trim()}
              >
                {savingPassword ? 'Updating...' : 'Set Password'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* Modal: Storage Breakdown & Diagnostics */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isBreakdownModalOpen}
        onClose={() => setIsBreakdownModalOpen(false)}
        title="Maildir Storage Breakdown & Diagnostics"
      >
        {selectedMailbox && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: 'var(--surface-subtle)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedMailbox.full_name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                  {selectedMailbox.email}
                </div>
              </div>
              <button
                className="btn-secondary"
                onClick={handleRecalculateSingle}
                disabled={recalculatingSingle}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
              >
                <RefreshCw size={13} className={recalculatingSingle ? 'animate-spin' : ''} />
                <span>{recalculatingSingle ? 'Scanning...' : 'Recalculate Now'}</span>
              </button>
            </div>

            {loadingBreakdown ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                Scanning physical Maildir structure on host...
              </div>
            ) : breakdownData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Total Quota Progress */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600 }}>Total Combined Disk Footprint</span>
                    <span style={{ fontWeight: 700 }}>
                      {formatBytes(breakdownData.bytes_used)} / {formatBytes(breakdownData.quota_bytes)} (
                      {breakdownData.percent_used}%)
                    </span>
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: '8px',
                      backgroundColor: '#E5E7EB',
                      borderRadius: '4px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(100, breakdownData.percent_used)}%`,
                        height: '100%',
                        background:
                          breakdownData.percent_used >= 90
                            ? 'linear-gradient(90deg, #C92A2A 0%, #FA5252 100%)'
                            : breakdownData.percent_used >= 80
                            ? 'linear-gradient(90deg, #E67700 0%, #FCC419 100%)'
                            : 'linear-gradient(90deg, #2B8A3E 0%, #40C057 100%)',
                        borderRadius: '4px',
                      }}
                    />
                  </div>
                </div>

                {/* Maildir Folder Breakdown List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Maildir Folder Allocation
                  </span>
                  {breakdownData.folders.map((f) => (
                    <div
                      key={f.name}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Mail size={14} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontWeight: 600 }}>{f.name}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                          ({f.messages_count.toLocaleString()} msgs)
                        </span>
                      </div>
                      <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                        {formatBytes(f.bytes_used)}
                      </span>
                    </div>
                  ))}

                  {/* Storage Vault Attachments */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <HardDrive size={14} style={{ color: '#1971C2' }} />
                      <span style={{ fontWeight: 600 }}>Storage Vault Attachments</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                        ({breakdownData.vault_files} files)
                      </span>
                    </div>
                    <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                      {formatBytes(breakdownData.vault_bytes)}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button className="btn-secondary" onClick={() => setIsBreakdownModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* Modal: Edit Account & Out-of-Office */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Mailbox & Out-of-Office Settings"
      >
        {selectedMailbox && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: 'var(--surface-subtle)',
                border: '1px solid var(--border-subtle)',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                fontFamily: 'monospace',
              }}
            >
              Editing Account: <strong>{selectedMailbox.email}</strong>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Full Name
              </label>
              <input
                type="text"
                className="input-control"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Department
                </label>
                <select
                  className="input-control"
                  value={editDept}
                  onChange={(e) => setEditDept(e.target.value)}
                >
                  <option value="General">General</option>
                  <option value="Administration">Administration</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Finance">Finance</option>
                  <option value="Support">Support</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', paddingTop: '24px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editIsAdmin}
                    onChange={(e) => setEditIsAdmin(e.target.checked)}
                  />
                  Admin Role
                </label>
              </div>
            </div>

            {/* Out-of-Office Section */}
            <div
              style={{
                padding: '14px',
                borderRadius: '8px',
                backgroundColor: 'var(--surface-subtle)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={14} />
                  Out-of-Office Auto-Reply
                </label>
                <input
                  type="checkbox"
                  checked={editAutoReplyEnabled}
                  onChange={(e) => setEditAutoReplyEnabled(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
              </div>

              {editAutoReplyEnabled && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>
                      Auto-Reply Subject
                    </label>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="e.g. Out of Office: [Original Subject]"
                      value={editAutoReplySubject}
                      onChange={(e) => setEditAutoReplySubject(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>
                      Auto-Reply Message Body
                    </label>
                    <textarea
                      className="input-control"
                      rows={4}
                      placeholder="I am currently away from the office with limited email access..."
                      value={editAutoReplyBody}
                      onChange={(e) => setEditAutoReplyBody(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button className="btn-secondary" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSaveEdit} disabled={savingEdit}>
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* Modal: Delete Confirmation */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Mailbox Account"
      >
        {selectedMailbox && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: '#FFF5F5',
                border: '1px solid #C92A2A',
                color: '#961C1C',
                fontSize: '13px',
                display: 'flex',
                gap: '10px',
              }}
            >
              <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Warning: Permanent Data Destruction</strong>
                <p style={{ marginTop: '4px', lineHeight: 1.4 }}>
                  Deleting <strong>{selectedMailbox.email}</strong> will immediately erase the database record and
                  permanently delete all mail messages from the physical Maildir directory on the host. This action cannot be
                  undone.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button className="btn-secondary" onClick={() => setIsDeleteModalOpen(false)}>
                Cancel
              </button>
              <button
                style={{
                  backgroundColor: '#C92A2A',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting Maildir...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
