FROM node:20-slim

# Install OpenSSL and ca-certificates for Prisma compatibility
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Expose port (default 5002 as seen in index.js)
EXPOSE 5002

# Default command (can be overridden in docker-compose.yml)
CMD ["npm", "run", "dev"]

