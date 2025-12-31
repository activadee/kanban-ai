import {createMiddleware} from "../factory";
import {problemJson} from "../../http/problem";

export const loadBoardContext = createMiddleware(async (c, next) => {
    const {projects} = c.get("services");
    const projectId = c.req.param("projectId");
    
    if (!projectId) {
        return problemJson(c, {status: 400, detail: "Project ID is required"});
    }
    
    const project = await projects.get(projectId);
    if (!project) {
        return problemJson(c, {status: 404, detail: "Project not found"});
    }
    
    const boardId = project.boardId ?? project.id;
    c.set("boardContext", {boardId, project});
    c.set("projectId", projectId);
    c.set("boardId", boardId);
    
    await next();
});
