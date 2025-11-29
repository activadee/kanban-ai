import {agentEnhanceTicket} from "core";
import {problemJson} from "../http/problem";
import {log} from "../log";

type EnhanceTicketBody = {
    title: string;
    description?: string;
    agent?: string;
    profileId?: string;
};

export const enhanceTicketHandler = async (c: any) => {
    const projectId = c.req.param("projectId");
    const body = c.req.valid("json") as EnhanceTicketBody;

    try {
        const result = await agentEnhanceTicket({
            projectId,
            title: body.title,
            description: body.description ?? "",
            agentKey: body.agent,
            profileId: body.profileId,
        });

        return c.json({ticket: result}, 200);
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Failed to enhance ticket";

        let status = 502;
        if (message === "Project not found") {
            status = 404;
        } else if (message.startsWith("Unknown agent:")) {
            status = 400;
        } else if (message.includes("does not support ticket enhancement")) {
            status = 400;
        } else if (
            message.startsWith(
                "No inline agent configured for this project.",
            )
        ) {
            status = 400;
        }

        if (status >= 500) {
            log.error(
                {
                    err: error,
                    projectId,
                    agent: body.agent,
                    profileId: body.profileId,
                },
                "[projects:tickets:enhance] failed",
            );
        }

        return problemJson(c, {
            status,
            detail: status >= 500 ? "Failed to enhance ticket" : message,
        });
    }
};
