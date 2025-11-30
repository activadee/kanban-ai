import {
    getGitOriginUrl,
    parseGithubOwnerRepo,
} from "core";
import {listProjectBranches} from "./settings/git";
import {problemJson} from "../http/problem";
import {log} from "../log";

export const listProjectsHandler = async (c: any) => {
    const {projects} = c.get("services");
    const result = await projects.list();
    return c.json(result, 200);
};

export const createProjectHandler = async (c: any) => {
    const {projects} = c.get("services");
    const events = c.get("events");
    const body = c.req.valid("json");
    const project = await projects.create(body);
    events.publish("project.created", {
        projectId: project.id,
        name: project.name,
        repositoryPath: project.repositoryPath,
        repositoryUrl: project.repositoryUrl,
        repositorySlug: project.repositorySlug,
        createdAt: project.createdAt,
    });
    return c.json(project, 201);
};

export const getProjectHandler = async (c: any) => {
    const {projects} = c.get("services");
    const project = await projects.get(c.req.param("projectId"));
    if (!project) return problemJson(c, {status: 404, detail: "Project not found"});
    return c.json(project, 200);
};

export const listProjectBranchesHandler = async (c: any) => {
    const {projects} = c.get("services");
    const projectId = c.req.param("projectId");
    const project = await projects.get(projectId);
    if (!project) return problemJson(c, {status: 404, detail: "Project not found"});
    try {
        const branches = await listProjectBranches(projectId);
        return c.json({branches}, 200);
    } catch (error) {
        log.error("projects:branches", "failed", {err: error, projectId});
        return problemJson(c, {
            status: 502,
            detail: "Failed to list branches",
        });
    }
};

export const updateProjectHandler = async (c: any) => {
    const {projects} = c.get("services");
    const events = c.get("events");
    const body = c.req.valid("json");
    const project = await projects.update(c.req.param("projectId"), body);
    if (!project) return problemJson(c, {status: 404, detail: "Project not found"});
    events.publish("project.updated", {
        projectId: project.id,
        changes: body,
        updatedAt: new Date().toISOString(),
    });
    return c.json(project, 200);
};

export const deleteProjectHandler = async (c: any) => {
    const {projects} = c.get("services");
    const events = c.get("events");
    const projectId = c.req.param("projectId");
    const project = await projects.get(projectId);
    if (!project) return problemJson(c, {status: 404, detail: "Project not found"});
    const removed = await projects.remove(projectId);
    if (!removed) return problemJson(c, {status: 404, detail: "Project not found"});
    events.publish("project.deleted", {
        projectId,
        projectName: project.name,
        repositoryPath: project.repositoryPath,
    });
    return c.body(null, 204);
};

export const getGithubOriginHandler = async (c: any) => {
    const {projects} = c.get("services");
    const project = await projects.get(c.req.param("projectId"));
    if (!project) return problemJson(c, {status: 404, detail: "Project not found"});
    const originUrl = await getGitOriginUrl(project.repositoryPath);
    const parsed = originUrl ? parseGithubOwnerRepo(originUrl) : null;
    return c.json(
        {
            originUrl: originUrl ?? null,
            owner: parsed?.owner ?? null,
            repo: parsed?.repo ?? null,
        },
        200,
    );
};
