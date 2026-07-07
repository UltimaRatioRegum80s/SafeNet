#!/bin/bash
set -e

npm install

# Use --force to bypass any interactive prompts (e.g. unique constraint additions)
npm run db:push -- --force
