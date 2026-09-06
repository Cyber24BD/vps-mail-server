#!/usr/bin/env bash
# ==============================================================================
# Intelligent Docker Engine & Docker Compose Verifier
# ==============================================================================

ensure_docker_installed() {
  if command -v docker &> /dev/null; then
    local d_ver=$(docker --version)
    log_success "Existing Docker Engine detected: $d_ver"

    # Verify if Docker daemon is actively running
    if ! docker info > /dev/null 2>&1; then
      log_warn "Docker binary is installed, but Docker daemon is inactive or not responding."
      log_info "Attempting to activate Docker service..."

      systemctl enable docker > /dev/null 2>&1 || true
      systemctl start docker > /dev/null 2>&1 || true
      sleep 2

      if docker info > /dev/null 2>&1; then
        log_success "Docker daemon successfully activated."
      else
        log_action_needed "Docker daemon failed to start." \
          "Run 'sudo systemctl status docker' or 'sudo journalctl -u docker -n 20' to inspect the system log."
        exit 1
      fi
    else
      log_success "Docker daemon is healthy and running."
    fi

    # Check for Docker Compose V2 support
    if ! docker compose version > /dev/null 2>&1; then
      log_warn "Docker is present, but Docker Compose V2 plugin is missing. Installing plugin..."
      apt-get update -y > /dev/null 2>&1
      apt-get install -y docker-compose-plugin > /dev/null 2>&1 || {
        log_action_needed "Failed to install docker-compose-plugin." \
          "Install docker-compose-plugin manually via 'apt-get install docker-compose-plugin'."
        exit 1
      }
      log_success "Docker Compose V2 plugin installed."
    else
      local dc_ver=$(docker compose version)
      log_success "Docker Compose V2 detected: $dc_ver"
    fi

  else
    log_info "Docker not found on host. Performing clean automated installation..."

    apt-get update -y
    apt-get install -y ca-certificates curl gnupg lsb-release

    mkdir -p /etc/apt/keyrings
    curl -fsSL "https://download.docker.com/linux/$OS/gpg" | gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

    systemctl enable docker
    systemctl start docker

    if docker info > /dev/null 2>&1; then
      log_success "Docker & Docker Compose installed and running."
    else
      log_action_needed "Docker installation finished but daemon failed to initialize." \
        "Check system logs with: 'journalctl -u docker -e'"
      exit 1
    fi
  fi
}
