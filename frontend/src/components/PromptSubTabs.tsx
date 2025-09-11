import React, { useState, useMemo } from 'react';
import { Save } from 'lucide-react';

type PromptType = 'analise_inicial' | 'as_is' | 'to_be';

interface PromptData {
  system_prompt: string;
  user_template: string;
  nome: string;
}

interface PromptSubTabsProps {
  prompts: Record<PromptType, PromptData>;
  setPrompts: React.Dispatch<React.SetStateAction<Record<PromptType, PromptData>>>;
  savePrompt: (promptType: PromptType, field: 'system_prompt' | 'user_template') => Promise<void>;
  savingPrompt: string | null;
  getPromptTypeName: (promptType: PromptType) => string;
}

const PromptSubTabs: React.FC<PromptSubTabsProps> = ({
  prompts,
  setPrompts,
  savePrompt,
  savingPrompt,
  getPromptTypeName
}) => {
  const [activeTab, setActiveTab] = useState<PromptType>('analise_inicial');

  // Função para separar a parte editável da parte protegida do user_template
  const separateUserTemplate = (template: string) => {
    const formatoIndex = template.indexOf('FORMATO DE SAÍDA:');
    if (formatoIndex === -1) {
      return {
        editablePart: template,
        protectedPart: ''
      };
    }
    
    return {
      editablePart: template.substring(0, formatoIndex).trim(),
      protectedPart: template.substring(formatoIndex).trim()
    };
  };

  // Função para recombinar as partes do user_template
  const combineUserTemplate = (editablePart: string, protectedPart: string) => {
    if (!protectedPart) return editablePart;
    return editablePart.trim() + '\n\n' + protectedPart;
  };

  // Memoizar as partes separadas do template ativo
  const templateParts = useMemo(() => {
    return separateUserTemplate(prompts[activeTab].user_template);
  }, [prompts, activeTab]);

  const tabs = [
    { id: 'analise_inicial' as PromptType, name: 'Análise Inicial', color: 'blue' },
    { id: 'as_is' as PromptType, name: 'Estado Atual', color: 'green' },
    { id: 'to_be' as PromptType, name: 'Estado Futuro', color: 'purple' }
  ];

  const getTabColorClasses = (color: string, isActive: boolean) => {
    const baseClasses = 'px-4 py-2 text-sm font-medium rounded-lg transition-colors';
    
    if (isActive) {
      switch (color) {
        case 'blue':
          return `${baseClasses} bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300`;
        case 'green':
          return `${baseClasses} bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300`;
        case 'purple':
          return `${baseClasses} bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300`;
        default:
          return `${baseClasses} bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300`;
      }
    } else {
      return `${baseClasses} text-gray-600 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700`;
    }
  };

  const getButtonColorClasses = (color: string, type: 'system' | 'user') => {
    const baseClasses = 'flex items-center space-x-1 px-3 py-1.5 text-xs font-medium disabled:opacity-50 transition-colors rounded-md';
    
    if (type === 'system') {
      switch (color) {
        case 'blue':
          return `${baseClasses} text-blue-700 bg-blue-100 hover:bg-blue-200`;
        case 'green':
          return `${baseClasses} text-green-700 bg-green-100 hover:bg-green-200`;
        case 'purple':
          return `${baseClasses} text-purple-700 bg-purple-100 hover:bg-purple-200`;
        default:
          return `${baseClasses} text-gray-700 bg-gray-100 hover:bg-gray-200`;
      }
    } else {
      switch (color) {
        case 'blue':
          return `${baseClasses} text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200`;
        case 'green':
          return `${baseClasses} text-green-800 bg-green-50 hover:bg-green-100 border border-green-200`;
        case 'purple':
          return `${baseClasses} text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200`;
        default:
          return `${baseClasses} text-gray-800 bg-gray-50 hover:bg-gray-100 border border-gray-200`;
      }
    }
  };

  const activeTabData = tabs.find(tab => tab.id === activeTab);
  const currentColor = activeTabData?.color || 'gray';

  return (
    <div className="space-y-6">
      {/* Descrição */}
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Configure os prompts de IA para análise de processos. Cada tipo possui um System Prompt (instruções para a IA) e um User Template (template para o usuário).
      </p>

      {/* Sub-abas */}
      <div className="border-b border-gray-200 dark:border-gray-600">
        <nav className="flex space-x-2" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={getTabColorClasses(tab.color, activeTab === tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Conteúdo da aba ativa */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6 space-y-6">


        {/* System Prompt */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                System Prompt
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Instruções que definem como a IA deve se comportar e processar as informações
              </p>
            </div>
            <button
              type="button"
              onClick={() => savePrompt(activeTab, 'system_prompt')}
              disabled={savingPrompt === `${activeTab}_system_prompt`}
              className={getButtonColorClasses(currentColor, 'system')}
              title="Salvar System Prompt"
            >
              {savingPrompt === `${activeTab}_system_prompt` ? (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></div>
              ) : (
                <Save className="h-3 w-3" />
              )}
              <span>Salvar</span>
            </button>
          </div>
          
          <div className="relative">
            <textarea
              className="w-full h-40 px-4 py-3 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-colors resize-y font-mono"
              placeholder="Instruções para a IA sobre como processar a análise..."
              value={prompts[activeTab].system_prompt}
              onChange={(e) => setPrompts(prev => ({ 
                ...prev, 
                [activeTab]: { ...prev[activeTab], system_prompt: e.target.value }
              }))}
              rows={8}
            />
            <div className="absolute bottom-3 right-3 text-xs text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded">
              {prompts[activeTab].system_prompt.length} caracteres
            </div>
          </div>
        </div>

        {/* User Template */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                User Template
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Template que será preenchido com dados do usuário e enviado para a IA
              </p>
            </div>
            <button
              type="button"
              onClick={() => savePrompt(activeTab, 'user_template')}
              disabled={savingPrompt === `${activeTab}_user_template`}
              className={getButtonColorClasses(currentColor, 'user')}
              title="Salvar User Template"
            >
              {savingPrompt === `${activeTab}_user_template` ? (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></div>
              ) : (
                <Save className="h-3 w-3" />
              )}
              <span>Salvar</span>
            </button>
          </div>
          
          <div className="relative">
            <div className="space-y-3">
              {/* Parte editável do template */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Parte Editável do Template
                </label>
                <textarea
                  className="w-full h-32 px-4 py-3 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-colors resize-y font-mono"
                  placeholder="Template que será enviado para o usuário com variáveis como {transcription}..."
                  value={templateParts.editablePart}
                  onChange={(e) => {
                    const newTemplate = combineUserTemplate(e.target.value, templateParts.protectedPart);
                    setPrompts(prev => ({ 
                      ...prev, 
                      [activeTab]: { ...prev[activeTab], user_template: newTemplate }
                    }));
                  }}
                  rows={6}
                />
                <div className="text-xs text-gray-400 mt-1">
                  {templateParts.editablePart.length} caracteres (editável)
                </div>
              </div>

              {/* Parte protegida do template (somente leitura) */}
              {templateParts.protectedPart && (
                <div>
                  <label className="block text-xs font-medium text-amber-600 dark:text-amber-400 mb-2">
                    🔒 Formato Esperado (Protegido - Não Editável)
                  </label>
                  <textarea
                    className="w-full h-24 px-4 py-3 border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-mono resize-none cursor-not-allowed"
                    value={templateParts.protectedPart}
                    readOnly
                    rows={4}
                  />
                  <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    {templateParts.protectedPart.length} caracteres (protegido)
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromptSubTabs;