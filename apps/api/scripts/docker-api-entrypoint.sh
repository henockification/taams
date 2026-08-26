#!/bin/sh
set -eu

node apps/api/scripts/migrate-production.mjs
exec node apps/api/server.js
