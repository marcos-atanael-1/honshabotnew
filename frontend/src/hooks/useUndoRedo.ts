import { useState, useCallback } from 'react';
import { Node, Edge } from 'reactflow';

interface HistoryState {
  nodes: Node[];
  edges: Edge[];
}

export function useUndoRedo(initialNodes: Node[], initialEdges: Edge[]) {
  const [history, setHistory] = useState<HistoryState[]>([
    { nodes: initialNodes, edges: initialEdges }
  ]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const saveState = useCallback((nodes: Node[], edges: Edge[]) => {
    setHistory((prev) => {
      // Remove estados futuros se estamos no meio do histórico
      const newHistory = prev.slice(0, currentIndex + 1);
      // Adiciona novo estado
      const updatedHistory = [...newHistory, { nodes, edges }];
      // Limita o histórico a 50 estados
      return updatedHistory.slice(-50);
    });
    setCurrentIndex((prev) => Math.min(prev + 1, 49));
  }, [currentIndex]);

  const undo = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      return history[currentIndex - 1];
    }
    return null;
  }, [currentIndex, history]);

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(currentIndex + 1);
      return history[currentIndex + 1];
    }
    return null;
  }, [currentIndex, history]);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  return {
    saveState,
    undo,
    redo,
    canUndo,
    canRedo,
    currentState: history[currentIndex]
  };
} 