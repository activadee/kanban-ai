import {describe, it, expect} from 'vitest'
import type {SubtaskStatus} from 'shared'

import {computeSubtaskProgress} from '../src/projects/subtasks'

describe('projects/subtasks.computeSubtaskProgress', () => {
    it('returns zero progress when there are no subtasks', () => {
        const result = computeSubtaskProgress([])
        expect(result).toEqual({total: 0, done: 0})
    })

    it('counts only done subtasks towards progress', () => {
        const items: Array<{ status: SubtaskStatus }> = [
            {status: 'todo'},
            {status: 'in_progress'},
            {status: 'blocked'},
            {status: 'done'},
            {status: 'done'},
        ]

        const result = computeSubtaskProgress(items)

        expect(result.total).toBe(5)
        expect(result.done).toBe(2)
    })
})

