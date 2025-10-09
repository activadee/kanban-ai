import {z} from 'zod'
import type {AgentInfo} from './types'
import type {AgentProfileField, AgentProfileSchemaResponse} from 'shared'

function titleCase(key: string): string {
    return key
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase())
        .trim()
}

function unwrap(schema: z.ZodTypeAny) {
    let current: z.ZodTypeAny = schema
    let optional = false
    let nullable = false
    while (true) {
        if (current instanceof z.ZodOptional) {
            optional = true
            current = current._def.innerType as z.ZodTypeAny
            continue
        }
        if (current instanceof z.ZodNullable) {
            nullable = true
            current = current._def.innerType as z.ZodTypeAny
            continue
        }
        if (current instanceof z.ZodDefault) {
            optional = true
            current = current._def.innerType as z.ZodTypeAny
            continue
        }
        break
    }
    return {schema: current, optional, nullable}
}

function toField(key: string, schema: z.ZodTypeAny): AgentProfileField | null {
    const {schema: inner, optional, nullable} = unwrap(schema)
    const base = {
        key,
        label: titleCase(key),
        optional,
        nullable,
        description: inner.description ?? null,
    }

    if (inner instanceof z.ZodString) {
        return {...base, type: 'string'}
    }
    if (inner instanceof z.ZodBoolean) {
        return {...base, type: 'boolean'}
    }
    if (inner instanceof z.ZodEnum) {
        const options = inner.options.map((v) => String(v))
        return {...base, type: 'enum', options}
    }
    if (inner instanceof z.ZodArray) {
        const element = unwrap(inner._def.type as unknown as z.ZodTypeAny)
        if (element.schema instanceof z.ZodString) {
            return {...base, type: 'string_array'}
        }
    }
    return null
}

export function buildAgentProfileSchema(agent: AgentInfo): AgentProfileSchemaResponse {
    const schema = agent.profileSchema
    if (!(schema instanceof z.ZodObject)) {
        throw new Error('Agent profile schema must be a Zod object')
    }
    const fields: AgentProfileField[] = []
    const shape = schema.shape
    for (const [key, fieldSchema] of Object.entries(shape)) {
        const field = toField(key, fieldSchema as z.ZodTypeAny)
        if (field) fields.push(field)
    }

    return {
        agent: agent.key,
        label: agent.label,
        defaultProfile: agent.defaultProfile,
        fields,
    }
}
