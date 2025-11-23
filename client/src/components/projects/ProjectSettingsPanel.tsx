import {useEffect, useMemo, useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {Checkbox} from "@/components/ui/checkbox";
import {Label} from "@/components/ui/label";
import {ScrollArea} from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {Textarea} from "@/components/ui/textarea";
// ProfilesManager modal replaced by Agents page
import {agentKeys} from "@/lib/queryClient";
import {
    useAgents,
    useAgentProfiles,
    useProject,
    useProjectSettings,
    useProjectBranches,
    useUpdateProjectSettings,
} from "@/hooks";
import type {ProjectSettings} from "shared";
import {Input} from "../ui/input";

const NONE_VALUE = "__none__";

type FormState = {
    baseBranch: string;
    preferredRemote: string;
    setupScript: string;
    devScript: string;
    cleanupScript: string;
    copyFiles: string;
    defaultAgent: string;
    defaultProfileId: string;
    autoCommitOnFinish: boolean;
    autoPushOnAutocommit: boolean;
    ticketPrefix: string;
};

function mapSettingsToForm(settings: ProjectSettings | null): FormState {
    if (!settings) {
        return {
            baseBranch: "",
            preferredRemote: "",
            setupScript: "",
            devScript: "",
            cleanupScript: "",
            copyFiles: "",
            defaultAgent: "",
            defaultProfileId: "",
            autoCommitOnFinish: false,
            autoPushOnAutocommit: false,
            ticketPrefix: "",
        };
    }
    return {
        baseBranch: settings.baseBranch ?? "",
        preferredRemote: settings.preferredRemote ?? "",
        setupScript: settings.setupScript ?? "",
        devScript: settings.devScript ?? "",
        cleanupScript: settings.cleanupScript ?? "",
        copyFiles: settings.copyFiles ?? "",
        defaultAgent: settings.defaultAgent ?? "",
        defaultProfileId: settings.defaultProfileId ?? "",
        autoCommitOnFinish: settings.autoCommitOnFinish ?? false,
        autoPushOnAutocommit: settings.autoPushOnAutocommit ?? false,
        ticketPrefix: settings.ticketPrefix ?? "",
    };
}

type ProjectSettingsPanelProps = {
    projectId: string;
    onSaved?: (settings: ProjectSettings) => void;
    onClose?: () => void;
    scrollArea?: boolean;
};

export function ProjectSettingsPanel({
                                         projectId,
                                         onSaved,
                                         onClose,
                                         scrollArea = true,
                                     }: ProjectSettingsPanelProps) {
    const queryClient = useQueryClient();

    const {data: project} = useProject(projectId);

    const {
        data: settings,
        isLoading: settingsLoading,
        isError: settingsError,
        error: settingsErrorObj,
    } = useProjectSettings(projectId);

    const {
        data: branchesData,
        isLoading: branchesLoading,
        isError: branchesError,
        error: branchesErrorObj,
    } = useProjectBranches(projectId);
    const branches = branchesData ?? [];

    const {
        data: agentsResponse,
        isLoading: agentsLoading,
        isError: agentsError,
        error: agentsErrorObj,
    } = useAgents()

    const {
        data: profileList,
        isLoading: profilesLoading,
        isError: profilesError,
        error: profilesErrorObj,
    } = useAgentProfiles("global")

    const [initialSettings, setInitialSettings] =
        useState<ProjectSettings | null>(null);
    const [form, setForm] = useState<FormState>(mapSettingsToForm(null));
    const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
    // profilesOpen removed with modal

    useEffect(() => {
        if (settings) {
            setInitialSettings(settings);
            setForm(mapSettingsToForm(settings));
            setStatus("idle");
        }
    }, [settings]);

    const agents = agentsResponse?.agents ?? [];
    const profiles = useMemo(() => profileList ?? [], [profileList]);

    const loading =
        settingsLoading || branchesLoading || agentsLoading || profilesLoading;
    const error =
        settingsErrorObj ??
        branchesErrorObj ??
        agentsErrorObj ??
        profilesErrorObj ??
        (settingsError || branchesError || agentsError || profilesError
            ? new Error("Failed to load project settings")
            : null);

    const updateForm = (patch: Partial<FormState>) => {
        setForm((prev) => ({...prev, ...patch}));
        setStatus("idle");
    };

    const normalizePrefixInput = (value: string) =>
        value
            .replace(/[^A-Za-z0-9]/g, "")
            .toUpperCase()
            .slice(0, 6);

    const refreshProfiles = async () => {
        await queryClient.invalidateQueries({
            queryKey: agentKeys.profiles("global"),
        });
    };

    const updateSettingsMutation = useUpdateProjectSettings({
        onSuccess: async (next) => {
            setInitialSettings(next);
            setForm(mapSettingsToForm(next));
            setStatus("saved");
            onSaved?.(next);
            await refreshProfiles();
        },
        onError: () => setStatus("error"),
    });

    const filteredProfiles = useMemo(() => {
        if (!form.defaultAgent) return profiles;
        return profiles.filter((profile) => profile.agent === form.defaultAgent);
    }, [profiles, form.defaultAgent]);

    const isDirty = useMemo(() => {
        if (!initialSettings) return false;
        return (
            form.baseBranch !== (initialSettings.baseBranch ?? "") ||
            (form.preferredRemote || "") !==
            (initialSettings.preferredRemote ?? "") ||
            (form.setupScript || "") !== (initialSettings.setupScript ?? "") ||
            (form.devScript || "") !== (initialSettings.devScript ?? "") ||
            (form.cleanupScript || "") !== (initialSettings.cleanupScript ?? "") ||
            (form.copyFiles || "") !== (initialSettings.copyFiles ?? "") ||
            (form.defaultAgent || "") !== (initialSettings.defaultAgent ?? "") ||
            (form.defaultProfileId || "") !==
            (initialSettings.defaultProfileId ?? "") ||
            form.autoCommitOnFinish !==
            (initialSettings.autoCommitOnFinish ?? false) ||
            form.autoPushOnAutocommit !==
            (initialSettings.autoPushOnAutocommit ?? false) ||
            (form.ticketPrefix || "") !== (initialSettings.ticketPrefix ?? "")
        );
    }, [form, initialSettings]);

    const handleReset = () => {
        if (initialSettings) {
            setForm(mapSettingsToForm(initialSettings));
            setStatus("idle");
        }
    };

    const handleSave = async () => {
        if (!initialSettings) return;

        const payload: Record<string, unknown> = {};
        if (form.baseBranch !== initialSettings.baseBranch)
            payload.baseBranch = form.baseBranch;
        if (
            (form.preferredRemote || "") !== (initialSettings.preferredRemote ?? "")
        )
            payload.preferredRemote = form.preferredRemote || null;
        if ((form.setupScript || "") !== (initialSettings.setupScript ?? ""))
            payload.setupScript = form.setupScript;
        if ((form.devScript || "") !== (initialSettings.devScript ?? ""))
            payload.devScript = form.devScript;
        if ((form.cleanupScript || "") !== (initialSettings.cleanupScript ?? ""))
            payload.cleanupScript = form.cleanupScript;
        if ((form.copyFiles || "") !== (initialSettings.copyFiles ?? ""))
            payload.copyFiles = form.copyFiles;
        if ((form.defaultAgent || "") !== (initialSettings.defaultAgent ?? ""))
            payload.defaultAgent = form.defaultAgent || null;
        if (
            (form.defaultProfileId || "") !== (initialSettings.defaultProfileId ?? "")
        )
            payload.defaultProfileId = form.defaultProfileId || null;
        if (
            form.autoCommitOnFinish !== (initialSettings.autoCommitOnFinish ?? false)
        )
            payload.autoCommitOnFinish = form.autoCommitOnFinish;
        if (
            form.autoPushOnAutocommit !==
            (initialSettings.autoPushOnAutocommit ?? false)
        )
            payload.autoPushOnAutocommit = form.autoPushOnAutocommit;
        if ((form.ticketPrefix || "") !== (initialSettings.ticketPrefix ?? ""))
            payload.ticketPrefix = form.ticketPrefix || initialSettings.ticketPrefix;

        if (Object.keys(payload).length === 0) return;

        await updateSettingsMutation.mutateAsync({projectId, updates: payload as Partial<ProjectSettings>});
    };

    const body = (
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">
                        Project Settings
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        {project ? project.name : "Loading…"}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {status === "saved" ? (
                        <Badge variant="secondary">Saved</Badge>
                    ) : status === "error" ? (
                        <Badge
                            variant="outline"
                            className="border-destructive/60 text-destructive"
                        >
                            Save failed
                        </Badge>
                    ) : null}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleReset}
                        disabled={!isDirty || updateSettingsMutation.isPending}
                    >
                        Reset
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={!isDirty || updateSettingsMutation.isPending}
                    >
                        {updateSettingsMutation.isPending ? "Saving…" : "Save changes"}
                    </Button>
                </div>
            </div>

            <div className="flex-1">
                <ScrollArea className={scrollArea ? "h-full" : undefined}>
                    <div className="space-y-6 px-6 py-4">
                        {loading ? (
                            <div className="text-sm text-muted-foreground">
                                Loading settings…
                            </div>
                        ) : error ? (
                            <div
                                className="rounded border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                                {error.message}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <section className="space-y-3 rounded-lg border border-border/60 bg-card/40 p-4">
                                    <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                                        Repository defaults
                                    </h3>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="base-branch">Base branch</Label>
                                            <Select
                                                value={form.baseBranch || undefined}
                                                onValueChange={(value) =>
                                                    updateForm({baseBranch: value})
                                                }
                                            >
                                                <SelectTrigger id="base-branch" className="w-full">
                                                    <SelectValue placeholder="Select base branch"/>
                                                </SelectTrigger>
                                                <SelectContent className="max-h-60 overflow-y-auto">
                                                    {branches
                                                        .filter((branch) => branch.kind === "local")
                                                        .map((branch) => (
                                                            <SelectItem
                                                                key={`local-${branch.name}`}
                                                                value={branch.name}
                                                            >
                                                                <div
                                                                    className="flex w-full items-center justify-between gap-2">
                                                                    <span>{branch.displayName}</span>
                                                                    {branch.isCurrent ? (
                                                                        <Badge variant="secondary">current</Badge>
                                                                    ) : null}
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="preferred-remote">Preferred remote</Label>
                                            <Select
                                                value={
                                                    form.preferredRemote
                                                        ? form.preferredRemote
                                                        : NONE_VALUE
                                                }
                                                onValueChange={(value) =>
                                                    updateForm({
                                                        preferredRemote: value === NONE_VALUE ? "" : value,
                                                    })
                                                }
                                            >
                                                <SelectTrigger id="preferred-remote" className="w-full">
                                                    <SelectValue placeholder="No preference"/>
                                                </SelectTrigger>
                                                <SelectContent className="max-h-60 overflow-y-auto">
                                                    <SelectItem value={NONE_VALUE}>
                                                        <div className="flex w-full items-center justify-between gap-2">
                                                            <span>None</span>
                                                        </div>
                                                    </SelectItem>
                                                    {Array.from(
                                                        new Set(
                                                            branches
                                                                .filter((b) => b.kind === "remote" && b.remote)
                                                                .map((b) => b.remote!)
                                                        )
                                                    ).map((remote) => (
                                                        <SelectItem key={remote} value={remote}>
                                                            <div
                                                                className="flex w-full items-center justify-between gap-2">
                                                                <span>{remote}</span>
                                                                <Badge variant="outline">remote</Badge>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div
                                        className="flex items-center gap-3 rounded-md border border-dashed border-border/60 bg-background/80 p-3">
                                        <Checkbox
                                            id="auto-commit-on-finish"
                                            checked={form.autoCommitOnFinish}
                                            onCheckedChange={(checked) =>
                                                updateForm({
                                                    autoCommitOnFinish: checked === true,
                                                    autoPushOnAutocommit: checked === true
                                                        ? form.autoPushOnAutocommit
                                                        : false,
                                                })
                                            }
                                        />
                                        <div className="space-y-1">
                                            <Label htmlFor="auto-commit-on-finish">
                                                Auto-commit on finish
                                            </Label>
                                            <p className="text-xs text-muted-foreground">
                                                When the agent succeeds, commit all changes in the
                                                worktree using the last assistant message as the commit
                                                message. Does not push unless auto-push is enabled.
                                            </p>
                                        </div>
                                    </div>
                                    <div
                                        className="flex items-center gap-3 rounded-md border border-dashed border-border/60 bg-background/80 p-3">
                                        <Checkbox
                                            id="auto-push-after-autocommit"
                                            checked={form.autoPushOnAutocommit}
                                            disabled={!form.autoCommitOnFinish}
                                            onCheckedChange={(checked) =>
                                                updateForm({autoPushOnAutocommit: checked === true})
                                            }
                                        />
                                        <div className="space-y-1">
                                            <Label htmlFor="auto-push-after-autocommit">
                                                Auto-push after auto-commit
                                            </Label>
                                            <p className="text-xs text-muted-foreground">
                                                If auto-commit is enabled, also push the branch to the
                                                preferred remote (or tracking remote) after committing.
                                            </p>
                                        </div>
                                    </div>
                                </section>

                                <section className="space-y-3 rounded-lg border border-border/60 bg-card/40 p-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                                            Ticket numbering
                                        </h3>
                                        <span className="text-xs text-muted-foreground">
                      Prefixes apply to future tickets only.
                    </span>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="ticket-prefix">Ticket prefix</Label>
                                            <Input
                                                id="ticket-prefix"
                                                value={form.ticketPrefix}
                                                onChange={(e) =>
                                                    updateForm({
                                                        ticketPrefix: normalizePrefixInput(e.target.value),
                                                    })
                                                }
                                                placeholder="KAN"
                                                maxLength={6}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Use 1–6 uppercase letters or numbers. Example keys
                                                appear as{" "}
                                                {form.ticketPrefix
                                                    ? `${form.ticketPrefix}-001`
                                                    : "PRJ-001"}
                                                .
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="next-ticket-number">
                                                Next ticket number
                                            </Label>
                                            <Input
                                                id="next-ticket-number"
                                                value={(
                                                    initialSettings?.nextTicketNumber ??
                                                    settings?.nextTicketNumber ??
                                                    1
                                                ).toString()}
                                                readOnly
                                                disabled
                                                className="bg-muted/40 text-muted-foreground"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Automatically increments when new tickets are created.
                                            </p>
                                        </div>
                                    </div>
                                </section>

                                <section className="space-y-3 rounded-lg border border-border/60 bg-card/40 p-4">
                                    <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                                        Automation scripts
                                    </h3>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="setup-script">Setup script</Label>
                                            <Textarea
                                                id="setup-script"
                                                placeholder="bun install\nnpm run prepare"
                                                className="h-28"
                                                value={form.setupScript}
                                                onChange={(e) =>
                                                    updateForm({setupScript: e.target.value})
                                                }
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Run once to prepare the workspace (install deps,
                                                generate code, etc.). Use newline for multiple commands.
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="dev-script">Dev script</Label>
                                            <Textarea
                                                id="dev-script"
                                                placeholder="bun run dev"
                                                className="h-28"
                                                value={form.devScript}
                                                onChange={(e) =>
                                                    updateForm({devScript: e.target.value})
                                                }
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Optional command the agent can start to run your app
                                                locally while working.
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="cleanup-script">Cleanup script</Label>
                                            <Textarea
                                                id="cleanup-script"
                                                placeholder="bun run clean"
                                                className="h-28"
                                                value={form.cleanupScript}
                                                onChange={(e) =>
                                                    updateForm({cleanupScript: e.target.value})
                                                }
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Optional post-run cleanup (stop services, remove temp
                                                files, etc.).
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="copy-files">Copy files</Label>
                                            <Textarea
                                                id="copy-files"
                                                placeholder=".env.example -> .env\napps/web/.env.local -> .env.local"
                                                className="h-28"
                                                value={form.copyFiles}
                                                onChange={(e) =>
                                                    updateForm({copyFiles: e.target.value})
                                                }
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                One mapping per line using{" "}
                                                <code className="font-mono">src -&gt; dest</code>.
                                                Useful for seeding environment files.
                                            </p>
                                        </div>
                                    </div>
                                </section>

                                <section className="space-y-3 rounded-lg border border-border/60 bg-card/40 p-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                                            Agent defaults
                                        </h3>
                                        <div className="text-xs text-muted-foreground">
                                            Choose defaults here; profiles are global.
                                        </div>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="default-agent">Primary agent</Label>
                                            <Select
                                                value={
                                                    form.defaultAgent ? form.defaultAgent : NONE_VALUE
                                                }
                                                onValueChange={(value) => {
                                                    if (value === NONE_VALUE)
                                                        updateForm({
                                                            defaultAgent: "",
                                                            defaultProfileId: "",
                                                        });
                                                    else
                                                        updateForm({
                                                            defaultAgent: value,
                                                            defaultProfileId: "",
                                                        });
                                                }}
                                            >
                                                <SelectTrigger id="default-agent" className="w-full">
                                                    <SelectValue placeholder="Choose an agent"/>
                                                </SelectTrigger>
                                                <SelectContent className="max-h-60 overflow-y-auto">
                                                    <SelectItem value={NONE_VALUE}>
                                                        <div className="flex w-full items-center justify-between gap-2">
                                                            <span>None</span>
                                                        </div>
                                                    </SelectItem>
                                                    {agents.map((agent) => (
                                                        <SelectItem key={agent.key} value={agent.key}>
                                                            <div
                                                                className="flex w-full items-center justify-between gap-2">
                                                                <span>{agent.label}</span>
                                                                <Badge variant="outline">{agent.key}</Badge>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="default-profile">Default profile</Label>
                                            <Select
                                                value={
                                                    form.defaultProfileId
                                                        ? form.defaultProfileId
                                                        : NONE_VALUE
                                                }
                                                onValueChange={(value) =>
                                                    updateForm({
                                                        defaultProfileId: value === NONE_VALUE ? "" : value,
                                                    })
                                                }
                                                disabled={
                                                    !form.defaultAgent || !filteredProfiles.length
                                                }
                                            >
                                                <SelectTrigger id="default-profile" className="w-full">
                                                    <SelectValue
                                                        placeholder={
                                                            form.defaultAgent
                                                                ? "Select profile"
                                                                : "Choose an agent first"
                                                        }
                                                    />
                                                </SelectTrigger>
                                                <SelectContent className="max-h-60 overflow-y-auto">
                                                    <SelectItem value={NONE_VALUE}>
                                                        <div className="flex w-full items-center justify-between gap-2">
                                                            <span>None</span>
                                                        </div>
                                                    </SelectItem>
                                                    {filteredProfiles.map((profile) => (
                                                        <SelectItem key={profile.id} value={profile.id}>
                                                            <div
                                                                className="flex w-full items-center justify-between gap-2">
                                                                <span>{profile.name}</span>
                                                                <Badge variant="secondary">
                                                                    {profile.agent}
                                                                </Badge>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {!filteredProfiles.length && form.defaultAgent ? (
                                                <p className="text-xs text-muted-foreground">
                                                    No profiles found for {form.defaultAgent}. Create them
                                                    in Agents.
                                                </p>
                                            ) : null}
                                        </div>
                                    </div>
                                </section>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>

            {null}

            {onClose ? (
                <div className="border-t border-border/60 px-4 py-3 text-right">
                    <Button variant="ghost" onClick={onClose}>
                        Close
                    </Button>
                </div>
            ) : null}
        </div>
    );

    return scrollArea ? body : <div className="flex h-full flex-col">{body}</div>;
}
