import React, { useState, useEffect } from 'react';
import { CheckCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';

import { StatusBadge } from '../common/StatusBadge';
import { SkeletonCard } from '../common/SkeletonCard';

interface SetupWizardViewProps {
  onComplete: () => void;
}

export const SetupWizardView: React.FC<SetupWizardViewProps> = ({ onComplete }) => {
  const [step, setStep] = useState<number>(1);
  const [specs, setSpecs] = useState<any>(null);
  const [loadingSpecs, setLoadingSpecs] = useState(true);

  // Form states
  const [domainName, setDomainName] = useState('');
  const [mailHostname, setMailHostname] = useState('');
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadSpecs() {
      try {
        const data = await api.getSystemSpecs();
        setSpecs(data);
      } catch (err: any) {
        console.error(err);
      } finally {
        setLoadingSpecs(false);
      }
    }
    loadSpecs();
  }, []);

  const handleDomainNext = () => {
    if (!domainName) {
      setErrorMsg('Please enter a valid primary mail domain.');
      return;
    }
    setErrorMsg(null);
    setMailHostname(`mail.${domainName}`);
    setAdminEmail(`admin@${domainName}`);
    setStep(3);
  };

  const handleFinishSetup = async () => {
    if (!adminUsername || !adminEmail || !adminPassword) {
      setErrorMsg('Please provide all administrator fields.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // 1. Create Super Admin
      await api.bootstrapAdmin({
        username: adminUsername,
        email: adminEmail,
        password: adminPassword,
        role: 'super_admin',
      });

      // 2. Login automatically
      await api.login(adminUsername, adminPassword);

      // 3. Create initial domain
      await api.createDomain(domainName, mailHostname);

      onComplete();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete setup wizard');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="animate-fade-in"
      style={{
        maxWidth: '720px',
        margin: '40px auto',
        backgroundColor: '#FFFFFF',
        border: '1px solid #2D3139',
        borderRadius: '18px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* Wizard Step Progress Bar */}
      <div
        style={{
          padding: '24px 32px 20px',
          borderBottom: '1px solid #E5E7EB',
          backgroundColor: '#F8F9FA',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>
            First-Time Setup Wizard (Bootstrap Mode)
          </span>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginTop: '2px' }}>
            {step === 1 && 'Step 1: Automated Server Detection'}
            {step === 2 && 'Step 2: Primary Corporate Mail Domain'}
            {step === 3 && 'Step 3: Initial DNS Configuration Guide'}
            {step === 4 && 'Step 4: Create Super Administrator Account'}
          </h2>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              style={{
                width: '28px',
                height: '6px',
                borderRadius: '4px',
                backgroundColor: s <= step ? '#111827' : '#E5E7EB',
                transition: 'background-color 200ms ease',
              }}
            />
          ))}
        </div>
      </div>

      {errorMsg && (
        <div
          style={{
            margin: '20px 32px 0',
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: '#FFF5F5',
            border: '1px solid #C92A2A',
            color: '#961C1C',
            fontSize: '13px',
          }}
        >
          {errorMsg}
        </div>
      )}

      <div style={{ padding: '32px' }}>
        {/* STEP 1: SERVER DETECTION */}
        {step === 1 && (
          <div>
            <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '20px' }}>
              The platform has automatically detected your host environment specifications. Verify the detected parameters before proceeding:
            </p>

            {loadingSpecs ? (
              <SkeletonCard lines={4} height="200px" />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                <div className="card-standard" style={{ padding: '16px' }}>
                  <span style={{ fontSize: '12px', color: '#6B7280' }}>Public IP Address</span>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>
                    {specs?.public_ip || '127.0.0.1'}
                  </div>
                  <StatusBadge status="verified" label="Detected" />
                </div>

                <div className="card-standard" style={{ padding: '16px' }}>
                  <span style={{ fontSize: '12px', color: '#6B7280' }}>Server Hostname</span>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>
                    {specs?.hostname || 'localhost'}
                  </div>
                  <StatusBadge status="verified" label="Bound" />
                </div>

                <div className="card-standard" style={{ padding: '16px' }}>
                  <span style={{ fontSize: '12px', color: '#6B7280' }}>CPU Cores</span>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>
                    {specs?.cpu_cores} Logical Cores
                  </div>
                </div>

                <div className="card-standard" style={{ padding: '16px' }}>
                  <span style={{ fontSize: '12px', color: '#6B7280' }}>RAM & Storage</span>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginTop: '4px' }}>
                    {specs?.ram_total_mb} MB / {specs?.disk_total_gb} GB Free
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-primary" onClick={() => setStep(2)}>
                <span>Continue to Mail Domain</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: PRIMARY MAIL DOMAIN */}
        {step === 2 && (
          <div>
            <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '20px' }}>
              Enter your corporate domain name (e.g., <code>company.com</code>). The platform will automatically assign <code>mail.company.com</code> as your primary mail gateway hostname.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Corporate Domain Name
              </label>
              <input
                type="text"
                className="input-control"
                placeholder="company.com"
                value={domainName}
                onChange={(e) => setDomainName(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '28px' }}>
              <button className="btn-secondary" onClick={() => setStep(1)}>Back</button>
              <button className="btn-primary" onClick={handleDomainNext}>
                <span>Next: DNS Verification Guide</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: DNS CONFIGURATION GUIDE */}
        {step === 3 && (
          <div>
            <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '16px' }}>
              Configure these records at your DNS provider (Cloudflare, Route53, Namecheap, etc.):
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="card-standard" style={{ padding: '12px 16px', fontSize: '13px' }}>
                <strong>A Record:</strong> <code>mail.{domainName}</code> &rarr; <code>{specs?.public_ip}</code>
              </div>
              <div className="card-standard" style={{ padding: '12px 16px', fontSize: '13px' }}>
                <strong>MX Record:</strong> <code>{domainName}</code> &rarr; <code>mail.{domainName} (Priority 10)</code>
              </div>
              <div className="card-standard" style={{ padding: '12px 16px', fontSize: '13px' }}>
                <strong>SPF Record:</strong> <code>v=spf1 mx ip4:{specs?.public_ip} ~all</code>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '28px' }}>
              <button className="btn-secondary" onClick={() => setStep(2)}>Back</button>
              <button className="btn-primary" onClick={() => setStep(4)}>
                <span>Next: Administrator Account</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: SUPER ADMIN REGISTRATION */}
        {step === 4 && (
          <div>
            <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '20px' }}>
              Create your initial Super Administrator credentials to secure the Control Panel:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Username</label>
                <input
                  type="text"
                  className="input-control"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Admin Email</label>
                <input
                  type="email"
                  className="input-control"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Password</label>
                <input
                  type="password"
                  className="input-control"
                  placeholder="Enter a strong password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '28px' }}>
              <button className="btn-secondary" onClick={() => setStep(3)}>Back</button>
              <button className="btn-primary" onClick={handleFinishSetup} disabled={isSubmitting}>
                {isSubmitting ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                <span>{isSubmitting ? 'Deploying...' : 'Complete Setup & Launch'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
