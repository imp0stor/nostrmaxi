FROM node:20

WORKDIR /app

# Install dependencies
COPY package.json ./
# Remove local file-linked package that is unavailable in production image context.
RUN npm install -g npm@9 \
  && npm pkg delete dependencies.@strangesignal/nostr-auth \
  && npm install --legacy-peer-deps

# Copy prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source
COPY . .

# Build
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start:prod"]
