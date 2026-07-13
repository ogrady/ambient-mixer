import express from 'express'
import * as C from './constants.js'
import { loop, createSpeaker } from './util.js'
import { loadScene } from './scene.js'
import { createWavHeader } from './audio.js'

/** @type {{write: (data: string) => void}[]} */
let clients = []
const app = express()

const scene = loadScene('./scenes/thunderstorm.json')
const { audioManager } = scene

/*
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
*/
const speaker = createSpeaker()

audioManager.fillTracks()

loop(async () => {
  await audioManager.schedule()
  audioManager.generateFrame()
}, (C.BUFFER_FRAMES / C.SAMPLE_RATE) * 1000)

audioManager.on('frame', (out) => [ ...clients, speaker ].forEach((c) => {
  c.write(out)
}))
for (const track of audioManager.tracks) {
  track.on('playing', ({ file, clip }) => {
    console.log(`playing ${file} on track ${track.name}`)
    clip.on('finished', () => console.log(`finished playing ${file} on track ${track.name}`))
  })
}

app.get('/stream.wav', (req, res) => {
  // res.writeHead(200, { 'Content-Type': 'audio/wav' })

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
  req.on('close', () => clients = clients.filter((c) => c !== res))
})

app.listen(C.PORT, () => console.log(`stream: http://localhost:${C.PORT}/stream.wav`))

