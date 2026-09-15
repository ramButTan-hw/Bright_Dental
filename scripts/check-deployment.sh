#!/usr/bin/env bash
set -euo pipefail
base_url="${1:?Usage: check-deployment.sh https://your-app-host}"
for attempt in $(seq 1 60); do
  if curl --fail --silent --show-error --max-time 10 "$base_url/api/ready" >/dev/null 2>&1; then
    curl --fail --silent --show-error --max-time 20 "$base_url/" | grep -q '<div id="root">'
    echo "Application and database are ready at $base_url"
    exit 0
  fi
  sleep 10
done
echo "Application did not become ready at $base_url; inspect container logs." >&2
exit 1
