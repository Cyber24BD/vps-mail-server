import React, { useState, useEffect } from 'react';
import {
  Zap, ShieldCheck, CheckCircle2, AlertTriangle, Loader2, Save,
  RefreshCw, Cpu
} from 'lucide-react';
import { api } from '../../services/api';

export const SettingsView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Settings State
  const [enabled, setEnabled] = useState(true);
  const [sameDomainOnly, setSameDomainOnly] = useState(true);
  const [stampInternalHeader, setStampInternalHeader] = useState(true);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getInternalMessagingSetting();
      setEnabled(res.enabled);
      setSameDomainOnly(res.same_domain_only);
      setStampInternalHeader(res.stamp_internal_header);
    } catch (err: any) {
      setError(err.message || 'Failed to load system settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const updated = await api.updateInternalMessagingSetting({
        enabled,
        same_domain_only: sameDomainOnly,
        stamp_internal_header: stampInternalHeader,
      });
      setEnabled(updated.enabled);
      setSameDomainOnly(updated.same_domain_only);
      setStampInternalHeader(updated.stamp_internal_header);
      setSuccessMsg('Routing policy updated successfully! Changes take effect immediately across all mailboxes.');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* View Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
            System Settings & Routing Policies
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            Configure global mail delivery behavior, fast-path optimizations, and security policies.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={fetchSettings}
          disabled={loading || saving}
          style={{ fontSize: '13px', padding: '6px 12px' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--status-danger-bg)',
            border: '1px solid var(--status-danger-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--status-danger-text)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--status-success-bg)',
            border: '1px solid var(--status-success-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--status-success-text)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Setting Card */}
      <div className="card-standard" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ maxWidth: '650px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: enabled ? 'var(--status-success-bg)' : 'var(--surface-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Zap size={18} color={enabled ? 'var(--status-success-border)' : 'var(--text-muted)'} />
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Inner Domain Direct Messaging (Fast-Path)
              </h2>
            </div>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              When enabled, messages between colleagues under the same domain (e.g., <strong>aksh@toamun.com</strong> to <strong>it@toamun.com</strong>) 
              bypass the external Postfix SMTP protocol queue, Rspamd, and ClamAV. Messages are injected directly into mailboxes in under 5 milliseconds.
            </p>
          </div>

          {/* Master Toggle Switch */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              disabled={loading || saving}
              style={{
                width: '52px',
                height: '28px',
                borderRadius: '14px',
                backgroundColor: enabled ? '#111827' : '#D1D5DB',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                transition: 'background-color 200ms ease',
                padding: '2px',
                outline: 'none',
              }}
              title={enabled ? 'Click to disable internal direct routing' : 'Click to enable internal direct routing'}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: '#FFFFFF',
                  transform: enabled ? 'translateX(24px)' : 'translateX(0px)',
                  transition: 'transform 200ms ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }}
              />
            </button>
            <span
              className={`badge-status ${enabled ? 'badge-success' : 'badge-warning'}`}
              style={{ fontSize: '11px' }}
            >
              {enabled ? '● Fast-Path Active (< 5ms)' : '○ Standard Postfix SMTP'}
            </span>
          </div>
        </div>

        <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', margin: '20px 0' }} />

        {/* Benefits & Technical Rules */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div
            style={{
              padding: '14px',
              borderRadius: '8px',
              backgroundColor: 'var(--surface-subtle)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
              <Cpu size={14} color="#1971C2" />
              <span>Zero Network Queue & Latency</span>
            </div>
            <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Completely bypasses Postfix Port 25 SMTP handshake and disk mail queues for internal communication.
            </p>
          </div>

          <div
            style={{
              padding: '14px',
              borderRadius: '8px',
              backgroundColor: 'var(--surface-subtle)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
              <ShieldCheck size={14} color="#2B8A3E" />
              <span>Zero Spam False-Positives</span>
            </div>
            <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Internal communications between verified company staff can never be mistakenly quarantined or routed to Spam.
            </p>
          </div>

          <div
            style={{
              padding: '14px',
              borderRadius: '8px',
              backgroundColor: 'var(--surface-subtle)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
              <Zap size={14} color="#E67700" />
              <span>Real-Time In-App Push</span>
            </div>
            <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Immediately emits Server-Sent Events (SSE) toast alerts to recipient's active webmail tabs.
            </p>
          </div>
        </div>

        {/* Sub-options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={sameDomainOnly}
              onChange={(e) => setSameDomainOnly(e.target.checked)}
              disabled={!enabled || loading || saving}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '13px', color: enabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              <strong>Strict Domain Isolation:</strong> Only apply fast-path when sender and recipient share the exact same domain name.
            </span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={stampInternalHeader}
              onChange={(e) => setStampInternalHeader(e.target.checked)}
              disabled={!enabled || loading || saving}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '13px', color: enabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              <strong>Attach Internal Verification Stamp:</strong> Adds <code>X-CorpMail-Delivery: Internal-Direct</code> to headers for webmail visual badge.
            </span>
          </label>
        </div>

        {/* Action Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
            disabled={loading || saving}
            style={{ padding: '8px 20px', fontSize: '13.5px' }}
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            <span>{saving ? 'Saving Policy...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
export default SettingsView;
