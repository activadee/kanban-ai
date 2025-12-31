import {createHandlers} from '../lib/factory'
import {getAppVersionInfo} from './service'

export const getVersionHandlers = createHandlers(async (c) => {
    const version = await getAppVersionInfo()
    return c.json(version)
})
