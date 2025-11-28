import type {ProjectBranchInfo} from 'shared'
import {RepositoryDefaultsForm} from '@/components/projects/settings/RepositoryDefaultsForm'

type BranchSettingsSectionProps = {
    baseBranch: string;
    preferredRemote: string;
    autoCommitOnFinish: boolean;
    autoPushOnAutocommit: boolean;
    branches: ProjectBranchInfo[];
    onChange: (patch: Partial<{
        baseBranch: string;
        preferredRemote: string;
        autoCommitOnFinish: boolean;
        autoPushOnAutocommit: boolean;
    }>) => void;
}

export function BranchSettingsSection({
                                          baseBranch,
                                          preferredRemote,
                                          autoCommitOnFinish,
                                          autoPushOnAutocommit,
                                          branches,
                                          onChange,
                                      }: BranchSettingsSectionProps) {
    return (
        <RepositoryDefaultsForm
            baseBranch={baseBranch}
            preferredRemote={preferredRemote}
            autoCommitOnFinish={autoCommitOnFinish}
            autoPushOnAutocommit={autoPushOnAutocommit}
            branches={branches}
            update={onChange}
        />
    )
}

