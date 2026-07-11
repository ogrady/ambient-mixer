import express from 'express'
import Speaker from 'speaker'
import * as C from './constants.js'
import { loadAudioFiles, AudioManager } from './audio.js'
import { loop } from './util.js'

let clients = []
const app = express()
const audioManager = new AudioManager()
audioManager.addTrack({ sounds: loadAudioFiles() })
const speaker = C.DEBUG ?
  new Speaker({
    channels: C.CHANNELS,
    bitDepth: 16,
    sampleRate: C.SAMPLE_RATE,
  }) :
    { write: () => {} }

// eslint-disable-next-line no-magic-numbers
loop(() => audioManager.generateFrame(), (C.BUFFER_FRAMES / C.SAMPLE_RATE) * 1000)
//setInterval(() => audioManager.generateFrame(), (C.BUFFER_FRAMES / C.SAMPLE_RATE) * 1000)
//setInterval(() => audioManager.addRandomSound().catch(console.error), C.RANDOM_SOUND_INTERVAL)

audioManager.on('frame', (out) => [ ...clients, speaker ].forEach((c) => {
  c.write(out)
}))
audioManager.on('playing', (file) => console.log('Playing', file))
audioManager.on('new-clip', ac => {
  ac.on('finished', () => console.log('clip ended'))
})

app.get('/stream.wav', (req, res) => {
  // eslint-disable-next-line no-magic-numbers
  res.writeHead(200, { 'Content-Type': 'audio/wav' })
  clients.push(res)
  req.on('close', () => clients = clients.filter((c) => c !== res))
})

app.listen(C.PORT, () => console.log(`stream: http://localhost:${C.PORT}/stream.wav`))
