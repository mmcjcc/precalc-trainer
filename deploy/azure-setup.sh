#!/usr/bin/env bash
# deploy/azure-setup.sh — Precalc Trainer on Azure Container Apps behind "Sign in with Google".
# No Microsoft Entra app registration is involved anywhere. Walkthrough: deploy/azure.md.
#
#   bash deploy/azure-setup.sh app [sha]   1. resource group, environment and container app. Every page
#                                             answers 403 until step 3, so nothing is open meanwhile.
#   (Google Cloud console)                 2. create the OAuth client; `app` prints the redirect URI.
#   bash deploy/azure-setup.sh google [client.json]
#                                          3. takes the client ID and secret from the JSON Google offers
#                                             at the end of step 2 (or prompts for them, the secret with
#                                             typing hidden), asks which emails are allowed in, turns
#                                             sign-in on, then sets the list. The secret is never echoed.
#   bash deploy/azure-setup.sh check          URL, sign-in settings, allowlist, tutor, and a live request.
#   bash deploy/azure-setup.sh users "a@gmail.com,b@gmail.com"      replace who may use it.
#   bash deploy/azure-setup.sh update [sha]   roll out the image(s) of a commit (default: this checkout's HEAD).
#   bash deploy/azure-setup.sh ci             optional: let GitHub Actions roll out every push to main,
#                                             through a managed identity (no Entra app, nothing expires).
#   bash deploy/azure-setup.sh tutor <key-file> [sha]
#                                             add or update the AI tutor sidecar. The key file holds
#                                             NAME=value lines; the Gemini key is the one whose name
#                                             contains gemini or google, the Anthropic key the one with
#                                             anthropic or claude. Only the NAMES are printed. Creates a
#                                             small storage account + file share for the tutor's log,
#                                             stores the keys as container app secrets, asks for the
#                                             parent emails, then checks the tutor started.
#   bash deploy/azure-setup.sh tutor-provider <gemini|anthropic>    switch the tutor's provider.
#
# Settings (environment; defaults in brackets):
#   LOC [eastus2]  RG [precalc-rg]  ACA_ENV [precalc-env]  APP [precalc]  IDENTITY [precalc-gh-deploy]
#   OWNER [GitHub owner from the git remote]  REPO [$OWNER/precalc-trainer]
#   GOOGLE_CLIENT_ID, ALLOWED_USERS   skip those prompts in `google` (the secret is always prompted)
#   tutor: PARENT_USERS (skips the prompt)  TUTOR_PROVIDER [gemini]  GEMINI_MODEL [gemini-3.8-flash]
#          TUTOR_DAILY_LIMIT [30]  TUTOR_TIMEZONE [America/New_York, the tutor's own default]
#          TUTOR_STORAGE [precalctutor + 10 hex characters derived from the subscription]
# Needs: az (signed in with `az login`), git, curl; gh for `ci`; node for `tutor`.
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
TUTOR_IMAGE="ghcr.io/$OWNER/precalc-tutor"
TUTOR_STORAGE_NAME="tutorlog"   # the share's name inside the Container Apps environment
TUTOR_SHARE="tutor-log"         # the file share in the storage account

die() { echo "azure-setup: $*" >&2; exit 1; }
say() { printf '\n== %s\n' "$*"; }
tsv() { az "$@" -o tsv | tr -d '\r'; }   # az on Windows ends tsv lines with CRLF
# Git Bash on Windows rewrites an argument that looks like a path (/healthz, /subscriptions/...)
# into a Windows file path. Use these two wrappers for the az calls that pass one. Setting
# MSYS_NO_PATHCONV for the whole script would instead break curl's -o /dev/null.
azp()  { MSYS_NO_PATHCONV=1 az "$@"; }
tsvp() { MSYS_NO_PATHCONV=1 az "$@" -o tsv | tr -d '\015'; }
# A temp file's path as az (a Windows program under Git Bash) can open it; unchanged elsewhere.
winpath() { if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else printf '%s' "$1"; fi; }
hash10() { if command -v sha256sum >/dev/null 2>&1; then printf '%s' "$1" | sha256sum; else printf '%s' "$1" | shasum -a 256; fi | cut -c1-10; }

TMP_SPEC=""
cleanup_tmp() { if [ -n "$TMP_SPEC" ]; then rm -f "$TMP_SPEC"; fi; }
trap cleanup_tmp EXIT

need_login() {
  [ -n "$OWNER" ] || die "could not read the GitHub owner from the git remote; set OWNER"
  az account get-access-token -o none 2>/dev/null || die "not signed in to Azure (or the sign-in expired): run az login"
  echo "Subscription: $(tsv account show --query name)"
}

fqdn() { tsv containerapp show -n "$APP" -g "$RG" --query properties.configuration.ingress.fqdn; }

# The web (nginx) container is the one not named "tutor"; `az containerapp create` named it after the app.
web_container() { tsv containerapp show -n "$APP" -g "$RG" --query "properties.template.containers[?name!='tutor'].name | [0]"; }
has_tutor() { [ "$(tsv containerapp show -n "$APP" -g "$RG" --query "length(properties.template.containers[?name=='tutor'])" 2>/dev/null || true)" = 1 ]; }
# env_of <container> <NAME> — a plain env var of one container ('' when unset)
env_of() {
  tsv containerapp show -n "$APP" -g "$RG" \
    --query "properties.template.containers[?name=='$1'] | [0].env[?name=='$2'].value | [0]" 2>/dev/null || true
}

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
    --query "properties.template.containers[?name!='tutor'] | [0].env[?name=='AUTH_ALLOWLIST'].value | [0]" 2>/dev/null || true
}

require_signin() {
  signin_enforced || die "sign-in is not switched on for $APP. Run: bash deploy/azure-setup.sh google
(the allowlist trusts a header that only sign-in can set)"
  [ "$(allowlist_mode)" != off ] || die "AUTH_ALLOWLIST=off is set on $APP: the email allowlist is switched off.
Remove it with: az containerapp update -n $APP -g $RG --container-name $(web_container) --remove-env-vars AUTH_ALLOWLIST"
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

# ghcr_has <package> <tag> — the image can be pulled anonymously (what Container Apps does).
ghcr_has() {
  local pkg="$1" tag="$2" token
  token=$(curl -fsS "https://ghcr.io/token?scope=repository:$OWNER/$pkg:pull&service=ghcr.io" \
    | sed -n 's/.*"token":"\([^"]*\)".*/\1/p') || return 1
  curl -fsS -o /dev/null -H "Authorization: Bearer $token" \
    -H 'Accept: application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json' \
    "https://ghcr.io/v2/$OWNER/$pkg/manifests/$tag"
}

# The image must contain the allowlist (so it can never be deployed open) and be pullable anonymously.
check_image() {
  local tag="$1"
  git cat-file -e "$tag:docker/25-allowlist.sh" 2>/dev/null \
    || die "commit $tag predates the sign-in allowlist or isn't in this checkout; deploy a newer commit"
  ghcr_has precalc-trainer "$tag" \
    || die "$IMAGE:$tag is not on ghcr.io (or the package is private). Wait for the deploy workflow on that commit to finish."
  echo "Image: $IMAGE:$tag"
}

check_tutor_image() {
  local tag="$1"
  git cat-file -e "$tag:server/Dockerfile" 2>/dev/null \
    || die "commit $tag has no tutor (server/Dockerfile) or isn't in this checkout; deploy a newer commit"
  ghcr_has precalc-tutor "$tag" \
    || die "$TUTOR_IMAGE:$tag is not on ghcr.io, or the package is private. Wait for the deploy workflow on that
commit, then make the package public: GitHub -> your profile -> Packages -> precalc-tutor -> Package settings
-> Change visibility (it holds no secrets: the keys live in Azure)."
  echo "Tutor image: $TUTOR_IMAGE:$tag"
}

set_users() {
  require_signin
  local web; web=$(web_container)
  say "Allowlist: $(tr ',' '\n' <<<"$1" | wc -l | tr -d ' ') account(s) (new revision)"
  az containerapp update -n "$APP" -g "$RG" --container-name "$web" --set-env-vars "ALLOWED_USERS=$1" -o none
  if has_tutor; then
    say "The tutor re-checks the same list (another revision)"
    az containerapp update -n "$APP" -g "$RG" --container-name tutor --set-env-vars "ALLOWED_USERS=$1" -o none
    local p
    for p in $(env_of tutor PARENT_USERS | tr ',' ' '); do
      [[ ",$1," == *",$p,"* ]] || echo "note: parent $p is no longer on the list, so it can't read the tutor's log"
    done
  fi
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
  local host id secret users json
  host=$(fqdn 2>/dev/null) && [ -n "$host" ] || die "no container app $APP in $RG yet: run app first"
  echo "The Google client must list this redirect URI: https://$host/.auth/login/google/callback"
  id="${GOOGLE_CLIENT_ID:-}"
  secret=""
  # Google offers the new client as a JSON download; reading it here keeps the secret out of the
  # terminal, the shell history and anyone's screen. Keys and values sit on one line in that file.
  json="${1:-${GOOGLE_CLIENT_JSON:-}}"
  if [ -n "$json" ]; then
    [ -f "$json" ] || die "no such file: $json"
    id=$(grep -o '"client_id":[[:space:]]*"[^"]*"' "$json" | head -1 | cut -d'"' -f4)
    secret=$(grep -o '"client_secret":[[:space:]]*"[^"]*"' "$json" | head -1 | cut -d'"' -f4)
    { [ -n "$id" ] && [ -n "$secret" ]; } || die "could not read client_id and client_secret from $json"
    echo "Client read from $json (the secret is not shown)"
  fi
  [ -n "$id" ] || read -rp "Google OAuth client ID: " id
  [[ "$id" =~ ^[0-9]+-[A-Za-z0-9_]+\.apps\.googleusercontent\.com$ ]] \
    || die "that doesn't look like a Google client ID (digits-letters.apps.googleusercontent.com)"
  if [ -z "$secret" ]; then read -rsp "Google OAuth client secret (typing is hidden): " secret; echo; fi
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
  local tag="${1:-$(git rev-parse HEAD)}" web
  check_image "$tag"
  require_signin
  web=$(web_container)
  # Two containers need --container-name each; the tutor first (its API only grows).
  if has_tutor; then
    check_tutor_image "$tag"
    az containerapp update -n "$APP" -g "$RG" --container-name tutor --image "$TUTOR_IMAGE:$tag" -o none
    echo "Rolled out $TUTOR_IMAGE:$tag"
  fi
  az containerapp update -n "$APP" -g "$RG" --container-name "$web" --image "$IMAGE:$tag" -o none
  echo "Rolled out $IMAGE:$tag"
}

cmd_check() {
  need_login
  local host state mode users res hz web
  host=$(fqdn)
  state=$(auth_state)
  mode=$(allowlist_mode)
  web=$(web_container)
  users=$(env_of "$web" ALLOWED_USERS)
  echo "URL:           https://$host"
  echo "Sign-in:       ${state:-none (no sign-in configured)}"
  echo "Email gate:    ${mode:-on}"
  echo "Allowlist:     ${users:-EMPTY, so every page answers 403}"
  if has_tutor; then
    echo "Tutor:         $(tsv containerapp show -n "$APP" -g "$RG" --query "properties.template.containers[?name=='tutor'].image | [0]")"
    echo "               provider=$(env_of tutor TUTOR_PROVIDER) gemini-model=$(env_of tutor GEMINI_MODEL) limit=$(env_of tutor TUTOR_DAILY_LIMIT)/day log=$(env_of tutor TUTOR_LOG_DIR)"
    echo "               parents=$(env_of tutor PARENT_USERS)"
    [ "$(env_of tutor ALLOWED_USERS)" = "$users" ] \
      || echo "note: the tutor's ALLOWED_USERS differs from nginx's; run: bash deploy/azure-setup.sh users \"$users\""
  else
    echo "Tutor:         not added (bash deploy/azure-setup.sh tutor <key-file>)"
  fi
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

# ---- tutor ------------------------------------------------------------------------------------

# read_key_file <file> — reads NAME=value lines (blank lines, # comments, `export ` and quotes are
# fine) with bash builtins only, so no value ever reaches another process's command line. Sets
# GEMINI_KEY and ANTHROPIC_KEY; prints the NAMES it found, never a value.
GEMINI_KEY=""
ANTHROPIC_KEY=""
read_key_file() {
  local file="$1" line name value lname names="" gname="" aname="" gcount=0 acount=0 g a
  [ -f "$file" ] || die "no such file: $file"
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    [[ "$line" =~ ^[[:space:]]*(#.*)?$ ]] && continue
    [[ "$line" == *=* ]] || continue
    name="${line%%=*}"
    value="${line#*=}"
    name="${name#"${name%%[![:space:]]*}"}"
    name="${name#export }"
    name="${name#"${name%%[![:space:]]*}"}"
    name="${name%"${name##*[![:space:]]}"}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    if [ "${#value}" -ge 2 ]; then
      case "$value" in \"*\" | \'*\') value="${value:1:${#value}-2}" ;; esac
    fi
    [ -n "$name" ] || continue
    names="${names:+$names, }$name"
    lname=$(printf '%s' "$name" | tr 'A-Z' 'a-z')   # the NAME only
    g=0
    a=0
    case "$lname" in *gemini* | *google*) g=1 ;; esac
    case "$lname" in *anthropic* | *claude*) a=1 ;; esac
    [ "$g$a" != 11 ] || die "the name $name mentions both Gemini/Google and Anthropic/Claude; rename it in $file"
    if [ "$g" = 1 ]; then gcount=$((gcount + 1)); gname="${gname:+$gname, }$name"; GEMINI_KEY="$value"; fi
    if [ "$a" = 1 ]; then acount=$((acount + 1)); aname="${aname:+$aname, }$name"; ANTHROPIC_KEY="$value"; fi
  done < "$file"
  echo "Key file $file: names found: ${names:-none} (values are never shown)"
  [ "$gcount" -gt 0 ] || die "no name containing \"gemini\" or \"google\" in $file"
  [ "$gcount" -eq 1 ] || die "several names match gemini/google ($gname); keep exactly one"
  [ "$acount" -gt 0 ] || die "no name containing \"anthropic\" or \"claude\" in $file"
  [ "$acount" -eq 1 ] || die "several names match anthropic/claude ($aname); keep exactly one"
  [ -n "$GEMINI_KEY" ] || die "$gname has no value"
  [ -n "$ANTHROPIC_KEY" ] || die "$aname has no value"
  [[ "$GEMINI_KEY" =~ ^[A-Za-z0-9._-]+$ ]] || die "the value of $gname has characters an API key never has (spaces, quotes, ...)"
  [[ "$ANTHROPIC_KEY" =~ ^[A-Za-z0-9._-]+$ ]] || die "the value of $aname has characters an API key never has (spaces, quotes, ...)"
  [[ "$GEMINI_KEY" == AIza* ]] || echo "note: the value of $gname doesn't start with AIza, as Gemini API keys usually do"
  [[ "$ANTHROPIC_KEY" == sk-ant-* ]] || echo "note: the value of $aname doesn't start with sk-ant-, as Anthropic API keys usually do"
  echo "Gemini key:    $gname"
  echo "Anthropic key: $aname"
}

# verify_tutor <provider> — wakes the app and reads the tutor's start-up lines from its console log.
verify_tutor() {
  local want="$1" host logs i image
  host=$(fqdn)
  image=$(tsv containerapp show -n "$APP" -g "$RG" --query "properties.template.containers[?name=='tutor'].image | [0]")
  say "Check the tutor ($image, provider $want)"
  for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
    curl -s -o /dev/null --max-time 60 "https://$host/healthz" || true   # wakes a scaled-to-zero replica
    logs=$(az containerapp logs show -n "$APP" -g "$RG" --container tutor --tail 100 --format text 2>/dev/null | tr -d '\r' || true)
    if grep -q "tutor: key check ok ($want," <<<"$logs"; then
      grep 'tutor: ' <<<"$logs" | tail -n 6
      echo "OK: the tutor is running with $want and its key works. The tutor's own log: file share $TUTOR_SHARE."
      return 0
    fi
    if grep -q "tutor: key check FAILED ($want\|tutor: configuration error\|tutor: cannot write the log directory" <<<"$logs"; then
      grep 'tutor: ' <<<"$logs" | tail -n 12 >&2
      die "the tutor did not start cleanly (lines above; they never contain a key)"
    fi
    echo "waiting for the new revision to start ($i/12)..."
    sleep 10
  done
  echo "note: no start-up line from the tutor yet. Look again in a minute with:"
  echo "  az containerapp logs show -n $APP -g $RG --container tutor --tail 50"
  echo "and look for \"tutor: key check ok ($want, ...)\"."
}

cmd_tutor() {
  local keyfile="${1:-}" tag="${2:-}"
  [ -n "$keyfile" ] || die "usage: tutor <path-to-key-file> [sha]"
  [ -n "$tag" ] || tag=$(git rev-parse HEAD)
  read_key_file "$keyfile"
  need_login
  command -v node >/dev/null 2>&1 || die "node (Node 22, as for the rest of the repository) is needed for this step"
  [ -f deploy/tutor-spec.mjs ] || die "run this from the repository root"
  require_signin
  check_tutor_image "$tag"

  local web allowed parents p provider model limit sub sa extra=()
  web=$(web_container)
  allowed=$(env_of "$web" ALLOWED_USERS)
  [ -n "$allowed" ] || die "the app has no ALLOWED_USERS yet: run google (or users) first"
  parents="${PARENT_USERS:-}"
  [ -n "$parents" ] || read -rp "Parent email(s) that may read the tutor's log, comma-separated: " parents
  parents=$(normalize_users "$parents")
  for p in ${parents//,/ }; do
    [[ ",$allowed," == *",$p,"* ]] || die "$p is not on ALLOWED_USERS ($allowed): a parent has to be allowed in to read the log"
  done
  provider="${TUTOR_PROVIDER:-gemini}"
  case "$provider" in gemini | anthropic) ;; *) die "TUTOR_PROVIDER must be gemini or anthropic" ;; esac
  model="${GEMINI_MODEL:-gemini-3.8-flash}"
  [[ "$model" =~ ^[A-Za-z0-9._-]+$ ]] || die "GEMINI_MODEL looks wrong: $model"
  limit="${TUTOR_DAILY_LIMIT:-30}"
  [[ "$limit" =~ ^[0-9]+$ ]] && [ "$limit" -ge 1 ] && [ "$limit" -le 1000 ] || die "TUTOR_DAILY_LIMIT must be 1-1000"
  if [ -n "${TUTOR_TIMEZONE:-}" ]; then
    [[ "$TUTOR_TIMEZONE" =~ ^[A-Za-z0-9_+/-]+$ ]] || die "TUTOR_TIMEZONE looks wrong: $TUTOR_TIMEZONE"
    extra+=(--env "TUTOR_TIMEZONE=$TUTOR_TIMEZONE")
  fi
  sub=$(tsv account show --query id)
  sa="${TUTOR_STORAGE:-precalctutor$(hash10 "$sub/$RG")}"
  [[ "$sa" =~ ^[a-z0-9]{3,24}$ ]] || die "TUTOR_STORAGE must be 3-24 lowercase letters and digits"

  say "Storage for the tutor's log: account $sa, file share $TUTOR_SHARE (Standard_LRS, pay per GiB used)"
  az provider register -n Microsoft.Storage --wait -o none
  if az storage account show -n "$sa" -g "$RG" -o none 2>/dev/null; then echo "account already exists"; else
    az storage account create -n "$sa" -g "$RG" -l "$LOC" --sku Standard_LRS --kind StorageV2 \
      --min-tls-version TLS1_2 --allow-blob-public-access false --https-only true -o none
  fi
  if az storage share-rm show --storage-account "$sa" -g "$RG" -n "$TUTOR_SHARE" -o none 2>/dev/null; then echo "share already exists"; else
    az storage share-rm create --storage-account "$sa" -g "$RG" -n "$TUTOR_SHARE" --quota 1 -o none
  fi

  say "Attach the share to environment $ACA_ENV as \"$TUTOR_STORAGE_NAME\" (the account key goes from az to az through a pipe)"
  if az containerapp env storage show -n "$ACA_ENV" -g "$RG" --storage-name "$TUTOR_STORAGE_NAME" -o none 2>/dev/null; then
    echo "already attached"
  else
    # tr: az on Windows ends tsv output with CRLF, which would become part of the key.
    # No --storage-type: the core CLI's env storage set is Azure Files only and rejects the flag
    # (only the containerapp extension accepts it).
    az storage account keys list -g "$RG" -n "$sa" --query "[0].value" -o tsv | tr -d '\r\n' \
      | az containerapp env storage set -n "$ACA_ENV" -g "$RG" --storage-name "$TUTOR_STORAGE_NAME" \
          --azure-file-account-name "$sa" --azure-file-share-name "$TUTOR_SHARE" \
          --azure-file-account-key @- --access-mode ReadWrite -o none
  fi

  # "name=@-" makes az read the value from stdin; printf is a bash builtin, so the key never
  # appears in the process list, a command line, the shell history or the screen.
  say "API keys -> container app secrets gemini-api-key and anthropic-api-key"
  printf '%s' "$GEMINI_KEY" | az containerapp secret set -n "$APP" -g "$RG" --secrets "gemini-api-key=@-" -o none
  printf '%s' "$ANTHROPIC_KEY" | az containerapp secret set -n "$APP" -g "$RG" --secrets "anthropic-api-key=@-" -o none
  GEMINI_KEY=""
  ANTHROPIC_KEY=""

  say "Tutor sidecar: $TUTOR_IMAGE:$tag, 0.25 vCPU / 0.5 GiB, provider $provider, $limit questions a day (new revision)"
  # The documented multi-container route: show -o json, add the container and volume, update --yaml.
  # The spec holds secret NAMES only (show never returns values; az fills them back in).
  TMP_SPEC=$(mktemp)
  az containerapp show -n "$APP" -g "$RG" -o json \
    | MSYS_NO_PATHCONV=1 node deploy/tutor-spec.mjs --image "$TUTOR_IMAGE:$tag" --storage "$TUTOR_STORAGE_NAME" \
        --env "TUTOR_PROVIDER=$provider" --env "GEMINI_MODEL=$model" --env "TUTOR_DAILY_LIMIT=$limit" \
        --env "ALLOWED_USERS=$allowed" --env "PARENT_USERS=$parents" ${extra[@]+"${extra[@]}"} \
        --secret-env GEMINI_API_KEY=gemini-api-key --secret-env ANTHROPIC_API_KEY=anthropic-api-key \
        > "$TMP_SPEC"
  azp containerapp update -n "$APP" -g "$RG" --yaml "$(winpath "$TMP_SPEC")" -o none
  rm -f "$TMP_SPEC"
  TMP_SPEC=""
  verify_tutor "$provider"
  cat <<EOF

Switch providers later:  bash deploy/azure-setup.sh tutor-provider anthropic   (or gemini)
New code rolls out with the deploy workflow, or: bash deploy/azure-setup.sh update
The tutor's log: storage account $sa, file share $TUTOR_SHARE, one tutor-YYYY-MM.jsonl per month.
EOF
}

cmd_tutor_provider() {
  local p="${1:-}"
  case "$p" in gemini | anthropic) ;; *) die "usage: tutor-provider <gemini|anthropic>" ;; esac
  need_login
  require_signin
  has_tutor || die "no tutor container on $APP yet: run  bash deploy/azure-setup.sh tutor <key-file>  first"
  tsv containerapp secret list -n "$APP" -g "$RG" --query "[].name" | grep -qx "$p-api-key" \
    || die "the secret $p-api-key is missing: run the tutor step again with a key file that has it"
  say "Tutor provider -> $p (new revision)"
  az containerapp update -n "$APP" -g "$RG" --container-name tutor --set-env-vars "TUTOR_PROVIDER=$p" -o none
  verify_tutor "$p"
}

cmd="${1:-}"
[ $# -gt 0 ] && shift
case "$cmd" in
  app)    cmd_app "$@" ;;
  google) cmd_google "$@" ;;
  users)  cmd_users "$@" ;;
  update) cmd_update "$@" ;;
  check)  cmd_check ;;
  ci)     cmd_ci ;;
  tutor)  cmd_tutor "$@" ;;
  tutor-provider) cmd_tutor_provider "$@" ;;
  *)      sed -n '2,36p' "$0"; exit 2 ;;
esac
