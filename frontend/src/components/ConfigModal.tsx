import React, { useState, useEffect } from 'react';
import { X, Settings } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import PromptSubTabs from './PromptSubTabs';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConfigModal({ isOpen, onClose }: ConfigModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // Estados para prompts
  const [prompts, setPrompts] = useState<{
    analise_inicial: { system_prompt: string; user_template: string; nome: string };
    as_is: { system_prompt: string; user_template: string; nome: string };
    to_be: { system_prompt: string; user_template: string; nome: string };
  }>({
    analise_inicial: { system_prompt: '', user_template: '', nome: '' },
    as_is: { system_prompt: '', user_template: '', nome: '' },
    to_be: { system_prompt: '', user_template: '', nome: '' }
  });
  const [savingPrompt, setSavingPrompt] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && user) {
      loadPromptConfigs();
    }
  }, [isOpen, user]);



  const loadPromptConfigs = async () => {
    if (!user) return;
    
    try {
      // Buscar prompts ativos da tabela prompts_analise
      const { data: promptsData, error } = await supabase
        .from('prompts_analise')
        .select('*')
        .eq('ativo', true);

      if (error) {
        console.error('Erro ao carregar prompts:', error);
        return;
      }

      // Montar objeto de prompts
      const newPrompts = {
        analise_inicial: { system_prompt: '', user_template: '', nome: '' },
        as_is: { system_prompt: '', user_template: '', nome: '' },
        to_be: { system_prompt: '', user_template: '', nome: '' }
      };
      
      // Preencher com dados da tabela
      promptsData?.forEach((prompt: any) => {
        if (prompt.tipo in newPrompts) {
          newPrompts[prompt.tipo as keyof typeof newPrompts] = {
            system_prompt: prompt.system_prompt,
            user_template: prompt.user_template,
            nome: prompt.nome
          };
        }
      });

      setPrompts(newPrompts);
    } catch (error: any) {
      console.error('Erro ao carregar prompts:', error);
    }
  };

  const savePrompt = async (promptType: 'analise_inicial' | 'as_is' | 'to_be', field: 'system_prompt' | 'user_template') => {
    if (!user) return;
    
    const promptData = prompts[promptType];
    const fieldValue = promptData[field].trim();
    
    if (!fieldValue) {
      toast.error(`${field === 'system_prompt' ? 'System Prompt' : 'User Template'} não pode estar vazio`);
      return;
    }

    setSavingPrompt(`${promptType}_${field}`);
    try {
      const { error } = await supabase
        .from('prompts_analise')
        .update({
          [field]: fieldValue,
          updated_at: new Date().toISOString()
        })
        .eq('tipo', promptType)
        .eq('ativo', true);

      if (error) throw error;

      toast.success(`${getPromptTypeName(promptType)} - ${field === 'system_prompt' ? 'System Prompt' : 'User Template'} salvo com sucesso!`);
    } catch (error: any) {
      toast.error(`Erro ao salvar ${getPromptTypeName(promptType)}`);
      console.error(error);
    } finally {
      setSavingPrompt(null);
    }
  };



  const getPromptTypeName = (promptType: string) => {
    switch (promptType) {
      case 'analise_inicial': return 'Análise Inicial';
      case 'as_is': return 'Processo As-Is';
      case 'to_be': return 'Processo To-Be';
      default: return promptType;
    }
  };



  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl dark:shadow-gray-900/50 max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
              <Settings className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Configurações
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>



        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Carregando configurações...</p>
            </div>
          ) : (
            <PromptSubTabs 
              prompts={prompts}
              setPrompts={setPrompts}
              savePrompt={savePrompt}
              savingPrompt={savingPrompt}
              getPromptTypeName={getPromptTypeName}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            💡 Personalize os prompts para obter análises mais precisas para seu negócio
          </p>
        </div>
      </div>
    </div>
  );
}