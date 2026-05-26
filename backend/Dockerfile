FROM node:22-slim AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:22-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y tzdata && rm -rf /var/lib/apt/lists/*

# We still need some dependencies for better-sqlite3 at runtime if it's not a prebuild
# But usually the builder stage handles it.
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Create data and uploads directories
RUN mkdir -p src/data src/uploads

EXPOSE 3001

# Increase memory limit for large data processing
CMD ["node", "--max-old-space-size=2048", "dist/index.js"]
