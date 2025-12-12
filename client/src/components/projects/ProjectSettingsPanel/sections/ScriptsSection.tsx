import {ScriptsForm} from '@/components/projects/settings/ScriptsForm'

type ScriptsSectionProps = {
    setupScript: string;
    devScript: string;
    cleanupScript: string;
    copyFiles: string;
    allowScriptsToFail: boolean;
    allowCopyFilesToFail: boolean;
    allowSetupScriptToFail: boolean;
    allowDevScriptToFail: boolean;
    allowCleanupScriptToFail: boolean;
    onChange: (patch: Partial<{
        setupScript: string;
        devScript: string;
        cleanupScript: string;
        copyFiles: string;
        allowScriptsToFail: boolean;
        allowCopyFilesToFail: boolean;
        allowSetupScriptToFail: boolean;
        allowDevScriptToFail: boolean;
        allowCleanupScriptToFail: boolean;
    }>) => void;
}

export function ScriptsSection({
                                   setupScript,
                                   devScript,
                                   cleanupScript,
                                   copyFiles,
                                   allowScriptsToFail,
                                   allowCopyFilesToFail,
                                   allowSetupScriptToFail,
                                   allowDevScriptToFail,
                                   allowCleanupScriptToFail,
                                   onChange,
                               }: ScriptsSectionProps) {
    return (
        <ScriptsForm
            setupScript={setupScript}
            devScript={devScript}
            cleanupScript={cleanupScript}
            copyFiles={copyFiles}
            allowScriptsToFail={allowScriptsToFail}
            allowCopyFilesToFail={allowCopyFilesToFail}
            allowSetupScriptToFail={allowSetupScriptToFail}
            allowDevScriptToFail={allowDevScriptToFail}
            allowCleanupScriptToFail={allowCleanupScriptToFail}
            update={onChange}
        />
    )
}
