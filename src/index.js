import fs from 'fs'
import path from 'path'
import express from 'express'
import Speaker from 'speaker'
import { clamp, sample } from './util.js'
import * as C from './constants.js'
import { loadAudioFiles, decodeMp3, declip, AudioClip, AudioManager } from './audio.js'

const audioManager = new AudioManager({ sounds: loadAudioFiles() })

let active = []

const speaker = new Speaker({
  channels: C.CHANNELS,
  bitDepth: 16,
  sampleRate: C.SAMPLE_RATE,
})

let clients = []


setInterval(() => audioManager.generateFrame(), (C.BUFFER_FRAMES / C.SAMPLE_RATE) * 1000)
setInterval(() => audioManager.addRandomSound().catch(console.error), C.RANDOM_SOUND_INTERVAL)

audioManager.on('frame', (out) => {
  speaker.write(out)
  for (const c of clients) c.write(out) 
})

const app = express()
app.get('/stream.wav', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'audio/wav' })
  clients.push(res)
  req.on('close', () => clients = clients.filter((c) => c !== res))
})


app.listen(C.PORT, () => console.log(`stream: http://localhost:${C.PORT}/stream.wav`))
