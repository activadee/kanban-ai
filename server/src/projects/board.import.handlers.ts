import type {BoardContext} from "./board.routes";
import {importGithubIssues} from "../github/import.service";
import {problemJson} from "../http/problem";
import {log} from "../log";

export const importGithubIssuesHandler = async (
    c: any,
    ctx: BoardContext,
) => {
    const {boardId, project} = ctx;
    const {owner, repo, state} = c.req.valid("json") as {
        owner: string;
        repo: string;
        state?: "open" | "closed" | "all";
    };

    try {
        const events = c.get("events");
        const result = await importGithubIssues(
            {
                boardId,
                owner,
                repo,
                state,
            },
            {
                bus: events,
                logContext: {
                    projectId: project.id,
                    boardId,
                    owner,
                    repo,
                    state: state ?? "open",
                    trigger: "manual",
                },
            },
        );
        return c.json(result, 200);
    } catch (error) {
        log.error("board:import:github", "failed", {
            err: error,
            boardId,
            owner,
            repo,
            state,
        });
        const detail =
            error instanceof Error ? error.message : "GitHub import failed";
        const status = detail.toLowerCase().includes("github") ? 502 : 500;
        return problemJson(c, {status, detail});
    }
};
