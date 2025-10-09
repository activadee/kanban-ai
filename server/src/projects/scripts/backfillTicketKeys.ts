import {projectTickets} from 'core'

async function main() {
    const targetProjectId = process.argv[2]
    const result = await projectTickets.backfillTicketKeys(targetProjectId)
    console.log(`Backfilled ${result.updated} tickets across ${result.projects} project(s).`)
}

main().then(() => {
    process.exit(0)
}).catch((error) => {
    console.error('[backfillTicketKeys] failed', error)
    process.exit(1)
})
