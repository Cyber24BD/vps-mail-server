#!/usr/bin/env bash
# ==============================================================================
# Administrator Account Bootstrap & CLI Setup Module
# ==============================================================================

setup_super_admin() {
  ADMIN_CREATED_IN_CLI=false
  ADMIN_CLI_USER=""

  # Verify if system is already bootstrapped with an admin
  local existing_admins=0
  if docker compose exec -T backend python -c "
import asyncio
from app.core.database import AsyncSessionLocal
from app.repositories.admin_repo import AdminRepository
async def check():
    async with AsyncSessionLocal() as db:
        repo = AdminRepository(db)
        print(await repo.count())
asyncio.run(check())
" 2>/dev/null | grep -q '^[1-9]'; then
    log_info "Administrator account already exists in database."
    return 0
  fi

  # Check if running in an interactive terminal
  if [ ! -t 0 ]; then
    log_info "Non-interactive terminal detected. Skipping interactive admin prompt."
    log_info "You can configure your Super Administrator account via the Web Setup Wizard."
    return 0
  fi

  echo ""
  echo -e "${CYAN}------------------------------------------------------------------------------${NC}"
  echo -e "${CYAN}  Administrator Account Setup${NC}"
  echo -e "${CYAN}------------------------------------------------------------------------------${NC}"
  echo -e "You can configure your Super Administrator account right now in this terminal,"
  echo -e "or skip to configure it using the Web Setup Wizard in your browser."
  echo ""

  read -rp "Configure Super Administrator account now? [Y/n]: " create_now
  create_now=${create_now:-Y}

  if [[ ! "$create_now" =~ ^[Yy]$ ]]; then
    log_info "Terminal admin setup skipped."
    log_info "You will be prompted to create your Super Admin in Step 4 of the Web Setup Wizard."
    return 0
  fi

  # 1. Admin Username
  local admin_user=""
  while [[ -z "$admin_user" ]]; do
    read -rp "Enter Admin Username [default: admin]: " admin_user
    admin_user=${admin_user:-admin}
  done

  # 2. Admin Email
  local admin_email=""
  while true; do
    read -rp "Enter Admin Email (e.g., admin@example.com): " admin_email
    if [[ "$admin_email" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
      break
    else
      log_warn "Please enter a valid email address (e.g. admin@company.com)."
    fi
  done

  # 3. Admin Password
  local admin_pass=""
  local admin_pass_confirm=""
  while true; do
    read -rsp "Enter Admin Password (minimum 8 characters): " admin_pass
    echo ""
    if [ ${#admin_pass} -lt 8 ]; then
      log_warn "Password is too short. Minimum length is 8 characters."
      continue
    fi
    read -rsp "Confirm Admin Password: " admin_pass_confirm
    echo ""
    if [ "$admin_pass" != "$admin_pass_confirm" ]; then
      log_warn "Passwords do not match. Please try again."
    else
      break
    fi
  done

  log_info "Registering Super Administrator '${admin_user}'..."

  # Execute admin creation inside backend container
  if docker compose exec -T backend python -m app.cli create-admin "${admin_user}" "${admin_email}" "${admin_pass}" >/dev/null 2>&1; then
    log_success "Super Administrator '${admin_user}' created successfully!"
    ADMIN_CREATED_IN_CLI=true
    ADMIN_CLI_USER="${admin_user}"
  else
    log_warn "CLI account registration could not complete immediately."
    log_hint "You can still configure your Super Admin account on first browser launch at http://${PUBLIC_IP}:${CHOSEN_CONTROL_PORT}"
  fi
}
