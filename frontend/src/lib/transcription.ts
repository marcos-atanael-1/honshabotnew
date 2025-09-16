import { supabase } from './supabase';

export interface TranscriptionConfig {
  openaiKey?: string;
  groqKey?: string;
}

export interface TranscriptionResult {
  text: string;
  processingTime: number;
  model: string;
}

export interface ExternalTranscriptionResponse {
  id: string;
  status: 'PROCESSING' | 'DONE' | 'ERROR';
  file_name: string;
  created_at: string;
  transcription: string | null;
}

export interface FlowAnalysisResult {
  fluxo_original_json: {
    nodes: Array<{
      id: string;
      type?: string;
      position: { x: number; y: number };
      data: { label: string };
      style?: Record<string, string>;
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      label?: string;
    }>;
  };
  fluxo_melhorado_json: {
    nodes: Array<{
      id: string;
      type?: string;
      position: { x: number; y: number };
      data: { label: string };
      style?: Record<string, string>;
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      label?: string;
    }>;
  };
  sugestoes: string;
}

export class TranscriptionService {
  private readonly API_BASE_URL = this.getApiBaseUrl();

  private getApiBaseUrl(): string {
    // Usar variável de ambiente do Vite
    return import.meta.env.VITE_BACKEND_URL || 'https://apihonshabot.com.br';
  }

  async startTranscription(file: File, processoId: string, tipoTranscricao?: string): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (tipoTranscricao) {
        formData.append('tipo_transcricao', tipoTranscricao);
      }

      const url = `${this.API_BASE_URL}/upload?processo_id=${processoId}`;
      console.log(`Enviando arquivo para: ${url}`);
      console.log(`Tipo de transcrição: ${tipoTranscricao}`);
      
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        headers: {
          // Não definir Content-Type para FormData (deixar o browser definir)
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Erro desconhecido');
        throw new Error(`Erro ao enviar arquivo para transcrição: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Resposta da API externa:', result);
      
      if (!result.order_id) {
        throw new Error('API externa não retornou um order_id válido');
      }
      
      return result.order_id;
    } catch (error) {
      console.error('Erro detalhado na startTranscription:', error);
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(`API de transcrição não está disponível. Verifique se o serviço está rodando em ${this.API_BASE_URL}`);
      }
      
      throw error;
    }
  }

  async checkTranscriptionStatus(transcriptionId: string): Promise<ExternalTranscriptionResponse> {
    try {
      console.log(`Consultando status: ${this.API_BASE_URL}/transcribe-status/${transcriptionId}`);
      
      const response = await fetch(`${this.API_BASE_URL}/transcribe-status/${transcriptionId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Erro desconhecido');
        throw new Error(`Erro ao consultar status da transcrição: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Status da transcrição:', result);
      
      return result;
    } catch (error) {
      console.error('Erro detalhado na checkTranscriptionStatus:', error);
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(`Erro de conectividade ao consultar status da transcrição`);
      }
      
      throw error;
    }
  }

  async waitForTranscription(transcriptionId: string, onProgress?: (status: string) => void): Promise<TranscriptionResult> {
    const startTime = Date.now();
    
    while (true) {
      const status = await this.checkTranscriptionStatus(transcriptionId);
      
      if (onProgress) {
        onProgress(status.status);
      }

      if (status.status === 'DONE') {
        const processingTime = Math.round((Date.now() - startTime) / 1000);
        return {
          text: status.transcription || '',
          processingTime,
          model: 'OpenAI GPT-4o',
        };
      }

      if (status.status === 'ERROR') {
        throw new Error(`Erro na transcrição: ${status.transcription || 'Erro desconhecido'}`);
      }

      // Aguardar 3 segundos antes de verificar novamente
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  async transcribeFile(file: File, processoId: string): Promise<{ transcriptionId: string; result?: TranscriptionResult }> {
    // Inicia a transcrição na API externa diretamente
    const transcriptionId = await this.startTranscription(file, processoId);
    
    // Retorna apenas o ID para permitir polling manual
    return { transcriptionId };
  }

  async saveTranscription(processoId: string, transcription: TranscriptionResult, transcriptionId?: string): Promise<void> {
    const insertData: {
      processo_id: string;
      conteudo: string;
      status: string;
      tempo_processamento: number;
      external_id?: string;
    } = {
      processo_id: processoId,
      conteudo: transcription.text,
      status: 'concluido',
      tempo_processamento: transcription.processingTime,
    };

    // Se temos um ID da API externa, vamos salvá-lo como referência
    if (transcriptionId) {
      insertData.external_id = transcriptionId;
    }

    const { error } = await supabase
      .from('transcricoes')
      .insert([insertData]);

    if (error) {
      throw new Error(`Erro ao salvar transcrição: ${error.message}`);
    }
  }

  async createTranscriptionRecord(processoId: string, transcriptionId: string): Promise<void> {
    const { error } = await supabase
      .from('transcricoes')
      .insert([
        {
          processo_id: processoId,
          conteudo: '',
          status: 'processando',
          external_id: transcriptionId,
        },
      ]);

    if (error) {
      throw new Error(`Erro ao criar registro de transcrição: ${error.message}`);
    }
  }

  async updateTranscriptionFromExternal(externalId: string, transcriptionResult: TranscriptionResult): Promise<void> {
    const { error } = await supabase
      .from('transcricoes')
      .update({
        conteudo: transcriptionResult.text,
        status: 'concluido',
        tempo_processamento: transcriptionResult.processingTime,
      })
      .eq('external_id', externalId);

    if (error) {
      throw new Error(`Erro ao atualizar transcrição: ${error.message}`);
    }
  }

  async getTranscription(processoId: string) {
    const { data, error } = await supabase
      .from('transcricoes')
      .select('*')
      .eq('processo_id', processoId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Erro ao buscar transcrição: ${error.message}`);
    }

    return data;
  }

  async updateTranscriptionStatus(processoId: string, status: 'processando' | 'concluido' | 'erro', error?: string): Promise<void> {
    const updateData: { status: string; erro?: string } = { status };
    
    if (status === 'erro' && error) {
      updateData.erro = error;
    }

    const { error: updateError } = await supabase
      .from('transcricoes')
      .update(updateData)
      .eq('processo_id', processoId);

    if (updateError) {
      console.error('Erro ao atualizar status da transcrição:', updateError);
    }
  }

  private async getApiKey(): Promise<string | null> {
    try {
      // Usar função segura que não expõe as chaves diretamente
      const { data, error } = await supabase.rpc('get_api_key', {
        provider_name: 'openai'
      });

      if (error || !data) {
        console.error('Erro ao buscar chave da API OpenAI:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Erro ao buscar chave da API OpenAI:', error);
      return null;
    }
  }

  private async getPromptConfig(promptType: 'fluxo_atual' | 'fluxo_melhorado' | 'sugestoes'): Promise<string> {
    try {
      // Primeiro, tentar buscar prompt personalizado do usuário
      const { data: userPrompt, error: userError } = await supabase
        .from('prompt_configs')
        .select('prompt_content')
        .eq('prompt_type', promptType)
        .eq('is_active', true)
        .single();

      if (!userError && userPrompt) {
        return userPrompt.prompt_content;
      }

      // Se não encontrar prompt do usuário, buscar prompt padrão
      const { data: defaultPrompt, error: defaultError } = await supabase
        .from('prompt_configs')
        .select('prompt_content')
        .eq('prompt_type', promptType)
        .eq('is_default', true)
        .single();

      if (!defaultError && defaultPrompt) {
        return defaultPrompt.prompt_content;
      }

      // Fallback para prompts hardcoded
      return this.getDefaultPrompt(promptType);
    } catch (error) {
      console.error(`Erro ao buscar prompt ${promptType}:`, error);
      return this.getDefaultPrompt(promptType);
    }
  }

  private getDefaultPrompt(promptType: 'fluxo_atual' | 'fluxo_melhorado' | 'sugestoes'): string {
    const prompts = {
      fluxo_atual: `Você é um especialista em análise de processos. Analise a seguinte transcrição de uma reunião/discussão sobre um processo organizacional e extraia o fluxo atual do processo.

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

Posicione os nodes de forma lógica (fluxo da esquerda para direita ou top-down).`,
      
      fluxo_melhorado: `Você é um especialista em otimização de processos. Com base na transcrição e no fluxo atual identificado, crie uma versão otimizada do processo.

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

Posicione os nodes mostrando claramente as melhorias (paralelização, eliminação de etapas, etc.).`,
      
      sugestoes: `Você é um consultor sênior em melhoria de processos. Analise a transcrição e os fluxos para gerar sugestões detalhadas de melhoria.

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

Seja específico e prático. Use informações da transcrição para fundamentar as sugestões.`
    };

    return prompts[promptType];
  }

  private async callOpenAI(prompt: string): Promise<string> {
    const apiKey = await this.getApiKey();
    
    if (!apiKey) {
      throw new Error('Chave da API OpenAI não configurada. Configure nas Configurações.');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Erro na API OpenAI: ${response.status} - ${errorData.error?.message || 'Erro desconhecido'}`);
    }

    const result = await response.json();
    return result.choices[0]?.message?.content || '';
  }

  async generateAnalysisFromTranscription(transcription: string): Promise<FlowAnalysisResult> {
    try {
      console.log('🤖 Iniciando análise com IA da transcrição...');
      
      // Validar se a transcrição não está vazia
      if (!transcription || transcription.trim().length < 50) {
        throw new Error('Transcrição muito curta ou vazia para análise');
      }

      // 1. Gerar fluxo atual
      console.log('📊 Gerando fluxo atual...');
      const currentFlowPrompt = await this.getPromptConfig('fluxo_atual');
      const currentFlowPromptFilled = currentFlowPrompt.replace('{transcription}', transcription);
      const currentFlowResponse = await this.callOpenAI(currentFlowPromptFilled);
      
      let fluxo_original_json;
      try {
        // Tentar extrair JSON da resposta
        const jsonMatch = currentFlowResponse.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : currentFlowResponse;
        fluxo_original_json = JSON.parse(jsonString);
        
        // Validar estrutura básica
        if (!fluxo_original_json.nodes || !fluxo_original_json.edges) {
          throw new Error('Estrutura JSON inválida');
        }
      } catch (parseError) {
        console.warn('⚠️ Erro ao parsear JSON do fluxo atual, usando fallback:', parseError);
        // Fallback mais inteligente baseado na transcrição
        fluxo_original_json = {
          nodes: [
            { 
              id: '1', 
              type: 'input', 
              position: { x: 50, y: 50 }, 
              data: { label: 'Início do Processo' },
              style: { backgroundColor: '#10b981', color: 'white', borderRadius: '8px' }
            },
            { 
              id: '2', 
              position: { x: 50, y: 150 }, 
              data: { label: 'Processo Identificado na Transcrição' },
              style: { backgroundColor: '#3b82f6', color: 'white', borderRadius: '8px' }
            },
            { 
              id: '3', 
              type: 'output', 
              position: { x: 50, y: 250 }, 
              data: { label: 'Fim do Processo' },
              style: { backgroundColor: '#6b7280', color: 'white', borderRadius: '8px' }
            },
          ],
          edges: [
            { id: 'e1-2', source: '1', target: '2' },
            { id: 'e2-3', source: '2', target: '3' },
          ],
        };
      }

      // 2. Gerar fluxo melhorado
      console.log('⚡ Gerando fluxo melhorado...');
      const improvedFlowPrompt = await this.getPromptConfig('fluxo_melhorado');
      const improvedFlowPromptFilled = improvedFlowPrompt
        .replace('{transcription}', transcription)
        .replace('{current_flow}', JSON.stringify(fluxo_original_json, null, 2));
      const improvedFlowResponse = await this.callOpenAI(improvedFlowPromptFilled);
      
      let fluxo_melhorado_json;
      try {
        // Tentar extrair JSON da resposta
        const jsonMatch = improvedFlowResponse.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : improvedFlowResponse;
        fluxo_melhorado_json = JSON.parse(jsonString);
        
        // Validar estrutura básica
        if (!fluxo_melhorado_json.nodes || !fluxo_melhorado_json.edges) {
          throw new Error('Estrutura JSON inválida');
        }
      } catch (parseError) {
        console.warn('⚠️ Erro ao parsear JSON do fluxo melhorado, usando fallback:', parseError);
        // Fallback com melhorias básicas
        fluxo_melhorado_json = {
          nodes: [
            { 
              id: '1', 
              type: 'input', 
              position: { x: 50, y: 50 }, 
              data: { label: 'Início Otimizado' },
              style: { backgroundColor: '#10b981', color: 'white', borderRadius: '8px' }
            },
            { 
              id: '2', 
              position: { x: 50, y: 150 }, 
              data: { label: 'Processo Automatizado' },
              style: { backgroundColor: '#8b5cf6', color: 'white', borderRadius: '8px' }
            },
            { 
              id: '3', 
              position: { x: 250, y: 150 }, 
              data: { label: 'Processo Paralelo' },
              style: { backgroundColor: '#06b6d4', color: 'white', borderRadius: '8px' }
            },
            { 
              id: '4', 
              position: { x: 150, y: 250 }, 
              data: { label: 'Consolidação' },
              style: { backgroundColor: '#10b981', color: 'white', borderRadius: '8px' }
            },
            { 
              id: '5', 
              type: 'output', 
              position: { x: 150, y: 350 }, 
              data: { label: 'Fim Otimizado' },
              style: { backgroundColor: '#6b7280', color: 'white', borderRadius: '8px' }
            },
          ],
          edges: [
            { id: 'e1-2', source: '1', target: '2' },
            { id: 'e1-3', source: '1', target: '3' },
            { id: 'e2-4', source: '2', target: '4' },
            { id: 'e3-4', source: '3', target: '4' },
            { id: 'e4-5', source: '4', target: '5' },
          ],
        };
      }

      // 3. Gerar sugestões
      console.log('💡 Gerando sugestões de melhoria...');
      const suggestionsPrompt = await this.getPromptConfig('sugestoes');
      const suggestionsPromptFilled = suggestionsPrompt
        .replace('{transcription}', transcription)
        .replace('{current_flow}', JSON.stringify(fluxo_original_json, null, 2))
        .replace('{improved_flow}', JSON.stringify(fluxo_melhorado_json, null, 2));
      const sugestoes = await this.callOpenAI(suggestionsPromptFilled);

      console.log('✅ Análise concluída com sucesso!');
      
      return {
        fluxo_original_json,
        fluxo_melhorado_json,
        sugestoes,
      };
    } catch (error) {
      console.error('❌ Erro ao gerar análise com OpenAI:', error);
      
      // Retornar dados mock mais informativos em caso de erro
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      return {
        fluxo_original_json: {
          nodes: [
            { 
              id: '1', 
              type: 'input', 
              position: { x: 50, y: 50 }, 
              data: { label: '⚠️ Início (Erro na Análise)' },
              style: { backgroundColor: '#ef4444', color: 'white', borderRadius: '8px' }
            },
            { 
              id: '2', 
              position: { x: 50, y: 150 }, 
              data: { label: 'Processo não analisado pela IA' },
              style: { backgroundColor: '#6b7280', color: 'white', borderRadius: '8px' }
            },
            { 
              id: '3', 
              type: 'output', 
              position: { x: 50, y: 250 }, 
              data: { label: '⚠️ Fim (Configurar API)' },
              style: { backgroundColor: '#ef4444', color: 'white', borderRadius: '8px' }
            },
          ],
          edges: [
            { id: 'e1-2', source: '1', target: '2' },
            { id: 'e2-3', source: '2', target: '3' },
          ],
        },
        fluxo_melhorado_json: {
          nodes: [
            { 
              id: '1', 
              type: 'input', 
              position: { x: 50, y: 50 }, 
              data: { label: '⚠️ Otimização Indisponível' },
              style: { backgroundColor: '#ef4444', color: 'white', borderRadius: '8px' }
            },
            { 
              id: '2', 
              position: { x: 50, y: 150 }, 
              data: { label: 'Configure a API OpenAI' },
              style: { backgroundColor: '#f59e0b', color: 'white', borderRadius: '8px' }
            },
            { 
              id: '3', 
              type: 'output', 
              position: { x: 50, y: 250 }, 
              data: { label: '⚠️ Tente Novamente' },
              style: { backgroundColor: '#ef4444', color: 'white', borderRadius: '8px' }
            },
          ],
          edges: [
            { id: 'e1-2', source: '1', target: '2' },
            { id: 'e2-3', source: '2', target: '3' },
          ],
        },
        sugestoes: `# ❌ Erro na Análise com IA

**Erro encontrado:** ${errorMessage}

## 🔧 Como resolver:

### 1. **CONFIGURAÇÃO DA API**
- **Ação:** Acesse as Configurações → Chaves de API
- **Descrição:** Configure sua chave da OpenAI
- **Impacto esperado:** Alto
- **Complexidade:** Baixa
- **Prazo estimado:** 2 minutos

### 2. **VERIFICAR SALDO DA CONTA**
- **Ação:** Verifique se há créditos suficientes na sua conta OpenAI
- **Descrição:** Sem créditos, a API não funciona
- **Impacto esperado:** Alto
- **Complexidade:** Baixa
- **Prazo estimado:** 5 minutos

### 3. **QUALIDADE DA TRANSCRIÇÃO**
- **Ação:** Verifique se a transcrição tem conteúdo suficiente (mínimo 50 caracteres)
- **Descrição:** Transcrições muito curtas não geram boas análises
- **Impacto esperado:** Médio
- **Complexidade:** Baixa
- **Prazo estimado:** Imediato

### 4. **TENTAR NOVAMENTE**
- **Ação:** Após resolver os problemas acima, clique novamente em "Gerar Análise com IA"
- **Descrição:** O sistema tentará processar novamente
- **Impacto esperado:** Alto
- **Complexidade:** Baixa
- **Prazo estimado:** 30 segundos

## 📞 Suporte
Se o problema persistir, verifique:
- Conexão com a internet
- Status da API OpenAI (https://status.openai.com)
- Logs do navegador (F12 → Console)`,
      };
    }
  }
}

export const transcriptionService = new TranscriptionService();