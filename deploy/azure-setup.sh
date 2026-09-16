#!/usr/bin/env bash
# deploy/azure-setup.sh — Precalc Trainer on Azure Container Apps behind "Sign in with Google".
# No Microsoft Entra app registration is involved anywhere. Walkthrough: deploy/azure.md.
#
#   bash deploy/azure-setup.sh app [sha]   1. resource group, environment and container app. Every page
#                                             answers 403 until step 3, so nothing is open meanwhile.
#   (Google Cloud console)                 2. create the OAuth client; `app` prints the redirect URI.
#   bash deploy/azure-setup.sh google      3. asks for the client ID, the secret (typing hidden) and the
#                                             emails allowed in; turns sign-in on, then sets the list.
#   bash deploy/azure-setup.sh check          URL, sign-in settings, allowlist, and a live request.
#   bash deploy/azure-setup.sh users "a@gmail.com,b@gmail.com"      replace who may use it.
#   bash deploy/azure-setup.sh update [sha]   roll out the image of a commit (default: this checkout's HEAD).
#   bash deploy/azure-setup.sh ci             optional: let GitHub Actions roll out every push to main,
#                                             through a managed identity (no Entra app, nothing expires).
#
# Settings (environment; defaults in brackets):
#   LOC [eastus2]  RG [precalc-rg]  ACA_ENV [precalc-env]  APP [precalc]  IDENTITY [precalc-gh-deploy]
#   OWNER [GitHub owner from the git remote]  REPO [$OWNER/precalc-trainer]
#   GOOGLE_CLIENT_ID, ALLOWED_USERS   skip those prompts in `google` (the secret is always prompted)
# Needs: az (signed in with `az login`), git, curl; gh for `ci`.
set -euo pipefail

LOC="${LOC:-eastus2}"
RG="${RG:-precalc-rg}"
ACA_ENV="${ACA_ENV:-precalc-env}"
APP="${APP:-precalc}"
IDENTITY="${IDENTITY:-precalc-gh-deploy}"
REMOTE=$(git remote get-url origin 2>/dev/null || true)
OWNER="${OWNER:-$(printf '%s' "$REMOTE" | sed -E 's#^.*github\.com[:/]([^/]+)/.*$#\1#' | tr 'A-Z' 'a-z')}"
REPO="${REPO:-$OWNER/precalc-trainer}"
IMAGE="ghcr.io/$OWNER/precalc-trainer"

die() { echo "azure-setup: $*" >&2; exit 1; }
say() { printf '\n== %s\n' "$*"; }
tsv() { az "$@" -o tsv | tr -d '\r'; }   # az on Windows ends tsv lines with CRLF
# Git Bash on Windows rewrites an argument that looks like a path (/healthz, /subscriptions/...)
# into a Windows file path. Use these two wrappers for the az calls that pass one. Setting
# MSYS_NO_PATHCONV for the whole script would instead break curl's -o /dev/null.
azp()  { MSYS_NO_PATHCONV=1 az "$@"; }
tsvp() { MSYS_NO_PATHCONV=1 az "$@" -o tsv | tr -d '\015'; }

need_login() {
  [ -n "$OWNER" ] || die "could not read the GitHub owner from the git remote; set OWNER"
  az account get-access-token -o none 2>/dev/null || die "not signed in to Azure (or the sign-in expired): run az login"
  echo "Subscription: $(tsv account show --query name)"
}

fqdn() { tsv containerapp show -n "$APP" -g "$RG" --query properties.configuration.ingress.fqdn; }

# One line, "<enabled> <unauthenticatedClientAction>", e.g. "true RedirectToLoginPage".
# to_string() earns its place twice: join() refuses the boolean, and a bare multi-select list
# renders in TSV as one row PER ELEMENT (two lines), which no `cut -f` can read. The || pairs
# cover both shapes of the CLI's output.
auth_state() {
  tsv containerapp auth show -n "$APP" -g "$RG" --query \
    "[to_string(properties.platform.enabled || platform.enabled), to_string(properties.globalValidation.unauthenticatedClientAction || globalValidation.unauthenticatedClientAction)] | join(' ', @)" \
    2>/dev/null || true
}

signin_enforced() { [ "$(auth_state)" = "true RedirectToLoginPage" ]; }

# AUTH_ALLOWLIST=off on the app would switch the nginx email gate off, leaving every Google
# account in. Empty output means the variable is not set, which is what we want.
allowlist_mode() {
  tsv containerapp show -n "$APP" -g "$RG" \
    --query "properties.template.containers[0].env[?name=='AUTH_ALLOWLIST'].value | [0]" 2>/dev/null || true
}

require_signin() {
  signin_enforced || die "sign-in is not switched on for $APP. Run: bash deploy/azure-setup.sh google
(the allowlist trusts a header that only sign-in can set)"
  [ "$(allowlist_mode)" != off ] || die "AUTH_ALLOWLIST=off is set on $APP: the email allowlist is switched off.
Remove it with: az containerapp update -n $APP -g $RG --remove-env-vars AUTH_ALLOWLIST"
}

# Lower-cased, comma-joined list; dies on anything that isn't an email or a GitHub username.
normalize_users() {
  local out="" u
  set -f
  for u in $(printf '%s' "$1" | tr ',' ' '); do
    if ! [[ "$u" =~ ^[A-Za-z0-9._%+@-]+$ ]]; then set +f; die "\"$u\" is not an email address or a GitHub username"; fi
    out="${out:+$out,}$(printf '%s' "$u" | tr 'A-Z' 'a-z')"
  done
  set +f
  [ -n "$out" ] || die "no accounts given"
  printf '%s' "$out"
}

# The image must contain the allowlist (so it can never be deployed open) and be pullable anonymously.
check_image() {
  local tag="$1" token
  git cat-file -e "$tag:docker/25-allowlist.sh" 2>/dev/null \
    || die "commit $tag predates the sign-in allowlist or isn't in this checkout; deploy a newer commit"
  token=$(curl -fsS "https://ghcr.io/token?scope=repository:$OWNER/precalc-trainer:pull&service=ghcr.io" \
    | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
  curl -fsS -o /dev/null -H "Authorization: Bearer $token" \
    -H 'Accept: application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json' \
    "https://ghcr.io/v2/$OWNER/precalc-trainer/manifests/$tag" \
    || die "$IMAGE:$tag is not on ghcr.io (or the package is private). Wait for the deploy workflow on that commit to finish."
  echo "Image: $IMAGE:$tag"
}

set_users() {
  require_signin
  say "Allowlist: $(tr ',' '\n' <<<"$1" | wc -l | tr -d ' ') account(s) (new revision)"
  az containerapp update -n "$APP" -g "$RG" --set-env-vars "ALLOWED_USERS=$1" -o none
}

cmd_app() {
  need_login
  local tag="${1:-$(git rev-parse HEAD)}" host
  check_image "$tag"
  say "Resource provider Microsoft.App"
  az provider register -n Microsoft.App --wait -o none
  say "Resource group $RG ($LOC)"
  az group create -n "$RG" -l "$LOC" -o none
  say "Container Apps environment $ACA_ENV (no Log Analytics workspace: the one part that would cost money)"
  if az containerapp env show -n "$ACA_ENV" -g "$RG" -o none 2>/dev/null; then echo "already exists"; else
    az containerapp env create -n "$ACA_ENV" -g "$RG" -l "$LOC" --logs-destination none -o none
  fi
  say "Container app $APP (0.25 vCPU / 0.5 GiB, scales to zero)"
  if az containerapp show -n "$APP" -g "$RG" -o none 2>/dev/null; then echo "already exists (to change the image: update)"; else
    az containerapp create -n "$APP" -g "$RG" --environment "$ACA_ENV" --image "$IMAGE:$tag" \
      --ingress external --target-port 80 --transport auto \
      --min-replicas 0 --max-replicas 1 --cpu 0.25 --memory 0.5Gi -o none
  fi
  host=$(fqdn)
  cat <<EOF

App: https://$host
Every page answers 403 until sign-in and the allowlist are set (step 3).

Step 2, Google Cloud console (https://console.cloud.google.com/auth/overview):
  Branding  app name "Precalc Trainer" and your email as the support email
  Audience  External, leave it in Testing, add each allowed Gmail address as a test user
  Clients   Create client, type "Web application"
            Authorized JavaScript origin: https://$host
            Authorized redirect URI:      https://$host/.auth/login/google/callback
Step 3: bash deploy/azure-setup.sh google
EOF
}

cmd_google() {
  need_login
  local host id secret users
  host=$(fqdn 2>/dev/null) && [ -n "$host" ] || die "no container app $APP in $RG yet: run app first"
  echo "The Google client must list this redirect URI: https://$host/.auth/login/google/callback"
  id="${GOOGLE_CLIENT_ID:-}"
  [ -n "$id" ] || read -rp "Google OAuth client ID: " id
  [[ "$id" =~ ^[0-9]+-[A-Za-z0-9_]+\.apps\.googleusercontent\.com$ ]] \
    || die "that doesn't look like a Google client ID (digits-letters.apps.googleusercontent.com)"
  read -rsp "Google OAuth client secret (typing is hidden): " secret; echo
  [ -n "$secret" ] || die "the client secret is empty"
  users="${ALLOWED_USERS:-}"
  [ -n "$users" ] || read -rp "Emails allowed in, comma-separated: " users
  users=$(normalize_users "$users")

  say "Google provider (Azure keeps the secret as a container app secret)"
  az containerapp auth google update -n "$APP" -g "$RG" --client-id "$id" --client-secret "$secret" --yes -o none
  secret=""
  say "Require sign-in on every path except /healthz"
  azp containerapp auth update -n "$APP" -g "$RG" --enabled true \
    --unauthenticated-client-action RedirectToLoginPage --redirect-provider google \
    --require-https true --excluded-paths /healthz --yes -o none
  set_users "$users"
  cmd_check
}

cmd_users() {
  need_login
  local users; users=$(normalize_users "${1:?usage: users \"a@gmail.com,b@gmail.com\"}")
  set_users "$users"
}

cmd_update() {
  need_login
  local tag="${1:-$(git rev-parse HEAD)}"
  check_image "$tag"
  require_signin
  az containerapp update -n "$APP" -g "$RG" --image "$IMAGE:$tag" -o none
  echo "Rolled out $IMAGE:$tag"
}

cmd_check() {
  need_login
  local host state mode users res hz
  host=$(fqdn)
  state=$(auth_state)
  mode=$(allowlist_mode)
  users=$(tsv containerapp show -n "$APP" -g "$RG" \
    --query "properties.template.containers[0].env[?name=='ALLOWED_USERS'].value | [0]")
  echo "URL:           https://$host"
  echo "Sign-in:       ${state:-none (no sign-in configured)}"
  echo "Email gate:    ${mode:-on}"
  echo "Allowlist:     ${users:-EMPTY, so every page answers 403}"
  echo "(a scaled-to-zero app can take 10-20 s to answer the first request)"
  res=$(curl -s -o /dev/null --max-time 90 -w '%{http_code} %{redirect_url}' "https://$host/" || true)
  hz=$(curl -s -o /dev/null --max-time 90 -w '%{http_code}' "https://$host/healthz" || true)
  echo "GET /          $res"
  echo "GET /healthz   $hz"
  signin_enforced || die "sign-in is NOT enforced: anyone could reach the app. Run: bash deploy/azure-setup.sh google"
  [ "${mode:-on}" != off ] || die "AUTH_ALLOWLIST=off on the app: the email gate is switched off, so any Google account gets in"
  case "$res" in
    30[12]\ *"/.auth/login/"*|401\ *) echo "OK: visitors who aren't signed in are sent to sign-in" ;;
    *) die "expected a redirect to /.auth/login/ for a visitor who isn't signed in; got: $res" ;;
  esac
}

cmd_ci() {
  need_login
  command -v gh >/dev/null || die "the GitHub CLI (gh) is required"
  local sub tenant rg_id client_id principal_id n
  sub=$(tsv account show --query id)
  tenant=$(tsv account show --query tenantId)
  rg_id=$(tsv group show -n "$RG" --query id)
  say "User-assigned managed identity $IDENTITY (an Azure resource, not an Entra app registration)"
  az identity create -n "$IDENTITY" -g "$RG" -l "$LOC" -o none
  client_id=$(tsv identity show -n "$IDENTITY" -g "$RG" --query clientId)
  principal_id=$(tsv identity show -n "$IDENTITY" -g "$RG" --query principalId)
  say "Federated credential: tokens only from pushes to main of $REPO"
  azp identity federated-credential create --name gh-main --identity-name "$IDENTITY" -g "$RG" \
    --issuer https://token.actions.githubusercontent.com \
    --subject "repo:$REPO:ref:refs/heads/main" --audiences api://AzureADTokenExchange -o none
  say "Role: Contributor on resource group $RG only"
  n=$(tsvp role assignment list --scope "$rg_id" \
    --query "length([?principalId=='$principal_id' && roleDefinitionName=='Contributor'])")
  if [ "$n" = 0 ]; then
    for attempt in 1 2 3 4 5 6; do   # a brand-new identity takes a moment to replicate
      if azp role assignment create --assignee-object-id "$principal_id" --assignee-principal-type ServicePrincipal \
        --role Contributor --scope "$rg_id" -o none; then break; fi
      [ "$attempt" -lt 6 ] || die "role assignment failed"
      sleep 10
    done
  else
    echo "already assigned"
  fi
  say "GitHub Actions secrets on $REPO (identifiers, not passwords)"
  gh secret set AZURE_CLIENT_ID -R "$REPO" -b "$client_id"
  gh secret set AZURE_TENANT_ID -R "$REPO" -b "$tenant"
  gh secret set AZURE_SUBSCRIPTION_ID -R "$REPO" -b "$sub"
  [ "$APP" = precalc ] || gh variable set ACA_APP_NAME -R "$REPO" -b "$APP"
  [ "$RG" = precalc-rg ] || gh variable set ACA_RESOURCE_GROUP -R "$REPO" -b "$RG"
  echo "Done: the next push to main rolls out by itself (.github/workflows/deploy.yml)."
}

cmd="${1:-}"
[ $# -gt 0 ] && shift
case "$cmd" in
  app)    cmd_app "$@" ;;
  google) cmd_google ;;
  users)  cmd_users "$@" ;;
  update) cmd_update "$@" ;;
  check)  cmd_check ;;
  ci)     cmd_ci ;;
  *)      sed -n '2,22p' "$0"; exit 2 ;;
esac
