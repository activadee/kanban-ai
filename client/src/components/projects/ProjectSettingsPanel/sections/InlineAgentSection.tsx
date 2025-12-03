import {InlineAgentForm} from '@/components/projects/settings/InlineAgentForm'
import type {InlineAgentProfileMapping} from 'shared'

type Agent = { key: string; label: string }
type Profile = { id: string; name: string; agent: string }

type InlineAgentSectionProps = {
    inlineAgent: string;
    inlineProfileId: string;
    inlineAgentProfileMapping: InlineAgentProfileMapping;
    agents: Agent[];
    profiles: Profile[];
    onChange: (patch: Partial<{
        inlineAgent: string;
        inlineProfileId: string;
        inlineAgentProfileMapping: InlineAgentProfileMapping;
    }>) => void;
}

export function InlineAgentSection({
                                       inlineAgent,
                                       inlineProfileId,
                                       inlineAgentProfileMapping,
                                       agents,
                                       profiles,
                                       onChange,
                                   }: InlineAgentSectionProps) {
    return (
        <InlineAgentForm
            inlineAgent={inlineAgent}
            inlineProfileId={inlineProfileId}
            inlineAgentProfileMapping={inlineAgentProfileMapping}
            agents={agents}
            profiles={profiles}
            update={onChange}
        />
    )
}
