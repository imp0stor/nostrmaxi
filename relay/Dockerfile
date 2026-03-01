FROM node:20-alpine

WORKDIR /app

# Install build deps for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy and install production deps only
COPY package*.json ./
RUN npm install --omit=dev

# Copy pre-built JS
COPY dist/ ./

EXPOSE 7778
CMD ["node", "compressed-relay.js"]
