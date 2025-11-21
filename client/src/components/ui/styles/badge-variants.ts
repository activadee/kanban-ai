import {cva} from "class-variance-authority"

export const badgeVariants = cva(
    "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
    {
        variants: {
            variant: {
                default: "border-transparent bg-primary text-primary-foreground",
                secondary: "border-transparent bg-secondary text-secondary-foreground",
                outline: "text-foreground",
                destructive: "border-transparent bg-destructive text-white",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
)
