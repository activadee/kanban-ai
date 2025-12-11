import {describe, it, expect} from "vitest"
import type {ProjectSnapshot} from "shared"
import {
    getFailureRate,
    isHighActivity,
    isHighFailureRate,
    sortProjectSnapshots,
} from "@/pages/dashboard/projectHealthHelpers"

function createSnapshot(partial: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
    return {
        projectId: "p1",
        id: "p1",
        name: "Project One",
        status: "healthy",
        ...partial,
    }
}

describe("projectHealthHelpers", () => {
    it("uses snapshot.health flags when present for activity", () => {
        const snapshot = createSnapshot({
            health: {
                activityScore: 10,
                failureRateInRange: 0.2,
                isHighActivity: true,
                isAtRisk: false,
            },
        })

        expect(isHighActivity(snapshot)).toBe(true)
        expect(isHighFailureRate(snapshot)).toBe(false)
    })

    it("falls back to thresholds when health flags are missing", () => {
        const snapshot = createSnapshot({
            openCards: 20,
            attemptsInRange: 0,
            failedAttemptsInRange: 0,
        })

        expect(isHighActivity(snapshot)).toBe(true)
        expect(isHighFailureRate(snapshot)).toBe(false)
    })

    it("computes failure rate from counts when needed", () => {
        const snapshot = createSnapshot({
            attemptsInRange: 10,
            failedAttemptsInRange: 4,
        })

        expect(getFailureRate(snapshot)).toBeCloseTo(0.4)
    })

    it("returns null failure rate when there are no attempts", () => {
        const snapshot = createSnapshot({
            attemptsInRange: 0,
            failedAttemptsInRange: 0,
        })

        expect(getFailureRate(snapshot)).toBeNull()
    })

    it("sorts snapshots by open cards descending", () => {
        const snapshots: ProjectSnapshot[] = [
            createSnapshot({id: "a", projectId: "a", name: "A", openCards: 5}),
            createSnapshot({id: "b", projectId: "b", name: "B", openCards: 10}),
            createSnapshot({id: "c", projectId: "c", name: "C", openCards: 2}),
        ]

        const sorted = sortProjectSnapshots(snapshots, "openCards")
        expect(sorted.map((s) => s.id)).toEqual(["b", "a", "c"])
    })

    it("sorts snapshots by failed attempts descending", () => {
        const snapshots: ProjectSnapshot[] = [
            createSnapshot({
                id: "a",
                projectId: "a",
                name: "A",
                attemptsInRange: 5,
                failedAttemptsInRange: 1,
            }),
            createSnapshot({
                id: "b",
                projectId: "b",
                name: "B",
                attemptsInRange: 8,
                failedAttemptsInRange: 4,
            }),
            createSnapshot({
                id: "c",
                projectId: "c",
                name: "C",
                attemptsInRange: 3,
                failedAttemptsInRange: 0,
            }),
        ]

        const sorted = sortProjectSnapshots(snapshots, "failedAttemptsInRange")
        expect(sorted.map((s) => s.id)).toEqual(["b", "a", "c"])
    })
})
