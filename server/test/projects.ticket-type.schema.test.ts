import {describe, expect, it} from "vitest";
import {
    createCardSchema,
    updateCardSchema,
    enhanceTicketSchema,
} from "../src/projects/project.schemas";

describe("ticket type validation schemas", () => {
    it("accepts supported ticket types and normalizes case", () => {
        const parsed = createCardSchema.parse({
            columnId: "col-1",
            title: "New card",
            ticketType: "FeAt",
        });
        expect(parsed.ticketType).toBe("feat");

        const update = updateCardSchema.parse({ticketType: "FIX"});
        expect(update.ticketType).toBe("fix");

        const enhance = enhanceTicketSchema.parse({title: "T", ticketType: "TEST"});
        expect(enhance.ticketType).toBe("test");
    });

    it("rejects invalid ticket types with a clear message", () => {
        const result = createCardSchema.safeParse({
            columnId: "col-1",
            title: "New card",
            ticketType: "unknown",
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0]?.message).toBe("Invalid ticket type: unknown");
        }
    });

    it("allows ticketType-only updates", () => {
        const parsed = updateCardSchema.parse({ticketType: "docs"});
        expect(parsed.ticketType).toBe("docs");
    });
});
