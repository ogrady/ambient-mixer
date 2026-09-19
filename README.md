# Ambient Mixer
Rewrite of https://github.com/ogrady/GoodMorning

Mixes mp3 files into a continuous stream to play on a Sonos speaker on my guest toilet.

## docker compose

For local execution, create a `docker/` directory alongside the `app/` directory and use:

```yaml
services:
  ambient-mixer:
    build: ../app
    ports:
      - "8000:8000"
    devices:
      - /dev/snd:/dev/snd
    volumes:
      - ./sounds:/app/sounds:ro
      - ./scenes:/app/scenes:ro
    env_file:
      - .env
    restart: unless-stopped
```

## Scene Format
TODO

## .env File
TODO