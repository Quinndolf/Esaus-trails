#!/usr/bin/env bash
# Pull main, test, build a fresh release, point the site at it, restart the API.
# Runs on the droplet as the "esau" user. Root may call it too; it switches to esau.
# Used by setup.sh, by hand (sudo /opt/esaus-trails/app/deploy/deploy.sh) and by the GitHub Action.
set -euo pipefail

ROOT=/opt/esaus-trails
APP=$ROOT/app
KEEP_RELEASES=3

# Everything lives in main() so bash has read the whole script before
# "git reset" below swaps this file for the new version.
main() {
  if [ "$(id -un)" != esau ]; then
    exec runuser -u esau -- "$0" "$@"
  fi
  export PATH=$ROOT/node/bin:$PATH
  cd "$APP"

  echo "==> Pulling main"
  git fetch --quiet origin main
  git reset --quiet --hard origin/main
  echo "    now at $(git log -1 --format='%h %s')"

  echo "==> Installing packages"
  npm ci --no-audit --no-fund --loglevel=error

  echo "==> Running tests"
  npm test --silent

  local release
  release=$ROOT/releases/$(date +%Y%m%d-%H%M%S)-$(git rev-parse --short HEAD)
  echo "==> Building into $release"
  npm run build --silent -- --outDir "$release" --emptyOutDir

  # Swap the live site in one step so nobody loads half a build.
  ln -sfn "$release" "$ROOT/site.next"
  mv -T "$ROOT/site.next" "$ROOT/site"
  ls -1dt "$ROOT"/releases/* | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf

  echo "==> Restarting the API"
  sudo -n systemctl restart esaus-trails-api

  local port
  port=$(sed -n 's/^PORT=//p' /etc/esaus-trails/esau.env 2>/dev/null | tail -1)
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fsS "http://127.0.0.1:${port:-8787}/api/health" >/dev/null 2>&1; then
      echo "==> Live: $(curl -fsS "http://127.0.0.1:${port:-8787}/api/health")"
      return 0
    fi
    sleep 1
  done
  echo "!! The API did not answer. Look with: sudo journalctl -u esaus-trails-api -n 50" >&2
  return 1
}

main "$@"
exit
