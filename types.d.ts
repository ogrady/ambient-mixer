export namespace schema {
    type Match = {
        match: string[]
    }
    
    type Track = {
        name: string
        mode?: 'loop'
        maxActive: number,
        sounds: {
            files: string[]
        } | Match,
        delay: number
    }

    type Scene = {
        name: string,
        tracks: Track[]
    }
}