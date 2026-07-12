import express from 'express'
import Speaker from 'speaker'
import * as C from './constants.js'
import { loadAudioFiles, AudioManager } from './audio.js'
import { loop } from './util.js'
import { loadScene } from './scene.js'

let clients = []
const app = express()
const audioManager = new AudioManager()
const sounds = loadAudioFiles()
const ambient = sounds.filter((f) => f.match(/rain/) || f.match(/waves/) || f.match(/brook/))
const birds = sounds.filter((f) => f.match(/bird/) || f.match(/crickets/))
const thunder = sounds.filter((f) => f.match(/thunder/))

audioManager.
  addTrack({ sounds: birds, name: 'birds', maxActive: 2, minDelay: 1_000 }).
  on('playing', ({ file, clip }) => console.log(`Playing ${file} on birds`))
audioManager.
  addTrack({ sounds: ambient, name: 'ambient' }).
  on('playing', ({ file, clip }) => console.log(`Playing ${file} on ambient`))
audioManager.
  addTrack({ sounds: thunder, name: 'thunder', maxActive: 5, minDelay: 300 }).
  on('playing', ({ file, clip }) => console.log(`Playing ${file} on thunder`))
const speaker = C.DEBUG ?
  new Speaker({
    channels: C.CHANNELS,
    bitDepth: 16,
    sampleRate: C.SAMPLE_RATE,
  }) :
    { write: () => {} }

audioManager.fillTracks()

loop(async () => {
  await audioManager.schedule()
  audioManager.generateFrame()
// eslint-disable-next-line no-magic-numbers
}, (C.BUFFER_FRAMES / C.SAMPLE_RATE) * 1000)

audioManager.on('frame', (out) => [ ...clients, speaker ].forEach((c) => {
  c.write(out)
}))
audioManager.on('new-clip', (ac) => {
  ac.on('finished', () => console.log('clip ended'))
})

app.get('/stream.wav', (req, res) => {
  // eslint-disable-next-line no-magic-numbers
  res.writeHead(200, { 'Content-Type': 'audio/wav' })
  clients.push(res)
  req.on('close', () => clients = clients.filter((c) => c !== res))
})

app.listen(C.PORT, () => console.log(`stream: http://localhost:${C.PORT}/stream.wav`))


const x = loadScene('./scenes/thunderstorm.json')

console.log(x)
