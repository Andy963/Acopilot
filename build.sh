#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

cd "$ROOT_DIR"

echo "Installing dependencies from repo root..."
npm run install:all:ci

echo "Running validators..."
npm run validate

echo "Building extension..."
npm run build

echo "Packaging VSIX..."
npm run package

echo "Done."
ls -la ./*.vsix
