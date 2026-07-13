export class Logger {
  static LEVELS = /** @type {const} */({
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
  })

  #level

  /**
   * 
   * @param {keyof Logger.LEVELS} level 
   */
  constructor (level = 'info') {
    this.#level = Logger.LEVELS[level] ?? Logger.LEVELS.info
  }

  /**
   * @param  {...any} args 
   */
  error (...args) {
    this.#log('error', ...args)
  }

  /**
   * @param  {...any} args 
   */
  warn (...args) {
    this.#log('warn', ...args)
  }

  /**
   * @param  {...any} args 
   */
  info (...args) {
    this.#log('info', ...args)
  }

  /**
   * @param  {...any} args 
   */
  debug (...args) {
    this.#log('debug', ...args)
  }

  /**
   * 
   * @param {keyof Logger.LEVELS} level 
   * @param  {...any} args 
   * @returns 
   */
  #log (level, ...args) {
    if (Logger.LEVELS[level] > this.#level)
      return

    console.log(
      `[${new Date().toISOString()}] [${level.toUpperCase()}]`,
      ...args,
    )
  }
}

// TODO: load level from env
export const LOGGER = new Logger('debug')
