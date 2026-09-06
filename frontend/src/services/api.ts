const API_BASE = '/api/v1';

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem('corpmail_token');
  }

  public setToken(token: string) {
    localStorage.setItem('corpmail_token', token);
  }

  public removeToken() {
    localStorage.removeItem('corpmail_token');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Network request failed' }));
      throw new Error(errorData.detail || `Error: ${response.status} ${response.statusText}`);
    }

    if (response.status === 204) {
      return null as unknown as T;
    }

    return response.json();
  }

  // --- Auth & Bootstrap ---
  async getBootstrapStatus() {
    return this.request<any>('/bootstrap/status');
  }

  async getSystemSpecs() {
    return this.request<any>('/bootstrap/system-specs');
  }

  async bootstrapAdmin(data: any) {
    return this.request<any>('/bootstrap/setup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(username: string, password: string) {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Authentication failed' }));
      throw new Error(err.detail || 'Login failed');
    }

    const data = await res.json();
    this.setToken(data.access_token);
    return data;
  }

  // --- Domains & DNS ---
  async listDomains() {
    return this.request<any[]>('/domains/');
  }

  async getDomain(id: string) {
    return this.request<any>(`/domains/${id}`);
  }

  async createDomain(name: string, mail_hostname?: string) {
    return this.request<any>('/domains/', {
      method: 'POST',
      body: JSON.stringify({ name, mail_hostname }),
    });
  }

  async verifyDns(domainId: string) {
    return this.request<any>(`/domains/${domainId}/verify-dns`, {
      method: 'POST',
    });
  }

  async deleteDomain(id: string) {
    return this.request<void>(`/domains/${id}`, { method: 'DELETE' });
  }

  // --- Mailboxes ---
  async listMailboxes(domainId?: string) {
    const url = domainId ? `/mailboxes/?domain_id=${domainId}` : '/mailboxes/';
    return this.request<any[]>(url);
  }

  async createMailbox(data: any) {
    return this.request<any>('/mailboxes/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMailbox(id: string, data: any) {
    return this.request<any>(`/mailboxes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteMailbox(id: string) {
    return this.request<void>(`/mailboxes/${id}`, { method: 'DELETE' });
  }

  // --- Aliases & Groups ---
  async listAliases(domainId?: string) {
    const url = domainId ? `/aliases/?domain_id=${domainId}` : '/aliases/';
    return this.request<any[]>(url);
  }

  async createAlias(domain_id: string, source_email: string, destination_email: string) {
    return this.request<any>('/aliases/', {
      method: 'POST',
      body: JSON.stringify({ domain_id, source_email, destination_email }),
    });
  }

  async deleteAlias(id: string) {
    return this.request<void>(`/aliases/${id}`, { method: 'DELETE' });
  }

  async listGroups(domainId?: string) {
    const url = domainId ? `/groups/?domain_id=${domainId}` : '/groups/';
    return this.request<any[]>(url);
  }

  async createGroup(data: any) {
    return this.request<any>('/groups/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // --- Diagnostics & Health ---
  async getSystemHealth() {
    return this.request<any>('/diagnostics/health');
  }

  async getSystemMetrics() {
    return this.request<any>('/diagnostics/metrics');
  }

  // --- Security & SSL ---
  async getSslStatus(domain: string) {
    return this.request<any>(`/security/ssl?domain=${encodeURIComponent(domain)}`);
  }

  async issueSsl(domain: string, admin_email: string) {
    return this.request<any>('/security/ssl/issue', {
      method: 'POST',
      body: JSON.stringify({ domain, admin_email }),
    });
  }

  async getFail2banStatus() {
    return this.request<any>('/security/fail2ban');
  }

  // --- Webmail ---
  async getWebmailFolders() {
    return this.request<any[]>('/webmail/folders');
  }

  async getWebmailMessages(folder: string = 'inbox') {
    return this.request<any[]>(`/webmail/messages?folder=${folder}`);
  }

  async sendEmail(recipient: string, subject: string, body: string) {
    return this.request<any>('/webmail/send', {
      method: 'POST',
      body: JSON.stringify({ recipient, subject, body }),
    });
  }
}

export const api = new ApiClient();
