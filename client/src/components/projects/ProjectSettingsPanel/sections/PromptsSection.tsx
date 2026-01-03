import {Label} from '@/components/ui/label'
import {Textarea} from '@/components/ui/textarea'
import {Sparkles, FileText} from 'lucide-react'

type PromptsSectionProps = {
    enhancePrompt: string;
    prSummaryPrompt: string;
    onChange: (patch: Partial<{
        enhancePrompt: string;
        prSummaryPrompt: string;
    }>) => void;
}

const MAX_PROMPT_LENGTH = 4000

const ENHANCE_PLACEHOLDER = `You are a ticket generator for a software project.

Analyze the repository to understand:
- Project structure and tech stack
- Naming conventions and patterns
- Commit message style

Write tickets that align with the project's conventions.`

const PR_SUMMARY_PLACEHOLDER = `You are a pull request generator for a software project.

Focus on:
- Summarizing the key changes
- Explaining the motivation
- Highlighting any breaking changes`

export function PromptsSection({
    enhancePrompt,
    prSummaryPrompt,
    onChange,
}: PromptsSectionProps) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div>
                    <h3 className="text-sm font-medium">Custom Prompts</h3>
                    <p className="text-xs text-muted-foreground">
                        Override the default prompts for ticket enhancement and PR summaries
                    </p>
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-muted-foreground" />
                            <Label htmlFor="enhance-prompt" className="text-sm font-medium">
                                Ticket Enhancement Prompt
                            </Label>
                        </div>
                        <span className={`text-xs ${enhancePrompt.length > MAX_PROMPT_LENGTH * 0.9 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                            {enhancePrompt.length}/{MAX_PROMPT_LENGTH}
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Custom system prompt for enhancing tickets. Leave empty to use the default.
                    </p>
                    <Textarea
                        id="enhance-prompt"
                        placeholder={ENHANCE_PLACEHOLDER}
                        className="min-h-[200px] resize-y font-mono text-xs leading-relaxed"
                        value={enhancePrompt}
                        maxLength={MAX_PROMPT_LENGTH}
                        onChange={(e) => onChange({enhancePrompt: e.target.value})}
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <Label htmlFor="pr-summary-prompt" className="text-sm font-medium">
                                PR Summary Prompt
                            </Label>
                        </div>
                        <span className={`text-xs ${prSummaryPrompt.length > MAX_PROMPT_LENGTH * 0.9 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                            {prSummaryPrompt.length}/{MAX_PROMPT_LENGTH}
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Custom system prompt for generating PR summaries. Leave empty to use the default.
                    </p>
                    <Textarea
                        id="pr-summary-prompt"
                        placeholder={PR_SUMMARY_PLACEHOLDER}
                        className="min-h-[200px] resize-y font-mono text-xs leading-relaxed"
                        value={prSummaryPrompt}
                        maxLength={MAX_PROMPT_LENGTH}
                        onChange={(e) => onChange({prSummaryPrompt: e.target.value})}
                    />
                </div>
            </div>

            <div className="rounded-lg border border-border/30 bg-muted/10 p-4">
                <p className="text-xs leading-relaxed text-muted-foreground">
                    <strong className="font-medium text-foreground">How it works:</strong>{' '}
                    Custom prompts replace the default instructions. The input context (ticket info, diff summary, etc.)
                    and output format requirements are automatically appended to ensure correct formatting.
                    Profile append prompts still apply on top.
                </p>
            </div>
        </div>
    )
}
