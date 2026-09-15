# LENS: Containerization, Azure Container Apps deployment, CI (GHCR + GitHub Actions), and security. Sources checked: learn.microsoft.com (az containerapp / containerapp env CLI reference, containers, billing, scale-app, cold-start, github-actions, manage-secrets, OIDC login, Entra federated credentials, Static Web Apps plans + password-protection), docs.github.com (container registry, Packages billing), docker-library repo-info (nginx image sizes) and the nginx docker alpine-slim Dockerfile.

## Findings

### D1 [blocker] Security / PIN delivery
**Claim:** The spec's PIN design is self-contradictory and, as written, ships the PIN hash to anyone who can pull the image: 'hash baked at build time' cannot be fed by 'APP_PIN delivered via Container Apps secret -> env', and a static nginx container cannot hand a runtime env var to the browser unless something writes it into a served file.

**Evidence:** Vite inlines VITE_* values at build time, so a baked hash lives in dist/assets/index-<hash>.js inside the image. If the GHCR package is public (the cheapest option, see D4) the image is anonymously pullable (docs.github.com: 'you can also access public container images anonymously'), and a 4-6 digit PIN's SHA-256 is brute-forced in milliseconds offline. Conversely, a runtime APP_PIN env var is invisible to nginx-served static files; the nginx image only applies envsubst to /etc/nginx/templates/*.template -> /etc/nginx/conf.d (nginx docker README, NGINX_ENVSUBST_* vars).

**Recommendation:** State honestly in the spec that any client-side PIN check is a speed bump, then move the gate into nginx so the secret never enters the image: ACA secret app-pin-sha256 -> env APP_PIN_SHA256 -> nginx `map $cookie_pc_auth` in an envsubst template; a tiny unauthenticated /gate.html computes SHA-256 with crypto.subtle and redirects to /gate/set?t=<hex>, where nginx sets an HttpOnly cookie. Everything else (index.html, /assets/) is served only when the cookie matches. Even cheaper alternative: Basic auth via an .htpasswd written at container start (`openssl passwd -apr1 "$APP_PIN"`; openssl is in alpine-slim) - but iOS home-screen/standalone mode handles Basic-auth prompts badly, so prefer the cookie gate for a phone-first student. Full config in reference. Real upgrade path later: the /api sidecar validates the PIN and issues the cookie, nginx keeps the same `map` check.

### D2 [major] Dockerfile / image size
**Claim:** nginx:alpine alone is ~69 MB on disk, so the '<60 MB' target is missed before dist/ is added; nginx:alpine-slim meets it with margin and keeps everything the deployment needs.

**Evidence:** docker-library/repo-info local/alpine.md lists nginx:1.31.5-alpine 'Virtual Size: ~ 68.98 Mb'; remote/alpine.md compressed total 19.6 MB. alpine-slim: 'Virtual Size: ~ 18.87 Mb', compressed 8.2 MB. The alpine-slim Dockerfile still installs `gettext-envsubst`, `openssl`, `tzdata` and copies 10-listen-on-ipv6-by-default.sh, 15-local-resolvers.envsh, 20-envsubst-on-templates.sh, 30-tune-worker-processes.sh into /docker-entrypoint.d - i.e. the envsubst templating used in D1 works unchanged. Estimated dist/: React 18 + math.js (~1 MB raw even tree-shaken) + function-plot/d3 + KaTeX JS/CSS + 60 KaTeX font files (~2.7 MB) ~= 5 MB. Final image ~25 MB on disk / ~10 MB pull.

**Recommendation:** Use `FROM nginx:stable-alpine-slim` (pin by digest in the Dockerfile; Renovate/Dependabot can bump it). Keep gzip on in nginx (gzip is a core module, present in slim). Measure with `docker image inspect --format '{{.Size}}'` in CI and fail if > 40 MB so the budget is enforced, not aspirational.

### D3 [major] nginx / envsubst
**Claim:** Using the nginx image's template mechanism without NGINX_ENVSUBST_FILTER silently destroys the config: envsubst replaces every `$name` it sees, including nginx's own `$uri`, `$host`, `$cookie_pc_auth`, `$arg_t`, with empty strings.

**Evidence:** nginx docker README: NGINX_ENVSUBST_FILTER is 'A regular expression to filter environment variable names passed to envsubst' - without it, all environment variables are candidates and envsubst substitutes any `$VAR` token in the template. A template containing `try_files $uri $uri/ /index.html` renders as `try_files   /index.html` and every deep link 404s or loops.

**Recommendation:** In the Dockerfile set `ENV NGINX_ENVSUBST_FILTER='^APP_'` and name all injected variables APP_* (APP_PIN_SHA256). Write the template with `${APP_PIN_SHA256}` braces for clarity. Add a CI smoke step: run the image with APP_PIN_SHA256=x and curl `/` (expect 302 /gate.html) and `/gate/set?t=<64 hex>` (expect 302 + Set-Cookie).

### D4 [major] GHCR pull / registry credentials
**Claim:** A private GHCR package pulled with a PAT introduces three independent ways for the app to go dark weeks later; a public package avoids all of them and is safe once D1 removes secrets from the image.

**Evidence:** (a) docs.github.com: 'GitHub Packages only supports authentication using a personal access token (classic)' with `read:packages` - classic PATs expire unless set to no-expiry. (b) With --min-replicas 0, every scale-from-zero on a node without the layers cached re-pulls the image; an expired PAT means the next cold start fails with an image-pull error and there is no deploy to alert you. (c) GitHub Free private packages: '500MB' storage and '1GB' data transfer per month; each CI push stores another ~10 MB version, and pulls from Azure count toward transfer (only GITHUB_TOKEN-authenticated Actions transfer is exempt). (d) learn.microsoft.com github-actions doc: 'When using a non-ACR registry such as GHCR, you must configure your container app to authenticate with the registry even if the image is public' - via `az containerapp registry set --server ghcr.io` with no username/password for public images.

**Recommendation:** Make the package public (Package settings -> Change visibility) and add `LABEL org.opencontainers.image.source=https://github.com/<user>/precalc-trainer` so it links to the repo; run `az containerapp registry set -n precalc -g precalc-rg --server ghcr.io` once. If it must stay private: create a no-expiry classic PAT with read:packages, pass `--registry-server ghcr.io --registry-username <user> --registry-password <PAT>` on create (the CLI stores it as an app secret; verify with `az containerapp secret list`), and add `actions/delete-package-versions` to the workflow to keep <500 MB.

### D5 [major] CI / deploy
**Claim:** Deploying with a stable `:latest` tag and `az containerapp update --image ...:latest` does not reliably roll out new builds: the container template is unchanged, so no new revision is created and the old image keeps running.

**Evidence:** learn.microsoft.com containers doc: 'Avoid using static tags like latest ... Instead, use unique tags for each deployment, such as a Git hash'; github-actions doc: 'Use a unique tag such as the Git commit SHA (${{ github.sha }}) instead of a generic tag like latest. This helps avoid caching issues and ensures new revisions are created reliably.'

**Recommendation:** Tag `ghcr.io/<user>/precalc-trainer:${{ github.sha }}` (plus `:latest` for humans) and run `az containerapp update -n precalc -g precalc-rg --image ghcr.io/<user>/precalc-trainer:${{ github.sha }}`. Keep the app in single-revision mode (default) so the previous revision is deactivated automatically.

### D6 [major] Azure secrets
**Claim:** `APP_PIN` cannot be the name of a Container Apps secret, and updating a secret does not restart the running revision, so the documented 'set secret -> env' flow needs two corrections or PIN rotation will appear to do nothing.

**Evidence:** ACA secret names must be lowercase alphanumerics and hyphens (the ARM validation rejects `APP_PIN`); the CLI pattern from the manage-secrets doc is `--secrets "queue-connection-string=..." --env-vars "ConnectionString=secretref:queue-connection-string"`. Same doc: 'New revisions don't get generated through adding, removing, or changing secrets' and 'An updated or deleted secret doesn't automatically affect existing revisions ... 1. Deploy a new revision. 2. Restart an existing revision.'

**Recommendation:** Use `--secrets app-pin-sha256=<sha> --env-vars APP_PIN_SHA256=secretref:app-pin-sha256`. Document rotation as: `az containerapp secret set -n precalc -g precalc-rg --secrets app-pin-sha256=<newsha>` then `az containerapp revision restart -n precalc -g precalc-rg --revision <active revision name>` (or any `az containerapp update` that changes the template). Compute the sha with `printf '%s' "$PIN" | sha256sum | cut -d' ' -f1` (no trailing newline; the gate page hashes the trimmed PIN).

### D7 [major] Docker build platform
**Claim:** A locally built image from an Apple Silicon or ARM machine will not run on Container Apps; the platform must be pinned in both the workflow and the docs.

**Evidence:** learn.microsoft.com containers doc, Limitations: 'Linux-based (linux/amd64) container images are required.' `docker build` on an M-series Mac defaults to linux/arm64; the replica then dies with 'exec format error' and ACA shows a crash loop with no obvious cause.

**Recommendation:** In docker/build-push-action set `platforms: linux/amd64`; in deploy/azure.md show `docker build --platform linux/amd64 ...` for any manual push. No QEMU/multi-arch is needed.

### D8 [major] nginx cache headers
**Claim:** Without split caching (index.html no-cache, /assets/* immutable) a phone that cached index.html will, after any deploy, request chunk files that no longer exist in the new image and show a blank app; and the obvious `add_header Cache-Control` per-location implementation silently drops the server-level security headers.

**Evidence:** Vite emits content-hashed files under /assets/ and a non-hashed index.html; a stale index.html referencing `index-OLDHASH.js` gets 404 from the new container. nginx add_header docs: 'These directives are inherited from the previous configuration level if and only if there are no add_header directives defined on the current level' - so a `location /assets/ { add_header Cache-Control ... }` block loses CSP/X-Content-Type-Options set at server level.

**Recommendation:** Use the `expires` directive instead of add_header for caching: `location /assets/ { expires max; try_files $uri =404; }` (Cache-Control: max-age=315360000) and `location / { expires -1; try_files $uri $uri/ /index.html; }` (Cache-Control: no-cache). Keep security headers once at server level with `always`. Also mark /gate.html, /gate.js and any runtime config no-cache.

### D9 [minor] /api proxy stub
**Claim:** The reserved /api location must fail fast and must point at localhost, because Container Apps exposes exactly one target port per app and the future Node API will be a sidecar container in the same replica.

**Evidence:** learn.microsoft.com containers doc: sidecar containers in one container app 'share hard disk and network resources' and ingress has a single `--target-port`. If /api falls through to `try_files ... /index.html`, a stray `fetch('/api/explain')` gets HTTP 200 with HTML and the SPA's JSON parse throws a confusing error.

**Recommendation:** `location /api/ { return 503; # proxy_pass http://127.0.0.1:3000; ... }` now; when the API ships, add it as a second container in the same app (`az containerapp update --yaml` or `containerapp create --yaml` with two containers) and uncomment proxy_pass to 127.0.0.1:<port>. Keep `--target-port 80` unchanged so the origin never changes.

### D10 [minor] CI auth to Azure
**Claim:** Use OIDC federated credentials rather than a service-principal JSON secret: the secret variant is another expiring credential, and the federated subject must match the workflow trigger exactly or login fails without a useful error.

**Evidence:** learn.microsoft.com OIDC doc: azure/login@v2 with `client-id`, `tenant-id`, `subscription-id` and job `permissions: id-token: write`. Entra federated-credential doc: subject for a branch-triggered job is `repo:<Org/Repo>:ref:refs/heads/main`, and 'The subject setting values must exactly match the configuration on the GitHub workflow configuration. Otherwise ... the exchange fails without error.' `az ad sp create-for-rbac --json-auth` client secrets default to a 1-year expiry.

**Recommendation:** Create the app registration, SP, Contributor role scoped to the resource group, and federated credential with the commands in the reference; store AZURE_CLIENT_ID / AZURE_TENANT_ID / AZURE_SUBSCRIPTION_ID as repo secrets (they are not sensitive in the way a client secret is). If the workflow later uses a GitHub environment, the subject changes to `repo:<Org/Repo>:environment:<name>` - add a second federated credential rather than editing.

### D11 [minor] CI / GHCR naming
**Claim:** `ghcr.io/${{ github.repository_owner }}/precalc-trainer` breaks for any GitHub username with capitals because GHCR repository paths must be lowercase.

**Evidence:** docker push to ghcr.io with a mixed-case path fails with 'repository name must be lowercase'; `github.repository_owner` preserves the account's display casing.

**Recommendation:** Hard-code the lowercase image name in the workflow `env:` block, or use docker/metadata-action (which lowercases) to produce tags.

### D12 [minor] Azure cost / logs
**Claim:** `az containerapp env create` with defaults provisions a Log Analytics workspace, an extra resource with its own ingestion billing after the free tier - unnecessary for the $0 target.

**Evidence:** az containerapp env CLI reference: `--logs-destination {azure-monitor, log-analytics, none}`; `--logs-workspace-id` note: 'Extra billing may apply.' Default is log-analytics with an auto-created workspace when no id is supplied.

**Recommendation:** Create the environment with `--logs-destination none`. Live troubleshooting still works via `az containerapp logs show -n precalc -g precalc-rg --type console --follow` and the portal Log stream; you only lose queryable history, which a static nginx app does not need.

### D13 [note] Scale-to-zero UX
**Claim:** Expect the first navigation after 5+ idle minutes to hang 3-10 s with nothing on screen; nothing in the SPA can soften this because the blocked request is index.html itself.

**Evidence:** scale-app doc: 'Cool down period 300 seconds' before the last replica is removed. cold-start doc: cold start = 'pulling your container image, provisioning resources, and starting your application code' and 'Avoid far away image registries' (GHCR is outside Azure). Microsoft community guidance cites 1-3 s for small containers, plus pull time on an uncached node.

**Recommendation:** Accept it for family use and say so in deploy/azure.md. If it becomes annoying: a GitHub Actions `schedule` cron that curls the FQDN at 15:30 on school days (the docs' 'Proactively wake your app' pattern) is free; `--min-replicas 1` works but runs 730 h/month against a 200 h free grant (see D14). Keep the image small (D2) - it is the one lever that shortens cold start.

### D14 [note] Cost expectation
**Claim:** '~$0 at family usage' is defensible with numbers: the Consumption free grant covers ~200 replica-hours per month at 0.25 vCPU / 0.5 GiB, and a scale-to-zero app bills only session length + 5 min cooldown.

**Evidence:** billing doc: free per subscription per month 'first 180,000 vCPU-seconds', 'first 360,000 GiB-seconds', 'first 2 million HTTP requests'; 180,000 / 0.25 = 720,000 s = 200 h; 360,000 / 0.5 = 720,000 s = 200 h. 'When a revision is scaled to zero replicas, no resource consumption charges are incurred.' containers doc confirms 0.25 vCPU / 0.5Gi is a valid Consumption combination. The environment itself has no charge on Consumption; TLS on *.azurecontainerapps.io is included.

**Recommendation:** Put this arithmetic in deploy/azure.md. Note the two things that would add cost: min-replicas 1 (idle-rate billing beyond the grant, low single-digit USD/month - check the region's price) and a Log Analytics workspace (D12). GHCR is free for public packages.

### D15 [minor] Static Web Apps alternative
**Claim:** The spec's SWA framing is wrong on both counts: SWA Free has no password protection (so the PIN gate would be purely client-side there), and SWA Free does include managed Functions, so the API 'never materializing' is not the deciding criterion.

**Evidence:** password-protection doc, Prerequisites: 'An existing static web app in the Standard plan.' plans doc: Free plan 'APIs via Azure Functions: Managed', 'Authentication provider integration: Preconfigured', 'Globally distributed static content', 2 custom domains, 250 MB app size, no SLA.

**Recommendation:** Reframe the alternative as a trade: SWA Free = $0, CDN, no cold start, managed Node function for the tutor endpoint later - but access control means either client-side-only PIN or SWA built-in auth with an invited GitHub/Microsoft account for the student (contradicts 'no accounts'). ACA + nginx = real server-side PIN gate without accounts, at the cost of cold starts. Pick ACA if the no-accounts PIN gate matters; otherwise SWA is strictly simpler.

### D16 [minor] Security headers
**Claim:** A strict CSP is nearly free for this stack and closes the only realistic attack surface (XSS via rendered math input), but it constrains how the gate page and KaTeX are served.

**Evidence:** Vite production index.html has no inline scripts (`<script type="module" src=...>`), so `script-src 'self'` works. KaTeX emits inline `style=` attributes on spans, so `style-src` needs `'unsafe-inline'`. An inline `<script>` in gate.html would be blocked by that CSP.

**Recommendation:** Server-level: `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`, plus `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `server_tokens off`. Ship gate logic as /gate.js (external file in Vite's public/). Also assert in the spec: no PII anywhere - progress stays in localStorage, URLs carry only the problem seed.

### D17 [minor] PIN session on iOS
**Claim:** If the gate cookie is set from JavaScript, Safari's ITP caps it at 7 days and the student re-enters the PIN weekly; setting it from an nginx Set-Cookie header avoids the cap and lets the cookie be HttpOnly.

**Evidence:** WebKit ITP: cookies created via document.cookie expire after 7 days; first-party cookies set via HTTP Set-Cookie keep their Max-Age.

**Recommendation:** gate.js redirects to `/gate/set?t=<sha256 hex>`; nginx validates `^[0-9a-f]{64}$`, responds 302 / with `Set-Cookie: pc_auth=...; Path=/; Max-Age=31536000; Secure; HttpOnly; SameSite=Lax`. Rate-limit that location (`limit_req` 5 r/s per IP with real_ip from X-Forwarded-For) and recommend a 6+ character PIN so online guessing is impractical.

### D18 [note] CI test gate
**Claim:** The spec's Vitest suite is the correctness core but nothing in the pipeline prevents a red engine test from shipping.

**Evidence:** Milestone text says tests exist; the deploy workflow as specified is build -> push -> update with no test step.

**Recommendation:** Run `npm test -- --run` inside the Docker build stage (`RUN npm test -- --run && npm run build`) so a failing sign-flip or minus-teleport test aborts the image build, and therefore the push and the deploy, with no extra workflow plumbing.

## Design decisions

- **Where the PIN check lives**: nginx cookie gate driven by an ACA secret (APP_PIN_SHA256) rendered into the config via the image's envsubst template; the SPA and image contain no PIN material. Basic auth documented as the 3-line fallback; a future /api sidecar can take over issuing the cookie without changing nginx.  
  _Why:_ Client-side hash checks are a speed bump by construction; with a public GHCR image they are no barrier at all. The nginx map costs nothing at runtime and keeps 'no accounts, no server-side data' true.

- **Base image**: nginx:stable-alpine-slim (pinned by digest) instead of nginx:alpine.  
  _Why:_ ~19 MB vs ~69 MB on disk; slim keeps envsubst, openssl and the entrypoint scripts. Smaller image = shorter cold start and the only way to honor the <60 MB budget.

- **Registry visibility**: Public GHCR package, no PAT; `az containerapp registry set --server ghcr.io` configured once.  
  _Why:_ Removes PAT expiry (silent outage on next cold start) and GitHub Free's 500 MB / 1 GB private-package quotas; safe because the image contains no secrets after the PIN moves to nginx.

- **Deploy identity and tags**: OIDC federated credential (azure/login@v2 with client-id/tenant-id/subscription-id), Contributor scoped to the resource group; images tagged with the commit SHA; platforms pinned to linux/amd64.  
  _Why:_ No expiring client secret; SHA tags guarantee a new revision per deploy (Microsoft's own guidance); amd64 is the only architecture ACA runs.

- **Caching and headers**: `expires` directive for cache control (index.html and gate files no-cache, /assets/ max), security headers set once at server level with `always`.  
  _Why:_ Avoids the add_header inheritance trap and the stale-index-after-deploy blank screen.

- **Logging and cost**: Environment created with `--logs-destination none`; min 0 / max 1 replica at 0.25 vCPU / 0.5 GiB; accept 3-10 s cold start after 5 idle minutes.  
  _Why:_ Keeps the bill inside the 180,000 vCPU-s / 360,000 GiB-s / 2M-request free grant (~200 replica-hours per month) and avoids a Log Analytics workspace; live log streaming still works.

- **Static Web Apps as alternative**: Documented as a real alternative only if the family accepts either a client-side-only PIN or SWA built-in auth with an invited account.  
  _Why:_ SWA Free lacks password protection (Standard only) but does include managed Functions, so the API is not the deciding factor; access control is.

## Reference

## Deployment reference (verified against learn.microsoft.com / docs.github.com / docker-library, Sept 2026)

### Dockerfile
```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# engine tests gate the image; a red sign-flip test aborts build -> push -> deploy
RUN npm test -- --run && npm run build            # -> /app/dist

FROM nginx:stable-alpine-slim                     # ~19 MB on disk, 8 MB pull; pin @sha256 in practice
LABEL org.opencontainers.image.source="https://github.com/<user>/precalc-trainer"
# only ${APP_*} is substituted; nginx's own $uri/$host/$cookie_* survive
ENV NGINX_ENVSUBST_FILTER='^APP_'
COPY deploy/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```
Build locally: `docker build --platform linux/amd64 -t precalc .` (ACA runs linux/amd64 only). Expected final size ~25 MB on disk.

### deploy/nginx/default.conf.template
Rendered by the image entrypoint (20-envsubst-on-templates.sh) into /etc/nginx/conf.d/default.conf, which the stock nginx.conf includes inside `http {}`.
```nginx
limit_req_zone $binary_remote_addr zone=gate:1m rate=5r/s;

# cookie -> state. "" = no cookie, match = ok, anything else = wrong PIN
map $cookie_pc_auth $pc_state {
    default              "bad";
    ""                   "none";
    "${APP_PIN_SHA256}"  "ok";
}

server {
    listen 80;
    server_name _;
    root  /usr/share/nginx/html;
    index index.html;
    server_tokens off;

    # ACA ingress (Envoy) is the only hop in front of nginx
    set_real_ip_from  0.0.0.0/0;
    real_ip_header    X-Forwarded-For;
    real_ip_recursive on;

    gzip on;
    gzip_min_length 1024;
    gzip_types text/css application/javascript application/json image/svg+xml;

    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy same-origin always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;

    # ---- gate: served without auth ----
    location = /gate.html { expires -1; }
    location = /gate.js   { expires -1; }
    location = /gate/set {
        limit_req zone=gate burst=10 nodelay;
        if ($arg_t !~ "^[0-9a-f]{64}$") { return 400; }
        add_header Set-Cookie "pc_auth=$arg_t; Path=/; Max-Age=31536000; Secure; HttpOnly; SameSite=Lax";
        return 302 /;
    }

    # ---- Vite hashed output: cache forever ----
    location /assets/ {
        if ($pc_state != "ok") { return 401; }
        expires max;                      # Cache-Control: max-age=315360000
        try_files $uri =404;
    }

    # ---- reserved for the tutor API: sidecar container in the same replica -> localhost ----
    location /api/ {
        return 503;
        # proxy_pass         http://127.0.0.1:3000;
        # proxy_http_version 1.1;
        # proxy_set_header   Host $host;
        # proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # ---- SPA ----
    location / {
        if ($pc_state = "none") { return 302 /gate.html; }
        if ($pc_state = "bad")  { return 302 /gate.html?bad=1; }
        expires -1;                       # Cache-Control: no-cache -> index.html always revalidated
        try_files $uri $uri/ /index.html;
    }
}
```
Why `expires` not `add_header Cache-Control`: an add_header inside a location drops all server-level add_headers (nginx inheritance rule), which would silently remove the CSP.

### public/gate.html and public/gate.js (Vite copies public/ to dist root, unhashed)
```html
<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Precalc Trainer</title>
<style>body{font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;background:#fff;color:#2F3C7E}input{font-size:1.5rem;padding:.5rem}button{font-size:1.2rem;padding:.5rem 1rem;background:#F96167;color:#fff;border:0;border-radius:.5rem}</style>
<form id="f"><h1>Precalc Trainer</h1>
  <label>PIN <input id="pin" type="password" inputmode="numeric" autocomplete="current-password" autofocus required></label>
  <button>Enter</button>
  <p id="msg" hidden>That PIN didn't match.</p>
</form>
<script src="/gate.js"></script>
```
```js
// gate.js - CSP forbids inline scripts, so this is a separate file
if (new URLSearchParams(location.search).has('bad')) document.getElementById('msg').hidden = false;
document.getElementById('f').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pin = document.getElementById('pin').value.trim();
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin)); // secure context: https or localhost
  const hex = Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
  location.replace('/gate/set?t=' + hex);
});
```
Server-side hash (must match the trimmed PIN, no newline): `printf '%s' "$PIN" | sha256sum | cut -d' ' -f1`.

Basic-auth fallback (even smaller; native browser prompt, poor in iOS home-screen mode): drop the map/gate blocks, add `auth_basic "Precalc"; auth_basic_user_file /etc/nginx/.htpasswd;` at server level, and add an executable `/docker-entrypoint.d/40-htpasswd.sh`:
```sh
#!/bin/sh
set -eu
printf 'family:%s\n' "$(openssl passwd -apr1 "$APP_PIN")" > /etc/nginx/.htpasswd   # openssl CLI is in alpine-slim
```
with secret `app-pin` -> env `APP_PIN=secretref:app-pin`.

### az CLI sequence (deploy/azure.md)
```bash
az login
az extension add --name containerapp --upgrade      # az containerapp is core GA; extension adds preview flags
az provider register -n Microsoft.App --wait

LOC=eastus2; RG=precalc-rg; ENV=precalc-env; APP=precalc
IMG=ghcr.io/<lowercase-user>/precalc-trainer:<git-sha>
PIN_SHA=$(printf '%s' "$APP_PIN" | sha256sum | cut -d' ' -f1)

az group create -n $RG -l $LOC
az containerapp env create -n $ENV -g $RG -l $LOC --logs-destination none   # no Log Analytics workspace

az containerapp create -n $APP -g $RG --environment $ENV \
  --image $IMG \
  --ingress external --target-port 80 --transport auto \
  --min-replicas 0 --max-replicas 1 --cpu 0.25 --memory 0.5Gi \
  --secrets app-pin-sha256=$PIN_SHA \
  --env-vars APP_PIN_SHA256=secretref:app-pin-sha256
  # private package only: add
  #   --registry-server ghcr.io --registry-username <github-user> --registry-password <classic PAT, read:packages>

# Microsoft docs: configure the non-ACR registry even for a public image
az containerapp registry set -n $APP -g $RG --server ghcr.io

az containerapp show -n $APP -g $RG --query properties.configuration.ingress.fqdn -o tsv
az containerapp logs show -n $APP -g $RG --type console --follow           # live logs without Log Analytics
```
Valid Consumption sizes include 0.25/0.5Gi, 0.5/1.0Gi, ... (containers doc table). Secret names: lowercase alphanumerics and hyphens only.

PIN rotation (secrets do not create or restart revisions):
```bash
az containerapp secret set -n $APP -g $RG --secrets app-pin-sha256=<newsha>
REV=$(az containerapp revision list -n $APP -g $RG --query "[?properties.active].name" -o tsv)
az containerapp revision restart -n $APP -g $RG --revision $REV
```

### OIDC for GitHub Actions (one-time)
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
  "subject": "repo:<user>/precalc-trainer:ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"] }'
# GitHub repo secrets: AZURE_CLIENT_ID=$APP_ID  AZURE_TENANT_ID=$TENANT  AZURE_SUBSCRIPTION_ID=$SUB
```
Subject must match the trigger exactly (branch push -> `ref:refs/heads/main`; environment job -> `environment:<name>`); a mismatch fails silently.

### .github/workflows/deploy.yml
```yaml
name: deploy
on:
  push:
    branches: [main]
permissions:
  contents: read
  packages: write      # push to ghcr.io with GITHUB_TOKEN
  id-token: write      # OIDC token for azure/login
concurrency:
  group: deploy
  cancel-in-progress: false
env:
  IMAGE: ghcr.io/<lowercase-user>/precalc-trainer   # GHCR paths must be lowercase
  APP: precalc
  RG: precalc-rg
jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          platforms: linux/amd64
          push: true
          tags: |
            ${{ env.IMAGE }}:${{ github.sha }}
            ${{ env.IMAGE }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
      - name: Roll out
        run: |
          az extension add --name containerapp --upgrade
          az containerapp update -n "$APP" -g "$RG" --image "$IMAGE:${{ github.sha }}"
          az containerapp show -n "$APP" -g "$RG" --query properties.configuration.ingress.fqdn -o tsv
```
First push creates the package private; switch it to public in Package settings (or keep private + PAT, see finding D4).

### Numbers to quote in deploy/azure.md
| Item | Value | Source |
|---|---|---|
| Free grant / month / subscription | 180,000 vCPU-s, 360,000 GiB-s, 2M requests | ACA billing doc |
| = replica-hours at 0.25 vCPU / 0.5 GiB | ~200 h | arithmetic |
| Scale-to-zero cooldown | 300 s after last request | ACA scale-app doc |
| Cold start (small image, GHCR pull) | plan for 3-10 s on first navigation | ACA cold-start doc + community guidance (1-3 s container start) |
| Image size | nginx:alpine ~69 MB disk / 19.6 MB pull; alpine-slim ~19 MB / 8.2 MB | docker-library repo-info |
| GHCR (GitHub Free) | public: free; private: 500 MB storage, 1 GB transfer/month | docs.github.com Packages billing |
| SWA Free | no password protection (Standard only); managed Functions included; 2 custom domains; 250 MB | SWA plans + password-protection docs |
