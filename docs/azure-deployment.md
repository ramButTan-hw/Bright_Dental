# Azure deployment

## Architecture

- **Azure Container Registry (ACR):** private Docker images tagged per deployment.
- **Azure App Service:** Linux B1 plan by default; one container serves React and the API on port 3001.
- **Azure Database for MySQL Flexible Server:** MySQL 8.0, Burstable `Standard_B1ms`, 32 GB storage, seven days of backup retention.

App Service pulls images using its managed identity with `AcrPull`. MySQL requires TLS with certificate verification. The provisioning script allows the app's possible outbound IP addresses through the database firewall. It does not enable access from all Azure services. Re-run provisioning after changing App Service plans if outbound addresses change; remove obsolete firewall rules after confirming the new addresses work.

## First deployment

Prerequisites: Azure CLI, Python 3, curl, Git, and an Azure subscription. Sign in as an identity allowed to create resources, register resource providers, and assign roles (for example, Contributor plus Role Based Access Control Administrator at the resource group, with provider registration rights at subscription scope). ACR Tasks builds the Linux/amd64 image remotely; local Docker is optional for Azure deployment.

1. Copy `.env.azure.example` to `.env.azure` and fill in every required value. The registry, app, and MySQL server names must be globally unique. Keep secrets quoted because Bash reads this file.
2. Run `az login`, then `bash scripts/deploy-azure.sh` from the repository.
3. The script selects the configured subscription, creates resources, builds the image, configures identity, firewall, TLS, secrets, health checks, and HTTPS, then waits for the app and database to become ready. It prints the resulting URL.

The script is intended for resources dedicated to this application. Re-running it updates the image and app settings and reuses the database. For an existing server, supply its current administrator username and password; the script does not rotate database credentials. The example `.env.azure` values are independent from local `.env` values.

Secrets are stored in App Service settings and supplied at runtime, never baked into the image. Temporary settings files are permission restricted and removed after deployment. The initial deployment uses the MySQL administrator because bootstrap and existing startup routines create tables and triggers. If you later separate migrations from runtime, provision a restricted runtime database user as part of that change.

The script creates billable resources. Regional SKU availability and subscription policy may require overriding `AZURE_LOCATION`, `AZURE_PLAN_SKU`, or `AZURE_MYSQL_SKU`. The MySQL SKU override must be in the Burstable tier.

## Existing data and cutover

Provisioning initializes a new database; it does **not** transfer existing data or change DNS. To migrate existing data:

1. Back up the source database and pause writes during the final export/cutover. Keep the source available until validation is complete.
2. Provision Azure, then stop the app with `az webapp stop -g <group> -n <app>` before restoring data. Add a temporary MySQL firewall rule for the migration machine's public IP only.
3. Export tables, data, views, triggers, and `schema_migrations` using a MySQL-compatible dump tool. Restore into a separate empty database on the Azure server using a TLS-verified connection. Remove or rewrite source-specific `DEFINER` clauses for the Azure account; Azure does not provide `SUPER`. Do not import over a database containing valuable data.
4. Change `AZURE_DB_NAME` to the restored database and re-run deployment. Startup applies migrations absent from `schema_migrations`.
5. Verify the schema, user logins, appointments, billing, and data counts against the source. The repository schema contains no live user accounts. Remove the temporary firewall rule, then update custom-domain/DNS configuration and resume writes only after validation.

Do not run `npm run copy` on an existing deployment: it imports the entire base schema. Use `npm run bootstrap` to apply pending migrations. MySQL DDL is not transactional; if an import or migration fails, inspect the error and restore or repair the database before retrying. Bootstrap skips the base schema whenever it finds existing tables.

## GitHub Actions

`.github/workflows/azure.yml` runs on pull requests, pushes to `main`, and manual dispatch. Its verification job builds and starts the Docker image with MySQL, waits for readiness, verifies schema/migrations, and checks the frontend and API. Deployment runs only on `main` when repository variable `AZURE_DEPLOY_ENABLED` equals `true`.

Provision resources once before enabling deployment. Configure an Entra application/service principal or user-assigned identity with an OIDC federated credential for:

```text
repo:OWNER/REPOSITORY:environment:production
```

Use issuer `https://token.actions.githubusercontent.com` and audience `api://AzureADTokenExchange`. Grant the deployment identity Contributor on the application's resource group to update App Service and run ACR builds. The workflow does not require role-assignment privileges or database passwords; the web app's separate managed identity retains `AcrPull`.

Create a GitHub environment named `production` and these repository variables:

| Variable | Value |
| --- | --- |
| `AZURE_DEPLOY_ENABLED` | `true` once provisioning and OIDC are complete |
| `AZURE_CLIENT_ID` | OIDC identity's application/client ID |
| `AZURE_TENANT_ID` | Azure tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |
| `AZURE_RESOURCE_GROUP` | Provisioned resource group |
| `AZURE_WEBAPP_NAME` | Provisioned App Service name |
| `AZURE_ACR_NAME` | Registry resource name, without `.azurecr.io` |

Deployment tags images with the commit SHA, updates App Service, and waits for readiness. Production deployments are serialized. If the default branch differs, update both the workflow trigger and deployment condition.

## Runtime and verification settings

| Setting | Purpose |
| --- | --- |
| `PORT`, `WEBSITES_PORT` | Both `3001`; application port and App Service routing port |
| `DB_HOST`, `DB_PORT`, `DB_NAME` | MySQL endpoint, port, database |
| `DB_USER`, `DB_PASSWORD` | MySQL account credentials |
| `DB_SSL` | `true` on Azure; `false` for local Compose |
| `DB_SSL_CA` | Optional mounted CA bundle path; otherwise Node's trusted roots are used |
| `ADMIN_SECRET` | Secret checked by the existing administrator login flow |

Run `npm run verify:schema` with the normal `DB_*` settings. For checks against Azure from a workstation, configure `AZURE_DB_HOST`, `AZURE_DB_PORT`, `AZURE_DB_USER`, `AZURE_DB_PASSWORD`, and `AZURE_DB_NAME`, then run `npm run verify:schema:azure`. This target enables verified TLS by default; `AZURE_DB_SSL_CA` optionally specifies a CA file. The deployment file's `AZURE_MYSQL_USER/PASSWORD` are provisioning inputs, not verification variable names. Allow the workstation's IP through MySQL's firewall temporarily.

For local container verification:

```bash
docker compose exec app npm run verify:schema
bash scripts/check-deployment.sh http://localhost:3001
```

## Logs and rollback

```bash
az webapp log tail --resource-group <group> --name <app>
az webapp config container set --resource-group <group> --name <app> \
  --container-image-name <registry>.azurecr.io/bright-dental:<previous-tag> \
  --container-registry-url https://<registry>.azurecr.io
az webapp restart --resource-group <group> --name <app>
```

Rolling back an image does not reverse database migrations. Check schema compatibility before rollback; use MySQL point-in-time restore to a separate server if data/schema recovery is needed. This deployment uses in-place restarts; it does not configure deployment slots or guarantee uninterrupted service.

## References

- [Microsoft: custom container configuration, managed identity, and ports](https://learn.microsoft.com/en-us/azure/app-service/configure-custom-container)
- [Microsoft: App Service deployment with GitHub Actions and OIDC](https://learn.microsoft.com/en-us/azure/app-service/deploy-github-actions)
- [Microsoft: MySQL Flexible Server CLI and public access settings](https://learn.microsoft.com/en-us/cli/azure/mysql/flexible-server?view=azure-cli-latest)
