# Stage 1: Build Stage (runs on the target architecture)
FROM node:20-bookworm AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci --omit=dev

RUN node -e "const db = require('better-sqlite3')(':memory:'); db.close(); console.log('✓ better-sqlite3 binding loaded successfully on ' + process.arch)"

# Stage 2: Runtime Stage
FROM node:20-bookworm

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules

COPY package*.json ./
COPY app.js .

EXPOSE 4000

CMD ["node", "app.js"]
