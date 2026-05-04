# ===== Build stage =====
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for layer caching — npm ci only re-runs when these change
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ===== Runtime stage =====
FROM node:20-alpine

# Run as the built-in 'node' user, not root
USER node
WORKDIR /home/node/app

# Copy only what's needed at runtime: deps from builder + source from local
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node . .

# Create the uploads dir multer expects (ephemeral on Render — receipts go to Cloudinary anyway)
RUN mkdir -p uploads

ENV NODE_ENV=production

# Render injects PORT env var; server.js already reads process.env.PORT
EXPOSE 3001

CMD ["node", "server.js"]
