import type {BoardContext} from "./board.routes";
import {tasks} from "core";
import {problemJson} from "../http/problem";
import {log} from "../log";

const {getBoardState: fetchBoardState} = tasks;

export const getBoardStateHandler = async (c: any, ctx: BoardContext) => {
    try {
        const state = await fetchBoardState(ctx.boardId);
        return c.json({state}, 200);
    } catch (error) {
        log.error({err: error, boardId: ctx.boardId}, "[board:state] failed");
        return problemJson(c, {status: 502, detail: "Failed to fetch board state"});
    }
};
