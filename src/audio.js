import * as C from './constants.js'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'child_process'
import { clamp, LruCache, pick } from './util.js'
import EventEmitter from 'node:events'

const declip = (bit) => clamp(bit, C.AUDIO_CLIPPING_LOWER_BOUND, C.AUDIO_CLIPPING_UPPER_BOUND)

export const loadAudioFiles = () => fs.readdirSync('./sounds').
  filter((f) => f.endsWith('.mp3')).
  map((f) => path.join('./sounds', f))

/** @returns {Promise<Buffer>} */
const decodeMp3 = (file) => new Promise((resolve, reject) => {
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

class AudioClip {
  #emitter = new EventEmitter()

  get #remainingFrames () {
    return (this.buffer.length - this.offset) / C.FRAME_BYTES
  }

  constructor ({ buffer, offset = 0, volume = 0.8 } = {}) {
    this.buffer = buffer
    this.offset = 0
    this.volume = 0.8 
  }

  on (event, fn) {
    this.#emitter.on(event, fn)
  }

  mix (out) {
    const frames = Math.min(this.#remainingFrames, out.length / C.FRAME_BYTES)

    // each sample uses 2 bytes -> +2
    // eslint-disable-next-line no-magic-numbers
    for (let i = 0; i < frames * C.FRAME_BYTES; i += 2) {
      const sample =
        this.buffer.readInt16LE(this.offset + i) *
        this.volume
      const existing = out.readInt16LE(i)
      const mixed = declip(existing + sample)

      out.writeInt16LE(mixed, i)
    }

    this.offset += frames * C.FRAME_BYTES
    const finished = this.offset >= this.buffer.length
    if (finished) {
      this.#emitter.emit('finished')
    }
    return finished
  }
}

class AudioTrack {
  #emitter = new EventEmitter()
  /** @type {number} */
  #maxActive
  /** @type {number} */
  #minDelay
  /** @type {string[]} */
  #sounds
  /** @type {AudioClip[]} */
  #active = []
  /** @type {string} */
  #name
  /** @type {number} */
  #lastAddedTimestamp
  #cache = new LruCache()

  constructor ({ name = '', maxActive = 1, sounds = [], minDelay = 0} = {}) {
    this.#maxActive = maxActive
    this.#sounds = sounds
    this.#name = name
    this.#minDelay = minDelay
  }

  on (event, fn) {
    this.#emitter.on(event, fn)
  }

  /**
   * @returns {ReturnType<decodeMp3>} 
   */
  async #getAudio (file) {
    let pcm = this.#cache.get(file)
    if (!pcm) {
      pcm = await decodeMp3(file)   
      this.#cache.set(file, pcm)
    }
    return pcm
  }

  async addRandomSound () {
    if (!this.#sounds.length)
      return
    if (this.#active.length >= this.#maxActive)
      return
    const now = new Date().getTime()
    if (this.#lastAddedTimestamp + this.#minDelay > now)
      return
    this.#lastAddedTimestamp = now
    const file = pick(this.#sounds)
    const pcm = await this.#getAudio(file)
    const ac = new AudioClip({ buffer: pcm })
    this.#active.push(ac)
    this.#emitter.emit('playing', { file, clip: ac})
  }

  async generateFrame (buffer) {
    this.#active = this.#active.filter((c) => !c.mix(buffer))
  }  
}

export class AudioManager {
  #emitter = new EventEmitter()
  /** @type {AudioTrack[]} */
  #tracks = []

  on (event, fn) {
    this.#emitter.on(event, fn)
  }

  addTrack({ name, sounds = [], maxActive = 1, minDelay = 0 } = {}) {
    const track = new AudioTrack({ name, sounds, maxActive, minDelay })
    this.#tracks.push(track)
    return track
  }

  async schedule () {
    return Promise.all(this.#tracks.map(t => t.addRandomSound()))
  }

  async generateFrame () {
    const out = Buffer.alloc(C.BUFFER_SIZE)
    for (const track of this.#tracks) {
      await track.generateFrame(out)
    }
    this.#emitter.emit('frame', out)
  }
}
