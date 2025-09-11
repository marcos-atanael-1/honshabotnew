-- Criar tabela para armazenar configurações de prompts personalizáveis
CREATE TABLE prompt_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID, -- Sem foreign key para permitir prompts padrão
  prompt_type TEXT NOT NULL CHECK (prompt_type IN ('fluxo_atual', 'fluxo_melhorado', 'sugestoes')),
  prompt_content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false, -- Indica se é um prompt padrão
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, prompt_type)
);

-- Criar índices
CREATE INDEX idx_prompt_configs_user_id ON prompt_configs(user_id);
CREATE INDEX idx_prompt_configs_type ON prompt_configs(prompt_type);

-- Habilitar RLS
ALTER TABLE prompt_configs ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
CREATE POLICY "Users can view their own prompt configs and defaults" ON prompt_configs
  FOR SELECT USING (user_id = auth.uid() OR is_default = true);

CREATE POLICY "Users can insert their own prompt configs" ON prompt_configs
  FOR INSERT WITH CHECK (user_id = auth.uid() AND is_default = false);

CREATE POLICY "Users can update their own prompt configs" ON prompt_configs
  FOR UPDATE USING (user_id = auth.uid() AND is_default = false);

CREATE POLICY "Users can delete their own prompt configs" ON prompt_configs
  FOR DELETE USING (user_id = auth.uid() AND is_default = false);

-- Criar trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_prompt_configs_updated_at BEFORE UPDATE ON prompt_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Inserir prompts padrão (disponíveis para todos os usuários)
INSERT INTO prompt_configs (user_id, prompt_type, prompt_content, is_active, is_default) VALUES
(
  NULL, -- Null para prompts padrão
  'fluxo_atual',
  'Analise a seguinte transcrição de uma reunião sobre processos de negócio e extraia o fluxo atual do processo descrito:

TRANSCRIÇÃO:
{transcription}

Por favor, retorne APENAS um JSON válido no seguinte formato:
{
  "nodes": [
    {"id": "1", "type": "input", "position": {"x": 0, "y": 0}, "data": {"label": "Início"}},
    {"id": "2", "position": {"x": 0, "y": 100}, "data": {"label": "Descrição da etapa"}},
    {"id": "3", "type": "output", "position": {"x": 0, "y": 200}, "data": {"label": "Fim"}}
  ],
  "edges": [
    {"id": "e1-2", "source": "1", "target": "2"},
    {"id": "e2-3", "source": "2", "target": "3"}
  ]
}

Instruções:
- Use "type": "input" para o nó inicial
- Use "type": "output" para o nó final  
- Para nós de decisão, use "type": "decision" e format o label como pergunta
- Posicione os nós de forma organizada (espaçamento de 100px entre níveis)
- Use IDs sequenciais (1, 2, 3, etc.)
- Conecte os nós na ordem lógica do processo
- Extraia as etapas EXATAMENTE como descritas na transcrição',
  true,
  true
),
(
  NULL,
  'fluxo_melhorado',
  'Com base na transcrição e no fluxo atual identificado, crie uma versão otimizada do processo:

TRANSCRIÇÃO:
{transcription}

FLUXO ATUAL:
{current_flow}

Por favor, retorne APENAS um JSON válido no seguinte formato:
{
  "nodes": [
    {"id": "1", "type": "input", "position": {"x": 0, "y": 0}, "data": {"label": "Início"}},
    {"id": "2", "position": {"x": 0, "y": 100}, "data": {"label": "Etapa otimizada"}},
    {"id": "3", "type": "output", "position": {"x": 0, "y": 200}, "data": {"label": "Fim"}}
  ],
  "edges": [
    {"id": "e1-2", "source": "1", "target": "2"},
    {"id": "e2-3", "source": "2", "target": "3"}
  ]
}

Otimizações a considerar:
- Eliminar etapas desnecessárias ou redundantes
- Paralelizar processos quando possível
- Automatizar tarefas manuais
- Reduzir tempo de espera e gargalos
- Melhorar comunicação entre etapas
- Adicionar pontos de controle e validação
- Consolidar atividades similares',
  true,
  true
),
(
  NULL,
  'sugestoes',
  'Analise a transcrição e os fluxos (atual e melhorado) para gerar sugestões detalhadas de melhoria:

TRANSCRIÇÃO:
{transcription}

FLUXO ATUAL:
{current_flow}

FLUXO MELHORADO:
{improved_flow}

Forneça sugestões de melhoria organizadas por categoria:

**🚀 OTIMIZAÇÕES DE PROCESSO:**
- [Liste melhorias específicas no fluxo]

**⚡ AUTOMAÇÃO:**
- [Identifique oportunidades de automação]

**📊 MONITORAMENTO:**
- [Sugira métricas e KPIs para acompanhar]

**👥 PESSOAS E COMUNICAÇÃO:**
- [Melhorias na comunicação e responsabilidades]

**🔧 FERRAMENTAS E TECNOLOGIA:**
- [Sistemas ou ferramentas que podem ajudar]

**⏱️ REDUÇÃO DE TEMPO:**
- [Estratégias para acelerar o processo]

**✅ CONTROLES DE QUALIDADE:**
- [Pontos de verificação e validação]

Base suas sugestões especificamente no que foi discutido na transcrição.',
  true,
  true
); 