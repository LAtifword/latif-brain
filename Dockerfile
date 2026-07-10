FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY src ./src
COPY dist ./dist

EXPOSE 8080

CMD ["node", "src/api/rest-server.js"]
