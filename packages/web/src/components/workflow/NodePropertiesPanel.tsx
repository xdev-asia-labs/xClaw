// ============================================================
// Node Properties Panel - Edit selected node config
// ============================================================

import React from 'react';
import { useWorkflowStore } from '@/stores';
import { NODE_TYPES } from './nodeTypes';
import { X, Trash2 } from 'lucide-react';

export function NodePropertiesPanel() {
    const selectedNodeId = useWorkflowStore(s => s.selectedNodeId);
    const nodes = useWorkflowStore(s => s.nodes);
    const updateNode = useWorkflowStore(s => s.updateNode);
    const removeNode = useWorkflowStore(s => s.removeNode);
    const selectNode = useWorkflowStore(s => s.selectNode);

    const node = nodes.find(n => n.id === selectedNodeId);
    if (!node) return null;

    const nodeType = NODE_TYPES.find(n => n.type === node.data.nodeType);
    const config = node.data.config;

    const updateConfig = (key: string, value: unknown) => {
        updateNode(node.id, { config: { ...config, [key]: value } });
    };

    return (
        <div className="w-80 bg-dark-900 border-l border-dark-700 flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-dark-700">
                <div className="flex items-center gap-2">
                    {nodeType && <nodeType.icon size={16} className="text-slate-300" />}
                    <span className="font-semibold text-sm text-white">{nodeType?.label}</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => { removeNode(node.id); }}
                        className="p-1 hover:bg-red-500/20 rounded text-red-400"
                        title="Delete node"
                    >
                        <Trash2 size={14} />
                    </button>
                    <button
                        onClick={() => selectNode(null)}
                        className="p-1 hover:bg-dark-700 rounded text-slate-400"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Properties */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {/* Label */}
                <Field label="Label">
                    <input
                        type="text"
                        value={(node.data.label as string) || ''}
                        onChange={e => updateNode(node.id, { label: e.target.value })}
                        className="input-field"
                    />
                </Field>

                <Field label="Description">
                    <input
                        type="text"
                        value={(node.data.description as string) || ''}
                        onChange={e => updateNode(node.id, { description: e.target.value })}
                        className="input-field"
                    />
                </Field>

                <hr className="border-dark-700" />

                {/* Type-specific config fields */}
                {node.data.nodeType === 'llm-call' && (
                    <>
                        <Field label="System Prompt">
                            <textarea
                                value={(config.systemPrompt as string) || ''}
                                onChange={e => updateConfig('systemPrompt', e.target.value)}
                                className="input-field h-20 resize-y"
                                placeholder="Optional system instruction..."
                            />
                        </Field>
                        <Field label="Prompt Template">
                            <textarea
                                value={(config.prompt as string) || ''}
                                onChange={e => updateConfig('prompt', e.target.value)}
                                className="input-field h-32 resize-y"
                                placeholder="Use {{variable}} for dynamic values..."
                            />
                        </Field>
                    </>
                )}

                {node.data.nodeType === 'tool-call' && (
                    <>
                        <Field label="Tool Name">
                            <input
                                type="text"
                                value={(config.toolName as string) || ''}
                                onChange={e => updateConfig('toolName', e.target.value)}
                                className="input-field"
                                placeholder="e.g. shell_exec, symptom_analyze"
                            />
                        </Field>
                        <Field label="Arguments (JSON)">
                            <textarea
                                value={typeof config.arguments === 'string' ? config.arguments : JSON.stringify(config.arguments || {}, null, 2)}
                                onChange={e => {
                                    try { updateConfig('arguments', JSON.parse(e.target.value)); }
                                    catch { updateConfig('arguments', e.target.value); }
                                }}
                                className="input-field h-32 resize-y font-mono text-xs"
                                placeholder='{"key": "{{variable}}"}'
                            />
                        </Field>
                    </>
                )}

                {node.data.nodeType === 'condition' && (
                    <Field label="Condition Expression">
                        <input
                            type="text"
                            value={(config.expression as string) || ''}
                            onChange={e => updateConfig('expression', e.target.value)}
                            className="input-field"
                            placeholder="e.g. status === 200"
                        />
                    </Field>
                )}

                {node.data.nodeType === 'http-request' && (
                    <>
                        <Field label="URL">
                            <input
                                type="text"
                                value={(config.url as string) || ''}
                                onChange={e => updateConfig('url', e.target.value)}
                                className="input-field"
                                placeholder="https://api.example.com/..."
                            />
                        </Field>
                        <Field label="Method">
                            <select
                                value={(config.method as string) || 'GET'}
                                onChange={e => updateConfig('method', e.target.value)}
                                className="input-field"
                            >
                                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m =>
                                    <option key={m} value={m}>{m}</option>
                                )}
                            </select>
                        </Field>
                        <Field label="Body">
                            <textarea
                                value={(config.body as string) || ''}
                                onChange={e => updateConfig('body', e.target.value)}
                                className="input-field h-24 resize-y font-mono text-xs"
                                placeholder="JSON body..."
                            />
                        </Field>
                    </>
                )}

                {node.data.nodeType === 'code' && (
                    <Field label="JavaScript Code">
                        <textarea
                            value={(config.code as string) || ''}
                            onChange={e => updateConfig('code', e.target.value)}
                            className="input-field h-40 resize-y font-mono text-xs"
                            placeholder="// Access inputs via `inputs`&#10;return { result: inputs.data };"
                        />
                    </Field>
                )}

                {node.data.nodeType === 'notification' && (
                    <>
                        <Field label="Message">
                            <textarea
                                value={(config.message as string) || ''}
                                onChange={e => updateConfig('message', e.target.value)}
                                className="input-field h-20 resize-y"
                                placeholder="Notification message... Use {{var}} for variables"
                            />
                        </Field>
                        <Field label="Channel">
                            <input
                                type="text"
                                value={(config.channel as string) || 'default'}
                                onChange={e => updateConfig('channel', e.target.value)}
                                className="input-field"
                            />
                        </Field>
                    </>
                )}

                {node.data.nodeType === 'wait' && (
                    <Field label="Wait (seconds)">
                        <input
                            type="number"
                            min={1}
                            value={(config.seconds as number) || 5}
                            onChange={e => updateConfig('seconds', parseInt(e.target.value) || 5)}
                            className="input-field"
                        />
                    </Field>
                )}

                {node.data.nodeType === 'trigger' && (
                    <Field label="Trigger Type">
                        <select
                            value={(config.triggerType as string) || 'manual'}
                            onChange={e => updateConfig('triggerType', e.target.value)}
                            className="input-field"
                        >
                            <option value="manual">Manual</option>
                            <option value="cron">Scheduled (Cron)</option>
                            <option value="webhook">Webhook</option>
                            <option value="message">Chat Message</option>
                            <option value="event">Event</option>
                        </select>
                    </Field>
                )}

                {(node.data.nodeType === 'memory-read' || node.data.nodeType === 'memory-write') && (
                    <Field label={node.data.nodeType === 'memory-read' ? 'Query' : 'Content'}>
                        <textarea
                            value={(config[node.data.nodeType === 'memory-read' ? 'query' : 'content'] as string) || ''}
                            onChange={e => updateConfig(
                                node.data.nodeType === 'memory-read' ? 'query' : 'content',
                                e.target.value
                            )}
                            className="input-field h-20 resize-y"
                        />
                    </Field>
                )}

                {node.data.nodeType === 'transform' && (
                    <Field label="Template">
                        <textarea
                            value={(config.template as string) || ''}
                            onChange={e => updateConfig('template', e.target.value)}
                            className="input-field h-24 resize-y font-mono text-xs"
                            placeholder="Use {{nodeId.outputName}} to reference data"
                        />
                    </Field>
                )}
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
            {children}
        </div>
    );
}

// Add this to index.css or a global style:
// .input-field { @apply w-full bg-dark-800 border border-dark-700 rounded-md px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500; }
