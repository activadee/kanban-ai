import {describe, it, expect, afterEach} from "vitest"
import {render, screen, fireEvent, cleanup} from "@testing-library/react"
import type {
    ConversationItem,
    ConversationMessageItem,
    ConversationThinkingItem,
    ConversationToolItem,
    ConversationErrorItem,
    ConversationAutomationItem,
} from "shared"

import {MessageRow} from "@/components/kanban/card-inspector/MessageRow"

describe("MessageRow", () => {
    afterEach(() => cleanup())

    describe("message type", () => {
        it("renders user message with right alignment and avatar", () => {
            const item: ConversationMessageItem = {
                type: "message",
                role: "user",
                text: "Hello, world!",
                timestamp: new Date("2025-01-01T12:30:00Z").toISOString(),
            }

            const {container} = render(<MessageRow item={item}/>)

            const row = container.querySelector('[data-slot="message-row"]')
            expect(row).not.toBeNull()
            expect(row?.getAttribute("data-role")).toBe("user")

            const avatar = container.querySelector('[data-slot="message-avatar"]')
            expect(avatar).not.toBeNull()

            const bubble = container.querySelector('[data-slot="message-bubble"]')
            expect(bubble).not.toBeNull()
            expect(bubble?.className).toContain("from-teal")
            expect(bubble?.textContent).toContain("Hello, world!")
        })

        it("renders assistant message with left alignment and gradient avatar", () => {
            const item: ConversationMessageItem = {
                type: "message",
                role: "assistant",
                text: "I can help with that!",
                timestamp: new Date("2025-01-01T12:30:00Z").toISOString(),
            }

            const {container} = render(<MessageRow item={item}/>)

            const row = container.querySelector('[data-slot="message-row"]')
            expect(row?.getAttribute("data-role")).toBe("assistant")
            expect(row?.className).not.toContain("flex-row-reverse")

            const bubble = container.querySelector('[data-slot="message-bubble"]')
            expect(bubble?.className).toContain("bg-muted")
        })

        it("renders system message with dashed border style", () => {
            const item: ConversationMessageItem = {
                type: "message",
                role: "system",
                text: "System notification",
                timestamp: new Date("2025-01-01T12:30:00Z").toISOString(),
            }

            const {container} = render(<MessageRow item={item}/>)

            const bubble = container.querySelector('[data-slot="message-bubble"]')
            expect(bubble?.className).toContain("border-dashed")
        })

        it("renders profile badge when profileId is present", () => {
            const item: ConversationMessageItem = {
                type: "message",
                role: "assistant",
                text: "Response from profile",
                timestamp: new Date("2025-01-01T12:30:00Z").toISOString(),
                profileId: "codex-pro",
            }

            render(<MessageRow item={item}/>)

            expect(screen.getByText("codex-pro")).not.toBeNull()
        })

        it("displays agentKey/profileName format when profiles provided", () => {
            const item: ConversationMessageItem = {
                type: "message",
                role: "assistant",
                text: "Response from profile",
                timestamp: new Date("2025-01-01T12:30:00Z").toISOString(),
                profileId: "profile-123",
            }
            const profiles = [
                {id: "profile-123", name: "My Custom Profile"},
                {id: "profile-456", name: "Another Profile"},
            ]

            render(<MessageRow item={item} agentKey="codex" profiles={profiles}/>)

            expect(screen.getByText("codex/My Custom Profile")).not.toBeNull()
        })

        it("displays profileName only when no agentKey provided", () => {
            const item: ConversationMessageItem = {
                type: "message",
                role: "assistant",
                text: "Response from profile",
                timestamp: new Date("2025-01-01T12:30:00Z").toISOString(),
                profileId: "profile-123",
            }
            const profiles = [
                {id: "profile-123", name: "My Custom Profile"},
            ]

            render(<MessageRow item={item} profiles={profiles}/>)

            expect(screen.getByText("My Custom Profile")).not.toBeNull()
        })

        it("falls back to profileId when not found in profiles array", () => {
            const item: ConversationMessageItem = {
                type: "message",
                role: "assistant",
                text: "Response from profile",
                timestamp: new Date("2025-01-01T12:30:00Z").toISOString(),
                profileId: "unknown-profile",
            }
            const profiles = [
                {id: "profile-123", name: "My Custom Profile"},
            ]

            render(<MessageRow item={item} agentKey="codex" profiles={profiles}/>)

            expect(screen.getByText("codex/unknown-profile")).not.toBeNull()
        })

        it("renders images when present", () => {
            const item: ConversationMessageItem = {
                type: "message",
                role: "user",
                text: "Check this image",
                timestamp: new Date("2025-01-01T12:30:00Z").toISOString(),
                images: [{
                    data: "dGVzdA==",
                    mime: "image/png",
                    name: "test.png",
                }],
            }

            render(<MessageRow item={item}/>)

            expect(screen.getByText("1 Image")).not.toBeNull()
        })

        it("displays formatted time", () => {
            const item: ConversationMessageItem = {
                type: "message",
                role: "user",
                text: "Time check",
                timestamp: new Date("2025-01-01T14:30:00Z").toISOString(),
            }

            const {container} = render(<MessageRow item={item}/>)

            const timeEl = container.querySelector('[data-slot="message-time"]')
            expect(timeEl).not.toBeNull()
            expect(timeEl?.textContent).toMatch(/\d{1,2}:\d{2}/)
        })
    })

    describe("thinking type", () => {
        it("renders thinking block collapsed by default", () => {
            const item: ConversationThinkingItem = {
                type: "thinking",
                text: "Let me analyze this...\nStep 1: Review\nStep 2: Plan",
                timestamp: new Date("2025-01-01T12:30:00Z").toISOString(),
            }

            const {container} = render(<MessageRow item={item}/>)

            const block = container.querySelector('[data-slot="thinking-block"]')
            expect(block).not.toBeNull()

            const content = container.querySelector('[data-slot="thinking-content"]')
            expect(content?.className).toContain("opacity-0")
            expect(content?.className).toContain("grid-rows-[0fr]")
        })

        it("renders thinking block with title when provided", () => {
            const item: ConversationThinkingItem = {
                type: "thinking",
                title: "Planning Phase",
                text: "Detailed thinking process...",
                timestamp: new Date("2025-01-01T12:30:00Z").toISOString(),
            }

            const {container} = render(<MessageRow item={item}/>)

            const title = container.querySelector('[data-slot="thinking-title"]')
            expect(title?.textContent).toBe("Planning Phase")
        })

        it("uses first line as summary when no title", () => {
            const item: ConversationThinkingItem = {
                type: "thinking",
                text: "First line summary\nRest of thinking...",
                timestamp: new Date("2025-01-01T12:30:00Z").toISOString(),
            }

            const {container} = render(<MessageRow item={item}/>)

            const title = container.querySelector('[data-slot="thinking-title"]')
            expect(title?.textContent).toBe("First line summary")
        })

        it("has thinking badge", () => {
            const item: ConversationThinkingItem = {
                type: "thinking",
                text: "Thinking...",
                timestamp: new Date("2025-01-01T12:30:00Z").toISOString(),
            }

            render(<MessageRow item={item}/>)

            expect(screen.getByText("thinking")).not.toBeNull()
        })
    })

    describe("tool type", () => {
        it("renders tool section collapsed by default", () => {
            const item: ConversationToolItem = {
                type: "tool",
                timestamp: new Date("2025-01-01T12:30:00Z").toISOString(),
                tool: {
                    name: "bash",
                    status: "succeeded",
                    command: "ls -la",
                },
            }

            const {container} = render(<MessageRow item={item}/>)

            const section = container.querySelector('[data-slot="collapsible-section"]')
            expect(section).not.toBeNull()

            const content = container.querySelector('[data-slot="collapsible-content"]')
            expect(content?.className).toContain("grid-rows-[0fr]")
        })

        it("expands on click to show details", () => {
            const item: ConversationToolItem = {
                type: "tool",
                timestamp: new Date("2025-01-01T12:30:00Z").toISOString(),
                tool: {
                    name: "bash",
                    status: "succeeded",
                    command: "echo hello",
                    exitCode: 0,
                },
            }

            const {container} = render(<MessageRow item={item}/>)

            const header = container.querySelector('[data-slot="collapsible-header"]')
            expect(header).not.toBeNull()
            fireEvent.click(header!)

            const content = container.querySelector('[data-slot="collapsible-content"]')
            expect(content?.className).toContain("grid-rows-[1fr]")
        })

        it("displays status indicator with correct styling", () => {
            const succeededItem: ConversationToolItem = {
                type: "tool",
                timestamp: new Date("2025-01-01T12:30:00Z").toISOString(),
                tool: {name: "test", status: "succeeded"},
            }

            const {container: container1} = render(<MessageRow item={succeededItem}/>)
            const successIndicator = container1.querySelector('[data-slot="status-indicator"]')
            expect(successIndicator?.textContent).toContain("done")
            expect(successIndicator?.className).toContain("text-emerald")

            cleanup()

            const failedItem: ConversationToolItem = {
                type: "tool",
                timestamp: new Date("2025-01-01T12:30:00Z").toISOString(),
                tool: {name: "test", status: "failed"},
            }

            const {container: container2} = render(<MessageRow item={failedItem}/>)
            const failIndicator = container2.querySelector('[data-slot="status-indicator"]')
            expect(failIndicator?.textContent).toContain("failed")
            expect(failIndicator?.className).toContain("text-destructive")
        })

        it("shows command in code block", () => {
            const item: ConversationToolItem = {
                type: "tool",
                timestamp: new Date("2025-01-01T12:30:00Z").toISOString(),
                tool: {
                    name: "bash",
                    status: "succeeded",
                    command: "npm install",
                },
            }

            const {container} = render(<MessageRow item={item}/>)

            const header = container.querySelector('[data-slot="collapsible-header"]')
            fireEvent.click(header!)

            const details = container.querySelector('[data-slot="tool-details"]')
            expect(details?.textContent).toContain("npm install")
        })

        it("has reveal output toggle when stdout/stderr present", () => {
            const item: ConversationToolItem = {
                type: "tool",
                timestamp: new Date("2025-01-01T12:30:00Z").toISOString(),
                tool: {
                    name: "bash",
                    status: "succeeded",
                    command: "echo test",
                    stdout: "dGVzdA==",
                },
            }

            const {container} = render(<MessageRow item={item}/>)

            const header = container.querySelector('[data-slot="collapsible-header"]')
            fireEvent.click(header!)

            const toggle = container.querySelector('[data-slot="output-toggle"]')
            expect(toggle).not.toBeNull()
            expect(toggle?.textContent).toBe("Show")

            fireEvent.click(toggle!)

            const output = container.querySelector('[data-slot="output-content"]')
            expect(output).not.toBeNull()
            expect(toggle?.textContent).toBe("Hide")
        })
    })

    describe("automation type", () => {
        it("renders automation section open by default", () => {
            const item: ConversationAutomationItem = {
                type: "automation",
                stage: "setup",
                command: "bun install",
                cwd: "/project",
                status: "succeeded",
                startedAt: new Date("2025-01-01T12:30:00Z").toISOString(),
                completedAt: new Date("2025-01-01T12:30:05Z").toISOString(),
                timestamp: new Date("2025-01-01T12:30:00Z").toISOString(),
                durationMs: 5000,
                exitCode: 0,
            }

            const {container} = render(<MessageRow item={item}/>)

            const content = container.querySelector('[data-slot="collapsible-content"]')
            expect(content?.className).toContain("grid-rows-[1fr]")
        })

        it("displays correct stage label", () => {
            const stageMap: Record<ConversationAutomationItem["stage"], string> = {
                copy_files: "Copy Files",
                setup: "Setup",
                dev: "Development",
                cleanup: "Cleanup",
            }

            for (const [stage, label] of Object.entries(stageMap)) {
                const item: ConversationAutomationItem = {
                    type: "automation",
                    stage: stage as ConversationAutomationItem["stage"],
                    command: "test",
                    cwd: "/",
                    status: "succeeded",
                    startedAt: new Date().toISOString(),
                    completedAt: new Date().toISOString(),
                    timestamp: new Date().toISOString(),
                    durationMs: 1000,
                    exitCode: 0,
                }

                render(<MessageRow item={item}/>)
                expect(screen.getByText(label)).not.toBeNull()
                cleanup()
            }
        })

        it("shows allowed failure badge when applicable", () => {
            const item: ConversationAutomationItem = {
                type: "automation",
                stage: "setup",
                command: "optional-script",
                cwd: "/",
                status: "failed",
                allowedFailure: true,
                startedAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
                timestamp: new Date().toISOString(),
                durationMs: 1000,
                exitCode: 1,
            }

            render(<MessageRow item={item}/>)

            expect(screen.getByText("allowed")).not.toBeNull()
        })

        it("displays duration and exit code", () => {
            const item: ConversationAutomationItem = {
                type: "automation",
                stage: "dev",
                command: "bun run dev",
                cwd: "/app",
                status: "succeeded",
                startedAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
                timestamp: new Date().toISOString(),
                durationMs: 2500,
                exitCode: 0,
            }

            const {container} = render(<MessageRow item={item}/>)

            const details = container.querySelector('[data-slot="automation-details"]')
            expect(details?.textContent).toContain("2.5s")
            expect(details?.textContent).toContain("exit:")
        })
    })

    describe("error type", () => {
        it("renders error message with destructive styling", () => {
            const item: ConversationErrorItem = {
                type: "error",
                text: "Something went wrong!",
                timestamp: new Date("2025-01-01T12:30:00Z").toISOString(),
            }

            const {container} = render(<MessageRow item={item}/>)

            const row = container.querySelector('[data-slot="error-row"]')
            expect(row).not.toBeNull()

            const bubble = container.querySelector('[data-slot="error-bubble"]')
            expect(bubble?.className).toContain("border-destructive")
            expect(bubble?.className).toContain("bg-destructive")

            const text = container.querySelector('[data-slot="error-text"]')
            expect(text?.textContent).toBe("Something went wrong!")
            expect(text?.className).toContain("text-destructive")
        })

        it("displays error label", () => {
            const item: ConversationErrorItem = {
                type: "error",
                text: "Error occurred",
                timestamp: new Date().toISOString(),
            }

            render(<MessageRow item={item}/>)

            expect(screen.getByText("Error")).not.toBeNull()
        })
    })

    describe("appearance animation", () => {
        it("applies animation classes to message row", () => {
            const item: ConversationMessageItem = {
                type: "message",
                role: "user",
                text: "Hello",
                timestamp: new Date().toISOString(),
            }

            const {container} = render(<MessageRow item={item}/>)

            const row = container.querySelector('[data-slot="message-row"]')
            expect(row?.className).toContain("animate-in")
            expect(row?.className).toContain("fade-in-0")
            expect(row?.className).toContain("slide-in-from-bottom-2")
        })

        it("applies animation classes to thinking block", () => {
            const item: ConversationThinkingItem = {
                type: "thinking",
                text: "Analyzing...",
                timestamp: new Date().toISOString(),
            }

            const {container} = render(<MessageRow item={item}/>)

            const block = container.querySelector('[data-slot="thinking-block"]')
            expect(block?.className).toContain("animate-in")
            expect(block?.className).toContain("fade-in-0")
            expect(block?.className).toContain("slide-in-from-bottom-2")
        })

        it("applies animation classes to tool section", () => {
            const item: ConversationToolItem = {
                type: "tool",
                timestamp: new Date().toISOString(),
                tool: {
                    name: "bash",
                    status: "succeeded",
                    command: "ls",
                },
            }

            const {container} = render(<MessageRow item={item}/>)

            const section = container.querySelector('[data-slot="collapsible-section"]')
            expect(section?.className).toContain("animate-in")
            expect(section?.className).toContain("fade-in-0")
            expect(section?.className).toContain("slide-in-from-bottom-2")
        })

        it("applies animation classes to automation section", () => {
            const item: ConversationAutomationItem = {
                type: "automation",
                stage: "setup",
                command: "bun install",
                cwd: "/project",
                status: "succeeded",
                startedAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
                timestamp: new Date().toISOString(),
                durationMs: 1000,
                exitCode: 0,
            }

            const {container} = render(<MessageRow item={item}/>)

            const section = container.querySelector('[data-slot="collapsible-section"]')
            expect(section?.className).toContain("animate-in")
            expect(section?.className).toContain("fade-in-0")
            expect(section?.className).toContain("slide-in-from-bottom-2")
        })

        it("applies animation classes to error row", () => {
            const item: ConversationErrorItem = {
                type: "error",
                text: "Error occurred",
                timestamp: new Date().toISOString(),
            }

            const {container} = render(<MessageRow item={item}/>)

            const row = container.querySelector('[data-slot="error-row"]')
            expect(row?.className).toContain("animate-in")
            expect(row?.className).toContain("fade-in-0")
            expect(row?.className).toContain("slide-in-from-bottom-2")
        })
    })

    describe("edge cases", () => {
        it("handles invalid timestamp gracefully", () => {
            const item: ConversationMessageItem = {
                type: "message",
                role: "user",
                text: "Test",
                timestamp: "invalid-date",
            }

            const {container} = render(<MessageRow item={item}/>)

            const time = container.querySelector('[data-slot="message-time"]')
            expect(time?.textContent).toMatch(/\d{1,2}:\d{2}/)
        })

        it("returns null for unknown type", () => {
            const item = {
                type: "unknown",
                timestamp: new Date().toISOString(),
            } as unknown as ConversationItem

            const {container} = render(<MessageRow item={item}/>)
            expect(container.innerHTML).toBe("")
        })
    })
})
