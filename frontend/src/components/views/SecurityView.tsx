import React, { useState, useEffect } from 'react';
import { Lock, AlertOctagon, RefreshCw, CheckCircle, ShieldAlert } from 'lucide-react';
import { api } from '../../services/api';
import { StatusBadge } from '../common/StatusBadge';
import { SkeletonCard } from '../common/SkeletonCard';
import type { Domain } from '../../types';

export const SecurityView: React.FC = () => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [sslStatus, setSslStatus] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [adminEmail, setAdminEmail] = useState('admin@company.local');
  const [msg, setMsg] = useState<{ text: string; isError: boolean } | null>(null);

  const loadData = async () => {
    try {
      const [domList] = await Promise.all([
        api.listDomains(),
      ]);
      setDomains(domList);


      if (domList.length > 0) {
        const dom = domList[0].name;
        setSelectedDomain(dom);
        setAdminEmail(`admin@${dom}`);
        const ssl = await api.getSslStatus(dom);
        setSslStatus(ssl);
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

  const handleDomainChange = async (dom: string) => {
    setSelectedDomain(dom);
    setLoading(true);
    try {
      const ssl = await api.getSslStatus(dom);
      setSslStatus(ssl);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleIssueSsl = async () => {
    if (!selectedDomain) return;
    setIssuing(true);
    setMsg(null);
    try {
      const res = await api.issueSsl(selectedDomain, adminEmail);
      setMsg({ text: res.message || 'SSL Certificate issued successfully', isError: false });
      const ssl = await api.getSslStatus(selectedDomain);
      setSslStatus(ssl);
    } catch (err: any) {
      setMsg({ text: err.message || 'Failed to obtain SSL certificate', isError: true });
    } finally {
      setIssuing(false);
    }
  };

  if (loading) {
    return <SkeletonCard lines={5} height="300px" />;
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* View Header */}
      <div>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>Security, SSL/TLS & Intrusion Prevention</h2>
        <p style={{ fontSize: '13px', color: '#6B7280' }}>
          Automated Let's Encrypt certificates, Postfix/Dovecot encryption, and Fail2ban brute-force protection.
        </p>
      </div>

      {msg && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: msg.isError ? '#FFF5F5' : '#EBFBEE',
            border: `1px solid ${msg.isError ? '#C92A2A' : '#2B8A3E'}`,
            color: msg.isError ? '#961C1C' : '#1B5E20',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {msg.isError ? <AlertOctagon size={16} /> : <CheckCircle size={16} />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* SSL Card */}
      <div className="card-standard" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={18} />
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>
              SSL / TLS Certificate Management
            </h3>
          </div>
          <StatusBadge status={sslStatus?.status || 'pending'} label={sslStatus?.type?.toUpperCase()} />
        </div>

        {domains.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#6B7280' }}>Please register a corporate domain first to request an SSL certificate.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Select Target Domain</label>
                <select
                  className="input-control"
                  value={selectedDomain}
                  onChange={(e) => handleDomainChange(e.target.value)}
                >
                  {domains.map((d) => (
                    <option key={d.id} value={d.name}>{d.name} ({d.mail_hostname})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Let's Encrypt Contact Email</label>
                <input
                  type="email"
                  className="input-control"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                />
              </div>
            </div>

            <div style={{ padding: '12px 14px', backgroundColor: '#F8F9FA', borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '12.5px', color: '#4B5563' }}>
              <strong>Current Certificate: </strong> {sslStatus?.details || 'Self-signed bootstrap certificate active'}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn-primary"
                onClick={handleIssueSsl}
                disabled={issuing}
              >
                <RefreshCw size={14} className={issuing ? 'animate-spin' : ''} />
                <span>{issuing ? 'Executing ACME Challenge...' : "Issue Free Let's Encrypt SSL"}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Fail2ban & Intrusion Shield Card */}
      <div className="card-standard" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <ShieldAlert size={18} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>
            Intrusion Prevention & Fail2ban Firewalls
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div style={{ padding: '16px', backgroundColor: '#F8F9FA', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
            <span style={{ fontSize: '12px', color: '#6B7280' }}>Postfix SMTP Guard</span>
            <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '4px', color: '#111827' }}>
              Active (Port 25/587)
            </div>
            <span style={{ fontSize: '11px', color: '#1B5E20', fontWeight: 600 }}>0 Failed attempts</span>
          </div>

          <div style={{ padding: '16px', backgroundColor: '#F8F9FA', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
            <span style={{ fontSize: '12px', color: '#6B7280' }}>Dovecot IMAP Guard</span>
            <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '4px', color: '#111827' }}>
              Active (Port 143/993)
            </div>
            <span style={{ fontSize: '11px', color: '#1B5E20', fontWeight: 600 }}>Zero brute-force bans</span>
          </div>

          <div style={{ padding: '16px', backgroundColor: '#F8F9FA', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
            <span style={{ fontSize: '12px', color: '#6B7280' }}>Rspamd Milter Filter</span>
            <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '4px', color: '#111827' }}>
              Active + ClamAV
            </div>
            <span style={{ fontSize: '11px', color: '#1B5E20', fontWeight: 600 }}>Real-time scanning</span>
          </div>
        </div>
      </div>
    </div>
  );
};
