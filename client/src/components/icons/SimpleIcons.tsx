import type { ComponentProps } from 'react'
import { SiGithub } from '@icons-pack/react-simple-icons'

type SimpleIconProps = ComponentProps<typeof SiGithub>

export function GitHubIcon({ title, color = 'currentColor', ...props }: SimpleIconProps) {
    return <SiGithub title={title} color={color} {...props} />
}

export type { SimpleIconProps }
