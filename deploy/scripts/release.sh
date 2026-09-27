#!/usr/bin/env bash

set -Eeuo pipefail

fail() {
  printf 'release.sh: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat >&2 <<'EOF'
Usage:
  release.sh activate <deploy-root> <release-id> <archive.tar.gz>
  release.sh rollback <deploy-root>
  release.sh prune <deploy-root> [releases-to-keep]
EOF
  exit 2
}

validate_deploy_root() {
  local deploy_root=$1

  [[ "$deploy_root" == /* ]] || fail 'deploy root must be an absolute path'
  [[ "$deploy_root" != / ]] || fail 'deploy root must not be /'

  mkdir -p -- "$deploy_root/incoming" "$deploy_root/releases"
  realpath "$deploy_root"
}

validate_release_id() {
  local release_id=$1
  [[ "$release_id" =~ ^[0-9a-f]{7,64}$ ]] ||
    fail 'release id must be a 7-64 character lowercase hexadecimal Git SHA'
}

validate_release_target() {
  local releases_dir=$1
  local target=$2

  [[ -n "$target" ]] || fail 'release link is missing or broken'
  [[ "$target" == "$releases_dir"/* ]] ||
    fail 'release link points outside the releases directory'
  [[ -f "$target/index.html" ]] || fail 'release does not contain index.html'
}

atomic_symlink() {
  local target=$1
  local link_path=$2
  local temporary_link="${link_path}.tmp.$$"

  rm -f -- "$temporary_link"
  ln -s -- "$target" "$temporary_link"

  if ! mv -Tf -- "$temporary_link" "$link_path" 2>/dev/null; then
    mv -fh -- "$temporary_link" "$link_path"
  fi
}

validate_archive_entries() {
  local archive_path=$1
  local entry

  while IFS= read -r entry; do
    [[ "$entry" != /* ]] || fail 'archive contains an absolute path'
    [[ "/$entry/" != *'/../'* ]] || fail 'archive contains a parent traversal path'
  done < <(tar -tzf "$archive_path")
}

activate_release() {
  [[ $# -eq 3 ]] || usage

  local deploy_root
  deploy_root=$(validate_deploy_root "$1")
  local release_id=$2
  local archive_path=$3
  local incoming_dir="$deploy_root/incoming"
  local releases_dir="$deploy_root/releases"
  local release_dir="$releases_dir/$release_id"
  local current_link="$deploy_root/current"
  local previous_link="$deploy_root/previous"
  local staging_dir=''

  validate_release_id "$release_id"
  [[ -f "$archive_path" ]] || fail 'release archive does not exist'
  archive_path=$(realpath "$archive_path")
  [[ "$archive_path" == "$incoming_dir"/* ]] ||
    fail 'release archive must be located inside the incoming directory'
  [[ "$archive_path" == *.tar.gz ]] || fail 'release archive must end in .tar.gz'
  validate_archive_entries "$archive_path"

  if [[ -e "$release_dir" ]]; then
    [[ -d "$release_dir" ]] || fail 'release path exists and is not a directory'
    [[ -f "$release_dir/index.html" ]] ||
      fail 'existing release does not contain index.html'
  else
    staging_dir=$(mktemp -d "$releases_dir/.${release_id}.XXXXXX")
    trap '[[ -z "${staging_dir:-}" ]] || rm -rf -- "$staging_dir"' EXIT
    tar -xzf "$archive_path" -C "$staging_dir"
    [[ -z "$(find "$staging_dir" -type l -print -quit)" ]] ||
      fail 'release archive must not contain symbolic links'
    [[ -f "$staging_dir/index.html" ]] ||
      fail 'release archive does not contain index.html at its root'
    mv -- "$staging_dir" "$release_dir"
    staging_dir=''
  fi

  local current_target=''

  if [[ -L "$current_link" ]]; then
    current_target=$(realpath "$current_link")
    validate_release_target "$releases_dir" "$current_target"
  elif [[ -e "$current_link" ]]; then
    fail 'current exists and is not a symbolic link'
  fi

  if [[ -e "$previous_link" && ! -L "$previous_link" ]]; then
    fail 'previous exists and is not a symbolic link'
  fi

  if [[ -n "$current_target" && "$current_target" != "$release_dir" ]]; then
    atomic_symlink "releases/$(basename "$current_target")" "$previous_link"
  fi

  atomic_symlink "releases/$release_id" "$current_link"
  printf 'Activated release %s\n' "$release_id"
}

rollback_release() {
  [[ $# -eq 1 ]] || usage

  local deploy_root
  deploy_root=$(validate_deploy_root "$1")
  local releases_dir="$deploy_root/releases"
  local current_link="$deploy_root/current"
  local previous_link="$deploy_root/previous"

  [[ -L "$current_link" ]] || fail 'current release link is missing'
  [[ -L "$previous_link" ]] || fail 'previous release link is missing'

  local current_target
  local previous_target
  current_target=$(realpath "$current_link")
  previous_target=$(realpath "$previous_link")
  validate_release_target "$releases_dir" "$current_target"
  validate_release_target "$releases_dir" "$previous_target"

  atomic_symlink "releases/$(basename "$previous_target")" "$current_link"
  atomic_symlink "releases/$(basename "$current_target")" "$previous_link"
  printf 'Rolled back to release %s\n' "$(basename "$previous_target")"
}

prune_releases() {
  [[ $# -ge 1 && $# -le 2 ]] || usage

  local deploy_root
  deploy_root=$(validate_deploy_root "$1")
  local keep=${2:-5}
  local releases_dir="$deploy_root/releases"

  [[ "$keep" =~ ^[1-9][0-9]*$ ]] || fail 'releases-to-keep must be positive'

  local current_target=''
  local previous_target=''
  [[ ! -L "$deploy_root/current" ]] || current_target=$(realpath "$deploy_root/current")
  [[ ! -L "$deploy_root/previous" ]] || previous_target=$(realpath "$deploy_root/previous")

  local index=0
  local record
  local release_dir

  while IFS= read -r record; do
    release_dir=${record#* }

    if ((index < keep)) ||
      [[ "$release_dir" == "$current_target" || "$release_dir" == "$previous_target" ]]; then
      index=$((index + 1))
      continue
    fi

    [[ "$release_dir" == "$releases_dir"/* ]] ||
      fail 'refusing to prune a path outside the releases directory'
    rm -rf -- "$release_dir"
    index=$((index + 1))
  done < <(
    find "$releases_dir" -mindepth 1 -maxdepth 1 -type d -name '[0-9a-f]*' \
      -printf '%T@ %p\n' | sort -nr
  )
}

command=${1:-}
[[ -n "$command" ]] || usage
shift

case "$command" in
  activate)
    activate_release "$@"
    ;;
  rollback)
    rollback_release "$@"
    ;;
  prune)
    prune_releases "$@"
    ;;
  *)
    usage
    ;;
esac
