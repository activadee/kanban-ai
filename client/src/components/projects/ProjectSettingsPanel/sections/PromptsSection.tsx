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
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor="enhance-prompt" className="text-sm font-medium">
                            Ticket Enhancement Prompt
                        </Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Custom system prompt for enhancing tickets. Leave empty to use the default.
                    </p>
                    <Textarea
                        id="enhance-prompt"
                        placeholder="You are a ticket generator for a software project..."
                        className="min-h-[200px] resize-y font-mono text-xs leading-relaxed"
                        value={enhancePrompt}
                        onChange={(e) => onChange({enhancePrompt: e.target.value})}
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor="pr-summary-prompt" className="text-sm font-medium">
                            PR Summary Prompt
                        </Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Custom system prompt for generating PR titles and descriptions. Leave empty to use the default.
                    </p>
                    <Textarea
                        id="pr-summary-prompt"
                        placeholder="You are a pull request generator for a software project..."
                        className="min-h-[200px] resize-y font-mono text-xs leading-relaxed"
                        value={prSummaryPrompt}
                        onChange={(e) => onChange({prSummaryPrompt: e.target.value})}
                    />
                </div>
            </div>

            <div className="rounded-lg border border-border/30 bg-muted/10 p-4">
                <p className="text-xs leading-relaxed text-muted-foreground">
                    <strong className="font-medium text-foreground">Note:</strong>{' '}
                    Custom prompts replace the default system prompt. The ticket/PR context (title, description, diff, etc.)
                    will be automatically appended to your custom prompt. Profile append prompts still apply on top.
                </p>
            </div>
        </div>
    )
}
