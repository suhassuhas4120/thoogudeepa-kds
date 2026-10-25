FROM node:20-alpine AS base

# Install openssl for Prisma
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Copy application code
COPY . .

# Build application
ENV NODE_ENV=production
RUN npx prisma generate
RUN npm run build

# Expose port (Render & Railway inject PORT environment variable)
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
