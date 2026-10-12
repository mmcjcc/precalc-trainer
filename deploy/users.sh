#!/usr/bin/env bash
# deploy/users.sh [--check] [--azure] [lists file]: make who may use math match one file, in one step.
#
# The lists file (default: the one Jason keeps beside his key file, outside the repo) has two lines:
#   ALLOWED_USERS=a@gmail.com,b@school.org,...   everyone who may use the app (students and parents)
#   PARENT_USERS=a@gmail.com,...                 who may also read the tutor's question log
# Every PARENT_USERS address must also be in ALLOWED_USERS.
#
# What it sets, at home (math.apps.mmcjcc.com):
#   1. the app's own lists (ALLOWED_USERS for nginx and the tutor sidecar, the tutor's PARENT_USERS) with
#      app-broker's set-secrets tool (the copy the broker serves), which restarts math once;
#   2. the platform's sign-in list: `ssh homelab access set math <every ALLOWED_USERS address> --by jason`
#      (set, not add, so the two lists can never drift apart). The broker's notes are printed: a new Google
#      account also has to be a test user in the Google console, an AD account in Apps-Users with its mail.
# With --azure it also sets the Azure site's lists (azure-setup.sh users, and the tutor's PARENT_USERS).
# With --check it changes nothing and says what it would do.
# Needs: git bash, ssh (the homelab alias), and for --azure an `az login` to the Azure for Students account.
set -euo pipefail

FILE='S:\Users\cohenjas\OneDrive\math\homelab-lists.txt'
CHECK=0
AZURE=0
for arg in "$@"; do
  case "$arg" in
    --check) CHECK=1 ;;
    --azure) AZURE=1 ;;
    -*) echo "unknown option $arg" >&2; exit 2 ;;
    *) FILE="$arg" ;;
  esac
done
here=$(cd "$(dirname "$0")/.." && pwd)
unix=$(command -v cygpath >/dev/null 2>&1 && cygpath -u "$FILE" || printf '%s' "$FILE")
[ -r "$unix" ] || { echo "users.sh: cannot read $FILE" >&2; exit 2; }

# One list per name: lower case, no spaces, no repeats, in file order.
list_of() {
  sed -n "s/^$1=//p" "$unix" | tr -d '\r' | tr 'A-Z' 'a-z' | tr ', ' '\n\n' | sed '/^$/d' | awk '!seen[$0]++'
}
allowed=$(list_of ALLOWED_USERS)
parents=$(list_of PARENT_USERS)
[ -n "$allowed" ] || { echo "users.sh: ALLOWED_USERS is empty in $FILE (the platform refuses an empty list)" >&2; exit 2; }
email='^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
for a in $allowed $parents; do
  [[ "$a" =~ $email ]] || { echo "users.sh: \"$a\" does not look like an email address" >&2; exit 2; }
done
for p in $parents; do
  grep -qx "$p" <<<"$allowed" || { echo "users.sh: parent $p is not in ALLOWED_USERS" >&2; exit 2; }
done
n_allowed=$(wc -l <<<"$allowed" | tr -d ' ')
n_parents=$([ -n "$parents" ] && wc -l <<<"$parents" | tr -d ' ' || echo 0)
echo "From $FILE: $n_allowed allowed, $n_parents of them parents."

# The broker accepts a command of at most 300 bytes.
access_cmd="access set math $(tr '\n' ' ' <<<"$allowed")--by jason"
[ "${#access_cmd}" -le 300 ] || { echo "users.sh: too many addresses for one access set (${#access_cmd} bytes; the broker takes 300)" >&2; exit 2; }

tool=$(mktemp -d)/set-secrets.sh
ssh homelab contract tool set-secrets > "$tool"

if [ "$CHECK" = 1 ]; then
  echo "== Home, the app's own lists (set-secrets --check)"
  bash "$tool" math "$FILE" --only ALLOWED_USERS,PARENT_USERS --check
  echo "== Home, the platform's sign-in list now"
  ssh homelab access show math
  echo "would run: ssh homelab $access_cmd"
  [ "$AZURE" = 0 ] || echo "would also set the Azure site's ALLOWED_USERS and the tutor's PARENT_USERS"
  exit 0
fi

echo "== Home: the app's own lists, then one restart"
bash "$tool" math "$FILE" --only ALLOWED_USERS,PARENT_USERS
echo "== Home: the platform's sign-in list"
# shellcheck disable=SC2086 # one word per address, on purpose
ssh homelab $access_cmd

if [ "$AZURE" = 1 ]; then
  echo "== Azure: the app's and the tutor's lists"
  joined_allowed=$(paste -sd, <<<"$allowed")
  ACA_ENV="${ACA_ENV:-precalc-env-std}" LOC="${LOC:-northcentralus}" bash "$here/deploy/azure-setup.sh" users "$joined_allowed"
  if [ -n "$parents" ]; then
    MSYS_NO_PATHCONV=1 az containerapp update -n precalc -g precalc-rg --container-name tutor \
      --set-env-vars "PARENT_USERS=$(paste -sd, <<<"$parents")" -o none
    echo "Azure tutor: $n_parents parent(s)"
  fi
  echo "Azure sign-in is Google's: a new address also has to be a test user of the Azure site's Google client."
fi
