# wooMakis — production image.
#
# Adapted from the cloudzeus/kollerisFrontEnd Dockerfile, which encodes several
# lessons worth keeping rather than rediscovering.

# Pinned deliberately. The lock file was resolved by npm 11 (which ships with
# Node 24); npm 10.9 computes a different tree from the same package.json and
# `npm ci` then refuses, correctly, because the lock does not describe the tree
# it wants to build. Bump this only together with a regenerated lock file.
ARG NODE_VERSION=24.10.0

# Debian slim rather than Alpine, because of sharp. It processes every product
# image and every WebP conversion on upload. sharp publishes musl builds, but a
# wrong native binary fails at runtime rather than at build — and an image
# pipeline that dies in production is not worth the ~80 MB saved.
FROM node:${NODE_VERSION}-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1

# ── Dependencies ────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app

# Only the manifests, so this layer rebuilds when dependencies change and not
# when a component does. `npm ci` installs exactly the lock, never resolving
# afresh — which is what makes the build reproducible.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ── Build ───────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# A placeholder, and deliberately an obviously fake one.
#
# prisma.config.ts reads DATABASE_URL through env(), which throws when unset, so
# `prisma generate` needs the variable to exist even though it never opens a
# connection. The real URL is supplied to the container at runtime. If a build
# ever fails trying to reach this host, that is a useful signal: something is
# querying the database during the build that should not be.
ENV DATABASE_URL=postgres://build:build@127.0.0.1:5432/placeholder

# No secret is ever passed as a build argument — a build arg is a secret
# recorded permanently in the image's layer history. Every credential this app
# uses (Woo consumer key, Bunny storage password, AUTH_SECRET) is read from the
# environment at runtime.

RUN npx prisma generate

ENV NODE_ENV=production
RUN npm run build

# ── Runtime ─────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

# ffmpeg is a system binary, not an npm package, so it does not arrive with
# node_modules. The media library re-encodes video with it; without it, image
# uploads still work and the UI says video is unavailable rather than failing at
# upload time. Costs roughly 100 MB - the alternative is uploading raw phone
# footage straight to the CDN.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Next writes the standalone server here at build time. It carries only the
# modules the server actually reaches, so this stage needs no package manager
# and no lock file. Requires `output: 'standalone'` in next.config.ts.
COPY --from=builder /app/.next/standalone ./
# Neither of these is traced — one is emitted separately, the other was never
# imported by any module — so both are copied by hand.
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Next writes its image-optimiser cache under .next/cache AT RUNTIME. Everything
# above was copied as root, so the tree belongs to uid 0 while the server runs
# as uid 1000 — and mkdir then fails with EACCES on the first optimised image.
# Next does not treat that as fatal: it logs an unhandledRejection per image and
# serves on, so the log fills with identical errors and every image is
# re-optimised on every request. Created and handed over here, because a
# directory that must exist before the first request is not something to leave
# to the first request.
RUN mkdir -p /app/.next/cache && chown -R node:node /app/.next

# `node` exists in the base image with uid 1000. Running as root would let a
# flaw in a dependency write to the application it is serving.
USER node

EXPOSE 3000

# The platform restarts a container that reports unhealthy. Asking for a real
# page rather than a socket check, because a Next server that has crashed inside
# its request handler still accepts connections.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
