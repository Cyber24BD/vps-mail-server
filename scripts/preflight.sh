#!/usr/bin/env bash
# ==============================================================================
# Preflight Hardware, OS, Port Auditing & Intelligent Error Diagnostics
# ==============================================================================

check_root() {
  if [ "$EUID" -ne 0 ]; then
    log_action_needed "Installer was launched without root privileges." \
      "Run the installer using sudo: 'sudo ./install.sh'"
    exit 1
  fi
}

check_os() {
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    OS_VERSION=$VERSION_ID
    log_success "Operating System: $PRETTY_NAME"
  else
    log_action_needed "Unknown or unsupported Linux distribution." \
      "Deploy on Ubuntu 20.04/22.04/24.04 LTS or Debian 11/12."
    exit 1
  fi

  if [[ "$OS" != "ubuntu" && "$OS" != "debian" ]]; then
    log_warn "Detected $OS. Recommended distributions are Ubuntu or Debian LTS."
  fi
}

check_resources() {
  ARCH=$(uname -m)
  if [[ "$ARCH" != "x86_64" && "$ARCH" != "aarch64" ]]; then
    log_action_needed "Unsupported CPU architecture: $ARCH" \
      "Deploy on a 64-bit x86_64 or ARM64 (aarch64) server."
    exit 1
  fi
  log_success "CPU Architecture: $ARCH"

  # RAM & Swap Analysis
  TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
  TOTAL_SWAP=$(free -m | awk '/^Swap:/{print $2}')

  if [ "$TOTAL_RAM" -lt 1900 ]; then
    log_warn "Low physical RAM detected (${TOTAL_RAM}MB). Corporate mail security (ClamAV & Rspamd) requires at least 2GB-4GB."
    
    if [ "$TOTAL_SWAP" -lt 1000 ]; then
      log_info "Creating 2GB swap space to prevent Out-Of-Memory (OOM) errors during mail antivirus scanning..."
      if [ ! -f /swapfile ]; then
        fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048
        chmod 600 /swapfile
        mkswap /swapfile >/dev/null 2>&1
        swapon /swapfile >/dev/null 2>&1
        echo '/swapfile none swap sw 0 0' >> /etc/fstab
        log_success "2GB Swap successfully enabled."
      fi
    else
      log_success "Existing swap space (${TOTAL_SWAP}MB) will provide memory cushion."
    fi
  else
    log_success "Memory check passed: ${TOTAL_RAM}MB RAM available."
  fi

  # Disk Space
  AVAIL_DISK_KB=$(df -P / | awk 'NR==2 {print $4}')
  AVAIL_DISK_GB=$((AVAIL_DISK_KB / 1024 / 1024))
  if [ "$AVAIL_DISK_GB" -lt 10 ]; then
    log_action_needed "Insufficient disk space: only ${AVAIL_DISK_GB}GB available." \
      "Free at least 10GB of storage on your root disk before continuing."
    exit 1
  fi
  log_success "Storage check passed: ${AVAIL_DISK_GB}GB free disk space."
}

check_mail_ports() {
  log_info "Auditing standard mail and web port availability..."
  local ports=(25 80 443 587 993)
  local conflict_detected=0

  for port in "${ports[@]}"; do
    if ss -tuln | grep -q ":${port} "; then
      # Identify conflicting process
      local pid=$(ss -lptn "sport = :${port}" 2>/dev/null | awk 'NR==2 {print $NF}' | sed -E 's/.*pid=([0-9]+).*/\1/' || echo "")
      local proc_name="unknown"
      if [ -n "$pid" ] && [ "$pid" -gt 0 ] 2>/dev/null; then
        proc_name=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
      fi

      log_error "Port $port is currently in use by process '${proc_name}' (PID: ${pid:-N/A})."
      
      if [[ "$proc_name" =~ (postfix|exim|sendmail) ]]; then
        log_hint "A default MTA is running. Disable it with: 'sudo systemctl stop $proc_name && sudo systemctl disable $proc_name'"
      elif [[ "$proc_name" =~ (nginx|apache2|httpd) ]]; then
        log_hint "A web server is running on port $port. Free it with: 'sudo systemctl stop $proc_name'"
      fi
      conflict_detected=1
    else
      log_success "Port $port is free."
    fi
  done

  if [ "$conflict_detected" -eq 1 ]; then
    log_action_needed "One or more core mail ports are occupied." \
      "Stop the conflicting processes indicated above, then rerun ./install.sh."
    exit 1
  fi
}

assign_control_port() {
  local target_port=7080
  while ss -tuln | grep -q ":${target_port} "; do
    log_warn "Control port $target_port is already in use by another process."
    target_port=$((target_port + 1))
  done
  CHOSEN_CONTROL_PORT=$target_port
  log_success "Assigned Control Panel Port: ${CHOSEN_CONTROL_PORT}"
}

detect_public_ip() {
  PUBLIC_IP=$(curl -s -4 https://ifconfig.me || curl -s -4 https://api.ipify.org || echo "127.0.0.1")
  log_success "Detected Public IP: ${PUBLIC_IP}"
}

check_outbound_smtp() {
  log_info "Auditing Outbound Port 25 connectivity to external mail networks..."
  if timeout 3 bash -c '</dev/tcp/smtp.gmail.com/25' 2>/dev/null || timeout 3 nc -z -w 3 smtp.gmail.com 25 2>/dev/null; then
    log_success "Outbound Port 25 is OPEN (Direct delivery to Gmail, Outlook & Yahoo enabled)."
  else
    log_warn "Outbound Port 25 appears BLOCKED by your VPS provider (DigitalOcean, Vultr, AWS, etc.)."
    log_hint "Your server can RECEIVE mail immediately. To SEND mail to external servers, either:"
    log_hint "  1. Request an unblock: Submit a ticket to your VPS provider: 'Please unblock outbound Port 25 for my mail server.'"
    log_hint "  2. Or configure an SMTP Relay (e.g. Amazon SES, SendGrid, Mailjet, Brevo) in Postfix relayhost."
  fi
}
