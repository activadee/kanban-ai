import { describe, expect, it, beforeEach, afterAll } from "vitest";

import type { AgentContext } from "../src/agents/types";
import { CodexAgent } from "../src/agents/codex/core/agent";
import { defaultProfile } from "../src/agents/codex/profiles/schema";

const originalEnv = {
    override: process.env.CODEX_PATH_OVERRIDE,
    path: process.env.CODEX_PATH,
};

const ctx = (): AgentContext => {
    const controller = new AbortController();
    return {
        attemptId: "att",
        boardId: "board",
        cardId: "card",
        worktreePath: "/tmp",
        repositoryPath: "/tmp",
        branchName: "main",
        baseBranch: "main",
        cardTitle: "t",
        cardDescription: null,
        profileId: null,
        sessionId: undefined,
        followupPrompt: undefined,
        signal: controller.signal,
        emit: () => {},
    };
};

beforeEach(() => {
    process.env.CODEX_PATH_OVERRIDE = originalEnv.override;
    process.env.CODEX_PATH = originalEnv.path;
});

afterAll(() => {
    process.env.CODEX_PATH_OVERRIDE = originalEnv.override;
    process.env.CODEX_PATH = originalEnv.path;
});

describe("CodexAgent detectInstallation", () => {
    it("accepts an executable provided via CODEX_PATH_OVERRIDE", async () => {
        const exe = process.execPath;
        delete process.env.CODEX_PATH;
        process.env.CODEX_PATH_OVERRIDE = exe;

        const install = await (CodexAgent as any).detectInstallation(
            defaultProfile,
            ctx(),
        );

        expect(install.executablePath).toBe(exe);
    });

    it("accepts an executable provided via CODEX_PATH", async () => {
        const exe = process.execPath;
        delete process.env.CODEX_PATH_OVERRIDE;
        process.env.CODEX_PATH = exe;

        const install = await (CodexAgent as any).detectInstallation(
            defaultProfile,
            ctx(),
        );

        expect(install.executablePath).toBe(exe);
    });

    it("fails when no executable can be found", async () => {
        process.env.CODEX_PATH_OVERRIDE = "/definitely/missing/path";
        process.env.CODEX_PATH = "";

        await expect(
            (CodexAgent as any).detectInstallation(defaultProfile, ctx()),
        ).rejects.toThrow(/executable not accessible/i);
    });
});
