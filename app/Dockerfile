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

CMD ["npm", "start"]
