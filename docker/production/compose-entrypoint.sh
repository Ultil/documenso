#!/usr/bin/env bash

SCRIPT_DIR="$(readlink -f "$(dirname "$0")")"
MONOREPO_ROOT="$(readlink -f "$SCRIPT_DIR/../../")"

cd "$MONOREPO_ROOT"

# Install dependencies
npm ci

# Preapre
npm run prisma:generate --workspace=@documenso/prisma
npm run prisma:migrate-deploy --workspace=@documenso/prisma

# Build
npm run build -- --filter @documenso/web

# Run
npm run start