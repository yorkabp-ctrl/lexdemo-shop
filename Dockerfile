# Multi-stage Dockerfile for ARM64 Mac
# Uses Debian Trixie (GLIBC 2.41) to satisfy better-sqlite3 prebuilds

# ── Stage 1: Build ──
FROM node:20.19.5-trixie AS builder

WORKDIR /app

# Build tools for native module compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# Remove any stale prebuilds + install fresh
RUN rm -rf node_modules && \
    npm install --omit=dev && \
    rm -rf node_modules/better-sqlite3/prebuilds && \
    npm rebuild better-sqlite3

# Verify the module loads — fails build if broken
RUN node -e "require('better-sqlite3'); console.log('✓ better-sqlite3 loads on ' + process.arch)"

# ── Stage 2: Runtime ──
FROM node:20.19.5-trixie

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY app.js .

EXPOSE 4000
CMD ["node", "app.js"]
