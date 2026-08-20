FROM node:20-alpine AS base

# تثبيت الأدوات اللازمة
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

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

RUN apk add --no-cache libc6-compat openssl

ENV NODE_ENV=production

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
