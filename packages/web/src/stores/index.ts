// ============================================================
// Workflow Store - State management for the workflow builder
// ============================================================

import { create } from 'zustand';
import { uuid } from '../utils/uuid.js';

export interface WFNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    description?: string;
    nodeType: string;
    config: Record<string, unknown>;
    color?: string;
    icon?: string;
  };
}

export interface WFEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  animated?: boolean;
  label?: string;
  style?: Record<string, unknown>;
}

interface WorkflowState {
  // Current workflow
  nodes: WFNode[];
  edges: WFEdge[];
  workflowId: string | null;
  workflowName: string;
  isDirty: boolean;

  // Selection
  selectedNodeId: string | null;

  // Actions
  setNodes: (nodes: WFNode[]) => void;
  setEdges: (edges: WFEdge[]) => void;
  addNode: (node: WFNode) => void;
  updateNode: (id: string, data: Partial<WFNode['data']>) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: WFEdge) => void;
  removeEdge: (id: string) => void;
  selectNode: (id: string | null) => void;
  setWorkflowMeta: (id: string | null, name: string) => void;
  clearWorkflow: () => void;
  markClean: () => void;
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  nodes: [],
  edges: [],
  workflowId: null,
  workflowName: 'Untitled Workflow',
  isDirty: false,
  selectedNodeId: null,

  setNodes: (nodes) => set({ nodes, isDirty: true }),
  setEdges: (edges) => set({ edges, isDirty: true }),

  addNode: (node) => set((s) => ({ nodes: [...s.nodes, node], isDirty: true })),

  updateNode: (id, data) => set((s) => ({
    nodes: s.nodes.map(n => n.id === id ? { ...n, data: { ...n.data, ...data } } : n),
    isDirty: true,
  })),

  removeNode: (id) => set((s) => ({
    nodes: s.nodes.filter(n => n.id !== id),
    edges: s.edges.filter(e => e.source !== id && e.target !== id),
    selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
    isDirty: true,
  })),

  addEdge: (edge) => set((s) => ({ edges: [...s.edges, edge], isDirty: true })),
  removeEdge: (id) => set((s) => ({ edges: s.edges.filter(e => e.id !== id), isDirty: true })),

  selectNode: (id) => set({ selectedNodeId: id }),

  setWorkflowMeta: (id, name) => set({ workflowId: id, workflowName: name }),
  clearWorkflow: () => set({
    nodes: [], edges: [], workflowId: null, workflowName: 'Untitled Workflow',
    isDirty: false, selectedNodeId: null,
  }),
  markClean: () => set({ isDirty: false }),
}));

// ─── Chat Store ─────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatState {
  messages: ChatMessage[];
  sessionId: string;
  isLoading: boolean;
  addMessage: (msg: ChatMessage) => void;
  updateMessage: (id: string, content: string) => void;
  setLoading: (v: boolean) => void;
  clearMessages: () => void;
  setSessionId: (id: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  sessionId: uuid(),
  isLoading: false,
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  updateMessage: (id, content) => set((s) => ({
    messages: s.messages.map(m => m.id === id ? { ...m, content } : m),
  })),
  setLoading: (isLoading) => set({ isLoading }),
  clearMessages: () => set({ messages: [], sessionId: uuid() }),
  setSessionId: (sessionId) => set({ sessionId }),
}));

// ─── App Store ──────────────────────────────────────────────

type AppView = 'chat' | 'knowledge' | 'workflows' | 'skills' | 'resources' | 'settings' | 'health-dashboard';

interface AppState {
  currentView: AppView;
  sidebarOpen: boolean;
  setView: (view: AppView) => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'chat',
  sidebarOpen: true,
  setView: (currentView) => set({ currentView }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
