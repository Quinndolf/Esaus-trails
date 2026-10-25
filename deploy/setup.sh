#!/usr/bin/env bash
# One-time setup of Esau's Trails on a DigitalOcean Ubuntu droplet that may already host another site.
#
#   curl -fsSL https://raw.githubusercontent.com/Quinndolf/Esaus-trails/main/deploy/setup.sh | sudo bash
#
# Safe to run again. It never edits another site's nginx config, never touches the system Node,
# and stops before changing anything if something other than nginx owns port 80.
# Options (put before "bash"): DOMAIN=esaustrails.com  EMAIL=you@example.com
set -euo pipefail

REPO=https://github.com/Quinndolf/Esaus-trails.git
ROOT=/opt/esaus-trails
APP=$ROOT/app
ETC=/etc/esaus-trails
ENV_FILE=$ETC/esau.env
SERVICE=esaus-trails-api

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!!  %s\033[0m\n' "$*" >&2; }
die() { printf '\033[1;31mXX  %s\033[0m\n' "$*" >&2; exit 1; }

main() {
  [ "$(id -u)" = 0 ] || die "Run this as root (put sudo in front)."
  command -v apt-get >/dev/null || die "This script expects Ubuntu or Debian."

  say "Checking what already runs on this server"
  local holder80
  holder80=$(ss -ltnpH 'sport = :80' 2>/dev/null | grep -o 'users:(("[^"]*' | head -1 | cut -d'"' -f2 || true)
  if [ -n "$holder80" ] && [ "$holder80" != nginx ]; then
    die "Port 80 belongs to '$holder80', not nginx. Nothing was changed. Send this message to Claude so it can adapt the setup."
  fi
  echo "    port 80: ${holder80:-free}"

  local ip
  ip=$(curl -fsS --max-time 3 http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address 2>/dev/null \
    || curl -fsS --max-time 5 https://api.ipify.org)
  # Until esaustrails.com is bought, sslip.io gives a free name that points at this IP,
  # which is enough for a real HTTPS certificate (phones only allow GPS and compass over HTTPS).
  DOMAIN=${DOMAIN:-esau.${ip//./-}.sslip.io}
  echo "    public IP: $ip"
  echo "    site name: $DOMAIN"

  say "Installing nginx, git and certbot (skips anything already installed)"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq git curl xz-utils nginx certbot python3-certbot-nginx >/dev/null
  systemctl enable --now nginx >/dev/null
  if command -v ufw >/dev/null && ufw status | grep -q 'Status: active'; then
    ufw allow 'Nginx Full' >/dev/null && echo "    firewall: opened ports 80 and 443"
  fi

  add_swap_if_needed

  say "Creating the esau user and folders"
  id esau >/dev/null 2>&1 || useradd --system --create-home --home-dir "$ROOT" --shell /bin/bash esau
  install -d -o esau -g esau -m 755 "$ROOT" "$ROOT/releases"
  install -d -o root -g esau -m 750 "$ETC"

  install_node

  say "Getting the code"
  if [ ! -d "$APP/.git" ]; then
    runuser -u esau -- git clone --quiet "$REPO" "$APP"
  fi
  chmod +x "$APP"/deploy/*.sh

  write_env
  local port
  port=$(sed -n 's/^PORT=//p' "$ENV_FILE" | tail -1)

  say "Installing the API service"
  install -m 644 "$APP/deploy/$SERVICE.service" /etc/systemd/system/$SERVICE.service
  systemctl daemon-reload
  systemctl enable $SERVICE >/dev/null 2>&1
  local systemctl_bin
  systemctl_bin=$(command -v systemctl)
  echo "esau ALL=(root) NOPASSWD: $systemctl_bin restart $SERVICE" >/etc/sudoers.d/esaus-trails
  chmod 440 /etc/sudoers.d/esaus-trails
  visudo -cf /etc/sudoers.d/esaus-trails >/dev/null || { rm -f /etc/sudoers.d/esaus-trails; die "sudoers check failed"; }

  say "Building the app (a few minutes on a small droplet)"
  "$APP/deploy/deploy.sh"

  write_nginx "$port"
  get_certificate

  local scheme=https
  [ -d "/etc/letsencrypt/live/$DOMAIN" ] || scheme=http
  say "Done. Open this on your phone:"
  printf '\n    \033[1m%s://%s\033[0m\n\n' "$scheme" "$DOMAIN"
  if ! grep -q '^ANTHROPIC_API_KEY=.\+' "$ENV_FILE"; then
    echo "Esau still needs your Anthropic key. Run:"
    echo "    sudo nano $ENV_FILE"
    echo "paste the key after ANTHROPIC_API_KEY=, save with Ctrl+O, Enter, Ctrl+X, then run:"
    echo "    sudo systemctl restart $SERVICE"
  fi
}

add_swap_if_needed() {
  # tsc and vite want more than the 1 GB a $6 droplet has, especially next to another app.
  if [ -z "$(swapon --show --noheadings)" ] && [ "$(df --output=avail -k / | tail -1)" -gt 4000000 ]; then
    say "Adding a 2 GB swap file so builds don't run out of memory"
    fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
    grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
  fi
}

install_node() {
  # A private Node for this app only, so the other project's Node (if any) is left alone.
  if [ -x "$ROOT/node/bin/node" ]; then
    echo "    node $("$ROOT/node/bin/node" -v) already installed"
    return
  fi
  say "Installing Node 22 for this app only"
  local arch base tarball tmp
  case "$(uname -m)" in x86_64) arch=x64 ;; aarch64) arch=arm64 ;; *) die "Unsupported CPU $(uname -m)" ;; esac
  base=https://nodejs.org/dist/latest-v22.x
  tarball=$(curl -fsS "$base/SHASUMS256.txt" | awk -v a="linux-$arch.tar.xz" '$2 ~ a"$" {print $2}')
  [ -n "$tarball" ] || die "Could not find a Node 22 download"
  tmp=$(mktemp -d)
  curl -fsSL "$base/$tarball" -o "$tmp/$tarball"
  (cd "$tmp" && curl -fsS "$base/SHASUMS256.txt" | grep " $tarball\$" | sha256sum -c --quiet -)
  install -d -o esau -g esau "$ROOT/node"
  tar -xJf "$tmp/$tarball" -C "$ROOT/node" --strip-components=1
  chown -R esau:esau "$ROOT/node"
  rm -rf "$tmp"
  echo "    node $("$ROOT/node/bin/node" -v)"
}

write_env() {
  if [ -f "$ENV_FILE" ]; then
    echo "    keeping existing $ENV_FILE"
    return
  fi
  say "Writing $ENV_FILE (you add the Anthropic key yourself)"
  local port=8787
  while ss -ltnH "sport = :$port" | grep -q .; do port=$((port + 1)); done
  cat >"$ENV_FILE" <<EOF
# Esau's Trails API settings. Only root and the esau user can read this file.
# Paste your key after the = sign, then: sudo systemctl restart $SERVICE
ANTHROPIC_API_KEY=
ESAU_MODEL=claude-opus-5-5
ESAU_EFFORT=low
ESAU_RATE_PER_MIN=20
ESAU_ALLOWED_ORIGINS=https://$DOMAIN,http://$DOMAIN
NWS_USER_AGENT=(esaus-trails, https://$DOMAIN)
HOST=127.0.0.1
PORT=$port
EOF
  chown root:esau "$ENV_FILE"
  chmod 640 "$ENV_FILE"
}

nginx_conf_path() {
  # Named zz- so it sorts last and can never become the default site for the other project's IP.
  if [ -d /etc/nginx/sites-enabled ] && grep -q 'sites-enabled' /etc/nginx/nginx.conf; then
    echo /etc/nginx/sites-available/zz-esaus-trails
  else
    echo /etc/nginx/conf.d/zz-esaus-trails.conf
  fi
}

write_nginx() {
  local port=$1 conf
  conf=$(nginx_conf_path)
  if [ -f "$conf" ]; then
    echo "    keeping existing $conf"
    return
  fi
  say "Adding the nginx site for $DOMAIN"
  sed -e "s/__DOMAINS__/$DOMAIN/g" -e "s/__PORT__/$port/g" "$APP/deploy/nginx.conf.template" >"$conf"
  [[ $conf == */sites-available/* ]] && ln -sfn "$conf" /etc/nginx/sites-enabled/zz-esaus-trails
  if ! nginx -t 2>/dev/null; then
    rm -f "$conf" /etc/nginx/sites-enabled/zz-esaus-trails
    nginx -t || true
    die "nginx rejected the config, so it was removed and nothing else changed."
  fi
  systemctl reload nginx
}

get_certificate() {
  if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    echo "    HTTPS certificate already in place"
    return
  fi
  say "Getting a free HTTPS certificate from Let's Encrypt"
  local email_args=(--register-unsafely-without-email)
  [ -n "${EMAIL:-}" ] && email_args=(-m "$EMAIL")
  if ! certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos "${email_args[@]}" --redirect; then
    warn "No certificate yet. The site works on http:// but phones will block GPS until it has HTTPS."
    warn "Check that ports 80 and 443 are open in the DigitalOcean firewall, then run: sudo certbot --nginx -d $DOMAIN --redirect"
  fi
}

main "$@"
exit
