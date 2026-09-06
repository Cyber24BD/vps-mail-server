#!/usr/bin/env bash
# ==============================================================================
# Terminal UI Formatting & Structured Logging Helper
# ==============================================================================

# ANSI Color Palettes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[✓ SUCCESS]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

log_hint() {
  echo -e "${CYAN}[HINT]${NC} $1"
}

log_action_needed() {
  local issue="$1"
  local solution="$2"
  echo ""
  echo -e "${RED}╔════════════════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║ ${BOLD}ACTION REQUIRED TO PROCEED${NC}${RED}                                               ║${NC}"
  echo -e "${RED}╠════════════════════════════════════════════════════════════════════════════╣${NC}"
  echo -e "${RED}║ Issue:    ${YELLOW}${issue}${NC}"
  echo -e "${RED}║ Solution: ${GREEN}${solution}${NC}"
  echo -e "${RED}╚════════════════════════════════════════════════════════════════════════════╝${NC}"
  echo ""
}
