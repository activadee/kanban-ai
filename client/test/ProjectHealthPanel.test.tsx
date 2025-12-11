import React from "react"
import {describe, it, expect, vi} from "vitest"
import {render, screen, fireEvent} from "@testing-library/react"
import type {ProjectSnapshot} from "shared"
import {ProjectHealthPanel} from "@/pages/dashboard/ProjectHealthPanel"

function createSnapshot(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
    return {
        projectId: "p1",
        id: "p1",
        name: "Fixture Project",
        status: "healthy",
        openCards: 3,
        totalCards: 5,
        attemptsInRange: 4,
        failedAttemptsInRange: 1,
        activeAttempts: 1,
        health: {
            activityScore: 10,
            failureRateInRange: 0.25,
            isHighActivity: true,
            isAtRisk: false,
        },
        ...overrides,
    }
}

describe("ProjectHealthPanel", () => {
    it("renders loading skeleton when loading", () => {
        render(
            <ProjectHealthPanel
                snapshots={[]}
                isLoading
            />,
        )

        expect(screen.getByTestId("project-health-loading")).toBeTruthy()
    })

    it("renders empty state when there are no projects", () => {
        render(
            <ProjectHealthPanel
                snapshots={[]}
                isLoading={false}
            />,
        )

        expect(
            screen.getByText(/Create a project to populate this list\./i),
        ).toBeTruthy()
    })

    it("renders project rows with metrics and badges", () => {
        const snapshot: ProjectSnapshot = createSnapshot({
            repositorySlug: "owner/repo",
        })

        render(
            <ProjectHealthPanel
                snapshots={[snapshot]}
                isLoading={false}
            />,
        )

        expect(screen.getByText("Fixture Project")).toBeTruthy()
        expect(screen.getByText("owner/repo")).toBeTruthy()
        expect(screen.getByText(/3 open of 5 cards/i)).toBeTruthy()
        expect(screen.getByText(/High Activity/i)).toBeTruthy()
    })

    it("invokes navigation callback when a row is activated", () => {
        const snapshot: ProjectSnapshot = createSnapshot()
        const handleNavigate = vi.fn()

        render(
            <ProjectHealthPanel
                snapshots={[snapshot]}
                isLoading={false}
                onProjectNavigate={handleNavigate}
            />,
        )

        const row = screen.getByTestId("project-health-row")
        fireEvent.click(row)

        expect(handleNavigate).toHaveBeenCalledWith(snapshot.id)
    })

    it("allows sorting by failed attempts", () => {
        const highFailure: ProjectSnapshot = createSnapshot({
            id: "high",
            projectId: "high",
            name: "High Failure",
            attemptsInRange: 10,
            failedAttemptsInRange: 5,
            health: {
                activityScore: 5,
                failureRateInRange: 0.5,
                isHighActivity: false,
                isAtRisk: true,
            },
        })

        const lowFailure: ProjectSnapshot = createSnapshot({
            id: "low",
            projectId: "low",
            name: "Low Failure",
            attemptsInRange: 10,
            failedAttemptsInRange: 1,
        })

        render(
            <ProjectHealthPanel
                snapshots={[lowFailure, highFailure]}
                isLoading={false}
            />,
        )

        const list = screen.getByTestId("project-health-list")
        const initialFirstRow = list.querySelectorAll("[data-testid='project-health-row']")[0]
        expect(initialFirstRow?.textContent).toMatch(/Fixture Project|Low Failure|High Failure/)

        const sortTrigger = screen.getByLabelText("Sort projects")
        fireEvent.click(sortTrigger)
        const failedOption = screen.getByText(/Failed attempts \(desc\)/i)
        fireEvent.click(failedOption)

        const rows = list.querySelectorAll("[data-testid='project-health-row']")
        expect(rows[0].textContent).toMatch(/High Failure/)
    })
})
