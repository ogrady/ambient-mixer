import * as C from './constants.js'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'child_process'
import { clamp, LruCache, pick } from './util.js'
import EventEmitter from 'node:events'

/** @param {number} bit */
const declip = (bit) => clamp(bit, C.AUDIO_CLIPPING_LOWER_BOUND, C.AUDIO_CLIPPING_UPPER_BOUND)

export const loadAudioFiles = () => fs.readdirSync('./sounds').
  filter((f) => f.endsWith('.mp3')).
  map((f) => path.join('./sounds', f))

/**
 * @param   {string}          file
 * @returns {Promise<Buffer>}
 */
const decodeMp3 = (file) => new Promise((resolve, reject) => {
  const ffmpeg = spawn('ffmpeg', [
    '-i',
    file,
    '-f',
    's16le',
    '-ac',
    String(C.CHANNELS),
    '-ar',
    String(C.SAMPLE_RATE),
    '-',
  ])
  /** @type {Uint8Array<ArrayBufferLike>[]} */
  const chunks = []

  ffmpeg.stdout.on('data', (d) => chunks.push(d))
  ffmpeg.stderr.on('data', () => {})
  ffmpeg.on('close', (code) => {
    if (code === 0)
      resolve(Buffer.concat(chunks))
    else
      reject(new Error(`ffmpeg failed for file ${file}: ${code}`))
  })
})

class AudioClip {
  #emitter = new EventEmitter()

  get #remainingFrames () {
    return (this.buffer.length - this.offset) / C.FRAME_BYTES
  }

  /**
   * @param {object} o
   * @param {Buffer} o.buffer
   * @param {number} [o.offset]
   * @param {number} [o.volume]
   * @param {boolean} [o.loop]
   */
  constructor ({ buffer, offset = 0, volume = 0.8, loop = false }) {
    this.buffer = buffer
    this.offset = offset
    this.volume = volume
    this.loop = loop
  }

  /**
   * @param {'finished'} event
   * @param {() => void} fn
   */
  on (event, fn) {
    this.#emitter.on(event, fn)
  }

  /**
   * @param {Buffer} out
   */
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
    const finished = this.offset >= this.buffer.length

    if (finished) {
      this.#emitter.emit('finished')
      if (this.loop) {
        this.offset = 0
        return false
      }
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
  /** @type {number} */
  #lastAddedTimestamp = 0
  #cache = new LruCache()

  get full () {
    return this.#active.length >= this.#maxActive
  }

  /**
   * @param {object}   o
   * @param {string}   o.name
   * @param {number}   o.maxActive
   * @param {string[]} o.sounds
   * @param {number}   o.minDelay
   * @param {boolean}  o.loop
   * @throws {Error}
   */
  constructor ({ name = '', maxActive = 1, sounds = [], minDelay = 0, loop = false }) {
    this.#maxActive = maxActive
    this.#sounds = sounds
    this.name = name
    this.#minDelay = minDelay
    this.loop = loop
    if (this.#sounds.length === 0)
      throw new Error(`track ${name} has no sounds`)
  }

  /**
   *
   * @param {'playing'}                                         event
   * @param {(params: {file: string, clip: AudioClip}) => void} fn
   */
  on (event, fn) {
    this.#emitter.on(event, fn)
  }

  /**
   * @param   {string}                file
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
    if (this.full)
      return
    const now = new Date().getTime()

    if (this.#lastAddedTimestamp + this.#minDelay > now)
      return
    this.#lastAddedTimestamp = now
    const file = pick(this.#sounds)
    const pcm = await this.#getAudio(file)
    const ac = new AudioClip({ buffer: pcm, loop: this.loop })

    this.#active.push(ac)
    this.#emitter.emit('playing', { file, clip: ac })
  }

  async fillWithRandomSounds () {
    while (!this.full) {
      // eslint-disable-next-line no-await-in-loop
      await this.addRandomSound()
      this.#lastAddedTimestamp = 0
    }
  }

  /**
   * @param {Buffer} buffer
   */
  async generateFrame (buffer) {
    this.#active = this.#active.filter((c) => !c.mix(buffer))
  }
}

export class AudioManager {
  #emitter = new EventEmitter()
  /** @type {AudioTrack[]} */
  tracks = []

  /**
   * @param {'frame'}                  event
   * @param {(...args: any[]) => void} fn
   */
  on (event, fn) {
    this.#emitter.on(event, fn)
  }

  /**
   * @param {'frame' | undefined} event 
   */
  removeAllListeners(event = undefined) {
    this.#emitter.removeAllListeners(event)
  }

  /**
   * @param {object}   o
   * @param {string}   o.name
   * @param {string[]} o.sounds
   * @param {number}   o.maxActive
   * @param {number}   o.minDelay
   * @param {boolean} o.loop
   */
  addTrack ({ name, sounds = [], maxActive = 1, minDelay = 0, loop = false }) {
    const track = new AudioTrack({ name, sounds, maxActive, minDelay, loop })

    this.tracks.push(track)

    return track
  }

  /**
   * Adds the maximum number of random sounds to each track.
   * This avoid startup lag, when all tracks try to load their initial
   * sound bits all at once while some bits may already be playing.
   */
  async fillTracks () {
    return Promise.all(this.tracks.map((t) => t.fillWithRandomSounds()))
  }

  async schedule () {
    return Promise.all(this.tracks.map((t) => t.addRandomSound()))
  }

  async generateFrame () {
    const out = Buffer.alloc(C.BUFFER_SIZE)

    for (const track of this.tracks) {
      // eslint-disable-next-line no-await-in-loop
      await track.generateFrame(out)
    }

    this.#emitter.emit('frame', out)
  }
}

/**
 * Required for clients like VLC to properly
 * recognize and start the stream.
 * @param {object} o
 * @param {number} o.sampleRate
 * @param {number} o.channels
 * @param {number} o.bitsPerSample
 */
export function createWavHeader ({
  sampleRate,
  channels,
  bitsPerSample,
}) {
  const blockAlign = channels * bitsPerSample / 8
  const byteRate = sampleRate * blockAlign

  const header = Buffer.alloc(44)

  header.write('RIFF', 0)
  header.writeUInt32LE(0xffffffff, 4) // unknown size
  header.write('WAVE', 8)

  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16) // PCM fmt chunk size
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)

  header.write('data', 36)
  header.writeUInt32LE(0xffffffff, 40) // unknown data size

  return header
}
