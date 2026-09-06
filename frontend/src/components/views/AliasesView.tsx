import React, { useState, useEffect } from 'react';
import { Forward, Plus, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { SkeletonCard } from '../common/SkeletonCard';
import { Modal } from '../common/Modal';
import type { Alias, Domain } from '../../types';

export const AliasesView: React.FC = () => {
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);

  const [loading, setLoading] = useState(true);
  const [isAliasModalOpen, setIsAliasModalOpen] = useState(false);

  // Form states
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [sourceUsername, setSourceUsername] = useState('');
  const [destEmail, setDestEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [alList, domList] = await Promise.all([
        api.listAliases(),
        api.listDomains(),
      ]);
      setAliases(alList);
      setDomains(domList);

      if (domList.length > 0 && !selectedDomainId) {
        setSelectedDomainId(domList[0].id);
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

  const handleCreateAlias = async () => {
    if (!sourceUsername || !destEmail || !selectedDomainId) {
      setErrorMsg('Please enter both source alias and destination address.');
      return;
    }
    const domain = domains.find((d) => d.id === selectedDomainId);
    if (!domain) return;

    setSaving(true);
    setErrorMsg(null);

    try {
      const sourceEmail = `${sourceUsername.toLowerCase().trim()}@${domain.name}`;
      await api.createAlias(domain.id, sourceEmail, destEmail);
      setIsAliasModalOpen(false);
      setSourceUsername('');
      setDestEmail('');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create alias');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAlias = async (id: string) => {
    if (!confirm('Are you sure you want to delete this alias forwarding route?')) return;
    try {
      await api.deleteAlias(id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete alias');
    }
  };

  if (loading) {
    return <SkeletonCard lines={4} height="280px" />;
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* View Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>Aliases & Distribution Groups</h2>
          <p style={{ fontSize: '13px', color: '#6B7280' }}>
            Configure inbound forwarding aliases and company-wide broadcast addresses.
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => setIsAliasModalOpen(true)}
          disabled={domains.length === 0}
        >
          <Plus size={16} />
          <span>New Alias</span>
        </button>
      </div>

      {/* Aliases Table */}
      <div className="card-standard" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Forward size={18} />
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>Inbound Email Forwarding Aliases</h3>
        </div>

        {aliases.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#6B7280', fontSize: '13px' }}>
            No aliases configured. Aliases forward messages (e.g. <code>info@company.com</code>) without consuming mailbox storage.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8F9FA', borderBottom: '1.5px solid #E5E7EB' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: '#4B5563' }}>Source Address</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: '#4B5563' }}>Forward Target</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: '#4B5563', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {aliases.map((al) => (
                <tr key={al.id} style={{ borderBottom: '1px solid #F1F3F5' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 600, fontFamily: 'monospace' }}>
                    {al.source_email}
                  </td>
                  <td style={{ padding: '14px 16px', fontFamily: 'monospace', color: '#4B5563' }}>
                    &rarr; {al.destination_email}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleDeleteAlias(al.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C92A2A', padding: '4px' }}
                      title="Delete alias"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Alias Modal */}
      <Modal
        isOpen={isAliasModalOpen}
        onClose={() => setIsAliasModalOpen(false)}
        title="Create Email Forwarding Alias"
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

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Source Alias Username</label>
            <input
              type="text"
              className="input-control"
              placeholder="e.g. contact or sales"
              value={sourceUsername}
              onChange={(e) => setSourceUsername(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Forward Destination Address</label>
            <input
              type="email"
              className="input-control"
              placeholder="e.g. team.lead@company.com"
              value={destEmail}
              onChange={(e) => setDestEmail(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <button className="btn-secondary" onClick={() => setIsAliasModalOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleCreateAlias} disabled={saving}>
              {saving ? 'Creating...' : 'Create Alias'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
