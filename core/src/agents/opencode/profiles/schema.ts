import {z} from "zod";
import {
    defaultOpencodeProfile,
    type OpencodeProfile as SharedOpencodeProfile,
} from "shared";

export const OpencodeProfileSchema = z.object({
    appendPrompt: z.string().nullable().optional(),
    agent: z.string().optional(),
    model: z.string().optional(),
    baseCommandOverride: z.string().nullable().optional(),
    additionalParams: z.array(z.string()).optional(),
    debug: z.boolean().optional(),
});

export type OpencodeProfile = z.infer<typeof OpencodeProfileSchema>;

export const defaultProfile: SharedOpencodeProfile = defaultOpencodeProfile;
