import {InlineAgentForm} from '@/components/projects/settings/InlineAgentForm'

type Agent = { key: string; label: string }
type Profile = { id: string; name: string; agent: string }

type InlineAgentSectionProps = {
    inlineAgent: string;
    inlineProfileId: string;
    agents: Agent[];
    profiles: Profile[];
    onChange: (patch: Partial<{
        inlineAgent: string;
        inlineProfileId: string;
    }>) => void;
}

export function InlineAgentSection({
                                       inlineAgent,
                                       inlineProfileId,
                                       agents,
                                       profiles,
                                       onChange,
                                   }: InlineAgentSectionProps) {
    return (
        <InlineAgentForm
            inlineAgent={inlineAgent}
            inlineProfileId={inlineProfileId}
            agents={agents}
            profiles={profiles}
            update={onChange}
        />
    )
}

