FROM node:20-alpine

# Dependencias nativas para better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3210
CMD ["node", "index.js"]
