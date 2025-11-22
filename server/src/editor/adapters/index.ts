import {vsCodeAdapter} from './vscode'
import {webStormAdapter} from './webstorm'
import {zedAdapter} from './zed'

export const PATH_EXT = '/usr/local/bin:/usr/bin:/bin:/snap/bin:/var/lib/snapd/snap/bin'

export const adapters = [vsCodeAdapter, webStormAdapter, zedAdapter]

export type {EditorAdapter} from '../types'
