// ============================================================
// @xclaw/chat-sdk/mcp — MCP Server for xClaw Chat SDK
// ============================================================
//
// Exposes xClaw Chat SDK as MCP tools so any AI agent (Claude,
// Copilot, etc.) can interact with xClaw programmatically.
//
// Usage:
//   XCLAW_BASE_URL=https://api.xclaw.io XCLAW_TOKEN=... npx @xclaw/chat-sdk mcp
//
//   Or in MCP config:
//   { "command": "npx", "args": ["@xclaw/chat-sdk", "mcp"], "env": { ... } }
//

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { XClawClient } from '../client.js';
import type { StreamEvent } from '../types.js';

export function createMcpServer(client: XClawClient): McpServer {
    const server = new McpServer({
        name: 'xclaw-chat-sdk',
        version: '1.0.0',
    });

    // ─── Tool: chat ─────────────────────────────────────────
    server.tool(
        'xclaw_chat',
        'Send a message to xClaw AI agent and get a response. Supports domain specialization and web search.',
        {
            message: z.string().describe('The message to send to the AI agent'),
            sessionId: z.string().optional().describe('Session ID for conversation continuity. Omit to auto-generate.'),
            domainId: z.string().optional().describe('Domain specialization (e.g., "healthcare", "developer", "finance")'),
            webSearch: z.boolean().optional().describe('Enable web search for real-time information'),
        },
        async ({ message, sessionId, domainId, webSearch }) => {
            const res = await client.chat(message, { sessionId, domainId, webSearch });
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: JSON.stringify({
                            sessionId: res.sessionId,
                            response: res.content,
                            usage: res.usage,
                        }, null, 2),
                    },
                ],
            };
        },
    );

    // ─── Tool: chat_stream ──────────────────────────────────
    server.tool(
        'xclaw_chat_stream',
        'Send a message with streaming response. Returns the complete response after streaming finishes.',
        {
            message: z.string().describe('The message to send'),
            sessionId: z.string().optional().describe('Session ID'),
            domainId: z.string().optional().describe('Domain specialization'),
            webSearch: z.boolean().optional().describe('Enable web search'),
        },
        async ({ message, sessionId, domainId, webSearch }) => {
            const events: StreamEvent[] = [];
            const handle = client.chatStream(message, {
                onMeta: (key, data) => events.push({ type: 'meta', key, data }),
                onError: (error) => events.push({ type: 'error', error }),
            }, { sessionId, domainId, webSearch });

            const fullText = await handle.done;
            const allEvents = await handle.events;
            const finishEvent = allEvents.find(e => e.type === 'finish');

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: JSON.stringify({
                            response: fullText,
                            usage: finishEvent?.type === 'finish' ? finishEvent.usage : undefined,
                            toolCalls: allEvents
                                .filter(e => e.type === 'tool-call-start')
                                .map(e => e.type === 'tool-call-start' ? e.toolName : ''),
                            meta: Object.fromEntries(
                                allEvents
                                    .filter((e): e is Extract<StreamEvent, { type: 'meta' }> => e.type === 'meta')
                                    .map(e => [e.key, e.data]),
                            ),
                        }, null, 2),
                    },
                ],
            };
        },
    );

    // ─── Tool: list_sessions ────────────────────────────────
    server.tool(
        'xclaw_list_sessions',
        'List all chat sessions for the authenticated user.',
        {},
        async () => {
            const res = await client.listSessions();
            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify(res, null, 2),
                }],
            };
        },
    );

    // ─── Tool: get_messages ─────────────────────────────────
    server.tool(
        'xclaw_get_messages',
        'Get all messages in a specific chat session.',
        {
            sessionId: z.string().describe('The session ID to retrieve messages for'),
        },
        async ({ sessionId }) => {
            const res = await client.getMessages(sessionId);
            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify(res.messages, null, 2),
                }],
            };
        },
    );

    // ─── Tool: delete_session ───────────────────────────────
    server.tool(
        'xclaw_delete_session',
        'Delete a chat session and all its messages.',
        {
            sessionId: z.string().describe('The session ID to delete'),
        },
        async ({ sessionId }) => {
            await client.deleteSession(sessionId);
            return {
                content: [{
                    type: 'text' as const,
                    text: `Session ${sessionId} deleted successfully.`,
                }],
            };
        },
    );

    // ─── Tool: feedback ─────────────────────────────────────
    server.tool(
        'xclaw_feedback',
        'Submit a correction/feedback for an AI response to improve future answers (self-learning).',
        {
            originalQuestion: z.string().describe('The original user question'),
            aiAnswer: z.string().describe('The AI answer to give feedback on'),
            feedback: z.enum(['positive', 'negative']).describe('Whether the answer was good or bad'),
            correction: z.string().optional().describe('The correct answer (for negative feedback)'),
        },
        async ({ originalQuestion, aiAnswer, feedback, correction }) => {
            await client.feedback({ originalQuestion, aiAnswer, feedback: feedback as 'positive' | 'negative', correction });
            return {
                content: [{
                    type: 'text' as const,
                    text: 'Feedback submitted successfully. The AI will learn from this correction.',
                }],
            };
        },
    );

    // ─── Tool: login ────────────────────────────────────────
    server.tool(
        'xclaw_login',
        'Authenticate with xClaw server and get an access token.',
        {
            email: z.string().email().describe('User email'),
            password: z.string().describe('User password'),
        },
        async ({ email, password }) => {
            const res = await client.login({ email, password });
            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        message: 'Login successful',
                        user: res.user,
                        note: 'Token has been stored in the client. You can now use other tools.',
                    }, null, 2),
                }],
            };
        },
    );

    // ─── Resource: SDK Documentation ────────────────────────
    server.resource(
        'sdk-docs',
        'xclaw://docs/chat-sdk',
        async () => ({
            contents: [{
                uri: 'xclaw://docs/chat-sdk',
                mimeType: 'text/markdown',
                text: SDK_DOCS,
            }],
        }),
    );

    return server;
}

const SDK_DOCS = `# @xclaw/chat-sdk — API Reference

## Available MCP Tools

### xclaw_chat
Send a message and get a complete response.
- \`message\` (required): The user message
- \`sessionId\` (optional): For conversation continuity
- \`domainId\` (optional): Domain specialization (healthcare, developer, finance, etc.)
- \`webSearch\` (optional): Enable real-time web search

### xclaw_chat_stream
Send a message with streaming. Returns complete response after stream finishes.
Same parameters as xclaw_chat.

### xclaw_list_sessions
List all chat sessions. No parameters.

### xclaw_get_messages
Get messages in a session.
- \`sessionId\` (required): Session ID

### xclaw_delete_session
Delete a session.
- \`sessionId\` (required): Session ID

### xclaw_feedback
Submit correction feedback for AI self-learning.
- \`messageId\`, \`correction\`, \`sessionId\` (all required)

### xclaw_login
Authenticate with credentials.
- \`email\`, \`password\` (required)

## Domains
Available domains: general, developer, healthcare, finance, legal, education,
marketing, hr, customer-service, devops, data-analyst, creative

## Chat Protocol
- SSE streaming with event types: text-delta, tool-call-start/args/end, tool-result, meta, finish, error
- Sessions persist conversation history
- RAG context automatically included when relevant knowledge base entries exist
`;

export { createMcpServer as default };
