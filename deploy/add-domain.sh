#!/usr/bin/env bash
# Point a real domain (e.g. esaustrails.com) at the app once its DNS A record points at this droplet.
#
#   sudo /opt/esaus-trails/app/deploy/add-domain.sh esaustrails.com
#
# Adds the domain and its www. name to the nginx site, Esau's allowed origins and the HTTPS certificate.
# The old sslip.io address keeps working.
set -euo pipefail

main() {
  [ "$(id -u)" = 0 ] || { echo "Run with sudo." >&2; exit 1; }
  local domain=${1:?Usage: add-domain.sh esaustrails.com}
  local env_file=/etc/esaus-trails/esau.env conf ip resolved
  conf=$(ls /etc/nginx/sites-available/zz-esaus-trails /etc/nginx/conf.d/zz-esaus-trails.conf 2>/dev/null | head -1)
  [ -n "$conf" ] || { echo "Run setup.sh first." >&2; exit 1; }

  ip=$(curl -fsS --max-time 3 http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address 2>/dev/null \
    || curl -fsS --max-time 5 https://api.ipify.org)
  for name in "$domain" "www.$domain"; do
    resolved=$(getent ahostsv4 "$name" | awk 'NR==1{print $1}')
    if [ "$resolved" != "$ip" ]; then
      echo "$name points at '${resolved:-nothing}', not this droplet ($ip)." >&2
      echo "Add A records for @ and www pointing at $ip where you bought the domain, wait a few minutes, then run this again." >&2
      exit 1
    fi
  done

  # Every server_name line in our file (certbot copies it into the HTTPS block) gets the new names.
  grep -q "server_name.* ${domain}[ ;]" "$conf" || sed -i -E "s/^(\s*server_name [^;]*);/\1 $domain www.$domain;/" "$conf"
  nginx -t
  systemctl reload nginx

  local names
  names=$(grep -m1 -oP '^\s*server_name \K[^;]+' "$conf")
  local args=()
  for n in $names; do args+=(-d "$n"); done
  certbot --nginx --expand --non-interactive --agree-tos --register-unsafely-without-email --redirect "${args[@]}"

  if ! grep -q "https://$domain" "$env_file"; then
    sed -i -E "s#^(ESAU_ALLOWED_ORIGINS=.*)#\1,https://$domain,https://www.$domain#" "$env_file"
  fi
  systemctl restart esaus-trails-api
  echo
  echo "Done: https://$domain"
}

main "$@"
exit
