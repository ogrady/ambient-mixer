FROM node:26-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential libasound2-dev python3 ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

VOLUME ["/app/sounds", "/app/scenes"]

EXPOSE 3000

CMD ["npm", "start"]