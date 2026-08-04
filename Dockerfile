# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
# Skip lifecycle scripts (prisma generate); the generated client is copied below.
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
EXPOSE 3006
USER node
CMD ["node", "dist/main.js"]

# Migrations run as a separate deploy step (CI/CD or an init job), not per replica:
#   npx prisma migrate deploy
