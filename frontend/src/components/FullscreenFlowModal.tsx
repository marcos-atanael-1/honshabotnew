import React, { useCallback, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  BackgroundVariant,
  ConnectionMode,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Panel,
} from 'reactflow';
import { X, Maximize2, Download, Edit3, Save, Square, Diamond, Circle, Undo, Redo } from 'lucide-react';
import { nodeTypes } from './FlowNodes';
import { useUndoRedo } from '../hooks/useUndoRedo';
import toast from 'react-hot-toast';

interface FullscreenFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  nodes: Node[];
  edges: Edge[];
  isEditing: boolean;
  onToggleEdit: () => void;
  onSave?: (nodes: Node[], edges: Edge[]) => void;
  onExport?: () => void;
}

export function FullscreenFlowModal({
  isOpen,
  onClose,
  title,
  nodes: initialNodes,
  edges: initialEdges,
  isEditing,
  onToggleEdit,
  onSave,
  onExport,
}: FullscreenFlowModalProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [nodeIdCounter, setNodeIdCounter] = React.useState(1);
  
  // Hook para undo/redo
  const { saveState, undo, redo, canUndo, canRedo } = useUndoRedo(initialNodes, initialEdges);

  // Atualizar nodes e edges quando props mudarem
  React.useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Event listeners para teclas
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isEditing) return;

      // Undo/Redo
      if (event.ctrlKey || event.metaKey) {
        if (event.key === 'z' && !event.shiftKey) {
          event.preventDefault();
          const undoState = undo();
          if (undoState) {
            setNodes(undoState.nodes);
            setEdges(undoState.edges);
            toast.success('Ação desfeita');
          }
        } else if ((event.key === 'y') || (event.key === 'z' && event.shiftKey)) {
          event.preventDefault();
          const redoState = redo();
          if (redoState) {
            setNodes(redoState.nodes);
            setEdges(redoState.edges);
            toast.success('Ação refeita');
          }
        }
      }

      // Delete
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const selectedNodes = nodes.filter(node => node.selected);
        const selectedEdges = edges.filter(edge => edge.selected);
        
        if (selectedNodes.length > 0 || selectedEdges.length > 0) {
          event.preventDefault();
          
          // Salvar estado antes de deletar
          saveState(nodes, edges);
          
          // Remover nós selecionados
          if (selectedNodes.length > 0) {
            const nodeIds = selectedNodes.map(node => node.id);
            setNodes(nodes => nodes.filter(node => !nodeIds.includes(node.id)));
            setEdges(edges => edges.filter(edge => 
              !nodeIds.includes(edge.source) && !nodeIds.includes(edge.target)
            ));
          }
          
          // Remover arestas selecionadas
          if (selectedEdges.length > 0) {
            const edgeIds = selectedEdges.map(edge => edge.id);
            setEdges(edges => edges.filter(edge => !edgeIds.includes(edge.id)));
          }
          
          toast.success(`${selectedNodes.length + selectedEdges.length} item(s) removido(s)`);
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isEditing, nodes, edges, undo, redo, saveState, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const addNode = (type: 'default' | 'start' | 'end' | 'decision' | 'automated' | 'parallel' | 'problem') => {
    // Salvar estado antes de adicionar
    saveState(nodes, edges);
    
    const newNode = {
      id: `node-${nodeIdCounter}`,
      type,
      position: { 
        x: Math.random() * 400 + 200, 
        y: Math.random() * 300 + 200 
      },
      data: { 
        label: type === 'start' ? 'Início' :
               type === 'end' ? 'Fim' :
               type === 'decision' ? 'Decisão?' :
               type === 'automated' ? 'Processo Automatizado' :
               type === 'parallel' ? 'Processo Paralelo' :
               type === 'problem' ? 'Problema/Gargalo' :
               'Novo Processo',
        isEditing: false,
        onLabelChange: (newLabel: string) => {
          setNodes(nodes => nodes.map(n => 
            n.id === newNode.id ? { ...n, data: { ...n.data, label: newLabel, isEditing: false } } : n
          ));
        },
        onStartEdit: () => {
          setNodes(nodes => nodes.map(n => 
            n.id === newNode.id ? { ...n, data: { ...n.data, isEditing: true } } : 
            { ...n, data: { ...n.data, isEditing: false } }
          ));
        },
        onCancelEdit: () => {
          setNodes(nodes => nodes.map(n => 
            n.id === newNode.id ? { ...n, data: { ...n.data, isEditing: false } } : n
          ));
        }
      },
    };

    setNodes((nodes) => [...nodes, newNode]);
    setNodeIdCounter(prev => prev + 1);
  };

  const handleSave = () => {
    if (onSave) {
      onSave(nodes, edges);
      toast.success('Fluxo salvo com sucesso!');
    }
  };

  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (!isEditing) return;
    
    const newLabel = prompt('Digite o novo texto para este bloco:', node.data.label);
    if (newLabel) {
      setNodes((nodes) =>
        nodes.map((n) =>
          n.id === node.id ? { ...n, data: { ...n.data, label: newLabel } } : n
        )
      );
    }
  }, [isEditing, setNodes]);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    if (!isEditing) return;
    
    event.preventDefault();
    if (confirm('Deseja excluir este bloco?')) {
      setNodes((nodes) => nodes.filter((n) => n.id !== node.id));
      setEdges((edges) => edges.filter((e) => e.source !== node.id && e.target !== node.id));
    }
  }, [isEditing, setNodes, setEdges]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9999]">
      <div className="bg-white dark:bg-gray-900 w-full h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center space-x-3">
            <Maximize2 className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {title} - Visualização em Tela Cheia
            </h2>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Botões de edição */}
            {isEditing && (
              <>
                <div className="flex items-center space-x-1 mr-4">
                  <button
                    onClick={() => addNode('start')}
                    className="flex items-center space-x-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                    title="Adicionar Início"
                  >
                    <Circle className="h-3 w-3" />
                    <span>Início</span>
                  </button>
                  <button
                    onClick={() => addNode('default')}
                    className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                    title="Adicionar Processo"
                  >
                    <Square className="h-3 w-3" />
                    <span>Processo</span>
                  </button>
                  <button
                    onClick={() => addNode('decision')}
                    className="flex items-center space-x-1 px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition-colors"
                    title="Adicionar Decisão"
                  >
                    <Diamond className="h-3 w-3" />
                    <span>Decisão</span>
                  </button>
                  <button
                    onClick={() => addNode('automated')}
                    className="flex items-center space-x-1 px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
                    title="Adicionar Automação"
                  >
                    <span>🤖</span>
                    <span>Automação</span>
                  </button>
                  <button
                    onClick={() => addNode('parallel')}
                    className="flex items-center space-x-1 px-2 py-1 text-xs bg-cyan-100 text-cyan-700 rounded hover:bg-cyan-200 transition-colors"
                    title="Adicionar Paralelo"
                  >
                    <span>⚡</span>
                    <span>Paralelo</span>
                  </button>
                  <button
                    onClick={() => addNode('problem')}
                    className="flex items-center space-x-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                    title="Adicionar Problema"
                  >
                    <span>⚠️</span>
                    <span>Problema</span>
                  </button>
                  <button
                    onClick={() => addNode('end')}
                    className="flex items-center space-x-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                    title="Adicionar Fim"
                  >
                    <Circle className="h-3 w-3" />
                    <span>Fim</span>
                  </button>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      const undoState = undo();
                      if (undoState) {
                        setNodes(undoState.nodes);
                        setEdges(undoState.edges);
                        toast.success('Ação desfeita');
                      }
                    }}
                    disabled={!canUndo}
                    className="flex items-center space-x-1 px-2 py-1 text-xs text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Desfazer (Ctrl+Z)"
                  >
                    <Undo className="h-3 w-3" />
                    <span>Desfazer</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      const redoState = redo();
                      if (redoState) {
                        setNodes(redoState.nodes);
                        setEdges(redoState.edges);
                        toast.success('Ação refeita');
                      }
                    }}
                    disabled={!canRedo}
                    className="flex items-center space-x-1 px-2 py-1 text-xs text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Refazer (Ctrl+Y)"
                  >
                    <Redo className="h-3 w-3" />
                    <span>Refazer</span>
                  </button>
                </div>
                
                <button
                  onClick={handleSave}
                  className="flex items-center space-x-2 px-3 py-2 text-sm text-green-700 bg-green-100 rounded-md hover:bg-green-200 transition-colors"
                >
                  <Save className="h-4 w-4" />
                  <span>Salvar</span>
                </button>
              </>
            )}
            
            <button
              onClick={onToggleEdit}
              className={`flex items-center space-x-2 px-3 py-2 text-sm rounded-md transition-colors ${
                isEditing 
                  ? 'text-gray-700 bg-gray-100 hover:bg-gray-200' 
                  : 'text-blue-700 bg-blue-100 hover:bg-blue-200'
              }`}
            >
              <Edit3 className="h-4 w-4" />
              <span>{isEditing ? 'Parar Edição' : 'Editar'}</span>
            </button>
            
            {onExport && (
              <button
                onClick={onExport}
                className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Exportar</span>
              </button>
            )}
            
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Flow Container */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeContextMenu={onNodeContextMenu}
            nodeTypes={nodeTypes}
            connectionMode={ConnectionMode.Loose}
            proOptions={{ hideAttribution: true }}
            fitView
            fitViewOptions={{ padding: 0.1 }}
            minZoom={0.1}
            maxZoom={2}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          >
            <Controls showInteractive={false} />
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
            
            {/* Instruções de edição */}
            {isEditing && (
              <Panel position="bottom-left" className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <div><strong>Edição ativa:</strong></div>
                  <div>• Clique duplo para editar texto inline</div>
                  <div>• Enter para salvar, Esc para cancelar</div>
                  <div>• Delete/Backspace para excluir selecionados</div>
                  <div>• Ctrl+Z para desfazer, Ctrl+Y para refazer</div>
                  <div>• Arraste para conectar nós</div>
                  <div>• Use os botões acima para adicionar nós</div>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>
      </div>
    </div>
  );
} 