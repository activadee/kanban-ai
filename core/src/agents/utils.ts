import type { TicketEnhanceInput, TicketEnhanceResult } from "./types";

export function splitTicketMarkdown(
    markdown: string,
    fallbackTitle: string,
    fallbackDescription: string,
): TicketEnhanceResult {
    const normalized = markdown.replace(/\r\n/g, "\n");
    const lines = normalized.split("\n");

    let headingIndex = -1;
    let headingText = "";

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";
        const trimmedStart = line.trimStart();
        if (trimmedStart.startsWith("# ")) {
            headingIndex = i;
            headingText = trimmedStart.slice(2).trim();
            break;
        }
    }

    if (headingIndex === -1 || !headingText) {
        return { title: fallbackTitle, description: fallbackDescription };
    }

    const rest = lines
        .slice(headingIndex + 1)
        .join("\n")
        .trim();
    const description = rest || fallbackDescription;

    return {
        title: headingText,
        description,
    };
}

export function buildTicketEnhancePrompt(
    input: TicketEnhanceInput,
    appendPrompt?: string | null,
): string {
    const description = input.description?.trim() || "(keine Beschreibung)";

    const base = [
        "You are a ticket generator for a software project.",
        "",
        "Input:",
        `Title: ${input.title}`,
        "Description:",
        description,
        "",
        "Task:",
        "Write an improved ticket that meets the following requirements:",
        "- Markdown.",
        "- First line: # <New title or unchanged title>.",
        "- Detailed description with steps and acceptance criteria.",
        "- At least one ```mermaid``` diagram (graph or sequenceDiagram).",
        "- Preferably an additional sequence diagram, if it makes sense.",
        "- No meta-explanation, only the ticket content.",
    ].join("\n");

    const extra = (appendPrompt ?? "").trim();
    return extra ? `${base}\n\n${extra}` : base;
}
