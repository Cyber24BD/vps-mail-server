import React, { useState, useEffect } from 'react';
import { Globe, Plus, RefreshCw, Trash2, Copy, Check } from 'lucide-react';
import { api } from '../../services/api';
import { StatusBadge } from '../common/StatusBadge';
import { SkeletonCard } from '../common/SkeletonCard';
import { Modal } from '../common/Modal';
import type { Domain } from '../../types';


export const DomainsView: React.FC = () => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Add domain form
  const [newDomain, setNewDomain] = useState('');
  const [newMailHost, setNewMailHost] = useState('');
  const [adding, setAdding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadDomains = async () => {
    try {
      const data = await api.listDomains();
      setDomains(data);
      if (data.length > 0) {
        // Load details for first domain
        const detail = await api.getDomain(data[0].id);
        setSelectedDomain(detail);
      } else {
        setSelectedDomain(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDomains();
  }, []);

  const handleSelectDomain = async (id: string) => {
    try {
      const detail = await api.getDomain(id);
      setSelectedDomain(detail);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateDomain = async () => {
    if (!newDomain) return;
    setAdding(true);
    setErrorMsg(null);
    try {
      await api.createDomain(newDomain, newMailHost || undefined);
      setIsAddOpen(false);
      setNewDomain('');
      setNewMailHost('');
      await loadDomains();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add domain');
    } finally {
      setAdding(false);
    }
  };

  const handleVerifyDns = async () => {
    if (!selectedDomain) return;
    setVerifying(true);
    try {
      await api.verifyDns(selectedDomain.id);
      // Reload domain details

      const detail = await api.getDomain(selectedDomain.id);
      setSelectedDomain(detail);
      await loadDomains();
    } catch (err: any) {
      alert(err.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleDeleteDomain = async (id: string) => {
    if (!confirm('Are you sure you want to delete this domain and all associated mailboxes?')) return;
    try {
      await api.deleteDomain(id);
      await loadDomains();
    } catch (err: any) {
      alert(err.message || 'Failed to delete domain');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return <SkeletonCard lines={6} height="350px" />;
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* View Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>Domain & DNS Management</h2>
          <p style={{ fontSize: '13px', color: '#6B7280' }}>
            Multi-domain onboarding with automated MX, SPF, DKIM, DMARC, and PTR verification.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setIsAddOpen(true)}>
          <Plus size={16} />
          <span>Add Domain</span>
        </button>
      </div>

      {domains.length === 0 ? (
        <div
          className="card-standard"
          style={{ padding: '40px', textAlign: 'center', backgroundColor: '#FFFFFF' }}
        >
          <Globe size={40} style={{ margin: '0 auto 12px', color: '#9CA3AF' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>No Domains Registered Yet</h3>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: '6px 0 16px' }}>
            Connect your corporate domain to begin issuing mailboxes and verifying DNS records.
          </p>
          <button className="btn-primary" onClick={() => setIsAddOpen(true)}>Add First Domain</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px', alignItems: 'flex-start' }}>
          {/* Left Domain List */}
          <div className="card-standard" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF', padding: '6px 8px', textTransform: 'uppercase' }}>
              Connected Domains ({domains.length})
            </span>
            {domains.map((dom) => {
              const isSelected = selectedDomain?.id === dom.id;
              return (
                <div
                  key={dom.id}
                  onClick={() => handleSelectDomain(dom.id)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: isSelected ? '1px solid #2D3139' : '1px solid transparent',
                    backgroundColor: isSelected ? '#F1F3F5' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    transition: 'all 150ms ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{dom.name}</span>
                    <StatusBadge status={dom.verification_status} icon={false} />
                  </div>
                  <span style={{ fontSize: '12px', color: '#6B7280' }}>{dom.mail_hostname}</span>
                </div>
              );
            })}
          </div>

          {/* Right Detailed DNS Inspector */}
          {selectedDomain && (
            <div className="card-standard" style={{ padding: '24px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', paddingBottom: '16px', borderBottom: '1px solid #E5E7EB' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>
                    {selectedDomain.name}
                  </h3>
                  <p style={{ fontSize: '12.5px', color: '#6B7280', marginTop: '3px' }}>
                    Gateway Host: <code style={{ backgroundColor: '#F1F3F5', padding: '2px 6px', borderRadius: '4px' }}>{selectedDomain.mail_hostname}</code> | DKIM Selector: <code style={{ backgroundColor: '#F1F3F5', padding: '2px 6px', borderRadius: '4px' }}>{selectedDomain.dkim_selector}</code>
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn-primary"
                    onClick={handleVerifyDns}
                    disabled={verifying}
                  >
                    <RefreshCw size={14} className={verifying ? 'animate-spin' : ''} />
                    <span>{verifying ? 'Resolving DNS...' : 'Verify DNS Now'}</span>
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ borderColor: '#C92A2A', color: '#961C1C' }}
                    onClick={() => handleDeleteDomain(selectedDomain.id)}
                    title="Delete domain"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* DNS Verification Grid Table */}
              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8F9FA', borderBottom: '1.5px solid #E5E7EB' }}>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: '#4B5563', width: '70px', whiteSpace: 'nowrap' }}>Type</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: '#4B5563', width: '220px', whiteSpace: 'nowrap' }}>Host / Name</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: '#4B5563', minWidth: '320px' }}>Expected Value</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: '#4B5563', minWidth: '220px' }}>Detected Value</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: '#4B5563', width: '130px', whiteSpace: 'nowrap' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDomain.dns_records?.map((record) => {
                      const isExpectedCopied = copiedId === `exp-${record.id}`;
                      const isHostCopied = copiedId === `host-${record.id}`;

                      return (
                        <tr key={record.id} style={{ borderBottom: '1px solid #F1F3F5' }}>
                          {/* Type */}
                          <td style={{ padding: '14px', fontWeight: 700, verticalAlign: 'top' }}>
                            <span style={{ padding: '3px 8px', backgroundColor: '#E5E7EB', borderRadius: '5px', fontSize: '11px', fontWeight: 700 }}>
                              {record.record_type}
                            </span>
                          </td>

                          {/* Host */}
                          <td style={{ padding: '14px', verticalAlign: 'top' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#111827', fontSize: '13px', whiteSpace: 'nowrap' }}>
                                {record.host}
                              </span>
                              <button
                                onClick={() => copyToClipboard(record.host, `host-${record.id}`)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: isHostCopied ? '#2B8A3E' : '#9CA3AF',
                                  padding: '2px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                }}
                                title="Copy Host"
                              >
                                {isHostCopied ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} />}
                              </button>
                            </div>
                          </td>

                          {/* Expected Value */}
                          <td style={{ padding: '14px', verticalAlign: 'top' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                              <div
                                style={{
                                  fontFamily: 'monospace',
                                  fontSize: '12px',
                                  backgroundColor: '#F8F9FA',
                                  border: '1px solid #E5E7EB',
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  color: '#111827',
                                  wordBreak: 'break-word',
                                  maxHeight: '75px',
                                  overflowY: 'auto',
                                  flex: 1,
                                  lineHeight: '1.4',
                                }}
                              >
                                {record.expected_value}
                              </div>
                              <button
                                onClick={() => copyToClipboard(record.expected_value, `exp-${record.id}`)}
                                className="btn-secondary"
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '11px',
                                  gap: '4px',
                                  flexShrink: 0,
                                  marginTop: '2px',
                                  backgroundColor: isExpectedCopied ? '#EBFBEE' : '#FFFFFF',
                                  borderColor: isExpectedCopied ? '#2B8A3E' : '#D1D5DB',
                                  color: isExpectedCopied ? '#1B5E20' : '#374151',
                                }}
                                title="Copy value to clipboard"
                              >
                                {isExpectedCopied ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} />}
                                <span>{isExpectedCopied ? 'Copied' : 'Copy'}</span>
                              </button>
                            </div>
                          </td>

                          {/* Detected Value */}
                          <td style={{ padding: '14px', verticalAlign: 'top' }}>
                            <div
                              style={{
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                color: record.status === 'verified' ? '#2B8A3E' : '#6B7280',
                                wordBreak: 'break-word',
                                maxHeight: '75px',
                                overflowY: 'auto',
                                lineHeight: '1.4',
                              }}
                            >
                              {record.detected_value || '—'}
                            </div>
                          </td>

                          {/* Status */}
                          <td style={{ padding: '14px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                            <StatusBadge status={record.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Domain Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Connect Corporate Mail Domain"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {errorMsg && (
            <div style={{ padding: '10px', backgroundColor: '#FFF5F5', border: '1px solid #C92A2A', borderRadius: '8px', color: '#961C1C', fontSize: '13px' }}>
              {errorMsg}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Domain Name
            </label>
            <input
              type="text"
              className="input-control"
              placeholder="e.g. enterprise.com"
              value={newDomain}
              onChange={(e) => {
                setNewDomain(e.target.value);
                setNewMailHost(`mail.${e.target.value}`);
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Mail Hostname (FQDN)
            </label>
            <input
              type="text"
              className="input-control"
              placeholder="mail.enterprise.com"
              value={newMailHost}
              onChange={(e) => setNewMailHost(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <button className="btn-secondary" onClick={() => setIsAddOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleCreateDomain} disabled={adding}>
              {adding ? 'Generating DKIM & Adding...' : 'Add Domain'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
