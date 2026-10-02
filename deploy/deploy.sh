#!/bin/sh
# deploy.sh [git-sha]: deploy a pushed commit, image and manifest together. An older sha is a rollback.
# Needs only git and ssh (the "homelab" alias in ~/.ssh/config). Run it as: sh deploy/deploy.sh
# Exit: 0 ok, 1 failed and rolled back, 2 rejected, 3 busy, 4 image not built yet, 5 waiting for Jason, 255 ssh failed.
set -eu
app=math                                    # set once: the `app:` value of deploy/homelab.yml
case "$app" in ''|*[!a-z0-9-]*) echo "set app= in deploy/deploy.sh to the app name" >&2; exit 2 ;; esac
sha=$(git rev-parse --verify --quiet "${1:-HEAD}^{commit}") || { echo "not a commit: ${1:-HEAD}" >&2; exit 2; }
git cat-file -e "$sha:deploy/homelab.yml" 2>/dev/null || { echo "commit $sha has no deploy/homelab.yml" >&2; exit 2; }
[ -n "$(git branch -r --contains "$sha" 2>/dev/null)" ] || { echo "commit $sha is not pushed" >&2; exit 2; }
i=0
while :; do
  rc=0
  git show "$sha:deploy/homelab.yml" | ssh homelab deploy "$app" "git:$sha" || rc=$?
  if [ "$rc" -ne 4 ] || [ "$i" -ge 60 ]; then exit "$rc"; fi     # 4 = CI has not pushed the image yet
  i=$((i+1)); sleep 15
done
