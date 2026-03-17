// ============================================================
// Custom Workflow Node component for React Flow
// ============================================================

import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { NODE_TYPES } from './nodeTypes';
import { useWorkflowStore } from '@/stores';

function WorkflowNodeComponent({ id, data, selected }: NodeProps) {
    const nodeConfig = NODE_TYPES.find(n => n.type === data.nodeType);
    const selectNode = useWorkflowStore(s => s.selectNode);
    const Icon = nodeConfig?.icon;

    return (
        <div
            className={`workflow-node rounded-lg border-2 ${nodeConfig?.borderColor ?? 'border-slate-500'} ${nodeConfig?.color ?? 'bg-slate-800'} backdrop-blur-sm min-w-[180px] cursor-pointer ${selected ? 'selected' : ''}`}
            onClick={() => selectNode(id)}
        >
            {/* Input handle */}
            {data.nodeType !== 'trigger' && (
                <Handle
                    type="target"
                    position={Position.Top}
                    className="!bg-blue-500 !w-3 !h-3 !border-2 !border-dark-900"
                />
            )}

            {/* Node content */}
            <div className="px-3 py-2">
                <div className="flex items-center gap-2 mb-1">
                    {Icon && <Icon size={16} className="text-slate-300 flex-shrink-0" />}
                    <span className="font-semibold text-sm text-white truncate">
                        {(data.label as string) || nodeConfig?.label || 'Node'}
                    </span>
                </div>
                {data.description ? (
                    <p className="text-xs text-slate-400 truncate">{String(data.description)}</p>
                ) : null}
            </div>

            {/* Output handle */}
            {data.nodeType !== 'output' && (
                <Handle
                    type="source"
                    position={Position.Bottom}
                    className="!bg-blue-500 !w-3 !h-3 !border-2 !border-dark-900"
                />
            )}

            {/* Condition node: two outputs */}
            {data.nodeType === 'condition' && (
                <>
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="true"
                        className="!bg-green-500 !w-3 !h-3 !border-2 !border-dark-900"
                        style={{ left: '30%' }}
                    />
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="false"
                        className="!bg-red-500 !w-3 !h-3 !border-2 !border-dark-900"
                        style={{ left: '70%' }}
                    />
                </>
            )}
        </div>
    );
}

export const WorkflowNode = memo(WorkflowNodeComponent);
