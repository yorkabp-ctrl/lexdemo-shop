# ─── Stage 1: Builder ───
FROM node:20.19.5-bookworm AS builder

WORKDIR /app

# Install build tools for native compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# Install ALL dependencies (including dev, since node-gyp is a dev dep)
RUN npm install

# Remove prebuilt binary (if any) and compile from source
# --build-from-source forces node-gyp to compile for this container's ABI
RUN npm rebuild better-sqlite3 --build-from-source

# VERIFY the .node file exists — fail build if missing
RUN test -f node_modules/better-sqlite3/build/Release/better_sqlite3.node \
    && echo "✓ better_sqlite3.node exists" \
    || (echo "✗ BINDING MISSING" && exit 1)

# Verify the module actually loads (not just that the file exists)
RUN node -e "const db = require('better-sqlite3')(':memory:'); db.close(); console.log('✓ better-sqlite3 loads on ' + process.arch)"

# ─── Stage 2: Runtime ───
FROM node:20.19.5-bookworm

WORKDIR /app

# Copy the fully built node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY app.js .

EXPOSE 4000
CMD ["node", "app.js"]
