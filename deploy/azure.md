# Deploying Precalc Trainer to Azure Container Apps

The app is a static single-page app served by nginx from a ~25 MB image. It runs on Azure
Container Apps (consumption plan, scale to zero) and pulls its image from GitHub Container Registry
(GHCR). Visitors sign in with Google, and only the accounts on a short email list get the app.
There is no Microsoft Entra app registration anywhere in the setup. Expected cost at family usage:
about $0 (see §6), plus the AI tutor's model usage if you add it (§9).

Files involved:

| File | Role |
|---|---|
| `Dockerfile` | `node:22-alpine` build → `nginx:stable-alpine-slim` runtime |
| `nginx.conf` | sign-in allowlist, SPA fallback, cache policy, security headers, `/api/` proxy to the tutor, `/healthz` |
| `docker/25-allowlist.sh` | writes the allowlist from `ALLOWED_USERS` at container start |
| `docker/not-allowed.html` | the 403 page for a signed-in account that isn't on the list |
| `docker/20-config.sh` | writes `/config.js` (optional PIN hash, sign-out link) at container start |
| `server/Dockerfile` | the optional AI tutor sidecar (`node:22-alpine`, one bundled file); §9 |
| `deploy/azure-setup.sh` | creates the Azure resources, turns on Google sign-in, manages the list, adds the tutor |
| `deploy/tutor-spec.mjs` | adds the tutor container and its log volume to the app's spec (used by `azure-setup.sh tutor`) |
| `deploy/smoke.sh` | boots the image and checks the whole contract, allowlist included (run by CI) |
| `deploy/smoke-tutor.sh` | boots the tutor image (mock provider), alone and behind nginx (run by CI) |
| `.github/workflows/ci.yml` | typecheck, tests, build, Docker builds + smoke on every PR/push |
| `.github/workflows/deploy.yml` | on push to `main`: build → smoke → push to GHCR → roll out (once `ci` is set up) |

## How access works

1. Every request reaches the Container Apps ingress over HTTPS. Container Apps authentication checks
   for a session first. A visitor who isn't signed in is redirected to Google.
2. While the Google app stays in **Testing**, Google only lets the test users you listed finish
   sign-in. That is the first filter.
3. A signed-in request is passed to nginx with `X-MS-CLIENT-PRINCIPAL-NAME` set to the account's
   email. Requests from the internet can't set that header while sign-in is on.
4. nginx compares the email, ignoring case, with `ALLOWED_USERS`. That is the second filter. An
   account that isn't listed gets `docker/not-allowed.html` (403) with a sign-out link.
5. `/healthz` is open on both layers and answers only `ok`.

The list fails closed: with `ALLOWED_USERS` empty or missing, every page answers 403. Both filters
live outside the repository: the Google test users in Google Cloud, the list as a container app
setting.

## 1. Run it locally with Docker

```bash
docker build --platform linux/amd64 -t precalc-trainer .
docker run --rm -p 8080:80 -e AUTH_ALLOWLIST=off precalc-trainer
bash deploy/smoke.sh precalc-trainer          # full contract check (needs docker + curl)
```

`AUTH_ALLOWLIST=off` lets every request through, because there is no sign-in layer locally. To
see the allowlist work, pretend to be the sign-in layer:

```bash
docker run --rm -p 8080:80 -e ALLOWED_USERS=kid@example.com precalc-trainer
curl -si http://localhost:8080/ | head -1                                              # 403
curl -si -H 'X-MS-CLIENT-PRINCIPAL-NAME: kid@example.com' http://localhost:8080/ | head -1   # 200
```

## 2. Set it up on Azure

You need the Azure CLI signed in (`az login`), plus git and curl. On Windows, run the script with
Git Bash; from PowerShell that is `& "C:\Program Files\Git\bin\bash.exe" deploy/azure-setup.sh <step>`.
Run it from the repository root, on a commit whose `deploy` workflow has finished, because the
script deploys the image built from that commit.

**Step 1: the app.**

```bash
bash deploy/azure-setup.sh app
```

This registers `Microsoft.App`, then creates the resource group `precalc-rg`, the environment
`precalc-env` (without a Log Analytics workspace, the only part that would cost money) and the
container app `precalc`. The app runs at 0.25 vCPU / 0.5 GiB and scales to zero. It pulls the
GHCR image anonymously, so no registry password is needed. That needs the package to be public:
GitHub → your profile → Packages → `precalc-trainer` → Package settings → Change visibility. The
script checks the pull before it creates anything and stops with a clear message if it fails. Every page answers 403 at this point. The
script prints the app URL and the two Google values for step 2. Override names with `LOC`, `RG`,
`ACA_ENV` or `APP`.

**Step 2: the Google OAuth client** (Google Cloud console, signed in with your Google account).

1. Open https://console.cloud.google.com, create a project, for example `precalc-trainer`.
2. Go to **Google Auth Platform**.
   - **Branding:** app name `Precalc Trainer`, and your email as the support and developer contact.
   - **Audience:** User type **External**. Leave the publishing status on **Testing**, and under
     **Test users** add every Gmail address that should get in.
   - **Clients:** **Create client**, type **Web application**. Add the **Authorized JavaScript
     origin** `https://<app-fqdn>` and the **Authorized redirect URI**
     `https://<app-fqdn>/.auth/login/google/callback`, both printed by step 1.
3. Copy the client ID. The client secret is shown right after you create the client. Keep that page
   open, or download the JSON, for step 3.

The Testing status shows a "Google hasn't verified this app" notice at first sign-in; choose
Continue. School Google Workspace accounts are often blocked from unverified apps by the school's
admin, so allow a personal Gmail account.

**Step 3: turn on sign-in and set the list.**

```bash
bash deploy/azure-setup.sh google ~/Downloads/client_secret_*.apps.googleusercontent.com.json
```

Hand it the JSON Google offers when the client is created and it reads the client ID and secret
from the file, so the secret never appears on screen or in your shell history. With no argument it
asks for both, the secret with typing hidden. Either way it stores the secret as a container app
secret, then requires sign-in on every path except `/healthz`. Only after that does it set
`ALLOWED_USERS` and run `check`, so there is no moment where the app is reachable by anyone.
`GOOGLE_CLIENT_JSON`, `GOOGLE_CLIENT_ID` and `ALLOWED_USERS` in the environment skip the prompts.
Delete the JSON once you are done: it holds the client secret.

**Check it any time:**

```bash
bash deploy/azure-setup.sh check
```

It prints the URL, the sign-in settings, whether the nginx email gate is on, and the list, then
fetches `/` and `/healthz`. It fails unless someone who isn't signed in is redirected to
`/.auth/login/`, and it fails if `AUTH_ALLOWLIST=off` has been set on the app, which would switch
the email gate off and let any Google account in.

## 3. Change who can get in

```bash
bash deploy/azure-setup.sh users "kid@gmail.com,parent@gmail.com"
```

That replaces the whole list and creates a new revision. Add or remove the same person under
**Audience → Test users** in Google too, so both filters agree. The script refuses to set the list
while sign-in is off. With the tutor added (§9) it sets the same list on the tutor container too,
which re-checks it (a second revision).

## 4. Roll out new versions

Manually, after the `deploy` workflow for a commit has pushed its image:

```bash
bash deploy/azure-setup.sh update            # this checkout's HEAD; or: update <commit-sha>
```

Or automatically on every push to `main`:

```bash
bash deploy/azure-setup.sh ci
```

`ci` creates a user-assigned managed identity. That is an ordinary Azure resource: no Entra app
registration, and no client secret to expire. It adds a federated credential that trusts only
GitHub Actions runs from `main` of this repository, and grants the identity **Contributor** on
`precalc-rg` only. It then stores `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` and `AZURE_SUBSCRIPTION_ID`
as repository secrets with `gh`. Those are identifiers, not passwords. From then on `deploy.yml`
rolls out the commit-SHA image and waits for `/healthz`. The workflow refuses to roll out if
sign-in has been switched off on the app.

Both `update` and the script's `app` step refuse an image from a commit older than the allowlist,
so an unprotected image can't be deployed by accident. Once the app has the tutor container (§9),
`update` and `deploy.yml` roll out both images of the commit, the tutor first; before that, only the
web container.

## 5. Operate

```bash
az containerapp logs show -n precalc -g precalc-rg --type console --follow   # nginx + start-up hooks
az containerapp logs show -n precalc -g precalc-rg --container tutor --tail 50   # the tutor (§9)
az containerapp logs show -n precalc -g precalc-rg --type system             # scaling, pulls, probes
az containerapp revision list -n precalc -g precalc-rg -o table
az containerapp auth show -n precalc -g precalc-rg                           # sign-in settings
```

Take the site offline at once, and bring it back:

```bash
az containerapp ingress disable -n precalc -g precalc-rg
az containerapp ingress enable -n precalc -g precalc-rg --type external --target-port 80 --transport auto
```

Rotate the Google client secret: in Google Auth Platform → Clients, add a new secret. Run
`bash deploy/azure-setup.sh google` again with it, then delete the old secret in Google.

Custom domain (optional): `az containerapp hostname add`, then `az containerapp hostname bind` with
`--validation-method CNAME` and a managed certificate; both are free. Add the new origin and
redirect URI to the Google client.

## 6. Cost and cold starts

| Item | Value |
|---|---|
| Monthly free grant per subscription | 180,000 vCPU-seconds, 360,000 GiB-seconds, 2 M requests |
| Equivalent at 0.25 vCPU / 0.5 GiB | ~200 replica-hours per month |
| Scale-to-zero cooldown | 300 s after the last request |
| Cold start (small image, GHCR pull) | plan for 3–10 s on the first open of a session |
| Container Apps authentication, Google sign-in | no charge |
| GHCR | public package free |

Family usage (an hour a day) stays inside the free grant, so the bill is ~$0. Keeping one replica
warm around the clock (`--min-replicas 1`) needs ~720 replica-hours and would cost a few dollars a
month; the cold start is a better trade. With the tutor sidecar a replica is 0.5 vCPU / 1 GiB (two
containers), so the free grant covers ~100 replica-hours a month: still ~$0 at an hour a day. The
tutor's model usage and log storage are in §9.

## 7. The family PIN (optional)

Sign-in replaces the PIN, so leave `APP_PIN` unset on Azure and the app shows no PIN screen. The
PIN still works if you want a second prompt on a shared device. The PIN is checked in the browser
against a hash in `/config.js`, which only signed-in, listed accounts can fetch:

```bash
PIN_SHA=$(printf '%s' "$PIN" | sha256sum | cut -d' ' -f1)
az containerapp secret set -n precalc -g precalc-rg --secrets app-pin-hash=$PIN_SHA
az containerapp update -n precalc -g precalc-rg --container-name precalc --set-env-vars APP_PIN_HASH=secretref:app-pin-hash
```

## 8. Security, honestly

- **What sign-in protects.** It keeps strangers from using the hosting and the tutor's `/api/`
  (which spends a paid API key). The source code is public on GitHub anyway, and no student data
  lives on the server apart from the tutor's question log (§9); progress stays in each browser's
  localStorage.
- **Where the trust sits.** nginx trusts `X-MS-CLIENT-PRINCIPAL-NAME` only because Container Apps
  sign-in sets that header and strips it from outside requests. If sign-in were switched off,
  anyone could send the header. Three guards cover this. The script sets the list only after sign-in
  is on, `update` refuses while it is off, and `deploy.yml` fails instead of rolling out.
  `check` shows the state.
- **Fail closed.** No list means nobody gets in. An entry with any character outside
  `A-Z a-z 0-9 . _ % + @ -` stops the container from starting, because entries are written into
  nginx config. Matching is exact apart from letter case, so `kid@gmail.com.evil.net` doesn't match.
- **Secrets.** The Google client secret lives only in Google and as a container app secret; so do
  the tutor's API keys (`gemini-api-key`, `anthropic-api-key`). The email and parent lists live in
  the container app's settings. None of them is in the repository.
- **The tutor re-checks.** The sidecar compares the account with its own copy of the list and
  refuses anything else, even if nginx were misconfigured; it has no off switch. nginx passes it
  the email only (no sign-in cookie, claims or Google tokens).
- **Sessions.** Signing out of the site (Settings → Sign out) ends the site's session but not the
  Google session in that browser. On a shared computer, sign out of Google too.
- **Not covered.** There is no WAF or DDoS protection beyond what Azure's ingress and Google's
  sign-in already rate-limit, and `/healthz` is public. Neither matters for a static family app;
  the tutor's spend is capped by its daily question limit (§9).

## 9. The AI tutor (optional sidecar)

**What it does.** On any problem she can type a question about that problem ("why did my sign flip
get rejected?", "what does the domain mean here?") and get a short coaching answer, streamed as it
is written. The tutor is a second container (`server/`, image `precalc-tutor`) in the same replica as
nginx, listening on 127.0.0.1:3000; nginx sends `/api/` to it after the usual allowlist check. It
sends the model the problem, her lines or answers, the checker's verdict and named mistake, and the
reference solution for the model's eyes only. It coaches one step at a time, explains the checker's
decision without re-judging it (the checker is exact and wins any disagreement), and never gives the
final answer while the problem is open; after she finishes, or uses the app's reveal, it may walk
through the whole solution. The API and the UI contract are in `docs/progress/tutor-core.md`.

**Safeguards**, whatever the provider:

- *Only the family.* nginx's allowlist, then the tutor's own check of `ALLOWED_USERS` (it fails
  closed and has no off switch). Only `PARENT_USERS` may read the question log. Both lists are
  container settings, never in the repository.
- *Content.* A fixed system prompt keeps the tutor on the current problem and its subject, declines
  anything else kindly and steers back, never asks for or repeats personal information, says it is an
  AI when asked, points her to a parent or trusted adult if she is upset or unsafe, and keeps answers
  to a few sentences in the app's math notation. Gemini runs with its safety filters at "block low
  and above" for every adjustable category; Claude's refusals fall back server-side and otherwise end
  as a kind "can't help with that" message.
- *Monitoring.* Every question, answer and flag ("wrong" / "inappropriate", from a button under each
  answer) is appended to `tutor-YYYY-MM.jsonl` on an Azure Files share. The tutor won't start if it
  can't write there. Read it in the app (Settings → Tutor log, parent accounts) or download it:
  portal → the storage account → File shares → `tutor-log`.
- *Limits.* 30 questions per person per day (`TUTOR_DAILY_LIMIT`; counted again from the log after a
  restart), one at a time, 500 characters per question, the last 4 questions of the same attempt as
  context, 60 s per answer, a small output cap. A failed or timed-out answer doesn't count.
- *No personal data to the provider.* Only the problem and her question go out: never her name,
  email or account. An email address or phone number typed into a question is removed before sending.
  No API key or provider error text is ever logged.

**Set it up** (after the app, sign-in and the list work, and after a `deploy` run has pushed
`precalc-tutor` for the commit). Make the new package public first, like the web image: GitHub → your
profile → Packages → `precalc-tutor` → Package settings → Change visibility. Then, from the repository
root in Git Bash:

```bash
bash deploy/azure-setup.sh tutor /path/to/keys.txt   # the key file: NAME=value lines
```

The key file can use any names: the Gemini key is the one whose name contains `gemini` or `google`,
the Anthropic key the one with `anthropic` or `claude` (case ignored). The script refuses a missing or
ambiguous match, prints only the names it found, and reads the values with shell built-ins only; each
key goes to Azure through a pipe (`az ... --secrets name=@-`), so it never appears on screen, in the
shell history or in the process list. It then asks for the parent email(s) (`PARENT_USERS=...` skips
the prompt; each must be on the allowlist), creates a Standard_LRS storage account and a 1 GiB file
share for the log, attaches it to the environment, stores both keys as container app secrets, adds the
tutor container (0.25 vCPU / 0.5 GiB) with `TUTOR_PROVIDER=gemini`, `GEMINI_MODEL`,
`TUTOR_DAILY_LIMIT`, `PARENT_USERS` and the app's `ALLOWED_USERS`, and finally wakes the app and reads
the tutor's start-up line, which says `key check ok` (a free call that proves the key and the model
work) or names what failed. Delete the key file afterwards if you don't need it: Azure holds the live
copies. Run the same command again to change the parents, the limit (`TUTOR_DAILY_LIMIT=20 bash ...`),
the model (`GEMINI_MODEL=...`) or the keys.

**Switch providers** with one setting (a new revision; both keys are already stored):

```bash
bash deploy/azure-setup.sh tutor-provider anthropic      # Claude (claude-opus-5)
bash deploy/azure-setup.sh tutor-provider gemini         # back to Gemini
```

`bash deploy/azure-setup.sh check` shows the tutor's image, provider, model, limit and parents.

**Cost.** Gemini `gemini-3.8-flash` on the paid tier: $0.75 per million input tokens and $3.75 per
million output tokens through 2026, then $1.50 / $7.50 from January 2027
([pricing](https://ai.google.dev/gemini-api/docs/pricing)). A question is about 1–2 thousand tokens in
and up to about 1.5 thousand out, roughly $0.01 at the 2027 price: about $1.50 a month at 5 questions a
day, and at most about $9 a month at the 30-a-day cap. Claude Opus 5 ($5 / $25 per million) is about
$0.05 a question: about $7.50 a month at 5 a day. The second container stays inside the Container Apps
free grant at family usage (§6), and the log share costs cents a year (a few kilobytes on
pay-as-you-go Standard_LRS).

**About Google's terms.** Google's Gemini API Additional Terms of Service say you must be 18 or older
to use the APIs, and that the APIs may not be used as part of a website, application or service
directed towards or likely to be accessed by individuals under 18
([terms](https://ai.google.dev/gemini-api/terms), last modified 2026-04-28). Here the parent holds the
API account and the tutor sits behind the parent's sign-in and allowlist, but the tutor is used by a
student under 18. If that matters to you, `bash deploy/azure-setup.sh tutor-provider anthropic` moves
the tutor to Claude without any code change; Anthropic publishes guidance for products used by minors,
and the safeguards above are built to it for either provider.
