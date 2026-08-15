#!/bin/sh
# Structural secret scan. Matches populated credentials, ignores placeholders.
# Excludes itself (it necessarily contains the patterns). Exit 1 if anything real is found.
hits=$(git grep -nEi \
  "ck_[a-f0-9]{40}|cs_[a-f0-9]{40}|postgres://[^:]+:[^@[:space:]]+@|AccessKey: *[0-9a-f-]{20,}" \
  -- $(git ls-files | grep -v '^\.secretscan\.sh$') 2>/dev/null \
  | grep -vE "USER:PASSWORD|:<password>@|:\\\$[A-Z_]+@|//build:build@127\.0\.0\.1")
if [ -n "$hits" ]; then echo "SECRETS FOUND:"; echo "$hits"; exit 1; fi
echo "scan: clean"
