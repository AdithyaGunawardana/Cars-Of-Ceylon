FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3000

CMD ["sh", "-c", "npm run prisma:generate && npm run dev -- -H 0.0.0.0 -p 3000"]
