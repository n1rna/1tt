#!/bin/sh

# 1tt CLI installer
# Usage:
#   curl -sSfL https://1tt.dev/cli/install.sh | sh                           # install latest
#   curl -sSfL https://1tt.dev/cli/install.sh | sh -s -- tunnel --token ...  # install + run
#   curl -sSfL https://1tt.dev/cli/install.sh | sh -s -- --version v0.1.5    # specific version

set -e

REPO="n1rna/1tt"
BINARY_NAME="1tt"
VERSION=""
RUN_ARGS=""
INSTALL_ONLY=true

# Colors (disabled if not a terminal)
if [ -t 1 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; BOLD=''; NC=''
fi

log()   { printf "${GREEN}[1tt]${NC} %s\n" "$1"; }
warn()  { printf "${YELLOW}[1tt]${NC} %s\n" "$1"; }
error() { printf "${RED}[1tt]${NC} %s\n" "$1" >&2; }

# ── Detect platform ──────────────────────────────────────────────────────────

detect_platform() {
  case "$(uname -s)" in
    Linux*)  OS="linux" ;;
    Darwin*) OS="darwin" ;;
    CYGWIN*|MINGW*|MSYS*) OS="windows" ;;
    *) error "Unsupported OS: $(uname -s)"; exit 1 ;;
  esac
  case "$(uname -m)" in
    x86_64|amd64)   ARCH="amd64" ;;
    arm64|aarch64)   ARCH="arm64" ;;
    *) error "Unsupported architecture: $(uname -m)"; exit 1 ;;
  esac
  EXT=""
  [ "$OS" = "windows" ] && EXT=".exe"
}

# ── Fetch latest version from GitHub ─────────────────────────────────────────

get_latest_version() {
  [ -n "$VERSION" ] && return
  VERSION=$(curl -sf "https://api.github.com/repos/$REPO/releases" \
    | grep '"tag_name":' | grep 'cli/v' | head -1 \
    | sed -E 's/.*"cli\/(v[^"]+)".*/\1/')
  if [ -z "$VERSION" ]; then
    error "Failed to determine latest CLI version"
    exit 1
  fi
}

# ── Check if the installed version matches ───────────────────────────────────

check_installed() {
  if command -v "$BINARY_NAME" >/dev/null 2>&1; then
    INSTALLED_VERSION=$("$BINARY_NAME" --version 2>/dev/null | awk '{print $NF}')
    if [ "$INSTALLED_VERSION" = "$VERSION" ]; then
      log "1tt $VERSION is already installed — skipping download"
      return 0
    fi
    log "Updating 1tt from $INSTALLED_VERSION to $VERSION"
    return 1
  fi
  return 1
}

# ── Find a writable install directory ────────────────────────────────────────

find_install_dir() {
  for dir in "$HOME/.local/bin" "$HOME/bin" "$HOME/.cargo/bin"; do
    case ":$PATH:" in *":$dir:"*)
      [ -d "$dir" ] && [ -w "$dir" ] && echo "$dir" && return
    ;; esac
  done
  # Check /usr/local/bin
  [ -w "/usr/local/bin" ] && echo "/usr/local/bin" && return
  # Fallback: create ~/.local/bin
  mkdir -p "$HOME/.local/bin"
  echo "$HOME/.local/bin"
}

# ── Download + install ───────────────────────────────────────────────────────

install_binary() {
  local asset="1tt-${OS}-${ARCH}${EXT}"
  local tag="cli/${VERSION}"
  local url="https://github.com/$REPO/releases/download/${tag}/${asset}"
  local tmp="/tmp/1tt-install-$$"

  mkdir -p "$tmp"
  trap 'rm -rf "$tmp"' EXIT

  log "Downloading 1tt $VERSION for ${OS}/${ARCH}..."

  if ! curl -sfL "$url" -o "$tmp/$asset"; then
    error "Download failed — check that $VERSION exists at github.com/$REPO/releases"
    exit 1
  fi

  chmod +x "$tmp/$asset"

  local install_dir
  install_dir=$(find_install_dir)

  log "Installing to $install_dir/1tt${EXT}..."
  if ! cp "$tmp/$asset" "$install_dir/1tt${EXT}"; then
    error "Cannot write to $install_dir — try: sudo mv $tmp/$asset /usr/local/bin/1tt"
    exit 1
  fi

  # Verify
  if "$install_dir/1tt${EXT}" --version >/dev/null 2>&1; then
    log "1tt $VERSION installed successfully!"
  else
    error "Installation verification failed"
    exit 1
  fi

  # PATH check
  if ! command -v 1tt >/dev/null 2>&1; then
    warn "$install_dir is not in your PATH"
    local shell_name=$(basename "${SHELL:-/bin/sh}")
    local profile="$HOME/.profile"
    case "$shell_name" in
      zsh)  profile="$HOME/.zshrc" ;;
      bash) [ -f "$HOME/.bashrc" ] && profile="$HOME/.bashrc" || profile="$HOME/.bash_profile" ;;
      fish) profile="$HOME/.config/fish/config.fish" ;;
    esac
    warn "Run: echo 'export PATH=\"$install_dir:\$PATH\"' >> $profile && source $profile"
  fi
}

# ── Main ─────────────────────────────────────────────────────────────────────

main() {
  # Parse installer flags (before --)
  while [ $# -gt 0 ]; do
    case "$1" in
      --version)
        VERSION="$2"; shift 2 ;;
      --help|-h)
        cat <<'HELP'
1tt CLI Installer

Usage:
  curl -sSfL https://1tt.dev/cli/install.sh | sh                             # install latest
  curl -sSfL https://1tt.dev/cli/install.sh | sh -s -- --version v0.1.5      # specific version
  curl -sSfL https://1tt.dev/cli/install.sh | sh -s -- tunnel --token T --db DB  # install + run

Options:
  --version VERSION    Install a specific version (default: latest)
  --help, -h           Show this help

Any arguments after installer flags are passed to `1tt` after installation.
HELP
        exit 0 ;;
      --)
        shift; RUN_ARGS="$*"; INSTALL_ONLY=false; break ;;
      *)
        # Not an installer flag — treat everything as run args
        RUN_ARGS="$*"; INSTALL_ONLY=false; break ;;
    esac
  done

  printf "\n${BOLD}  1tt.dev CLI Installer${NC}\n\n"

  detect_platform
  get_latest_version

  if check_installed; then
    # Already up to date
    :
  else
    install_binary
  fi

  # If there are run args, execute 1tt with them
  if [ "$INSTALL_ONLY" = false ] && [ -n "$RUN_ARGS" ]; then
    printf "\n"
    log "Running: 1tt $RUN_ARGS"
    printf "\n"
    exec 1tt $RUN_ARGS
  fi

  if [ "$INSTALL_ONLY" = true ]; then
    printf "\n"
    log "Get started: 1tt --help"
    log "Connect a database: 1tt tunnel --token <TOKEN> --db <CONNECTION_STRING>"
    printf "\n"
  fi
}

main "$@"
