#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

for tool in az python3 curl; do
  command -v "$tool" >/dev/null || { echo "Missing prerequisite: $tool" >&2; exit 1; }
done
if [[ -f .env.azure ]]; then
  set -a
  source .env.azure
  set +a
fi
for name in AZURE_SUBSCRIPTION_ID AZURE_RESOURCE_GROUP AZURE_LOCATION AZURE_WEBAPP_NAME AZURE_ACR_NAME AZURE_MYSQL_SERVER AZURE_MYSQL_USER AZURE_MYSQL_PASSWORD ADMIN_SECRET; do
  [[ -n "${!name:-}" ]] || { echo "Set $name in .env.azure or your environment." >&2; exit 1; }
done
export AZURE_MYSQL_USER AZURE_MYSQL_PASSWORD ADMIN_SECRET
export AZURE_DB_NAME="${AZURE_DB_NAME:-medical-clinic}"
plan_name="${AZURE_WEBAPP_NAME}-plan"
image_tag="$(git rev-parse --short HEAD)-$(date -u +%Y%m%d%H%M%S)"

az account show --output none
az account set --subscription "$AZURE_SUBSCRIPTION_ID"
az group create --name "$AZURE_RESOURCE_GROUP" --location "$AZURE_LOCATION" --output none
for provider in Microsoft.Web Microsoft.ContainerRegistry Microsoft.DBforMySQL; do
  az provider register --namespace "$provider" --wait --output none
done
az acr create --resource-group "$AZURE_RESOURCE_GROUP" --name "$AZURE_ACR_NAME" --sku Basic --admin-enabled false --output none
registry_id=$(az acr show -g "$AZURE_RESOURCE_GROUP" -n "$AZURE_ACR_NAME" --query id -o tsv)
registry_host=$(az acr show -g "$AZURE_RESOURCE_GROUP" -n "$AZURE_ACR_NAME" --query loginServer -o tsv)
image="$registry_host/bright-dental:$image_tag"
# Build on Azure's Linux builders; no local Docker daemon is required.
az acr build --registry "$AZURE_ACR_NAME" --image "bright-dental:$image_tag" --platform linux/amd64 .

if ! az mysql flexible-server show -g "$AZURE_RESOURCE_GROUP" -n "$AZURE_MYSQL_SERVER" --output none 2>/dev/null; then
  az mysql flexible-server create --resource-group "$AZURE_RESOURCE_GROUP" \
    --name "$AZURE_MYSQL_SERVER" --location "$AZURE_LOCATION" \
    --admin-user "$AZURE_MYSQL_USER" --admin-password "$AZURE_MYSQL_PASSWORD" \
    --sku-name "${AZURE_MYSQL_SKU:-Standard_B1ms}" --tier Burstable --version 8.0 \
    --storage-size 32 --backup-retention 7 --public-access None --yes --output none
fi
az mysql flexible-server db create -g "$AZURE_RESOURCE_GROUP" -s "$AZURE_MYSQL_SERVER" \
  -d "$AZURE_DB_NAME" --output none
az mysql flexible-server parameter set -g "$AZURE_RESOURCE_GROUP" -s "$AZURE_MYSQL_SERVER" \
  -n require_secure_transport -v ON --output none
# The schema creates triggers; managed MySQL does not grant SUPER privileges.
az mysql flexible-server parameter set -g "$AZURE_RESOURCE_GROUP" -s "$AZURE_MYSQL_SERVER" \
  -n log_bin_trust_function_creators -v ON --output none
export AZURE_DB_HOST
AZURE_DB_HOST=$(az mysql flexible-server show -g "$AZURE_RESOURCE_GROUP" -n "$AZURE_MYSQL_SERVER" --query fullyQualifiedDomainName -o tsv)

az appservice plan create -g "$AZURE_RESOURCE_GROUP" -n "$plan_name" \
  --location "$AZURE_LOCATION" --is-linux --sku "${AZURE_PLAN_SKU:-B1}" --output none
if ! az webapp show -g "$AZURE_RESOURCE_GROUP" -n "$AZURE_WEBAPP_NAME" --output none 2>/dev/null; then
  az webapp create -g "$AZURE_RESOURCE_GROUP" -p "$plan_name" -n "$AZURE_WEBAPP_NAME" \
    --container-image-name "$image" --output none
fi
principal_id=$(az webapp identity assign -g "$AZURE_RESOURCE_GROUP" -n "$AZURE_WEBAPP_NAME" --query principalId -o tsv)
az role assignment create --assignee-object-id "$principal_id" --assignee-principal-type ServicePrincipal \
  --role AcrPull --scope "$registry_id" --output none
az webapp config set -g "$AZURE_RESOURCE_GROUP" -n "$AZURE_WEBAPP_NAME" \
  --always-on true --http20-enabled true --min-tls-version 1.2 --ftps-state Disabled \
  --generic-configurations '{"acrUseManagedIdentityCreds":true,"healthCheckPath":"/api/ready"}' --output none
az webapp update -g "$AZURE_RESOURCE_GROUP" -n "$AZURE_WEBAPP_NAME" --https-only true --output none

# Allow only this App Service's possible outbound addresses to reach MySQL.
outbound_ips=$(az webapp show -g "$AZURE_RESOURCE_GROUP" -n "$AZURE_WEBAPP_NAME" --query possibleOutboundIpAddresses -o tsv)
[[ -n "$outbound_ips" ]] || { echo 'App Service returned no outbound IPs.' >&2; exit 1; }
IFS=',' read -r -a addresses <<< "$outbound_ips"
for ip in "${addresses[@]}"; do
  az mysql flexible-server firewall-rule create -g "$AZURE_RESOURCE_GROUP" -n "$AZURE_MYSQL_SERVER" \
    --rule-name "app-${ip//./-}" --start-ip-address "$ip" --end-ip-address "$ip" --output none
done

# Avoid printing secrets in Azure command output or storing them in the repository.
umask 077
settings_file=$(mktemp)
trap 'rm -f "$settings_file"' EXIT
python3 - "$settings_file" <<'PY'
import json, os, sys
settings = {
    'NODE_ENV': 'production', 'PORT': '3001', 'WEBSITES_PORT': '3001',
    'WEBSITES_ENABLE_APP_SERVICE_STORAGE': 'false',
    'WEBSITES_CONTAINER_START_TIME_LIMIT': '600',
    'WEBSITE_WARMUP_PATH': '/api/ready', 'WEBSITE_WARMUP_STATUSES': '200',
    'DB_HOST': os.environ['AZURE_DB_HOST'], 'DB_PORT': '3306',
    'DB_USER': os.environ['AZURE_MYSQL_USER'], 'DB_PASSWORD': os.environ['AZURE_MYSQL_PASSWORD'],
    'DB_NAME': os.environ['AZURE_DB_NAME'], 'DB_SSL': 'true',
    'ADMIN_SECRET': os.environ['ADMIN_SECRET']
}
with open(sys.argv[1], 'w') as f:
    json.dump(settings, f)
PY
az webapp config appsettings set -g "$AZURE_RESOURCE_GROUP" -n "$AZURE_WEBAPP_NAME" \
  --settings "@$settings_file" --output none
az webapp config container set -g "$AZURE_RESOURCE_GROUP" -n "$AZURE_WEBAPP_NAME" \
  --container-image-name "$image" --container-registry-url "https://$registry_host" --output none
az webapp log config -g "$AZURE_RESOURCE_GROUP" -n "$AZURE_WEBAPP_NAME" --docker-container-logging filesystem --output none
az webapp restart -g "$AZURE_RESOURCE_GROUP" -n "$AZURE_WEBAPP_NAME" --output none
hostname=$(az webapp show -g "$AZURE_RESOURCE_GROUP" -n "$AZURE_WEBAPP_NAME" --query defaultHostName -o tsv)
bash scripts/check-deployment.sh "https://$hostname"
echo "Deployed $image to https://$hostname"
