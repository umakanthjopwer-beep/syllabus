#!/usr/bin/env bash
set -euo pipefail

rm -rf dist
mkdir -p dist

find . -mindepth 1 -maxdepth 1 \
  ! -name '.git' \
  ! -name '.github' \
  ! -name 'dist' \
  ! -name 'wrangler.jsonc' \
  ! -name '.assetsignore' \
  ! -name 'README.md' \
  ! -name 'pages-build.sh' \
  -exec cp -R {} dist/ \;

test -f dist/index.html
