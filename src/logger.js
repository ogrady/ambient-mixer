export class Logger {
  static LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
  }

  #level

  constructor (level = 'info') {
    this.#level = Logger.LEVELS[level] ?? Logger.LEVELS.info
  }

  error (...args) {
    this.#log('error', ...args)
  }

  warn (...args) {
    this.#log('warn', ...args)
  }

  info (...args) {
    this.#log('info', ...args)
  }

  debug (...args) {
    this.#log('debug', ...args)
  }

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
export const LOGGER = new Logger(Logger.LEVELS.debug)
