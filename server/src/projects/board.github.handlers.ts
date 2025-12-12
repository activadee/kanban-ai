import type {BoardContext} from "./board.routes";
import {githubRepo} from "core";
import {problemJson} from "../http/problem";
import {log} from "../log";

export const getGithubIssueStatsHandler = async (c: any, ctx: BoardContext) => {
    const {boardId, project} = ctx;
    try {
        const stats = await githubRepo.getGithubIssueStats(boardId);
        return c.json(stats, 200);
    } catch (error) {
        log.error("board:github:stats", "failed", {
            err: error,
            boardId,
            projectId: project.id,
        });
        return problemJson(c, {
            status: 502,
            detail: "Failed to load GitHub issue stats",
        });
    }
};

