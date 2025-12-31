import {z} from "zod";
import {zValidator} from "@hono/zod-validator";
import {agentEnhanceTicket} from "core";
import {problemJson} from "../http/problem";
import {log} from "../log";
import {createHandlers} from "../lib/factory";
import {enhanceTicketSchema} from "./project.schemas";

const projectIdParam = z.object({projectId: z.string()});

export const enhanceTicketHandlers = createHandlers(
    zValidator("param", projectIdParam),
    zValidator("json", enhanceTicketSchema),
    async (c) => {
        const {projectId} = c.req.valid("param");
        const body = c.req.valid("json");

        try {
            const result = await agentEnhanceTicket({
                projectId,
                title: body.title,
                description: body.description ?? "",
                agentKey: body.agent,
                profileId: body.profileId,
                ticketType: body.ticketType ?? undefined,
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
            }

            if (status >= 500) {
                log.error("projects:tickets", "enhance failed", {
                    err: error,
                    projectId,
                    agent: body.agent,
                    profileId: body.profileId,
                });
            }

            return problemJson(c, {
                status,
                detail: status >= 500 ? "Failed to enhance ticket" : message,
            });
        }
    },
);
