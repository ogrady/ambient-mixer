import fs from 'node:fs'
import { AudioManager, loadAudioFiles } from './audio.js'
import { pick } from './util.js'

class Scene {
  /**
   * @param {object}                                 o
   * @param {string}                                 o.name
   * @param {import('../types.d.ts').schema.Track[]} o.trackData
   */
  constructor ({ name, trackData }) {
    this.name = name
    this.audioManager = new AudioManager()
    for (const track of trackData) {
      this.audioManager.addTrack({
        name: track.name,
        maxActive: track.maxActive,
        minDelay: track.minDelay,
        sounds: track.sounds,
      })
    }
  }
}

export function loadScene (file) {
  const sceneData = /** @type {import('../types.d.ts').schema.Scene} */JSON.parse(fs.readFileSync(file))
  // TODO: meh. Do lazy loading with cache!
  const allSounds = loadAudioFiles()

  for (const track of sceneData.tracks) {
    // replace any match patterns with file lists
    if (track.sounds.match) {
      track.sounds = allSounds.
        filter((sound) => track.sounds.match.
          some((pattern) => sound.match(pattern)))
    }
    // in loop mode, pick one single option to repeat
    if (track.mode === 'loop')
      track.sounds.files = [ pick(track.sounds.files) ]
  }

  return new Scene({
    name: sceneData.name,
    trackData: sceneData.tracks,
  })
}
