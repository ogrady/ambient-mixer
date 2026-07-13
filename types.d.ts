export namespace schema {
    type Match = {
        match: string[]
    }
    
    type Track = {
        name: string
        mode?: 'loop'
        maxActive: number,
        minDelay: number,
        sounds: {
            files: string[]
        } | Match,
        delay: number
    }

    type NormalisedTrack = Omit<Track, 'sounds'> & {
        sounds: { files: string[] }
    }

    type Scene = {
        name: string,
        tracks: Track[]
    }

    type NormalisedScene = Omit<Scene, 'tracks'> & { tracks: NormalisedTrack[] }
}