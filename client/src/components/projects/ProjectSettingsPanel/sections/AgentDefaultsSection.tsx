import {AgentDefaultsForm} from '@/components/projects/settings/AgentDefaultsForm'

type Agent = { key: string; label: string }
type Profile = { id: string; name: string; agent: string }

type AgentDefaultsSectionProps = {
    defaultAgent: string;
    defaultProfileId: string;
    agents: Agent[];
    profiles: Profile[];
    onChange: (patch: Partial<{
        defaultAgent: string;
        defaultProfileId: string;
    }>) => void;
}

export function AgentDefaultsSection({
                                         defaultAgent,
                                         defaultProfileId,
                                         agents,
                                         profiles,
                                         onChange,
                                     }: AgentDefaultsSectionProps) {
    return (
        <AgentDefaultsForm
            defaultAgent={defaultAgent}
            defaultProfileId={defaultProfileId}
            agents={agents}
            profiles={profiles}
            update={onChange}
        />
    )
}

