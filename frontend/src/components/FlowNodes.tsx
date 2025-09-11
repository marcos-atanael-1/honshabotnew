import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { EditableText } from './EditableText';

// Nó padrão customizado
export function DefaultNode({ data, selected }: NodeProps) {
  return (
    <div className={`px-4 py-2 shadow-md rounded-md bg-gray-50 border-2 ${
      selected ? 'border-blue-500' : 'border-gray-300'
    }`}>
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <EditableText
        text={data.label}
        onSave={(newText) => {
          if (data.onLabelChange) {
            data.onLabelChange(newText);
          }
        }}
        isEditing={data.isEditing || false}
        onStartEdit={() => {
          if (data.onStartEdit) {
            data.onStartEdit();
          }
        }}
        onCancelEdit={() => {
          if (data.onCancelEdit) {
            data.onCancelEdit();
          }
        }}
        className="text-sm font-medium text-gray-800 text-center min-w-[120px]"
      />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
}

// Nó de início customizado
export function StartNode({ data, selected }: NodeProps) {
  return (
    <div className={`px-4 py-2 shadow-md rounded-full bg-green-500 border-2 ${
      selected ? 'border-green-700' : 'border-green-400'
    }`}>
      <div className="text-sm font-medium text-white text-center min-w-[100px]">
        {data.label}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
}

// Nó de fim customizado
export function EndNode({ data, selected }: NodeProps) {
  return (
    <div className={`px-4 py-2 shadow-md rounded-full bg-gray-600 border-2 ${
      selected ? 'border-gray-800' : 'border-gray-500'
    }`}>
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <div className="text-sm font-medium text-white text-center min-w-[100px]">
        {data.label}
      </div>
    </div>
  );
}

// Nó de decisão em formato de losango
export function DecisionNode({ data, selected }: NodeProps) {
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <Handle type="target" position={Position.Top} className="w-3 h-3 z-10" />
      
      {/* Losango usando CSS clip-path para formato mais limpo */}
      <div 
        className={`w-20 h-20 shadow-lg border-2 ${
          selected ? 'border-yellow-600 bg-yellow-400' : 'border-yellow-500 bg-yellow-400'
        }`}
        style={{
          clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
        }}
      >
        {/* Texto dentro do losango */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-xs font-medium text-gray-900 text-center px-1 leading-tight max-w-[60px]">
            {data.label}
          </div>
        </div>
      </div>
      
      {/* Handles nas 4 direções para decisões */}
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 z-10" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 z-10" />
      <Handle type="source" position={Position.Left} className="w-3 h-3 z-10" />
    </div>
  );
}

// Nó de processo automatizado
export function AutomatedNode({ data, selected }: NodeProps) {
  return (
    <div className={`px-4 py-2 shadow-md rounded-md bg-purple-100 border-2 ${
      selected ? 'border-purple-500' : 'border-purple-300'
    }`}>
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <div className="text-sm font-medium text-purple-800 text-center min-w-[120px]">
        🤖 {data.label}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
}

// Nó de processo paralelo
export function ParallelNode({ data, selected }: NodeProps) {
  return (
    <div className={`px-4 py-2 shadow-md rounded-md bg-cyan-100 border-2 ${
      selected ? 'border-cyan-500' : 'border-cyan-300'
    }`}>
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <div className="text-sm font-medium text-cyan-800 text-center min-w-[120px]">
        ⚡ {data.label}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
}

// Nó de problema/gargalo
export function ProblemNode({ data, selected }: NodeProps) {
  return (
    <div className={`px-4 py-2 shadow-md rounded-md bg-red-100 border-2 ${
      selected ? 'border-red-500' : 'border-red-300'
    }`}>
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <div className="text-sm font-medium text-red-800 text-center min-w-[120px]">
        ⚠️ {data.label}
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
}

// Mapeamento dos tipos de nós
export const nodeTypes = {
  default: DefaultNode,
  start: StartNode,
  end: EndNode,
  decision: DecisionNode,
  automated: AutomatedNode,
  parallel: ParallelNode,
  problem: ProblemNode,
}; 