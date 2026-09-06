import React, { useState, useEffect } from 'react';
import { Globe, Plus, RefreshCw, Trash2, Copy, Check, Info, Download } from 'lucide-react';
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
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [zoneFileContent, setZoneFileContent] = useState('');
  const [zoneCopied, setZoneCopied] = useState(false);

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

  const generateCloudflareZoneFile = (domain: Domain): string => {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    let content = `;;
;; Domain:     ${domain.name}.
;; Exported:   ${timestamp}
;; Target:     Cloudflare DNS RFC-1035 / BIND Zone Import
;;
;; INSTRUCTIONS FOR CLOUDFLARE IMPORT:
;; 1. In Cloudflare Dashboard, select "${domain.name}" -> DNS -> Records.
;; 2. Click "Import and Export" -> "Import".
;; 3. Upload this file.
;; 4. Cloudflare will automatically configure all MX, SPF, DKIM, DMARC, and A records.
;; Note: Mail A-records are tagged cf-proxied:false to enforce Grey Cloud (DNS Only).
;;

;; A Records (Mail Gateway - Unproxied)
`;

    const records = domain.dns_records || [];

    // A records
    const aRecords = records.filter((r) => r.record_type === 'A');
    if (aRecords.length > 0) {
      aRecords.forEach((r) => {
        const fqdn = r.host.endsWith('.') ? r.host : `${r.host}.`;
        content += `${fqdn}\t1\tIN\tA\t${r.expected_value}\t; cf_tags=cf-proxied:false\n`;
      });
    }

    // MX records
    content += `\n;; MX Records\n`;
    const mxRecords = records.filter((r) => r.record_type === 'MX');
    if (mxRecords.length > 0) {
      mxRecords.forEach((r) => {
        const fqdn = r.host.endsWith('.') ? r.host : `${r.host}.`;
        let pri = '10';
        let srv = r.expected_value;
        if (srv.includes(' ')) {
          const parts = srv.trim().split(/\s+/);
          pri = parts[0];
          srv = parts.slice(1).join(' ');
        }
        const srvFqdn = srv.endsWith('.') ? srv : `${srv}.`;
        content += `${fqdn}\t1\tIN\tMX\t${pri}\t${srvFqdn}\n`;
      });
    }

    // TXT records (SPF, DKIM, DMARC)
    content += `\n;; TXT Records (SPF, DKIM, DMARC)\n`;
    const txtRecords = records.filter((r) => r.record_type === 'TXT');
    if (txtRecords.length > 0) {
      txtRecords.forEach((r) => {
        const fqdn = r.host.endsWith('.') ? r.host : `${r.host}.`;
        // Clean value and wrap in quotes
        let val = r.expected_value.trim();
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.substring(1, val.length - 1);
        }
        content += `${fqdn}\t1\tIN\tTXT\t"${val}"\n`;
      });
    }

    // CNAME records
    const cnameRecords = records.filter((r) => r.record_type === 'CNAME');
    if (cnameRecords.length > 0) {
      content += `\n;; CNAME Records\n`;
      cnameRecords.forEach((r) => {
        const fqdn = r.host.endsWith('.') ? r.host : `${r.host}.`;
        const targetFqdn = r.expected_value.endsWith('.') ? r.expected_value : `${r.expected_value}.`;
        content += `${fqdn}\t1\tIN\tCNAME\t${targetFqdn}\t; cf_tags=cf-proxied:false\n`;
      });
    }

    return content;
  };

  const handleOpenExport = () => {
    if (!selectedDomain) return;
    const zoneText = generateCloudflareZoneFile(selectedDomain);
    setZoneFileContent(zoneText);
    setZoneCopied(false);
    setIsExportOpen(true);
  };

  const handleDownloadZoneFile = () => {
    if (!selectedDomain || !zoneFileContent) return;
    const blob = new Blob([zoneFileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedDomain.name}-cloudflare-dns.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyZoneContent = () => {
    navigator.clipboard.writeText(zoneFileContent);
    setZoneCopied(true);
    setTimeout(() => setZoneCopied(false), 2500);
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
                    className="btn-secondary"
                    onClick={handleOpenExport}
                    title="Export BIND RFC-1035 Zone file for 1-click Cloudflare DNS Import"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Download size={14} />
                    <span>Export Cloudflare DNS (.txt)</span>
                  </button>
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

              {/* DNS Registrar Quick Cheat-Sheet Banner */}
              <div
                style={{
                  backgroundColor: '#F8F9FA',
                  border: '1px solid #E5E7EB',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  fontSize: '12.5px',
                  color: '#374151',
                  lineHeight: '1.5',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>
                  <Info size={15} color="#111827" />
                  <span>Cloudflare & DNS Manager Guide:</span>
                </div>
                <div>
                  • <strong>MX Record:</strong> Set <em>Name</em> to <code>@</code> (or your domain), <em>Mail Server</em> to <code>{selectedDomain.mail_hostname}</code>, and <em>Priority</em> to <code>10</code>.
                </div>
                <div>
                  • <strong>Cloudflare Proxy Warning:</strong> All mail-related records (especially the <code>mail</code> A-record) <strong>must be DNS Only (Grey Cloud)</strong>, not Proxied (Orange Cloud).
                </div>
                <div>
                  • <strong>PTR (Reverse DNS):</strong> Cannot be set in Cloudflare/registrar — configure it in your <strong>VPS hosting dashboard</strong>.
                </div>
              </div>

              {/* DNS Verification Grid Table */}
              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8F9FA', borderBottom: '1.5px solid #E5E7EB' }}>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: '#4B5563', width: '75px', whiteSpace: 'nowrap' }}>Type</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: '#4B5563', width: '240px', whiteSpace: 'nowrap' }}>DNS Name / Host</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: '#4B5563', minWidth: '340px' }}>Target / Expected Value</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: '#4B5563', minWidth: '220px' }}>Detected Value</th>
                      <th style={{ padding: '12px 14px', fontWeight: 600, color: '#4B5563', width: '130px', whiteSpace: 'nowrap' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDomain.dns_records?.map((record) => {
                      const isExpectedCopied = copiedId === `exp-${record.id}`;
                      const isHostCopied = copiedId === `host-${record.id}`;
                      const isShortHostCopied = copiedId === `short-${record.id}`;

                      // Calculate short name for Cloudflare (e.g. '@', 'mail', 'mail._domainkey')
                      let shortHost = '@';
                      if (record.host === selectedDomain.name) {
                        shortHost = '@';
                      } else if (record.host.endsWith(`.${selectedDomain.name}`)) {
                        shortHost = record.host.slice(0, -(selectedDomain.name.length + 1));
                      } else {
                        shortHost = record.host;
                      }

                      // Check if record is MX to separate Priority and Server
                      const isMx = record.record_type === 'MX';
                      let mxPriority = '10';
                      let mxServer = record.expected_value;
                      if (isMx && record.expected_value.includes(' ')) {
                        const parts = record.expected_value.trim().split(/\s+/);
                        mxPriority = parts[0];
                        mxServer = parts.slice(1).join(' ');
                      }
                      const isMxServerCopied = copiedId === `mx-srv-${record.id}`;
                      const isMxPriorityCopied = copiedId === `mx-pri-${record.id}`;

                      return (
                        <tr key={record.id} style={{ borderBottom: '1px solid #F1F3F5' }}>
                          {/* Type */}
                          <td style={{ padding: '14px', fontWeight: 700, verticalAlign: 'top' }}>
                            <span style={{ padding: '3px 8px', backgroundColor: '#E5E7EB', borderRadius: '5px', fontSize: '11px', fontWeight: 700 }}>
                              {record.record_type}
                            </span>
                          </td>

                          {/* Host / Name */}
                          <td style={{ padding: '14px', verticalAlign: 'top' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {/* Short Name for DNS providers */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600 }}>DNS Name:</span>
                                <code style={{ backgroundColor: '#F1F3F5', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', fontWeight: 700, color: '#111827' }}>
                                  {shortHost}
                                </code>
                                <button
                                  onClick={() => copyToClipboard(shortHost, `short-${record.id}`)}
                                  style={{
                                    background: 'none',
                                    border: '1px solid #E5E7EB',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    color: isShortHostCopied ? '#2B8A3E' : '#4B5563',
                                    padding: '2px 5px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    fontSize: '10px',
                                  }}
                                  title="Copy DNS Name for Cloudflare/Registrar"
                                >
                                  {isShortHostCopied ? <Check size={11} strokeWidth={2.5} /> : <Copy size={11} />}
                                  <span>{isShortHostCopied ? 'Copied' : 'Copy'}</span>
                                </button>
                              </div>

                              {/* Full FQDN */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#6B7280' }}>
                                <span style={{ fontFamily: 'monospace' }}>{record.host}</span>
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
                                  title="Copy Full FQDN"
                                >
                                  {isHostCopied ? <Check size={11} strokeWidth={2.5} /> : <Copy size={11} />}
                                </button>
                              </div>
                            </div>
                          </td>

                          {/* Expected Value */}
                          <td style={{ padding: '14px', verticalAlign: 'top' }}>
                            {isMx ? (
                              /* Specialized MX Field Representation with Individual Copy Buttons */
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151', minWidth: '80px' }}>Mail Server:</span>
                                  <code style={{ fontFamily: 'monospace', fontSize: '12px', backgroundColor: '#F8F9FA', border: '1px solid #E5E7EB', padding: '4px 8px', borderRadius: '4px', color: '#111827' }}>
                                    {mxServer}
                                  </code>
                                  <button
                                    onClick={() => copyToClipboard(mxServer, `mx-srv-${record.id}`)}
                                    className="btn-secondary"
                                    style={{
                                      padding: '3px 8px',
                                      fontSize: '11px',
                                      gap: '4px',
                                      backgroundColor: isMxServerCopied ? '#EBFBEE' : '#FFFFFF',
                                      borderColor: isMxServerCopied ? '#2B8A3E' : '#D1D5DB',
                                      color: isMxServerCopied ? '#1B5E20' : '#374151',
                                    }}
                                    title="Copy Mail Server"
                                  >
                                    {isMxServerCopied ? <Check size={11} strokeWidth={2.5} /> : <Copy size={11} />}
                                    <span>{isMxServerCopied ? 'Copied' : 'Copy Server'}</span>
                                  </button>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151', minWidth: '80px' }}>Priority:</span>
                                  <code style={{ fontFamily: 'monospace', fontSize: '12px', backgroundColor: '#F8F9FA', border: '1px solid #E5E7EB', padding: '4px 8px', borderRadius: '4px', color: '#111827' }}>
                                    {mxPriority}
                                  </code>
                                  <button
                                    onClick={() => copyToClipboard(mxPriority, `mx-pri-${record.id}`)}
                                    className="btn-secondary"
                                    style={{
                                      padding: '3px 8px',
                                      fontSize: '11px',
                                      gap: '4px',
                                      backgroundColor: isMxPriorityCopied ? '#EBFBEE' : '#FFFFFF',
                                      borderColor: isMxPriorityCopied ? '#2B8A3E' : '#D1D5DB',
                                      color: isMxPriorityCopied ? '#1B5E20' : '#374151',
                                    }}
                                    title="Copy Priority"
                                  >
                                    {isMxPriorityCopied ? <Check size={11} strokeWidth={2.5} /> : <Copy size={11} />}
                                    <span>{isMxPriorityCopied ? 'Copied' : 'Copy Priority'}</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* Standard Record Value with Copy Button */
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
                                  <span>{isExpectedCopied ? 'Copied' : 'Copy Value'}</span>
                                </button>
                              </div>
                            )}
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

      {/* Cloudflare Zone File Export Modal */}
      <Modal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        title={`Cloudflare DNS Zone Export (${selectedDomain?.name})`}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              backgroundColor: '#F8F9FA',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              padding: '12px 14px',
              fontSize: '12.5px',
              color: '#374151',
              lineHeight: 1.5,
            }}
          >
            <strong>How to import to Cloudflare:</strong>
            <ol style={{ margin: '6px 0 0', paddingLeft: '20px' }}>
              <li>Download the <code>.txt</code> file below or copy the contents.</li>
              <li>In Cloudflare Dashboard, navigate to <strong>DNS &rarr; Records</strong>.</li>
              <li>Click <strong>Import and Export</strong> &rarr; <strong>Import</strong> and upload this file.</li>
              <li>Cloudflare will automatically populate your A, MX, SPF, DKIM, and DMARC records without any manual typing!</li>
            </ol>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280' }}>
                RFC 1035 BIND Zone Preview:
              </span>
              <span style={{ fontSize: '11px', color: '#16A34A', fontWeight: 600 }}>
                • cf-proxied:false enforced (Grey Cloud)
              </span>
            </div>
            <pre
              style={{
                backgroundColor: '#1E293B',
                color: '#F8FAFC',
                padding: '14px',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '12px',
                maxHeight: '260px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                lineHeight: '1.5',
                border: '1px solid #334155',
              }}
            >
              {zoneFileContent}
            </pre>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
            <button
              className="btn-secondary"
              onClick={handleCopyZoneContent}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {zoneCopied ? <Check size={14} color="#2B8A3E" strokeWidth={2.5} /> : <Copy size={14} />}
              <span>{zoneCopied ? 'Copied to Clipboard!' : 'Copy All Text'}</span>
            </button>
            <button
              className="btn-primary"
              onClick={handleDownloadZoneFile}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={14} />
              <span>Download .txt File</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
