FROM node:20

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production || npm install --only=production --legacy-peer-deps

# Copy prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source
COPY . .

# Build
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start:prod"]
