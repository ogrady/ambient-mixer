FROM node:26-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg python3 make g++ libasound2-dev\
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

VOLUME ["/app/sounds", "/app/scenes", "/app/.env"]

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:8000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npm", "start"]
