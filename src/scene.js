import fs from 'node:fs'
import path from 'node:path'
import { AudioManager } from './audio'

export function loadScene (file) {
    const content = fs.readFileSync(file)
    const scene = JSON.parse(content)
    console.log(scene)
}