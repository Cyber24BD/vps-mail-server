import React, { useState, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { SidebarCard, type NavTab } from './components/layout/SidebarCard';
import { DashboardView } from './components/views/DashboardView';
import { DomainsView } from './components/views/DomainsView';
import { MailboxesView } from './components/views/MailboxesView';
import { AliasesView } from './components/views/AliasesView';
import { WebmailView } from './components/views/WebmailView';
import { SecurityView } from './components/views/SecurityView';
import { DiagnosticsView } from './components/views/DiagnosticsView';
import { SettingsView } from './components/views/SettingsView';
import { StorageView } from './components/views/storage/StorageView';
import { SetupWizardView } from './components/views/SetupWizardView';
import { SkeletonCard } from './components/common/SkeletonCard';
import { api } from './services/api';
import './styles/tokens.css';

export const App: React.FC = () => {
  const [bootstrapped, setBootstrapped] = useState<boolean | null>(null);
  const [publicIp, setPublicIp] = useState<string>('127.0.0.1');
  const [domainCount, setDomainCount] = useState<number>(0);
  const [mailboxCount, setMailboxCount] = useState<number>(0);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Login form states
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const checkBootstrap = async () => {
    try {
      const status = await api.getBootstrapStatus();
      setBootstrapped(status.is_bootstrapped);
      setPublicIp(status.public_ip);
      setDomainCount(status.total_domains);
      setMailboxCount(status.total_mailboxes);

      const token = localStorage.getItem('corpmail_token');
      if (token) {
        try {
          const user = await api.getMe();
          setCurrentUser(user);
          setIsAuthenticated(true);
          if (user.type === 'mailbox' || user.role === 'user') {
            setCurrentTab('webmail');
          }
        } catch {
          api.removeToken();
          setCurrentUser(null);
          setIsAuthenticated(false);
          setLoginError('Your session has expired. Please sign in again.');
        }
      } else {
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
    } catch (err) {
      console.error(err);
      // Fallback for offline dev
      setBootstrapped(true);
    }
  };

  useEffect(() => {
    checkBootstrap();

    const handleAuthExpired = () => {
      setIsAuthenticated(false);
      setCurrentUser(null);
      setLoginError('Your session has expired. Please sign in again.');
    };

    window.addEventListener('corpmail:auth_expired', handleAuthExpired);
    return () => {
      window.removeEventListener('corpmail:auth_expired', handleAuthExpired);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError(null);
    try {
      await api.login(loginUser, loginPass);
      setIsAuthenticated(true);
      await checkBootstrap();
    } catch (err: any) {
      setLoginError(err.message || 'Invalid credentials');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    api.removeToken();
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  if (bootstrapped === null) {
    return (
      <div style={{ maxWidth: '600px', margin: '80px auto', padding: '20px' }}>
        <SkeletonCard height="240px" />
      </div>
    );
  }

  // If system has no Super Admin registered, enter Bootstrap Setup Wizard
  if (!bootstrapped) {
    return <SetupWizardView onComplete={() => checkBootstrap()} />;
  }

  // If not authenticated, display login portal
  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F9FA' }}>
        <div
          className="animate-fade-in card-standard"
          style={{ width: '100%', maxWidth: '400px', padding: '32px', border: '1.5px solid #2D3139', borderRadius: '18px' }}
        >
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>Sign In to Mail Control</h2>
            <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
              Enter administrator or mailbox credentials
            </p>
          </div>

          {loginError && (
            <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: '#FFF5F5', border: '1px solid #C92A2A', color: '#961C1C', fontSize: '13px', marginBottom: '16px' }}>
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Username or Email</label>
              <input
                type="text"
                className="input-control"
                placeholder="admin or user@domain.com"
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Password</label>
              <input
                type="password"
                className="input-control"
                placeholder="••••••••••••"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-primary" style={{ justifyContent: 'center', marginTop: '8px' }} disabled={loggingIn}>
              {loggingIn ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const isWebmail = currentTab === 'webmail';

  return (
    <div
      style={{
        height: isWebmail ? '100vh' : undefined,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#F8F9FA',
        overflow: isWebmail ? 'hidden' : 'auto',
      }}
    >
      <Header
        publicIp={publicIp}
        isBootstrap={!bootstrapped}
        onLogout={handleLogout}
        currentUser={currentUser?.username || loginUser || 'Administrator'}
      />

      <main
        style={{
          display: 'flex',
          gap: isWebmail ? '12px' : '24px',
          padding: isWebmail ? '8px 12px' : '24px 32px',
          width: '100%',
          maxWidth: '100%',
          margin: '0',
          flex: 1,
          boxSizing: 'border-box',
          height: isWebmail ? 'calc(100vh - 64px)' : undefined,
          overflow: isWebmail ? 'hidden' : 'visible',
        }}
      >
        <SidebarCard
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          domainCount={domainCount}
          mailboxCount={mailboxCount}
          userRole={currentUser?.type === 'mailbox' || currentUser?.role === 'user' ? 'user' : 'admin'}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        <section
          style={{
            flex: 1,
            minWidth: 0,
            height: isWebmail ? '100%' : undefined,
            display: isWebmail ? 'flex' : undefined,
            flexDirection: isWebmail ? 'column' : undefined,
            overflow: isWebmail ? 'hidden' : undefined,
          }}
        >
          {currentUser?.type === 'mailbox' || currentUser?.role === 'user' ? (
            <>
              {currentTab === 'storage' ? <StorageView /> : <WebmailView />}
            </>
          ) : (
            <>
              {currentTab === 'dashboard' && <DashboardView />}
              {currentTab === 'domains' && <DomainsView />}
              {currentTab === 'mailboxes' && <MailboxesView />}
              {currentTab === 'aliases' && <AliasesView />}
              {currentTab === 'webmail' && <WebmailView />}
              {currentTab === 'storage' && <StorageView />}
              {currentTab === 'security' && <SecurityView />}
              {currentTab === 'diagnostics' && <DiagnosticsView />}
              {currentTab === 'settings' && <SettingsView />}
            </>
          )}
        </section>
      </main>
    </div>
  );
};
export default App;
