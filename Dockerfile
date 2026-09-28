# ─── Stage 1: Dependencies ───
FROM node:24-trixie-slim AS deps

WORKDIR /app

COPY package*.json ./

# --ignore-scripts prevents node-gyp/QEMU compile.
# better-sqlite3 v13 ships pre-built binaries for linux/arm64.
RUN npm ci --omit=dev --ignore-scripts

# ─── Stage 2: Runtime ───
FROM node:24-trixie-slim

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY app.js .

EXPOSE 4000

CMD ["node", "app.js"]
