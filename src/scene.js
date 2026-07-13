import fs from 'node:fs'
import { AudioManager, loadAudioFiles } from './audio.js'
import { pick } from './util.js'

class Scene {
  /**
   * @param {object}                                           o
   * @param {string}                                           o.name
   * @param {import('../types.d.ts').schema.NormalisedTrack[]} o.trackData
   */
  constructor ({ name, trackData }) {
    this.name = name
    this.audioManager = new AudioManager()
    for (const track of trackData) {
      this.audioManager.addTrack({
        name: track.name,
        maxActive: track.maxActive,
        minDelay: track.minDelay,
        sounds: track.sounds.files,
      })
    }
  }
}

/**
 * @param {string} file
 */
export function loadScene (file) {
  const sceneData = /** @type {import('../types.d.ts').schema.Scene} */JSON.parse(fs.readFileSync(file, 'utf8'))
  // TODO: meh. Do lazy loading with cache!
  const allSounds = loadAudioFiles()

  /**
   * @param   {import('../types.d.ts').schema.Track}                    track
   * @returns {track is {sounds: import('../types.d.ts').schema.Match}}
   */
  const isMatchTrack = (track) => Object.hasOwn(track.sounds, 'match')

  for (const track of sceneData.tracks) {
    // replace any match patterns with file lists
    if (isMatchTrack(track)) {
      // @ts-expect-error
      track.sounds.files = allSounds.
        filter((sound) => track.sounds.match.
          some((pattern) => sound.match(pattern)))
    }
    // in loop mode, pick one single option to repeat
    if (track.mode === 'loop')
      // @ts-expect-error
      track.sounds.files = [ pick(track.sounds.files) ]
  }
  const normalised = /** @type {import('../types.d.ts').schema.NormalisedScene} */sceneData

  return new Scene({
    name: sceneData.name,
    trackData: normalised.tracks,
  })
}
