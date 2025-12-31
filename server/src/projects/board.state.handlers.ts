import {tasks} from 'core'
import {problemJson} from '../http/problem'
import {log} from '../log'
import {createHandlers} from '../lib/factory'

const {getBoardState: fetchBoardState} = tasks

export const getBoardStateHandlers = createHandlers(async (c) => {
    const ctx = c.get('boardContext')!
    try {
        const state = await fetchBoardState(ctx.boardId)
        return c.json({state}, 200)
    } catch (error) {
        log.error('board:state', 'failed', {err: error, boardId: ctx.boardId})
        return problemJson(c, {status: 502, detail: 'Failed to fetch board state'})
    }
})
