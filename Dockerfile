FROM node:20-alpine AS base

# تثبيت الأدوات اللازمة
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

ARG ASAS_RELEASE_VERSION=0.1.0
ARG ASAS_RELEASE_CHANNEL=STABLE
ENV ASAS_RELEASE_VERSION=$ASAS_RELEASE_VERSION
ENV ASAS_RELEASE_CHANNEL=$ASAS_RELEASE_CHANNEL

# نسخ package files
COPY package*.json ./
COPY prisma ./prisma/

# تثبيت التبعيات
RUN npm ci

# توليد Prisma Client
RUN npx prisma generate

# نسخ كود المصدر
COPY . .

# البناء
RUN npm run build

# المرحلة النهائية
FROM node:20-alpine AS runner
WORKDIR /app

ARG ASAS_RELEASE_VERSION=0.1.0
ARG ASAS_RELEASE_CHANNEL=STABLE
LABEL org.opencontainers.image.title="asas-platform" \
      org.opencontainers.image.version="$ASAS_RELEASE_VERSION" \
      org.opencontainers.image.description="ASAS Plus application artifact"

RUN apk add --no-cache libc6-compat openssl

ENV NODE_ENV=production
ENV ASAS_RELEASE_VERSION=$ASAS_RELEASE_VERSION
ENV ASAS_RELEASE_CHANNEL=$ASAS_RELEASE_CHANNEL

COPY --from=base /app/public ./public
COPY --from=base /app/.next/standalone ./
COPY --from=base /app/.next/static ./.next/static
COPY --from=base /app/prisma ./prisma
COPY --from=base /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=base /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
