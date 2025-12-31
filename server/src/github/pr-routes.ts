import {Hono} from 'hono'
import type {AppEnv} from '../env'
import {
    listPullRequestsHandlers,
    summarizePullRequestHandlers,
    getPullRequestHandlers,
    createPullRequestHandlers,
    deprecatedGetPrHandlers,
    deprecatedPostPrHandlers,
} from './pr.handlers'

export function createGithubProjectRouter() {
    return new Hono<AppEnv>()
        .get('/:projectId/pull-requests', ...listPullRequestsHandlers)
        .post('/:projectId/pull-requests/summary', ...summarizePullRequestHandlers)
        .get('/:projectId/pull-requests/:number', ...getPullRequestHandlers)
        .post('/:projectId/pull-requests', ...createPullRequestHandlers)
        .get('/:projectId/github/pr', ...deprecatedGetPrHandlers)
        .post('/:projectId/github/pr', ...deprecatedPostPrHandlers)
}
