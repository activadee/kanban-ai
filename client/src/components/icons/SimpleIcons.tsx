import type {ComponentProps} from 'react'
import {SiGithub} from '@icons-pack/react-simple-icons'

type SimpleIconProps = ComponentProps<typeof SiGithub>

export function GitHubIcon({title, ...props}: SimpleIconProps) {
    return <SiGithub title={title} {...props}/>
}

export type {SimpleIconProps}
