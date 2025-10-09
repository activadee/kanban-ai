export type CodexEnvelope = {
    msg?: { type?: string; [k: string]: unknown }
    prompt?: string
    model?: string
    sandbox?: string
    provider?: string
    [k: string]: unknown
}

export type MsgType =
    | 'agent_message'
    | 'agent_reasoning'
    | 'agent_reasoning_section_break'
    | 'agent_reasoning_section_title'
    | 'agent_reasoning_summary'
    | 'agent_reasoning_raw_content'
    | 'agent_reasoning_raw_content_delta'
    | 'exec_command_begin'
    | 'exec_command_output_delta'
    | 'exec_command_end'
    | 'mcp_tool_call_begin'
    | 'mcp_tool_call_end'
    | 'error'
    | 'task_started'
    | 'task_complete'
    | 'token_count'
    // Newer Codex JSONL envelope lines
    | 'session_meta'
    | 'response_item'
    | 'event_msg'

export function isCodexEnvelope(obj: unknown): obj is CodexEnvelope {
    return !!obj && typeof obj === 'object'
}
