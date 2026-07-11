export const clamp = (val, min, max) => Math.min(max, Math.max(min, val))
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

export async function loop(fn, delay, ...args) {
  await fn(...args)
  setTimeout(loop, delay, fn, delay, ...args)
}