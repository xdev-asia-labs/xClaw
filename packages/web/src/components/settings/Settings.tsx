// ============================================================
// Settings - Agent configuration page
// ============================================================

import React, { useEffect, useState } from 'react';
import { api } from '@/utils/api';
import { Card, Button, Spinner, PageHeader, Input, Textarea, Select } from '@/components/ui';
import { Settings as SettingsIcon, Save } from 'lucide-react';

interface AgentConfig {
    name: string;
    persona: string;
    llm: {
        provider: string;
        model: string;
        apiKey: string;
        baseUrl: string;
        temperature: number;
    };
}

const DEFAULT_CONFIG: AgentConfig = {
    name: 'xClaw',
    persona: 'A helpful AI assistant',
    llm: { provider: 'openai', model: 'gpt-4o-mini', apiKey: '', baseUrl: '', temperature: 0.7 },
};

export function Settings() {
    const [config, setConfig] = useState<AgentConfig>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        api.getConfig()
            .then(res => setConfig({ ...DEFAULT_CONFIG, ...res }))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const save = async () => {
        setSaving(true);
        setStatus(null);
        try {
            await api.updateConfig(config);
            setStatus('Saved successfully');
        } catch (err: unknown) {
            setStatus(`Error: ${err instanceof Error ? err.message : 'Failed to save'}`);
        } finally {
            setSaving(false);
        }
    };

    const updateLLM = (key: string, value: unknown) => {
        setConfig(c => ({ ...c, llm: { ...c.llm, [key]: value } }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Spinner size={28} />
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto">
                <PageHeader title="Settings" icon={SettingsIcon} subtitle="Agent configuration" />

                <div className="space-y-6 mt-6">
                    {/* Agent Basics */}
                    <Card>
                        <h2 className="text-sm font-semibold text-slate-300 mb-4">Agent Profile</h2>
                        <div className="space-y-4">
                            <Input
                                label="Agent Name"
                                value={config.name}
                                onChange={e => setConfig(c => ({ ...c, name: e.target.value }))}
                            />
                            <Textarea
                                label="Persona / System Prompt"
                                value={config.persona}
                                onChange={e => setConfig(c => ({ ...c, persona: e.target.value }))}
                                rows={4}
                                placeholder="Describe how the agent should behave..."
                            />
                        </div>
                    </Card>

                    {/* LLM Configuration */}
                    <Card>
                        <h2 className="text-sm font-semibold text-slate-300 mb-4">LLM Configuration</h2>
                        <div className="space-y-4">
                            <Select
                                label="Provider"
                                value={config.llm.provider}
                                onChange={e => updateLLM('provider', e.target.value)}
                                options={[
                                    { value: 'openai', label: 'OpenAI' },
                                    { value: 'anthropic', label: 'Anthropic (Claude)' },
                                    { value: 'ollama', label: 'Ollama (Local)' },
                                ]}
                            />
                            <Input
                                label="Model"
                                value={config.llm.model}
                                onChange={e => updateLLM('model', e.target.value)}
                                placeholder="gpt-4o-mini, claude-3-haiku, llama3..."
                            />
                            <Input
                                label="API Key"
                                type="password"
                                value={config.llm.apiKey}
                                onChange={e => updateLLM('apiKey', e.target.value)}
                                placeholder="sk-..."
                            />
                            {config.llm.provider === 'ollama' && (
                                <Input
                                    label="Base URL"
                                    value={config.llm.baseUrl}
                                    onChange={e => updateLLM('baseUrl', e.target.value)}
                                    placeholder="http://localhost:11434/v1"
                                />
                            )}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Temperature</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="range"
                                        min={0}
                                        max={2}
                                        step={0.1}
                                        value={config.llm.temperature}
                                        onChange={e => updateLLM('temperature', parseFloat(e.target.value))}
                                        className="flex-1"
                                    />
                                    <span className="text-sm text-slate-300 w-8 text-right">
                                        {config.llm.temperature}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Save */}
                    <div className="flex items-center gap-3">
                        <Button onClick={save} loading={saving} icon={Save}>
                            Save Settings
                        </Button>
                        {status && (
                            <span className={`text-sm ${status.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>
                                {status}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
