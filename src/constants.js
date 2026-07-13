export const SAMPLE_RATE = 44100
export const CHANNELS = 2
export const BYTES_PER_SAMPLE = 2
export const FRAME_BYTES = CHANNELS * BYTES_PER_SAMPLE
export const PORT = 8000
export const BUFFER_FRAMES = 1024
export const BUFFER_SIZE = BUFFER_FRAMES * FRAME_BYTES
export const AUDIO_CLIPPING_LOWER_BOUND = -32768
export const AUDIO_CLIPPING_UPPER_BOUND = 32767
export const RANDOM_SOUND_INTERVAL = 1000
export const DEBUG = (process.env.DEBUG ?? 'true') === 'true'
