import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { once } from 'node:events'
import * as C from './constants.js'
import { loop, createSpeaker, pick } from './util.js'
import { loadScene } from './scene.js'
import { AudioManager, createMp3Encoder, createWavHeader } from './audio.js'
import { LOGGER } from './logger.js'

/** @type {import('node:http').ServerResponse[]} */
let clients = []
/** @type {AudioManager | null} */
let audioManager
/** @type {{close: () => void} | null} */
let timeOut
const speaker = createSpeaker()
const app = express()

/** @type {{input: import('node:stream').Writable, output: import('node:stream').Readable, process: import('node:child_process').ChildProcess} | null} */
let encoder = null
/** @type {Promise<void> | null} */
let encoderDrain = null
/** @type {Promise<void> | null} */
let speakerDrain = null
/** @type {WeakSet<import('node:http').ServerResponse>} */
let drainingClients = new WeakSet()

const scenes = fs
  .readdirSync(C.SCENES_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => path.join(C.SCENES_DIR, f))

if (scenes.length === 0) {
  LOGGER.error(`no scenes found in ${C.SCENES_DIR}`)
  process.exit(1)
}

/**
 * Wait for a writable stream to drain, resolving if it closes/ends/errors first.
 * @param {import('node:stream').Writable} stream
 */
async function waitForDrain (stream) {
  if (stream.destroyed || stream.writableEnded) return
  await Promise.race([
    once(stream, 'drain'),
    once(stream, 'close').catch(() => {}),
    once(stream, 'error').catch(() => {}),
  ])
}

async function startRandomScene() {
  const scene = loadScene(pick(scenes))
  audioManager = scene.audioManager
  encoderDrain = null
  speakerDrain = null
  drainingClients = new WeakSet()

  LOGGER.info(`loaded scene ${scene.name} with tracks: [${audioManager.tracks.map(t => t.name).join(', ')}]`)

  encoder = createMp3Encoder()

  encoder.process.on('error', (err) => {
    LOGGER.error('mp3 encoder process error:', err?.message ?? err)
    stopScene()
  })
  encoder.process.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      LOGGER.warn(`mp3 encoder process exited with code ${code}`)
    }
  })
  encoder.output.on('error', (err) => {
    LOGGER.error('mp3 encoder output error:', err?.message ?? err)
    stopScene()
  })
  encoder.output.on('data', (chunk) => {
    for (const c of clients) {
      try {
        if (drainingClients.has(c)) continue
        const ok = c.write(chunk)
        if (!ok) {
          drainingClients.add(c)
          c.once('drain', () => drainingClients.delete(c))
        }
      } catch (e) {
        // ignore per-client write errors; 'error' handler will clean up
      }
    }
  })

  audioManager.on('frame', (out) => {
    try {
      const ok = speaker.write(out)
      if (ok === false && !speakerDrain) {
        speakerDrain = waitForDrain(speaker).finally(() => { speakerDrain = null })
      }
    } catch (e) {
      LOGGER.warn('speaker write failed:', e?.message ?? e)
    }
    if (encoder?.input && !encoder.input.destroyed) {
      try {
        if (!encoderDrain) {
          const ok = encoder.input.write(out)
          if (!ok) {
            encoderDrain = waitForDrain(encoder.input).finally(() => { encoderDrain = null })
          }
        } else {
          // Encoder input is still draining; drop this frame for the encoder to
          // avoid unbounded buffering. Speaker/local playback continues.
          LOGGER.warn('MP3 encoder input buffer is full; dropping frame')
        }
      } catch (e) {
        LOGGER.warn('encoder write failed:', e?.message ?? e)
      }
    }
  })

  for (const track of audioManager.tracks) {
    track.on('playing', ({ file, clip }) => {
      LOGGER.debug(`playing ${file} on track ${track.name}`)
      clip.on('finished', () => LOGGER.debug(`finished playing ${file} on track ${track.name} (looping: ${clip.loop})`))
    })
  }

  LOGGER.debug('filling tracks')
  try {
    await audioManager.fillTracks()
  } catch (err) {
    LOGGER.error('failed to fill tracks:', err?.message ?? err)
    stopScene()
    return
  }
  LOGGER.debug('done prefilling. Starting main loop')

  timeOut = loop(async () => {
    try {
      audioManager?.schedule()
      audioManager?.generateFrame()
      if (speakerDrain) await speakerDrain
    } catch (err) {
      LOGGER.error('audio loop error:', err?.message ?? err)
      stopScene()
    }
  }, (C.BUFFER_FRAMES / C.SAMPLE_RATE) * 1000)
}

function stopScene () {
  LOGGER.debug('stopping scene')
  if (timeOut) {
    timeOut.close()
    timeOut = null
  }

  encoderDrain = null
  speakerDrain = null
  drainingClients = new WeakSet()

  if (encoder) {
    try {
      encoder.input?.end()
    } catch (e) {}
    try {
      encoder.process?.kill('SIGTERM')
    } catch (e) {}
    encoder = null
  }

  if (audioManager) {
    audioManager.removeAllListeners()
    audioManager.destroy?.()
    audioManager = null
  }
}

app.get('/health', (_, res) => {
  res.status(200).send('OK')
})

app.get('/stream.mp3', async (req, res) => {
  if (clients.length === 0) await startRandomScene()

  res.writeHead(200, {
    'Content-Type': 'audio/mpeg',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  clients.push(res)
  res.on('error', () => {
    drainingClients.delete(res)
    clients = clients.filter((c) => c !== res)
    if (clients.length === 0) stopScene()
  })
  req.on('close', () => {
    drainingClients.delete(res)
    clients = clients.filter((c) => c !== res)
    if (clients.length === 0) stopScene()
  })
})

app.get('/stream.wav', async (req, res) => {
  if (clients.length === 0) await startRandomScene()

  res.writeHead(200, {
    'Content-Type': 'audio/wav',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  res.write(createWavHeader({
    sampleRate: C.SAMPLE_RATE,
    channels: C.CHANNELS,
    bitsPerSample: 16,
  }))
  // Note: stream data is currently fed from the MP3 encoder output, so /stream.wav
  // does not deliver valid WAV PCM audio. Header/startup behavior is preserved.
  clients.push(res)
  res.on('error', () => {
    drainingClients.delete(res)
    clients = clients.filter((c) => c !== res)
    if (clients.length === 0) stopScene()
  })
  req.on('close', () => {
    drainingClients.delete(res)
    clients = clients.filter((c) => c !== res)
    if (clients.length === 0) stopScene()
  })
})

app.listen(C.PORT, () => LOGGER.info(`stream: http://localhost:${C.PORT}/stream.wav|mp3`))