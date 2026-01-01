import React from 'react'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {cleanup, render, screen} from '@testing-library/react'
import {MemoryRouter, Route, Routes} from 'react-router-dom'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'

import {DashboardPage} from '@/pages/DashboardPage'
import {ProjectBoardPage} from '@/pages/ProjectBoardPage'
import {AppSettingsPage} from '@/pages/AppSettingsPage'
import {AgentsPage} from '@/pages/AgentsPage'
import {AttemptDetailPage} from '@/pages/AttemptDetailPage'
import {OnboardingPage} from '@/pages/OnboardingPage'
import {ProjectsLanding} from '@/components/projects/ProjectsLanding'

const hooksMocks = vi.hoisted(() => ({
    useDashboardOverview: vi.fn(),
    useDashboardStream: vi.fn(),
    useGithubAuthStatus: vi.fn(),
    useAgents: vi.fn(),

    useProject: vi.fn(),
    useBoardState: vi.fn(),
    useTicketEnhancementQueue: vi.fn(),
    useCreateCard: vi.fn(),
    useUpdateCard: vi.fn(),
    useDeleteCard: vi.fn(),
    useMoveCard: vi.fn(),

    useAppSettings: vi.fn(),
    useEditorSuggestions: vi.fn(),
    useValidateEditorPath: vi.fn(),
    useGithubAppConfig: vi.fn(),
    useSaveGithubAppConfig: vi.fn(),
    useUpdateAppSettings: vi.fn(),

    useAgentSchema: vi.fn(),
    useAgentProfiles: vi.fn(),
    useCreateAgentProfile: vi.fn(),
    useUpdateAgentProfile: vi.fn(),
    useDeleteAgentProfile: vi.fn(),

    useAttempt: vi.fn(),
    useAttemptLogs: vi.fn(),
    useRelativeTimeFormatter: vi.fn(),
}))

vi.mock('@/hooks', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/hooks')>()
    return {
        ...actual,
        useDashboardOverview: hooksMocks.useDashboardOverview,
        useDashboardStream: hooksMocks.useDashboardStream,
        useGithubAuthStatus: hooksMocks.useGithubAuthStatus,
        useAgents: hooksMocks.useAgents,

        useProject: hooksMocks.useProject,
        useBoardState: hooksMocks.useBoardState,
        useTicketEnhancementQueue: hooksMocks.useTicketEnhancementQueue,
        useCreateCard: hooksMocks.useCreateCard,
        useUpdateCard: hooksMocks.useUpdateCard,
        useDeleteCard: hooksMocks.useDeleteCard,
        useMoveCard: hooksMocks.useMoveCard,

        useAppSettings: hooksMocks.useAppSettings,
        useEditorSuggestions: hooksMocks.useEditorSuggestions,
        useValidateEditorPath: hooksMocks.useValidateEditorPath,
        useGithubAppConfig: hooksMocks.useGithubAppConfig,
        useSaveGithubAppConfig: hooksMocks.useSaveGithubAppConfig,
        useUpdateAppSettings: hooksMocks.useUpdateAppSettings,

        useAgentSchema: hooksMocks.useAgentSchema,
        useAgentProfiles: hooksMocks.useAgentProfiles,
        useCreateAgentProfile: hooksMocks.useCreateAgentProfile,
        useUpdateAgentProfile: hooksMocks.useUpdateAgentProfile,
        useDeleteAgentProfile: hooksMocks.useDeleteAgentProfile,

        useAttempt: hooksMocks.useAttempt,
        useAttemptLogs: hooksMocks.useAttemptLogs,
        useRelativeTimeFormatter: hooksMocks.useRelativeTimeFormatter,
    }
})

vi.mock('@/lib/ws', () => ({
    useKanbanWS: () => ({connected: true, reconnecting: false, state: undefined}),
}))

vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-router-dom')>()
    return {
        ...actual,
        useOutletContext: () => ({
            registerCreateTicket: vi.fn(),
        }),
    }
})

vi.mock('@/components/kanban/Board', () => ({
    Board: () => <div data-testid="board-stub"/>,
}))

vi.mock('@/components/kanban/card-dialogs/CardEnhancementDialog', () => ({
    CardEnhancementDialog: () => null,
}))

vi.mock('@/components/github/ImportIssuesDialog', () => ({
    ImportIssuesDialog: () => null,
}))

vi.mock('@/components/system/ConnectionLostDialog', () => ({
    ConnectionLostDialog: () => null,
}))

vi.mock('@/pages/OnboardingPage/steps/IntroStep', () => ({IntroStep: () => <div/>}))
vi.mock('@/pages/OnboardingPage/steps/SettingsStep', () => ({SettingsStep: () => <div/>}))
vi.mock('@/pages/OnboardingPage/steps/EditorStep', () => ({EditorStep: () => <div/>}))
vi.mock('@/pages/OnboardingPage/steps/GitStep', () => ({GitStep: () => <div/>}))
vi.mock('@/pages/OnboardingPage/steps/GithubDeviceFlowStep', () => ({GithubDeviceFlowStep: () => <div/>}))
vi.mock('@/pages/OnboardingPage/steps/SummaryStep', () => ({SummaryStep: () => <div/>}))

vi.mock('@/pages/OnboardingPage/useOnboardingState', () => ({
    STEP_ORDER: ['welcome', 'general', 'editor', 'github-app', 'github-connect', 'finish'],
    STEP_META: {
        welcome: {title: 'Welcome', description: 'A quick pass through preferences and GitHub.'},
        general: {title: 'General preferences', description: 'Theme, language, telemetry, notifications.'},
        editor: {title: 'Editor & Git defaults', description: 'Choose your editor and git identity.'},
        'github-app': {title: 'GitHub templates & OAuth app', description: 'PR templates and your GitHub app credentials.'},
        'github-connect': {title: 'Connect GitHub', description: 'Authorize KanbanAI via device flow.'},
        finish: {title: 'All set', description: 'Review and enter the workspace.'},
    },
    useOnboardingState: () => ({
        state: {
            stepId: 'welcome',
            stepIndex: 0,
            stepCount: 6,
            stepMeta: {title: 'Welcome', description: 'A quick pass through preferences and GitHub.'},
            settingsForm: {
                theme: 'system',
                language: 'browser',
                telemetryEnabled: false,
                notificationsAgentCompletionSound: false,
                notificationsDesktop: false,
                autoStartAgentOnInProgress: false,
                editorCommand: null,
                gitUserName: '',
                gitUserEmail: '',
                branchTemplate: '',
                ghPrTitleTemplate: '',
                ghPrBodyTemplate: '',
                ghAutolinkTickets: false,
            },
            appCredForm: null,
            editorValidationStatus: null,
            connected: false,
            connectedUsername: null,
            onboardingCompleted: false,
            githubConfigMissingId: false,
            deviceState: null,
            polling: false,
            startingDevice: false,
            isInitializing: false,
            queryErrored: false,
            queryErrorMessages: [],
            onboardingStatusError: false,
            completePending: false,
            saveSettingsPending: false,
            saveGithubAppPending: false,
            githubAuthRefreshing: false,
        },
        actions: {
            goNext: vi.fn(async () => {}),
            goBack: vi.fn(async () => {}),
            saveProgress: vi.fn(async () => {}),
            handleDesktopToggle: vi.fn(async () => {}),
            retryPrerequisites: vi.fn(),
            refreshGithubStatus: vi.fn(),
            startGithubConnect: vi.fn(async () => {}),
            setSettingsForm: vi.fn(),
            setAppCredForm: vi.fn(),
        },
    }),
}))

// Simplified Select implementation for predictable testing.
vi.mock('@/components/ui/select', () => {
    const SelectContext = React.createContext<{
        value?: string
        onChange?: (value: string) => void
    }>({})

    const Select = ({
        value,
        onValueChange,
        children,
    }: {
        value?: string
        onValueChange?: (value: string) => void
        children: React.ReactNode
    }) => (
        <SelectContext.Provider value={{value, onChange: onValueChange}}>
            <div data-slot="select">{children}</div>
        </SelectContext.Provider>
    )

    const SelectTrigger = ({
        children,
        ...props
    }: React.ComponentPropsWithoutRef<'button'>) => (
        <button type="button" data-slot="select-trigger" {...props}>
            {children}
        </button>
    )

    const SelectValue = ({placeholder}: {placeholder?: string}) => (
        <span>{placeholder}</span>
    )

    const SelectContent = ({children}: {children: React.ReactNode}) => (
        <div data-slot="select-content">{children}</div>
    )

    const SelectItem = ({
        value,
        children,
    }: {
        value: string
        children: React.ReactNode
    }) => {
        const ctx = React.useContext(SelectContext)
        const selected = ctx.value === value
        return (
            <button
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => ctx.onChange?.(value)}
            >
                {children}
            </button>
        )
    }

    return {Select, SelectTrigger, SelectValue, SelectContent, SelectItem}
})

function renderWithQueryClient(ui: React.ReactElement) {
    const client = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: 0,
                staleTime: 0,
            },
        },
    })

    return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

function expectUnifiedHeader(title: string) {
    const header = screen.getByTestId('page-header')
    expect(header.getAttribute('data-component')).toBe('PageHeader')
    expect(header.className).toContain('border-b')
    expect(header.className).toContain('bg-card/60')
    expect(screen.getByRole('heading', {level: 1, name: title})).toBeTruthy()
}

describe('Page headers are unified across pages', () => {
    beforeEach(() => {
        cleanup()
        vi.clearAllMocks()

        hooksMocks.useDashboardOverview.mockReturnValue({
            data: undefined,
            isLoading: false,
            isFetching: false,
            isError: false,
        })
        hooksMocks.useDashboardStream.mockReturnValue({status: 'idle'})
        hooksMocks.useGithubAuthStatus.mockReturnValue({
            data: {status: 'valid', account: {username: 'dev'}},
            isLoading: false,
        })
        hooksMocks.useAgents.mockReturnValue({
            data: {agents: []},
            isLoading: false,
        })

        hooksMocks.useProject.mockReturnValue({
            data: {id: 'proj-1', name: 'Project Alpha', boardId: 'board-1'},
            isLoading: false,
            isError: false,
            error: null,
        })
        hooksMocks.useBoardState.mockReturnValue({
            data: {columns: {}, cards: {}},
            isLoading: false,
        })
        hooksMocks.useTicketEnhancementQueue.mockReturnValue({
            enhancements: {},
            startEnhancementForNewCard: vi.fn(async () => {}),
            startEnhancementForExistingCard: vi.fn(async () => {}),
            clearEnhancement: vi.fn(),
        })
        hooksMocks.useCreateCard.mockReturnValue({mutateAsync: vi.fn(), isPending: false})
        hooksMocks.useUpdateCard.mockReturnValue({mutateAsync: vi.fn(), isPending: false})
        hooksMocks.useDeleteCard.mockReturnValue({mutateAsync: vi.fn(), isPending: false})
        hooksMocks.useMoveCard.mockReturnValue({mutateAsync: vi.fn(), isPending: false})

        hooksMocks.useAppSettings.mockReturnValue({data: null, isLoading: false})
        hooksMocks.useEditorSuggestions.mockReturnValue({data: []})
        hooksMocks.useValidateEditorPath.mockReturnValue({mutate: vi.fn(), isPending: false})
        hooksMocks.useGithubAppConfig.mockReturnValue({data: undefined})
        hooksMocks.useSaveGithubAppConfig.mockReturnValue({mutate: vi.fn(), isPending: false})
        hooksMocks.useUpdateAppSettings.mockReturnValue({mutate: vi.fn(), isPending: false})

        hooksMocks.useAgentSchema.mockReturnValue({data: undefined})
        hooksMocks.useAgentProfiles.mockReturnValue({data: []})
        hooksMocks.useCreateAgentProfile.mockReturnValue({mutate: vi.fn(), isPending: false})
        hooksMocks.useUpdateAgentProfile.mockReturnValue({mutate: vi.fn(), isPending: false})
        hooksMocks.useDeleteAgentProfile.mockReturnValue({mutate: vi.fn(), isPending: false})

        hooksMocks.useAttempt.mockReturnValue({
            data: {
                id: '12345678abcdef',
                status: 'running',
                boardId: 'board-1',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                agent: 'CODEX',
                cardId: 'card-1',
            },
            isLoading: false,
            isError: false,
        })
        hooksMocks.useAttemptLogs.mockReturnValue({
            data: [],
            isLoading: false,
            isError: false,
        })
        hooksMocks.useRelativeTimeFormatter.mockReturnValue(() => 'just now')
    })

    it('Projects page header is unified', () => {
        render(
            <ProjectsLanding
                projects={[]}
                onSelect={() => {}}
                onCreate={() => {}}
                onEdit={() => {}}
                onDelete={() => {}}
            />,
        )

        expectUnifiedHeader('Projects')
    })

    it('Dashboard page header is unified', () => {
        renderWithQueryClient(
            <MemoryRouter>
                <DashboardPage/>
            </MemoryRouter>,
        )

        expectUnifiedHeader('Mission Control')
    })

    it('Board page header is unified', () => {
        renderWithQueryClient(
            <MemoryRouter initialEntries={['/projects/proj-1']}>
                <Routes>
                    <Route path="/projects/:projectId" element={<ProjectBoardPage/>}/>
                </Routes>
            </MemoryRouter>,
        )

        expectUnifiedHeader('Project Alpha')
    })

    it('Settings page header is unified', () => {
        render(<AppSettingsPage/>)

        expectUnifiedHeader('Application Settings')
    })

    it('Agents page header is unified', () => {
        renderWithQueryClient(
            <MemoryRouter initialEntries={['/agents']}>
                <Routes>
                    <Route path="/agents" element={<AgentsPage/>}/>
                </Routes>
            </MemoryRouter>,
        )

        expectUnifiedHeader('Agents')
    })

    it('Attempt detail page header is unified', () => {
        render(
            <MemoryRouter initialEntries={['/attempts/12345678abcdef']}>
                <Routes>
                    <Route path="/attempts/:attemptId" element={<AttemptDetailPage/>}/>
                </Routes>
            </MemoryRouter>,
        )

        expectUnifiedHeader('Attempt 12345678')
    })

    it('Onboarding page header is unified', () => {
        render(
            <MemoryRouter initialEntries={['/onboarding']}>
                <Routes>
                    <Route path="/onboarding" element={<OnboardingPage/>}/>
                </Routes>
            </MemoryRouter>,
        )

        expectUnifiedHeader('Welcome')
    })
})
