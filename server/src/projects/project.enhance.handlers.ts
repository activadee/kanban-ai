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
        log.error(
            {
                err: error,
                projectId,
                agent: body.agent,
                profileId: body.profileId,
            },
            "[projects:tickets:enhance] failed",
        );
        return problemJson(c, {
            status: 502,
            detail: "Failed to enhance ticket",
        });
    }
};

