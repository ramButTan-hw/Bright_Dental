#!/bin/sh
set -eu
node database/bootstrap-db.js
exec "$@"
