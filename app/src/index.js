import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import * as C from './constants.js'
import { loop, createSpeaker, pick } from './util.js'
import { loadScene } from './scene.js'
import { AudioManager, createMp3Encoder, createWavHeader } from './audio.js'
import { LOGGER } from './logger.js'

/** @type {{write: (data: string) => void}[]} */
let clients = []
/** @type {AudioManager | null} */
let audioManager
/** @type {{close: () => void}} */
let timeOut
const speaker = createSpeaker()
const app = express()

/** @type {{input: import('node:stream').Writable, output: import('node:stream').Readable, process: import('node:child_process').ChildProcess} | null} */
let encoder = null

const scenes = fs
  .readdirSync(C.SCENES_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => path.join(C.SCENES_DIR, f))

if (scenes.length === 0) {
  LOGGER.error(`no scenes found in ${C.SCENES_DIR}`)
  process.exit(1)
}

async function startRandomScene() {
  const scene = loadScene(pick(scenes))
  audioManager = scene.audioManager

  LOGGER.info(`loaded scene ${scene.name} with tracks: [${audioManager.tracks.map(t => t.name).join(', ')}]`)

  encoder = createMp3Encoder()

  encoder.output.on('data', (chunk) => {
    clients.forEach((c) => c.write(chunk))
  })

  audioManager.on('frame', (out) => {
    speaker.write(out)
    encoder?.input.write(out)
  })

  for (const track of audioManager.tracks) {
    track.on('playing', ({ file, clip }) => {
      LOGGER.debug(`playing ${file} on track ${track.name}`)
      clip.on('finished', () => LOGGER.debug(`finished playing ${file} on track ${track.name} (looping: ${clip.loop})`))
    })
  }

  LOGGER.debug('filling tracks')
  await audioManager.fillTracks()
  LOGGER.debug('done prefilling. Starting main loop')

  timeOut = loop(async () => {
    await audioManager?.schedule()
    await audioManager?.generateFrame()
  }, (C.BUFFER_FRAMES / C.SAMPLE_RATE) * 1000)
}

function stopScene () {
  LOGGER.debug('stopping scene')
  timeOut?.close()

  encoder?.input.end()
  encoder = null

  audioManager?.removeAllListeners()
  audioManager = null
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

  req.on('close', () => {
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
  clients.push(res)
  req.on('close', () => {
    clients = clients.filter((c) => c !== res)
    if (clients.length === 0) stopScene()
  })
})

app.listen(C.PORT, () => LOGGER.info(`stream: http://localhost:${C.PORT}/stream.wav|mp3`))