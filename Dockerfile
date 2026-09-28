# ─── Stage 1: Builder ───
FROM node:20.19.5-trixie AS builder

WORKDIR /app

# Build tools for native compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# 1. Install WITHOUT running lifecycle scripts — this prevents the broken prebuilt binary
#    from ever being downloaded or run
RUN npm install --ignore-scripts

# 2. Explicitly compile better-sqlite3 for THIS container's arch (arm64) and GLIBC (2.41)
RUN cd node_modules/better-sqlite3 && npx node-gyp rebuild

# 3. Verify the .node file exists — fail the build if missing
RUN test -f node_modules/better-sqlite3/build/Release/better_sqlite3.node \
    && echo "✓ better_sqlite3.node exists" \
    || (echo "✗ BINDING MISSING" && exit 1)

# 4. Verify it loads — fail the build if it segfaults
RUN node -e "const db = require('better-sqlite3')(':memory:'); db.close(); console.log('✓ better-sqlite3 loads on ' + process.arch)"

# ─── Stage 2: Runtime ───
FROM node:20.19.5-trixie

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY app.js .

EXPOSE 4000
CMD ["node", "app.js"]
