// ============================================================
// WorkflowCanvas - Main drag-and-drop React Flow canvas
// ============================================================

import React, { useCallback, useRef } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    useReactFlow,
    ReactFlowProvider,
    addEdge,
    type Connection,
    type OnNodesChange,
    type OnEdgesChange,
    applyNodeChanges,
    applyEdgeChanges,
    BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useWorkflowStore, type WFNode, type WFEdge } from '@/stores';
import { WorkflowNode } from './WorkflowNode';
import { NodePalette } from './NodePalette';
import { NodePropertiesPanel } from './NodePropertiesPanel';
import type { NodeTypeConfig } from './nodeTypes';

const nodeTypes = { custom: WorkflowNode };

let nodeId = 0;
const getId = () => `node_${Date.now()}_${++nodeId}`;

function Canvas() {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const { screenToFlowPosition } = useReactFlow();

    const nodes = useWorkflowStore(s => s.nodes);
    const edges = useWorkflowStore(s => s.edges);
    const setNodes = useWorkflowStore(s => s.setNodes);
    const setEdges = useWorkflowStore(s => s.setEdges);
    const addNodeStore = useWorkflowStore(s => s.addNode);
    const selectNode = useWorkflowStore(s => s.selectNode);
    const selectedNodeId = useWorkflowStore(s => s.selectedNodeId);

    const onNodesChange: OnNodesChange = useCallback(
        (changes) => {
            setNodes(applyNodeChanges(changes, nodes) as WFNode[]);
        },
        [nodes, setNodes]
    );

    const onEdgesChange: OnEdgesChange = useCallback(
        (changes) => {
            setEdges(applyEdgeChanges(changes, edges) as WFEdge[]);
        },
        [edges, setEdges]
    );

    const onConnect = useCallback(
        (params: Connection) => {
            setEdges(
                addEdge(
                    { ...params, animated: true, style: { stroke: '#475569' } },
                    edges
                ) as WFEdge[]
            );
        },
        [edges, setEdges]
    );

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const raw = event.dataTransfer.getData('application/xclaw-node');
            if (!raw) return;

            let nodeConfig: NodeTypeConfig;
            try {
                nodeConfig = JSON.parse(raw);
            } catch {
                return;
            }

            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            const newNode: WFNode = {
                id: getId(),
                type: 'custom',
                position,
                data: {
                    label: nodeConfig.label,
                    description: nodeConfig.description,
                    nodeType: nodeConfig.type,
                    config: { ...nodeConfig.defaultConfig },
                    color: nodeConfig.color,
                },
            };

            addNodeStore(newNode);
        },
        [screenToFlowPosition, addNodeStore]
    );

    const onPaneClick = useCallback(() => {
        selectNode(null);
    }, [selectNode]);

    return (
        <div className="flex flex-1 h-full overflow-hidden">
            <NodePalette />

            <div ref={reactFlowWrapper} className="flex-1 relative">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onPaneClick={onPaneClick}
                    nodeTypes={nodeTypes}
                    fitView
                    deleteKeyCode="Delete"
                    snapToGrid
                    snapGrid={[16, 16]}
                    className="bg-dark-950"
                >
                    <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#1e293b" />
                    <Controls className="!bg-dark-800 !border-dark-700 !rounded-lg" />
                    <MiniMap
                        nodeColor="#3b82f6"
                        maskColor="rgba(15, 23, 42, 0.8)"
                        className="!bg-dark-800 !border-dark-700"
                    />
                </ReactFlow>
            </div>

            {selectedNodeId && <NodePropertiesPanel />}
        </div>
    );
}

export function WorkflowCanvas() {
    return (
        <ReactFlowProvider>
            <Canvas />
        </ReactFlowProvider>
    );
}
