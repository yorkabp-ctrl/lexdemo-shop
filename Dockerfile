# ─── Stage 1: Builder ───
FROM node:20.19.5-trixie AS builder

WORKDIR /app

# Install build tools for native module compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# Install dependencies and force better-sqlite3 to compile from source
RUN npm install --omit=dev && \
    npm rebuild better-sqlite3

# Verify the native binding loads BEFORE copying to runtime
RUN node -e "const db = require('better-sqlite3')(':memory:'); db.close(); console.log('✓ better-sqlite3 binding loads on ' + process.arch)"

# ─── Stage 2: Runtime ───
FROM node:20.19.5-trixie

WORKDIR /app

# Copy the fully built node_modules from builder (includes the .node binding)
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY app.js .

EXPOSE 4000
CMD ["node", "app.js"]
