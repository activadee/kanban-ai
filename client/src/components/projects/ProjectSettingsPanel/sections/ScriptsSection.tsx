import {ScriptsForm} from '@/components/projects/settings/ScriptsForm'

type ScriptsSectionProps = {
    setupScript: string;
    devScript: string;
    cleanupScript: string;
    copyFiles: string;
    onChange: (patch: Partial<{
        setupScript: string;
        devScript: string;
        cleanupScript: string;
        copyFiles: string;
    }>) => void;
}

export function ScriptsSection({
                                   setupScript,
                                   devScript,
                                   cleanupScript,
                                   copyFiles,
                                   onChange,
                               }: ScriptsSectionProps) {
    return (
        <ScriptsForm
            setupScript={setupScript}
            devScript={devScript}
            cleanupScript={cleanupScript}
            copyFiles={copyFiles}
            update={onChange}
        />
    )
}

