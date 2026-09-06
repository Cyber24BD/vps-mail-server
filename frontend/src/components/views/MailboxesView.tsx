import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Shield } from 'lucide-react';
import { api } from '../../services/api';
import { StatusBadge } from '../common/StatusBadge';
import { SkeletonCard } from '../common/SkeletonCard';
import { Modal } from '../common/Modal';
import type { Mailbox, Domain } from '../../types';


export const MailboxesView: React.FC = () => {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form states
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [department, setDepartment] = useState('General');
  const [quotaMb, setQuotaMb] = useState(5120);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [mbs, doms] = await Promise.all([
        api.listMailboxes(),
        api.listDomains(),
      ]);
      setMailboxes(mbs);
      setDomains(doms);
      if (doms.length > 0 && !selectedDomainId) {
        setSelectedDomainId(doms[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async () => {
    if (!username || !fullName || !password || !selectedDomainId) {
      setErrorMsg('Please complete all required fields.');
      return;
    }

    const domain = domains.find((d) => d.id === selectedDomainId);
    if (!domain) return;

    setSaving(true);
    setErrorMsg(null);

    try {
      await api.createMailbox({
        domain_id: domain.id,
        email: `${username.toLowerCase().trim()}@${domain.name}`,
        full_name: fullName,
        password,
        quota_mb: Number(quotaMb),
        department,
      });

      setIsCreateOpen(false);
      setUsername('');
      setFullName('');
      setPassword('');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create mailbox');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Are you sure you want to delete mailbox ${email}? All mail data will be permanently removed.`)) return;
    try {
      await api.deleteMailbox(id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete mailbox');
    }
  };

  if (loading) {
    return <SkeletonCard lines={5} height="320px" />;
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* View Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>Mailbox & Quota Administration</h2>
          <p style={{ fontSize: '13px', color: '#6B7280' }}>
            Provision and configure individual corporate employee accounts and storage quotas.
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => setIsCreateOpen(true)}
          disabled={domains.length === 0}
        >
          <Plus size={16} />
          <span>New Mailbox</span>
        </button>
      </div>

      {domains.length === 0 ? (
        <div className="card-standard" style={{ padding: '32px', textAlign: 'center' }}>
          <Shield size={36} style={{ color: '#9CA3AF', margin: '0 auto 8px' }} />
          <h3 style={{ fontSize: '15px', fontWeight: 600 }}>No Domains Available</h3>
          <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
            Please add and verify a corporate domain under "Domains & DNS" first.
          </p>
        </div>
      ) : mailboxes.length === 0 ? (
        <div className="card-standard" style={{ padding: '32px', textAlign: 'center' }}>
          <Users size={36} style={{ color: '#9CA3AF', margin: '0 auto 8px' }} />
          <h3 style={{ fontSize: '15px', fontWeight: 600 }}>No Mailboxes Created Yet</h3>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: '4px 0 16px' }}>
            Create accounts for staff members to enable custom Webmail and SMTP/IMAP client access.
          </p>
          <button className="btn-primary" onClick={() => setIsCreateOpen(true)}>Create First Mailbox</button>
        </div>
      ) : (
        <div className="card-standard" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8F9FA', borderBottom: '1.5px solid #E5E7EB' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: '#4B5563' }}>Employee & Email</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: '#4B5563' }}>Department</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: '#4B5563' }}>Storage Quota</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: '#4B5563' }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: '#4B5563', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mailboxes.map((mb) => {
                const quotaMb = Math.round(mb.quota_bytes / (1024 * 1024));
                const usedMb = Math.round(mb.bytes_used / (1024 * 1024));
                const percent = quotaMb > 0 ? Math.min(100, Math.round((usedMb / quotaMb) * 100)) : 0;

                return (
                  <tr key={mb.id} style={{ borderBottom: '1px solid #F1F3F5' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#111827' }}>{mb.full_name}</div>
                      <div style={{ fontSize: '12px', color: '#4B5563', fontFamily: 'monospace' }}>{mb.email}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#F1F3F5', fontSize: '12px' }}>
                        {mb.department || 'General'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', width: '220px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px', color: '#6B7280' }}>
                        <span>{usedMb} MB used</span>
                        <span>{quotaMb} MB limit</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', backgroundColor: '#E5E7EB', borderRadius: '3px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${percent}%`,
                            height: '100%',
                            background: percent > 85 ? 'var(--gradient-danger)' : 'var(--gradient-success)',
                            borderRadius: '3px',
                          }}
                        />
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <StatusBadge status={mb.is_active ? 'active' : 'offline'} />
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleDelete(mb.id, mb.email)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#C92A2A',
                          padding: '4px',
                        }}
                        title="Delete mailbox"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Mailbox Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Provision New Employee Mailbox"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {errorMsg && (
            <div style={{ padding: '10px', backgroundColor: '#FFF5F5', border: '1px solid #C92A2A', borderRadius: '8px', color: '#961C1C', fontSize: '13px' }}>
              {errorMsg}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Domain</label>
            <select
              className="input-control"
              value={selectedDomainId}
              onChange={(e) => setSelectedDomainId(e.target.value)}
            >
              {domains.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Username</label>
              <input
                type="text"
                className="input-control"
                placeholder="e.g. john.doe"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Full Name</label>
              <input
                type="text"
                className="input-control"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Password</label>
            <input
              type="password"
              className="input-control"
              placeholder="Temporary login password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Department</label>
              <select
                className="input-control"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
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
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Storage Quota</label>
              <select
                className="input-control"
                value={quotaMb}
                onChange={(e) => setQuotaMb(Number(e.target.value))}
              >
                <option value={1024}>1 GB</option>
                <option value={5120}>5 GB (Standard)</option>
                <option value={10240}>10 GB</option>
                <option value={25600}>25 GB</option>
                <option value={51200}>50 GB</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <button className="btn-secondary" onClick={() => setIsCreateOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleCreate} disabled={saving}>
              {saving ? 'Creating Maildir...' : 'Create Mailbox'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
