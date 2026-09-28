# ─── Stage 1: Builder ───
FROM node:20.19.5-trixie AS builder

WORKDIR /app

# Install build tools for native module compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# Install dependencies WITHOUT running install scripts
RUN npm install --omit=dev --ignore-scripts

# Remove any prebuilt binary that might be incompatible
RUN rm -rf node_modules/better-sqlite3/build node_modules/better-sqlite3/prebuilds

# Explicitly compile better-sqlite3 from source for THIS container's arch + glibc
RUN cd node_modules/better-sqlite3 && \
    npx node-gyp rebuild --arch=arm64

# Verify the binding loads — fails build if ABI mismatch persists
RUN node -e "const db = require('better-sqlite3')(':memory:'); db.close(); console.log('✓ better-sqlite3 binding loads on ' + process.arch)"

# ─── Stage 2: Runtime ───
FROM node:20.19.5-trixie

WORKDIR /app

# Copy the fully built node_modules (includes compiled .node binding)
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY app.js .

EXPOSE 4000
CMD ["node", "app.js"]
