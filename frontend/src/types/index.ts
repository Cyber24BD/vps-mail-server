export interface DnsRecord {
  id: string;
  record_type: 'A' | 'AAAA' | 'MX' | 'TXT' | 'CNAME' | 'SPF' | 'DKIM' | 'DMARC' | 'PTR';
  host: string;
  expected_value: string;
  detected_value: string | null;
  status: 'verified' | 'pending' | 'incorrect' | 'missing' | 'warning';
  error_reason?: string | null;
  last_checked_at?: string | null;
}

export interface Domain {
  id: string;
  name: string;
  mail_hostname: string;
  is_active: boolean;
  verification_status: 'active' | 'action_required' | 'pending';
  dkim_selector: string;
  created_at: string;
  updated_at: string;
  dns_records?: DnsRecord[];
  total_mailboxes?: number;
  total_aliases?: number;
  total_groups?: number;
  ssl_status?: string | null;
  ssl_message?: string | null;
}

export interface Mailbox {
  id: string;
  domain_id: string;
  email: string;
  username: string;
  full_name: string;
  quota_bytes: number;
  bytes_used: number;
  messages_used: number;
  department?: string | null;
  is_active: boolean;
  is_admin: boolean;
  auto_reply_enabled: boolean;
  auto_reply_subject?: string | null;
  signature?: string | null;
  created_at: string;
}

export interface Alias {
  id: string;
  domain_id: string;
  source_email: string;
  destination_email: string;
  is_active: boolean;
  created_at: string;
}

export interface MailingGroup {
  id: string;
  domain_id: string;
  group_email: string;
  name: string;
  description?: string | null;
  allow_external: boolean;
  members_count: number;
  created_at: string;
}

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'warning' | 'critical' | 'offline';
  details?: string;
  response_time_ms?: number | null;
}

export interface SystemHealthOverview {
  overall_status: 'healthy' | 'warning' | 'critical';
  timestamp: string;
  services: ServiceHealth[];
}

export interface SystemResourceMetrics {
  cpu_percent: number;
  memory_total_mb: number;
  memory_used_mb: number;
  memory_percent: number;
  disk_total_gb: number;
  disk_used_gb: number;
  disk_percent: number;
  active_connections: number;
  mail_queue_count: number;
}

export interface WebmailAttachment {
  index: number;
  filename: string;
  content_type: string;
  size: number;
  is_shared?: boolean;
  shared_file_id?: string;
  owner_mailbox?: string;
}

export interface WebmailMessage {
  id: string;
  folder: string;
  sender: string;
  recipient: string;
  cc?: string;
  subject: string;
  snippet: string;
  body_text?: string;
  body_html?: string;
  date: string;
  is_read: boolean;
  is_starred: boolean;
  is_internal?: boolean;
  has_attachment: boolean;
  attachments?: WebmailAttachment[];
}

export interface FolderStat {
  key: string;
  name: string;
  unread: number;
  total: number;
}

export interface MailboxStorageSummary {
  folders: FolderStat[];
  bytes_used: number;
  quota_bytes: number;
  messages_used: number;
  quota_percent: number;
}

export interface MailboxAccountItem {
  email: string;
  full_name: string;
  quota_bytes: number;
  bytes_used: number;
  is_active: boolean;
}

export interface SpamTrigger {
  rule: string;
  description: string;
  points: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface SpamCheckResult {
  score: number;
  verdict: 'clean' | 'warning' | 'rejected';
  risk_level: 'low' | 'moderate' | 'critical';
  recommendation: string;
  triggers: SpamTrigger[];
  is_safe: boolean;
}

export interface BootstrapStatus {
  is_bootstrapped: boolean;
  public_ip: string;
  server_time: string;
  hostname: string;
  total_domains: number;
  total_mailboxes: number;
}

export interface StorageFileItem {
  id: string;
  filename: string;
  filesize: number;
  content_type: string;
  category: 'images' | 'documents' | 'media' | 'archives' | 'others';
  sha256?: string;
  source_type?: string;
  message_id?: string;
  subject?: string;
  created_at?: string;
  shared_with: string[];
  is_shared: boolean;
}

export interface StorageCategoryStats {
  bytes: number;
  count: number;
}

export interface StorageStats {
  mailbox_email: string;
  quota_bytes: number;
  total_bytes_used: number;
  percent_used: number;
  total_files: number;
  breakdown: {
    images: StorageCategoryStats;
    documents: StorageCategoryStats;
    media: StorageCategoryStats;
    archives: StorageCategoryStats;
    others: StorageCategoryStats;
  };
}

