-- Remover tabela se existir (para recriar corretamente)
DROP TABLE IF EXISTS prompt_configs CASCADE;

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
CREATE INDEX idx_prompt_configs_default ON prompt_configs(is_default);

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

-- Inserir prompts padrão melhorados
INSERT INTO prompt_configs (user_id, prompt_type, prompt_content, is_active, is_default) VALUES
(NULL, 'fluxo_atual', 'Você é um especialista em análise de processos. Analise a seguinte transcrição de uma reunião/discussão sobre um processo organizacional e extraia o fluxo atual do processo.

TRANSCRIÇÃO:
{transcription}

INSTRUÇÕES:
1. Identifique as etapas, atividades e decisões mencionadas na transcrição
2. Identifique os responsáveis por cada etapa (pessoas, departamentos, sistemas)
3. Identifique pontos de decisão, aprovações, validações
4. Identifique gargalos, problemas ou demoras mencionadas
5. Crie um fluxo visual usando React Flow com nodes e edges

FORMATO DE SAÍDA:
Retorne APENAS um JSON válido no formato:
{
  "nodes": [
    {
      "id": "unique_id",
      "type": "input|default|output",
      "position": {"x": number, "y": number},
      "data": {"label": "Descrição da etapa"},
      "style": {
        "backgroundColor": "#cor",
        "color": "white",
        "border": "none",
        "borderRadius": "8px"
      }
    }
  ],
  "edges": [
    {
      "id": "edge_id",
      "source": "source_node_id",
      "target": "target_node_id",
      "label": "Condição/Descrição (opcional)"
    }
  ]
}

CORES SUGERIDAS:
- Início: #10b981 (verde)
- Processo normal: #3b82f6 (azul)
- Decisão: #f59e0b (amarelo)
- Problema/Gargalo: #ef4444 (vermelho)
- Fim: #6b7280 (cinza)

Posicione os nodes de forma lógica (fluxo da esquerda para direita ou top-down).', true, true),

(NULL, 'fluxo_melhorado', 'Você é um especialista em otimização de processos. Com base na transcrição e no fluxo atual identificado, crie uma versão otimizada do processo.

TRANSCRIÇÃO ORIGINAL:
{transcription}

FLUXO ATUAL IDENTIFICADO:
{current_flow}

INSTRUÇÕES PARA OTIMIZAÇÃO:
1. Elimine etapas desnecessárias ou redundantes
2. Automatize processos manuais quando possível
3. Paralelização de atividades que podem ocorrer simultaneamente
4. Reduza pontos de aprovação desnecessários
5. Implemente controles de qualidade preventivos
6. Melhore a comunicação entre etapas
7. Identifique oportunidades de digitalização
8. Reduza tempo de espera e gargalos

CRITÉRIOS DE MELHORIA:
- Redução de tempo total
- Redução de custos
- Melhoria da qualidade
- Redução de erros
- Maior transparência
- Melhor experiência do usuário/cliente

FORMATO DE SAÍDA:
Retorne APENAS um JSON válido no formato React Flow com nodes e edges otimizados.
Use as mesmas cores do fluxo atual, mas adicione:
- Processos automatizados: #8b5cf6 (roxo)
- Processos paralelos: #06b6d4 (ciano)
- Melhorias: #10b981 (verde)

Posicione os nodes mostrando claramente as melhorias (paralelização, eliminação de etapas, etc.).', true, true),

(NULL, 'sugestoes', 'Você é um consultor sênior em melhoria de processos. Analise a transcrição e os fluxos para gerar sugestões detalhadas de melhoria.

TRANSCRIÇÃO ORIGINAL:
{transcription}

FLUXO ATUAL:
{current_flow}

FLUXO MELHORADO PROPOSTO:
{improved_flow}

CATEGORIAS DE ANÁLISE:
1. **PROBLEMAS IDENTIFICADOS**: Liste os principais problemas mencionados na transcrição
2. **OPORTUNIDADES DE MELHORIA**: Identifique oportunidades específicas
3. **TECNOLOGIA E AUTOMAÇÃO**: Sugira ferramentas e sistemas
4. **PESSOAS E TREINAMENTO**: Necessidades de capacitação
5. **PROCESSOS E PROCEDIMENTOS**: Mudanças em políticas/procedimentos
6. **MÉTRICAS E INDICADORES**: KPIs para acompanhar melhorias
7. **CRONOGRAMA DE IMPLEMENTAÇÃO**: Fases e prazos sugeridos
8. **INVESTIMENTO NECESSÁRIO**: Estimativa de recursos
9. **RISCOS E MITIGAÇÃO**: Possíveis obstáculos e como superar
10. **BENEFÍCIOS ESPERADOS**: Resultados quantitativos e qualitativos

FORMATO DE SAÍDA:
Organize as sugestões em seções claras e detalhadas. Para cada sugestão, inclua:
- Descrição clara da melhoria
- Justificativa baseada na transcrição
- Impacto esperado (Alto/Médio/Baixo)
- Complexidade de implementação (Alta/Média/Baixa)
- Prazo estimado
- Responsável sugerido

Seja específico e prático. Use informações da transcrição para fundamentar as sugestões.', true, true); 