FROM node:20

WORKDIR /app

# Install dependencies
COPY package*.json ./
# Remove local file-linked package that is unavailable in production image context.
RUN npm pkg delete dependencies.@strangesignal/nostr-auth \
  && npm install --omit=dev --legacy-peer-deps

# Copy prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source
COPY . .

# Build
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start:prod"]
