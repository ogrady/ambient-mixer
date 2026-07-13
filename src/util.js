/**
 * @param {number} val 
 * @param {number} min 
 * @param {number} max 
 */
export const clamp = (val, min, max) => Math.min(max, Math.max(min, val))

/**
 * @template T
 * @param {T[]} arr 
 * @returns {T}
 */
export const pick = (arr) => /** @type {T} */(arr[Math.floor(Math.random() * arr.length)])

/**
 * @param {Function} fn 
 * @param {number} delay 
 * @param  {...any} args 
 */
export async function loop (fn, delay, ...args) {
  await fn(...args)
  setTimeout(loop, delay, fn, delay, ...args)
}

/**
 * @template T
 */
export class LruCache {
  #maxSize
  #cache = new Map()

  constructor (maxSize = 10) {
    this.#maxSize = maxSize
  }

  /**
   * @param {string} key 
   */
  has (key) {
    return this.#cache.has(key)
  }

  /**
   * @param {string} key 
   * @returns {T | null}
   */
  get (key) {
    if (!this.#cache.has(key))
      return null

    const value = this.#cache.get(key)

    // move to end (most recently used)
    this.#cache.delete(key)
    this.#cache.set(key, value)

    return value
  }

  /**
   * @param {string} key 
   * @param {T} value 
   */
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
