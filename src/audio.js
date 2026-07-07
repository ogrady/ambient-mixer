import * as C from './constants.js'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'child_process'
import { clamp, sample } from './util.js'
import Speaker from 'speaker'
import EventEmitter from 'node:events'

export const declip = (bit) => clamp(bit, C.AUDIO_CLIPPING_LOWER_BOUND, C.AUDIO_CLIPPING_UPPER_BOUND)

export const loadAudioFiles = () => fs.readdirSync('./sounds')
  .filter(f => f.endsWith('.mp3'))
  .map(f => path.join('./sounds', f))

export function decodeMp3 (file) {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
        '-i',
        file,
        '-f',
        's16le',
        '-ac',
        C.CHANNELS,
        '-ar',
        C.SAMPLE_RATE,
        '-',
        ])

        const chunks = []
        ffmpeg.stdout.on('data', (d) => chunks.push(d))
        ffmpeg.stderr.on('data', () => {})
        ffmpeg.on('close', (code) => {
        if (code === 0)
            resolve(Buffer.concat(chunks))
        else
            reject(new Error('ffmpeg failed'))
        })
    })
}

export class AudioClip {
  get #remainingFrames () {
    return (this.buffer.length - this.offset) / C.FRAME_BYTES
  }

  constructor (buffer) {
    this.buffer = buffer
    this.offset = 0
    this.volume = 0.8
  }

  mix (out) {
    const frames = Math.min(this.#remainingFrames, out.length / C.FRAME_BYTES)

    // each sample uses 2 bytes -> +2
    for (let i = 0; i < frames * C.FRAME_BYTES; i += 2) {
      const sample =
        this.buffer.readInt16LE(this.offset + i) *
        this.volume

      const existing = out.readInt16LE(i)
      const mixed = declip(existing + sample)
      out.writeInt16LE(mixed, i)
    }

    this.offset += frames * C.FRAME_BYTES
    return this.offset >= this.buffer.length
  }
}

export class AudioManager {
    #emitter = new EventEmitter()
    #sounds = []
    #active = []

    constructor ({ sounds, speaker = true } = {}) {
        this.#sounds = sounds
    }

    on (event, fn) {
        this.#emitter.on(event, fn)
    }

    generateFrame () {
        const out = Buffer.alloc(C.BUFFER_SIZE)
        this.#active = this.#active.filter((c) => !c.mix(out))
        this.#emitter.emit('frame', out)
        //this.#speaker.write(out)
        //for (const c of this.#clients) c.write(out)
    }

    async addRandomSound () {
        if (!this.#sounds.length) return
        const file = sample(this.#sounds)
        console.log('Playing', file)
        const pcm = await decodeMp3(file)
        this.#active.push(new AudioClip(pcm))
    }
}
