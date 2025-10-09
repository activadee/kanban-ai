#!/usr/bin/env node

const dependenciesJson = process.env.UPDATED_DEPENDENCIES_JSON;
const minReleaseAgeDays = Number.parseInt(process.env.MIN_RELEASE_AGE_DAYS || '3', 10);
const registryBaseUrl = (process.env.NPM_REGISTRY_URL || 'https://registry.npmjs.org').replace(/\/$/, '');
const registryAuthToken = process.env.NPM_REGISTRY_TOKEN || process.env.NODE_AUTH_TOKEN;

if (!dependenciesJson) {
    console.log('No updated dependencies metadata provided; skipping age verification.');
    process.exit(0);
}

let dependencies;
try {
    dependencies = JSON.parse(dependenciesJson);
} catch (error) {
    console.error('Unable to parse Dependabot metadata payload:', error);
    process.exit(1);
}

if (!Array.isArray(dependencies) || dependencies.length === 0) {
    console.log('Metadata does not include dependency entries; nothing to check.');
    process.exit(0);
}

const now = new Date();
const failures = [];

const packagesToCheck = new Map();

for (const dependency of dependencies) {
    const name = dependency?.dependencyName;
    const ecosystem = dependency?.packageEcosystem ?? '';
    const version = dependency?.newVersion;

    if (!name || !version) {
        continue;
    }

    if (ecosystem && ecosystem !== 'npm' && ecosystem !== 'yarn' && ecosystem !== 'pnpm') {
        console.log(`Skipping ${name}@${version} from unsupported ecosystem '${ecosystem}'.`);
        continue;
    }

    if (!packagesToCheck.has(name)) {
        packagesToCheck.set(name, new Set());
    }

    packagesToCheck.get(name).add(version);
}

if (packagesToCheck.size === 0) {
    console.log('No npm dependencies require release age verification.');
    process.exit(0);
}

async function fetchReleaseTimestamps(packageName) {
    const encodedName = encodeURIComponent(packageName);
    const response = await fetch(`${registryBaseUrl}/${encodedName}`, {
        headers: {
            accept: 'application/vnd.npm.install-v1+json',
            ...(registryAuthToken ? {authorization: `Bearer ${registryAuthToken}`} : {}),
        },
    });

    if (!response.ok) {
        throw new Error(`registry responded with ${response.status} ${response.statusText}`);
    }

    const body = await response.json();
    const timestamps = body?.time;

    if (!timestamps || typeof timestamps !== 'object') {
        throw new Error('registry response did not include release timestamps');
    }

    return timestamps;
}

async function verifyDependencies() {
    for (const [name, versions] of packagesToCheck) {
        let timestamps;
        try {
            timestamps = await fetchReleaseTimestamps(name);
        } catch (error) {
            for (const version of versions) {
                failures.push(`Unable to retrieve release information for ${name}@${version}: ${error.message}`);
            }
            continue;
        }

        for (const version of versions) {
            const timestamp = timestamps?.[version];
            if (!timestamp) {
                failures.push(`Release timestamp for ${name}@${version} was not found.`);
                continue;
            }

            const releasedAt = new Date(timestamp);
            if (Number.isNaN(releasedAt.valueOf())) {
                failures.push(`Release timestamp for ${name}@${version} is invalid: ${timestamp}`);
                continue;
            }

            const ageMs = now.getTime() - releasedAt.getTime();
            const ageDays = ageMs / (1000 * 60 * 60 * 24);

            console.log(`${name}@${version} was released ${ageDays.toFixed(2)} days ago.`);

            if (ageDays < minReleaseAgeDays) {
                failures.push(`${name}@${version} is only ${ageDays.toFixed(2)} days old (minimum required: ${minReleaseAgeDays}).`);
            }
        }
    }

    if (failures.length > 0) {
        console.error('Dependency age verification failed:');
        for (const message of failures) {
            console.error(` - ${message}`);
        }
        process.exit(1);
    }

    console.log(`All dependencies satisfy the minimum release age of ${minReleaseAgeDays} days.`);
}

try {
    await verifyDependencies();
} catch (error) {
    console.error('Unexpected error verifying dependency release age:', error);
    process.exit(1);
}
