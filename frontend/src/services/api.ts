import type { StorageFileItem, StorageStats } from '../types';

const API_BASE = '/api/v1';

class ApiClient {
  public getToken(): string | null {
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
    const isFormData = options.body instanceof FormData;
    const headers: Record<string, string> = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
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
      if (response.status === 401) {
        this.removeToken();
        window.dispatchEvent(new CustomEvent('corpmail:auth_expired'));
      }
      const errorData = await response.json().catch(() => ({ detail: 'Network request failed' }));
      let detailMessage = `Error: ${response.status} ${response.statusText}`;
      if (typeof errorData.detail === 'string') {
        detailMessage = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        detailMessage = errorData.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
      } else if (errorData.detail) {
        detailMessage = JSON.stringify(errorData.detail);
      }
      throw new Error(detailMessage);
    }

    if (response.status === 204) {
      return null as unknown as T;
    }

    return response.json();
  }

  // --- Auth & Bootstrap ---
  async getMe() {
    return this.request<any>('/auth/me');
  }

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
  async getWebmailAccounts() {
    return this.request<any[]>('/webmail/accounts');
  }

  async getWebmailFolders(mailbox?: string) {
    const qs = mailbox ? `?mailbox=${encodeURIComponent(mailbox)}` : '';
    return this.request<any>(`/webmail/folders${qs}`);
  }

  async getWebmailMessages(folder: string = 'inbox', mailbox?: string, search?: string, limit: number = 50, offset: number = 0) {
    const params = new URLSearchParams({ folder, limit: String(limit), offset: String(offset) });
    if (mailbox) params.append('mailbox', mailbox);
    if (search) params.append('search', search);
    return this.request<any[]>(`/webmail/messages?${params.toString()}`);
  }

  async getWebmailMessage(messageId: string, folder: string = 'inbox', mailbox?: string) {
    const params = new URLSearchParams({ folder });
    if (mailbox) params.append('mailbox', mailbox);
    return this.request<any>(`/webmail/messages/${encodeURIComponent(messageId)}?${params.toString()}`);
  }

  async sendWebmail(formData: FormData) {
    return this.request<any>('/webmail/send', {
      method: 'POST',
      body: formData,
    });
  }

  async sendWebmailJson(data: any) {
    return this.request<any>('/webmail/send-json', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async saveDraft(data: {
    recipient?: string;
    subject?: string;
    body_text?: string;
    body_html?: string;
    cc?: string;
    bcc?: string;
    mailbox?: string;
    draft_id?: string;
  }) {
    return this.request<any>('/webmail/drafts/save', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async checkSpamScore(subject: string, bodyText: string, bodyHtml?: string, attachmentNames?: string[]) {
    return this.request<any>('/webmail/spam-check', {
      method: 'POST',
      body: JSON.stringify({
        subject,
        body_text: bodyText,
        body_html: bodyHtml,
        attachment_names: attachmentNames,
      }),
    });
  }

  async moveWebmailMessage(messageId: string, fromFolder: string, targetFolder: string, mailbox?: string) {
    const qs = mailbox ? `?folder=${encodeURIComponent(fromFolder)}&mailbox=${encodeURIComponent(mailbox)}` : `?folder=${encodeURIComponent(fromFolder)}`;
    return this.request<any>(`/webmail/messages/${encodeURIComponent(messageId)}/move${qs}`, {
      method: 'POST',
      body: JSON.stringify({ target_folder: targetFolder }),
    });
  }

  async deleteWebmailMessage(messageId: string, folder: string = 'inbox', mailbox?: string) {
    const qs = mailbox ? `?folder=${encodeURIComponent(folder)}&mailbox=${encodeURIComponent(mailbox)}` : `?folder=${encodeURIComponent(folder)}`;
    return this.request<any>(`/webmail/messages/${encodeURIComponent(messageId)}${qs}`, {
      method: 'DELETE',
    });
  }

  async markWebmailSpam(messageId: string, folder: string = 'inbox', mailbox?: string) {
    const qs = mailbox ? `?folder=${encodeURIComponent(folder)}&mailbox=${encodeURIComponent(mailbox)}` : `?folder=${encodeURIComponent(folder)}`;
    return this.request<any>(`/webmail/messages/${encodeURIComponent(messageId)}/mark-spam${qs}`, {
      method: 'POST',
    });
  }

  async markWebmailHam(messageId: string, mailbox?: string) {
    const qs = mailbox ? `?mailbox=${encodeURIComponent(mailbox)}` : '';
    return this.request<any>(`/webmail/messages/${encodeURIComponent(messageId)}/mark-ham${qs}`, {
      method: 'POST',
    });
  }

  async executeWebmailBulk(action: string, messageIds: string[], folder: string, targetFolder?: string, mailbox?: string) {
    const qs = mailbox ? `?mailbox=${encodeURIComponent(mailbox)}` : '';
    return this.request<any>(`/webmail/bulk${qs}`, {
      method: 'POST',
      body: JSON.stringify({
        action,
        message_ids: messageIds,
        folder,
        target_folder: targetFolder,
      }),
    });
  }

  async injectTestEmail(mailbox?: string, sampleType: string = 'welcome') {
    const params = new URLSearchParams({ sample_type: sampleType });
    if (mailbox) params.append('mailbox', mailbox);
    return this.request<any>(`/webmail/test-delivery?${params.toString()}`, {
      method: 'POST',
    });
  }

  getAttachmentDownloadUrl(messageId: string, index: number, folder: string = 'inbox', mailbox?: string) {
    const params = new URLSearchParams({ folder });
    if (mailbox) params.append('mailbox', mailbox);
    return `${API_BASE}/webmail/messages/${encodeURIComponent(messageId)}/attachments/${index}?${params.toString()}`;
  }

  // --- Platform Updates ---
  async checkUpdates() {
    return this.request<any>('/updates/check');
  }

  async applyUpdate() {
    return this.request<any>('/updates/apply', { method: 'POST' });
  }

  // --- System Settings & Routing Policies ---
  async getInternalMessagingSetting() {
    return this.request<{
      enabled: boolean;
      same_domain_only: boolean;
      stamp_internal_header: boolean;
      description?: string;
    }>('/settings/internal-messaging');
  }

  async updateInternalMessagingSetting(data: {
    enabled: boolean;
    same_domain_only?: boolean;
    stamp_internal_header?: boolean;
  }) {
    return this.request<{
      enabled: boolean;
      same_domain_only: boolean;
      stamp_internal_header: boolean;
      description?: string;
    }>('/settings/internal-messaging', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // --- Storage & Media Vault ---
  async getStorageStats(mailbox?: string) {
    const params = new URLSearchParams();
    if (mailbox) params.append('mailbox', mailbox);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<StorageStats>(`/storage/stats${qs}`);
  }

  async getStorageFiles(params?: {
    category?: string;
    search?: string;
    sort_by?: string;
    limit?: number;
    offset?: number;
    mailbox?: string;
  }) {
    const qs = new URLSearchParams();
    if (params?.category) qs.append('category', params.category);
    if (params?.search) qs.append('search', params.search);
    if (params?.sort_by) qs.append('sort_by', params.sort_by);
    if (params?.limit) qs.append('limit', params.limit.toString());
    if (params?.offset) qs.append('offset', params.offset.toString());
    if (params?.mailbox) qs.append('mailbox', params.mailbox);
    const qStr = qs.toString() ? `?${qs.toString()}` : '';
    return this.request<{ total: number; files: StorageFileItem[] }>(`/storage/files${qStr}`);
  }

  async deleteStorageFile(fileId: string, mailbox?: string) {
    const params = new URLSearchParams();
    if (mailbox) params.append('mailbox', mailbox);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<{ success: boolean; message: string }>(`/storage/files/${encodeURIComponent(fileId)}${qs}`, {
      method: 'DELETE',
    });
  }

  async bulkDeleteStorageFiles(fileIds: string[], mailbox?: string) {
    return this.request<{ success: boolean; deleted_count: number; failed_count: number }>(`/storage/bulk-delete`, {
      method: 'POST',
      body: JSON.stringify({ file_ids: fileIds, mailbox }),
    });
  }

  getStoragePreviewUrl(fileId: string, mailbox?: string) {
    const params = new URLSearchParams();
    if (mailbox) params.append('mailbox', mailbox);
    const qStr = params.toString() ? `?${params.toString()}` : '';
    return `${API_BASE}/storage/files/${encodeURIComponent(fileId)}/preview${qStr}`;
  }

  getStorageDownloadUrl(fileId: string, mailbox?: string) {
    const params = new URLSearchParams();
    if (mailbox) params.append('mailbox', mailbox);
    const qStr = params.toString() ? `?${params.toString()}` : '';
    return `${API_BASE}/storage/files/${encodeURIComponent(fileId)}/download${qStr}`;
  }
}


export const api = new ApiClient();
