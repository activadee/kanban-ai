import {tasks} from 'core'

export const {
    bindTaskEventBus,
    getBoardState,
    createDefaultBoardStructure,
    createBoardCard,
    moveBoardCard,
    moveCardToColumnByTitle,
    broadcastBoard,
    updateBoardCard,
    deleteBoardCard,
    ensureBoardExists,
} = tasks
