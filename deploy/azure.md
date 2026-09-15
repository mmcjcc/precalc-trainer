# Deploying Precalc Trainer to Azure Container Apps

The app is a static single-page app served by nginx from a ~25 MB image. It runs on Azure
Container Apps (consumption plan, scale to zero), pulls its image from GitHub Container Registry
(GHCR), and gets its family PIN from a Container Apps secret at start-up. Expected cost at family
usage: about $0 (see §7).

Files involved:

| File | Role |
|---|---|
| `Dockerfile` | `node:22-alpine` build → `nginx:stable-alpine-slim` runtime |
| `nginx.conf` | SPA fallback, cache policy, security headers, `/api/` stub, `/healthz` |
| `docker/20-config.sh` | writes `/config.js` from `APP_PIN` or `APP_PIN_HASH` at container start |
| `deploy/smoke.sh` | boots the image and checks the whole contract (run by CI) |
| `.github/workflows/ci.yml` | typecheck, tests, build, Docker build + smoke on every PR/push |
| `.github/workflows/deploy.yml` | on push to `main`: build → smoke → push to GHCR → `az containerapp update` |

## 1. Run it locally with Docker

```bash
docker build --platform linux/amd64 -t precalc-trainer .
docker run --rm -p 8080:80 -e APP_PIN=1234 precalc-trainer
curl -s http://localhost:8080/config.js      # window.__PRECALC_CONFIG__ = { pinHash: "03ac67…" }
bash deploy/smoke.sh precalc-trainer          # full contract check (needs docker + curl)
```

Without `APP_PIN` the app shows no PIN gate. `APP_PIN_HASH` (a 64-character SHA-256 hex) is
honored verbatim and wins over `APP_PIN`, which lets the plaintext PIN stay out of Azure entirely:

```bash
printf '%s' "$PIN" | sha256sum | cut -d' ' -f1
```

## 2. One-time Azure setup

```bash
az login
az extension add --name containerapp --upgrade --yes
az provider register -n Microsoft.App --wait

LOC=eastus2; RG=precalc-rg; ENV=precalc-env; APP=precalc
az group create -n $RG -l $LOC
az containerapp env create -n $ENV -g $RG -l $LOC --logs-destination none
```

`--logs-destination none` skips the Log Analytics workspace (the only line item that would
otherwise cost money at this scale); `az containerapp logs show` still streams live logs.

## 3. First deploy (bootstrapping order matters)

1. Push the repository to GitHub with `main` as the default branch. `deploy.yml` runs, builds the
   image, smoke-tests it, pushes `ghcr.io/<owner>/precalc-trainer:<sha>` and `:latest`, and
   **skips the Azure roll-out** because `AZURE_CLIENT_ID` is not set yet.
2. Make the package public: GitHub → your profile → Packages → `precalc-trainer` → Package
   settings → Change visibility → Public. (Private works too; see the registry note below.)
3. Create the Container App from that image, with the PIN hash as a secret:

```bash
OWNER=<github-user-in-lowercase>
IMG=ghcr.io/$OWNER/precalc-trainer:latest
PIN_SHA=$(printf '%s' "$PIN" | sha256sum | cut -d' ' -f1)

az containerapp create -n $APP -g $RG --environment $ENV \
  --image $IMG \
  --ingress external --target-port 80 --transport auto \
  --min-replicas 0 --max-replicas 1 --cpu 0.25 --memory 0.5Gi \
  --secrets app-pin-hash=$PIN_SHA \
  --env-vars APP_PIN_HASH=secretref:app-pin-hash

az containerapp show -n $APP -g $RG --query properties.configuration.ingress.fqdn -o tsv
```

Open `https://<fqdn>`; the PIN gate should appear. Secret names must be lowercase letters, digits
and hyphens. Valid consumption sizes include 0.25 vCPU / 0.5 GiB (the smallest).

Private package instead of public: add to `create`
`--registry-server ghcr.io --registry-username $OWNER --registry-password <classic PAT with read:packages>`.
The PAT expires; put a reminder in the calendar or keep the package public.

## 4. Let GitHub Actions roll out on every push (OIDC, nothing that expires)

```bash
SUB=$(az account show --query id -o tsv); TENANT=$(az account show --query tenantId -o tsv)
APP_ID=$(az ad app create --display-name precalc-gh-deploy --query appId -o tsv)
az ad sp create --id $APP_ID
SP_OID=$(az ad sp show --id $APP_ID --query id -o tsv)
az role assignment create --assignee-object-id $SP_OID --assignee-principal-type ServicePrincipal \
  --role Contributor --scope /subscriptions/$SUB/resourceGroups/$RG
az ad app federated-credential create --id $APP_ID --parameters '{
  "name": "gh-main",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:<github-user>/precalc-trainer:ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"] }'
echo "AZURE_CLIENT_ID=$APP_ID  AZURE_TENANT_ID=$TENANT  AZURE_SUBSCRIPTION_ID=$SUB"
```

GitHub → repository → Settings → Secrets and variables → Actions:

| Kind | Name | Value |
|---|---|---|
| Secret | `AZURE_CLIENT_ID` | `$APP_ID` |
| Secret | `AZURE_TENANT_ID` | `$TENANT` |
| Secret | `AZURE_SUBSCRIPTION_ID` | `$SUB` |
| Variable (optional) | `ACA_APP_NAME` | `precalc` (default) |
| Variable (optional) | `ACA_RESOURCE_GROUP` | `precalc-rg` (default) |

The federated credential's `subject` must match the trigger exactly (`ref:refs/heads/main`); a
mismatch fails with an unhelpful "no matching federated identity" error. From now on every push to
`main` deploys the commit-SHA tag and waits for `/healthz`. A client-secret alternative is
documented inside `deploy.yml`; it is simpler but the secret expires after a year.

## 5. Change the PIN

Secrets do not create or restart revisions, so restart the active one:

```bash
NEW_SHA=$(printf '%s' "$NEW_PIN" | sha256sum | cut -d' ' -f1)
az containerapp secret set -n $APP -g $RG --secrets app-pin-hash=$NEW_SHA
REV=$(az containerapp revision list -n $APP -g $RG --query "[?properties.active].name" -o tsv)
az containerapp revision restart -n $APP -g $RG --revision $REV
```

Every device then asks for the PIN again on its next visit (the app stores only an "unlocked" flag).

## 6. Operate

```bash
az containerapp logs show -n $APP -g $RG --type console --follow   # nginx + entrypoint output
az containerapp logs show -n $APP -g $RG --type system             # scaling, pulls, probes
az containerapp revision list -n $APP -g $RG -o table
```

Custom domain (optional): `az containerapp hostname add` then `az containerapp hostname bind`
with `--validation-method CNAME` and a managed certificate; both are free.

## 7. Cost and cold starts

| Item | Value |
|---|---|
| Monthly free grant per subscription | 180,000 vCPU-seconds, 360,000 GiB-seconds, 2 M requests |
| Equivalent at 0.25 vCPU / 0.5 GiB | ~200 replica-hours per month |
| Scale-to-zero cooldown | 300 s after the last request |
| Cold start (small image, GHCR pull) | plan for 3–10 s on the first open of a session |
| GHCR | public package free; private: 500 MB storage, 1 GB transfer per month on GitHub Free |

Family usage (an hour a day) stays inside the free grant, so the bill is ~$0. Keeping one replica
warm around the clock (`--min-replicas 1`) needs ~720 replica-hours and would cost a few dollars a
month; the cold start is a better trade.

### Static Web Apps as the $0 alternative

If the tutor API never materializes, Azure Static Web Apps Free hosts `dist/` with a global CDN and
no cold start (`swa deploy dist --env production`). Caveats: the Free tier has no password
protection (Standard only), so access stays as it is today (client-side PIN); and the runtime
`/config.js` trick does not exist, so bake the PIN hash at build time instead
(`public/config.js` checked in with the hash). Managed Functions are included on Free, so a
future API would fit there too.

## 8. Security, honestly

The PIN gate is a deterrent, not authentication: `/config.js` is public, so anyone can read the
hash and, with a four-digit PIN, brute-force it offline in seconds. No personal data lives on the
server; progress is in each device's localStorage. If real access control is ever needed, the cheap
upgrade is nginx basic auth in the same image — add to `nginx.conf` at server level

```nginx
auth_basic           "Precalc";
auth_basic_user_file /etc/nginx/.htpasswd;
```

and an executable `/docker-entrypoint.d/40-htpasswd.sh`

```sh
#!/bin/sh
set -eu
printf 'amelia:%s\n' "$(openssl passwd -apr1 "$APP_PIN")" > /etc/nginx/.htpasswd
```

with the plaintext secret `--secrets app-pin=$PIN --env-vars APP_PIN=secretref:app-pin`. Browsers
then prompt natively (iOS home-screen mode handles this poorly, which is why v1 uses the in-app
gate). A tiny `/api` PIN check is the other path; `nginx.conf` already reserves the route.
