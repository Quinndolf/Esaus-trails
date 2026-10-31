#!/usr/bin/env bash
# Take Esau's Trails off this server and nothing else.
#
#   curl -fsSL https://raw.githubusercontent.com/Quinndolf/Esaus-trails/main/deploy/uninstall.sh | sudo bash
#
# Removes only what setup.sh created: the esaus-trails-api service, the zz-esaus-trails nginx site,
# the HTTPS certificate named in that site, /opt/esaus-trails, /etc/esaus-trails, the sudoers
# line and the esau user. Other sites, nginx itself, certbot, git, swap and firewall rules stay.
# Set DRY_RUN=1 to print what would be removed without removing anything.
set -uo pipefail

SERVICE=esaus-trails-api
UNIT=/etc/systemd/system/$SERVICE.service
ROOT=/opt/esaus-trails
ETC=/etc/esaus-trails
SUDOERS=/etc/sudoers.d/esaus-trails
NGINX_FILES=(
  /etc/nginx/sites-enabled/zz-esaus-trails
  /etc/nginx/sites-available/zz-esaus-trails
  /etc/nginx/conf.d/zz-esaus-trails.conf
)
removed=()
warnings=()

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
note_removed() {
  if [ "${DRY_RUN:-}" = 1 ]; then echo "    would remove: $1"; return; fi
  removed+=("$1"); echo "    removed: $1"
}
warn() { warnings+=("$1"); printf '\033[1;33m!!  %s\033[0m\n' "$1" >&2; }
run() {
  if [ "${DRY_RUN:-}" = 1 ]; then echo "    would run: $*"; return 0; fi
  "$@" </dev/null
}

main() {
  [ "$(id -u)" = 0 ] || { echo "Run this as root (put sudo in front)." >&2; exit 1; }
  [ "${DRY_RUN:-}" = 1 ] && say "DRY RUN: nothing will be changed"

  # Read the certificate names from our nginx file before it is deleted.
  local certs=() f name
  for f in "${NGINX_FILES[@]}"; do
    [ -f "$f" ] || continue
    while read -r name; do
      [ -n "$name" ] && [[ " ${certs[*]:-} " != *" $name "* ]] && certs+=("$name")
    done < <(sed -n 's#^\s*ssl_certificate\s\+/etc/letsencrypt/live/\([^/]*\)/fullchain.pem;.*#\1#p' "$f")
  done

  local live_dir
  for live_dir in /etc/letsencrypt/live/*/; do
    name=$(basename "$live_dir")
    case "$name" in
      esau.*.sslip.io | esau.*.sslip.io-[0-9]* | esaustrails.com | esaustrails.com-[0-9]* | www.esaustrails.com)
        [[ " ${certs[*]:-} " != *" $name "* ]] && certs+=("$name") ;;
    esac
  done

  say "Stopping the API"
  if [ -f "$UNIT" ] || systemctl is-active --quiet "$SERVICE" 2>/dev/null; then
    run systemctl disable --now "$SERVICE" >/dev/null 2>&1
    note_removed "service $SERVICE (stopped, disabled)"
  else
    echo "    no $SERVICE service found"
  fi
  if [ -f "$UNIT" ]; then
    run rm -f "$UNIT" && note_removed "$UNIT"
    run systemctl daemon-reload
    run systemctl reset-failed "$SERVICE" >/dev/null 2>&1
  fi

  say "Removing the nginx site"
  local touched_nginx=0
  for f in "${NGINX_FILES[@]}"; do
    if [ -e "$f" ] || [ -L "$f" ]; then
      run rm -f "$f" && note_removed "$f"
      touched_nginx=1
    fi
  done
  if [ "$touched_nginx" = 1 ] && [ "${DRY_RUN:-}" != 1 ]; then
    if nginx -t >/dev/null 2>&1; then
      systemctl reload nginx && echo "    nginx reloaded" || warn "nginx reload failed, run 'systemctl reload nginx' yourself"
    else
      warn "nginx -t fails without our site, so nginx was NOT reloaded. Run 'nginx -t' to see why."
    fi
  fi

  say "Removing the HTTPS certificate"
  if [ "${#certs[@]}" -eq 0 ]; then
    echo "    none named in our nginx site"
  fi
  for name in "${certs[@]}"; do
    # Only esau's own names. A certificate for anything else is never touched here.
    case "$name" in
      esau.*.sslip.io | esau.*.sslip.io-[0-9]* | esaustrails.com | esaustrails.com-[0-9]* | www.esaustrails.com)
        if command -v certbot >/dev/null; then
          run certbot delete --cert-name "$name" --non-interactive >/dev/null 2>&1 \
            && note_removed "certificate $name" || warn "could not delete certificate $name"
        else
          warn "certbot is not installed, so certificate $name was left in /etc/letsencrypt"
        fi ;;
      *) warn "left certificate '$name' alone, it is not an Esau name" ;;
    esac
  done

  say "Removing the app, its settings and the Anthropic key file"
  if [ -f "$SUDOERS" ]; then run rm -f "$SUDOERS" && note_removed "$SUDOERS"; fi
  local d
  for d in "$ROOT" "$ETC"; do
    if [ -e "$d" ]; then run rm -rf -- "$d" && note_removed "$d"; fi
  done

  say "Removing the esau user"
  if id esau >/dev/null 2>&1; then
    run pkill -KILL -u esau >/dev/null 2>&1
    [ "${DRY_RUN:-}" = 1 ] || sleep 1
    if run userdel esau || { [ "${DRY_RUN:-}" != 1 ] && sleep 2 && userdel esau </dev/null; }; then
      note_removed "user esau"
    else
      warn "could not remove user esau"
    fi
  else
    echo "    no esau user found"
  fi

  verify
}

verify() {
  if [ "${DRY_RUN:-}" = 1 ]; then
    say "Dry run finished: nothing was changed"
    return
  fi
  say "Checking it is gone"
  local left=0 p
  for p in "$UNIT" "$ROOT" "$ETC" "$SUDOERS" "${NGINX_FILES[@]}"; do
    if [ -e "$p" ] || [ -L "$p" ]; then echo "    STILL THERE: $p"; left=1; fi
  done
  id esau >/dev/null 2>&1 && { echo "    STILL THERE: user esau"; left=1; }
  systemctl is-active --quiet "$SERVICE" 2>/dev/null && { echo "    STILL RUNNING: $SERVICE"; left=1; }
  [ "$left" = 0 ] && echo "    nothing of Esau's Trails is left"

  say "Left alone on purpose (for whoever checks this server next)"
  echo "    nginx, certbot, git, the swap file and firewall rules stay as they are."
  local sites=() site
  for site in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*; do [ -e "$site" ] && sites+=("$(basename "$site")"); done
  echo "    nginx sites now enabled:  ${sites[*]:-none}"
  echo "    nginx config test:        $(nginx -t 2>&1 | tail -1)"
  echo "    listening on 80/443:      $(ss -ltnH 'sport = :80 or sport = :443' 2>/dev/null | awk '{print $4}' | tr '\n' ' ')"
  local live=() c
  for c in /etc/letsencrypt/live/*/; do [ -d "$c" ] && live+=("$(basename "$c")"); done
  echo "    certificates remaining:   ${live[*]:-none}"
  echo
  echo "Removed (${#removed[@]}):"
  [ "${#removed[@]}" -gt 0 ] && printf '    - %s\n' "${removed[@]}"
  [ "${#warnings[@]}" -gt 0 ] && { echo "Warnings:"; printf '    - %s\n' "${warnings[@]}"; }
  [ "$left" = 0 ] || exit 1
}

main "$@"
exit
