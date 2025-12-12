import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

import { AttemptsSection } from "@/components/kanban/card-inspector/sections/AttemptsSection";

const mockDataUrl = "data:image/png;base64,Zm9v";

class MockFileReader {
    result: string | ArrayBuffer | null = null;
    onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
    onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
    readAsDataURL() {
        this.result = mockDataUrl;
        this.onload?.(new ProgressEvent("load") as any);
    }
}

describe("AttemptsSection image paste", () => {
    const originalFileReader = globalThis.FileReader;

    beforeEach(() => {
        // @ts-expect-error test stub
        globalThis.FileReader = MockFileReader;
    });

    afterEach(() => {
        globalThis.FileReader = originalFileReader;
        cleanup();
    });

    it("adds pasted image files as attachments", async () => {
        const onImagesChange = vi.fn();

        render(
            <AttemptsSection
                attempt={{ id: "att-1", sessionId: "sess-1", status: "failed" } as any}
                cardId="card-1"
                conversation={[]}
                followup=""
                onFollowupChange={vi.fn()}
                followupImages={[]}
                onFollowupImagesChange={onImagesChange}
                onSendFollowup={vi.fn()}
                sendPending={false}
                stopping={false}
                onStopAttempt={vi.fn()}
                attemptAgent="CODEX" as any
                onProfileSelect={vi.fn()}
                followupProfiles={[]}
            />
        );

        const textarea = screen.getByPlaceholderText(/paste or drop images/i);
        const file = new File(["foo"], "test.png", { type: "image/png" });

        fireEvent.paste(textarea, {
            clipboardData: {
                items: [
                    {
                        kind: "file",
                        type: "image/png",
                        getAsFile: () => file,
                    },
                ],
            },
        });

        await waitFor(() => {
            expect(onImagesChange).toHaveBeenCalled();
        });

        const newImages = onImagesChange.mock.calls.at(-1)?.[0];
        expect(newImages).toHaveLength(1);
        expect(newImages[0].mimeType).toBe("image/png");
        expect(newImages[0].dataUrl).toBe(mockDataUrl);
    });
});

