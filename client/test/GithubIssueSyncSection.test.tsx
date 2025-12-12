import React from "react";
import {describe, it, expect, vi, beforeEach} from "vitest";
import {render, cleanup, screen} from "@testing-library/react";
import {GithubIssueSyncSection} from "@/components/projects/ProjectSettingsPanel/sections/GithubIssueSyncSection";

const githubMocks = vi.hoisted(() => ({
    useGithubAuthStatus: vi.fn(() => ({data: {status: "valid"}})),
}));

const projectMocks = vi.hoisted(() => ({
    useProjectGithubOrigin: vi.fn(() => ({
        data: {originUrl: "https://github.com/owner/repo", owner: "owner", repo: "repo"},
    })),
}));

const boardMocks = vi.hoisted(() => ({
    useGithubIssueStats: vi.fn(() => ({data: {imported: 0, exported: 0, total: 0}})),
}));

vi.mock("@/hooks/github", () => ({
    useGithubAuthStatus: githubMocks.useGithubAuthStatus,
}));

vi.mock("@/hooks/projects", () => ({
    useProjectGithubOrigin: projectMocks.useProjectGithubOrigin,
}));

vi.mock("@/hooks/board", () => ({
    useGithubIssueStats: boardMocks.useGithubIssueStats,
}));

describe("GithubIssueSyncSection", () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it("enables controls when GitHub is connected and origin is detected", () => {
        render(
            <GithubIssueSyncSection
                projectId="proj-1"
                githubIssueSyncEnabled={false}
                githubIssueSyncState="open"
                githubIssueSyncIntervalMinutes={15}
                githubIssueAutoCreateEnabled={false}
                onChange={() => {}}
            />,
        );

        const checkbox = screen.getByRole("checkbox", {
            name: /Enable GitHub Issue Sync/i,
        }) as HTMLElement;
        expect(checkbox.getAttribute("disabled")).toBeNull();

        // Interval input remains disabled until sync is explicitly enabled.
        const intervalInput = screen.getByLabelText(
            /Sync interval \(minutes\)/i,
        ) as HTMLInputElement;
        expect(intervalInput.disabled).toBe(true);
    });

    it("disables controls and shows helper text when GitHub is not connected", () => {
        githubMocks.useGithubAuthStatus.mockReturnValueOnce({data: {status: "invalid"}});

        render(
            <GithubIssueSyncSection
                projectId="proj-1"
                githubIssueSyncEnabled={false}
                githubIssueSyncState="open"
                githubIssueSyncIntervalMinutes={15}
                githubIssueAutoCreateEnabled={false}
                onChange={() => {}}
            />,
        );

        const helper = screen.getByText(
            /Connect GitHub and configure the repo to enable automatic issue sync/i,
        );
        expect(helper).not.toBeNull();

        const checkbox = screen.getByRole("checkbox", {
            name: /Enable GitHub Issue Sync/i,
        }) as HTMLElement;
        expect(checkbox.getAttribute("disabled")).not.toBeNull();
    });
});
