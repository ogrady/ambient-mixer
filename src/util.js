export const clamp = (val, min, max) => Math.min(max, Math.max(min, val))
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

export async function loop (fn, delay, ...args) {
  await fn(...args)
  setTimeout(loop, delay, fn, delay, ...args)
}

export class LruCache {
  #maxSize
  #cache = new Map()

  constructor (maxSize = 10) {
    this.#maxSize = maxSize
  }

  has (key) {
    return this.#cache.has(key)
  }

  get (key) {
    if (!this.#cache.has(key))
      return undefined

    const value = this.#cache.get(key)

    // move to end (most recently used)
    this.#cache.delete(key)
    this.#cache.set(key, value)

    return value
  }

  set (key, value) {
    if (this.#cache.has(key))
      this.#cache.delete(key)

    this.#cache.set(key, value)

    if (this.#cache.size > this.#maxSize) {
      const oldestKey = this.#cache.keys().next().value

      this.#cache.delete(oldestKey)
    }
  }

  clear () {
    this.#cache.clear()
  }

  get size () {
    return this.#cache.size
  }
}
