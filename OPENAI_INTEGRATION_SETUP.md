# Integração com API Externa - Sistema de Análise Automática

Este documento descreve como configurar e usar o sistema de integração com API externa que substitui o webhook N8N anterior.

## Visão Geral

O sistema automaticamente:
1. Detecta quando um processo do tipo "texto" é criado
2. Busca o conteúdo da transcrição associada
3. Envia os dados para a API externa
4. **A API externa é responsável por processar os dados e inserir na tabela `analise_fluxo`**

## Configuração

### 1. Executar a Migração

```sql
-- Execute a migração no console SQL do Supabase
-- Arquivo: supabase/migrations/20250125000002_add_openai_integration.sql
```

### 2. Configurar URL da API Externa

**OPÇÃO 1: Usando Supabase Vault (Recomendado)**

1. No painel do Supabase, vá em **Settings** → **Vault**
2. Clique em **Add new secret**
3. Nome: `external_api_url`
4. Valor: URL da sua API externa (https://sua-api.com/endpoint)
5. Clique em **Save**

**OPÇÃO 2: Usando variável de ambiente**

No arquivo `.env` do backend:
```env
EXTERNAL_API_URL=https://sua-api.com/endpoint
```

**Configurar a URL da API Externa:**
1. Defina o endpoint da sua API externa
2. Certifique-se de que a API aceita requisições POST
3. Configure os headers necessários se houver autenticação
4. Teste a conectividade com a API

**Verificar se a URL foi configurada (Vault):**
```sql
SELECT vault.decrypted_secrets WHERE name = 'external_api_url';
```

### 3. Verificar Extensão HTTP

```sql
-- Certifique-se de que a extensão http está disponível
CREATE EXTENSION IF NOT EXISTS http;
```

### 4. Ativar o Trigger Automático (Opcional)

Por padrão, o trigger está desabilitado. Para ativar:

```sql
CREATE TRIGGER trigger_processo_external_api_analysis
  AFTER INSERT ON processos
  FOR EACH ROW
  EXECUTE FUNCTION trigger_external_api_analysis();
```

## Formato da API Externa

### Requisição POST

A API externa receberá requisições POST com o seguinte formato:

```json
{
  "transcricao": {
    "id": "uuid-da-transcricao",
    "conteudo": "texto completo da transcrição",
    "tipo": "Analise Inicial"
  },
  "processo": {
    "id": "uuid-do-processo",
    "nome": "nome do processo",
    "cliente": "nome do cliente",
    "tipo_entrada": "texto"
  },
  "timestamp": "2024-01-25T10:00:00Z"
}
```

### Responsabilidade da API Externa

**Sua API deve:**
1. Receber os dados da transcrição
2. Processar/analisar o conteúdo conforme necessário
3. **Inserir os resultados diretamente na tabela `analise_fluxo` do Supabase**
4. Retornar uma resposta de confirmação

### Resposta Esperada

A API pode retornar qualquer formato de resposta (será apenas logado):

**Exemplo de resposta:**
```json
{
  "success": true,
  "message": "Análise processada e inserida com sucesso",
  "analise_id": "uuid-da-analise-criada"
}
```

## Estrutura das Tabelas

### Tabela `prompts_analise`

A tabela deve conter os prompts com a seguinte estrutura:
- `tipo`: Tipo do prompt ('analise_inicial', 'as_is', 'to_be')
- `system_prompt`: Prompt do sistema para a OpenAI
- `user_template`: Template do prompt do usuário (pode conter `{transcription}`)
- `ativo`: Boolean indicando se o prompt está ativo
- `nome`: Nome descritivo do prompt (usado no campo 'estado' da analise_fluxo)

### Tabela `logs`

A tabela de logs registra todos os eventos do sistema:
- `id`: ID único do log (BIGSERIAL)
- `level`: Nível do log ('debug', 'info', 'warn', 'error')
- `message`: Mensagem do log
- `metadata`: Dados adicionais em formato JSON
- `created_at`: Timestamp de criação

### Mapeamento Tipo Transcrição → Tipo Prompt

O sistema mapeia automaticamente os tipos:
- `'Analise Inicial'` (transcricoes.tipo_transcricao) → `'analise_inicial'` (prompts_analise.tipo)
- `'Estado Atual'` (transcricoes.tipo_transcricao) → `'as_is'` (prompts_analise.tipo)
- `'Estado Futuro'` (transcricoes.tipo_transcricao) → `'to_be'` (prompts_analise.tipo)

### Tabela `analise_fluxo`

Os resultados são inseridos com os seguintes campos:
- `processo_id`: ID do processo
- `transcricao_id`: ID da transcrição
- `estado`: Nome do prompt usado (campo 'nome' da tabela prompts_analise)
- `seq`: Sequência (1)
- `responsavel_area`: Área responsável
- `etapa_descricao`: Descrição da etapa
- `desvios_variacoes`: JSONB com array de desvios
- `problemas`: JSONB com array de problemas
- `causas_possiveis`: JSONB com array de causas possíveis
- `kaizen_discutido`: Kaizen discutido
- `kaizen_alternativo_boas_praticas`: JSONB com array de boas práticas
- `referencia_acordada`: Referência acordada
- `timestamp_inicio`: Timestamp de início
- `timestamp_fim`: Timestamp de fim
- `evidencia_texto`: Texto completo da resposta da IA
- `created_at`: Data de criação

## Funções Disponíveis

### `get_prompt_analise(prompt_tipo TEXT)`
Busca prompts ativos da tabela `prompts_analise` por tipo.

```sql
SELECT * FROM get_prompt_analise('analise_inicial');
```

### `call_openai_api(system_prompt TEXT, user_prompt TEXT, api_key TEXT)`
Faz chamada para a API da OpenAI.

```sql
SELECT call_openai_api(
  'Você é um especialista em análise de processos.',
  'Analise este processo: [conteúdo]'
);
```

### `process_transcricao_with_openai(processo_id UUID, transcricao_id UUID)`
Processa uma transcrição específica com OpenAI.

```sql
SELECT process_transcricao_with_openai(
  'uuid-do-processo',
  'uuid-da-transcricao'
);
```

### `test_openai_integration(processo_id UUID)`
Testa a integração completa para um processo específico.

```sql
SELECT test_openai_integration('uuid-do-processo');
```

## Teste Manual

### 1. Verificar Configuração

```sql
-- Verificar se a chave está configurada
SHOW app.openai_api_key;

-- Verificar se há prompts ativos
SELECT * FROM prompts_analise WHERE ativo = true;

-- Verificar se há processos e transcrições
SELECT p.id, p.nome, p.tipo_entrada, t.id as transcricao_id
FROM processos p
LEFT JOIN transcricoes t ON p.id = t.processo_id
WHERE p.tipo_entrada = 'texto'
ORDER BY p.created_at DESC;
```

### 2. Testar com Processo Existente

```sql
-- Substitua pelo UUID de um processo real
SELECT test_openai_integration('seu-processo-uuid-aqui');
```

### 3. Verificar Resultados

```sql
-- Verificar se foi inserido na analise_fluxo
SELECT * FROM analise_fluxo 
WHERE processo_id = 'seu-processo-uuid-aqui'
ORDER BY created_at DESC;

-- Verificar logs
SELECT * FROM logs 
WHERE message LIKE '%OpenAI%'
ORDER BY created_at DESC;
```

## Fluxo de Funcionamento

1. **Criação do Processo**: Usuário cria um processo do tipo "texto"
2. **Trigger Ativado**: O trigger `trigger_openai_analysis()` é executado
3. **Busca Transcrição**: Sistema busca a transcrição mais recente e concluída
4. **Busca Prompt**: Sistema mapeia o tipo_transcricao para o tipo de prompt correspondente e busca o prompt ativo
5. **Prepara Requisição**: Substitui `{transcription}` no template do usuário
6. **Chama OpenAI**: Envia system_prompt e user_prompt para a API
7. **Processa Resposta**: Tenta parsear como JSON ou trata como texto
8. **Insere Resultado**: Salva na tabela `analise_fluxo`
9. **Log**: Registra sucesso ou erro nos logs

## Tratamento de Erros

- **Chave API não configurada**: Exceção com mensagem clara
- **Prompt não encontrado**: Exceção indicando tipo de prompt
- **Falha na API**: Log do erro com status HTTP
- **Resposta inválida**: Tratamento como texto simples
- **Erro no trigger**: Log do erro mas não falha a inserção do processo

## Logs

Todos os eventos são registrados na tabela `logs`:
- **info**: Chamadas bem-sucedidas com metadados
- **error**: Erros com detalhes para debugging

```sql
-- Visualizar logs recentes
SELECT level, message, metadata, created_at
FROM logs
WHERE message LIKE '%OpenAI%'
ORDER BY created_at DESC
LIMIT 10;
```

## Monitoramento e Logs

### Consultar logs gerais
```sql
SELECT 
  level,
  message,
  metadata,
  created_at
FROM logs 
ORDER BY created_at DESC 
LIMIT 20;
```

### Consultar apenas erros
```sql
SELECT 
  message,
  metadata,
  created_at
FROM logs 
WHERE level = 'error'
ORDER BY created_at DESC;
```

### Consultar resposta completa da API Externa (para debug)
```sql
SELECT 
  message,
  metadata->>'response_content' as api_response,
  metadata->>'full_response' as full_api_response,
  metadata->>'api_content_raw' as raw_content,
  metadata->>'parsed_result' as parsed_data,
  metadata->>'processo_id' as processo_id,
  metadata->>'transcricao_id' as transcricao_id,
  created_at
FROM logs 
WHERE level = 'info' 
  AND message LIKE '%External API%'
ORDER BY created_at DESC;
```

### Verificar se campos estão sendo preenchidos corretamente
```sql
SELECT 
  processo_id,
  transcricao_id,
  estado,
  responsavel_area,
  etapa_descricao,
  desvios_variacoes,
  problemas,
  causas_possiveis,
  kaizen_alternativo_boas_praticas,
  created_at
FROM analise_fluxo 
ORDER BY created_at DESC 
LIMIT 10;
```

### Debug: Verificar conteúdo da transcrição
```sql
SELECT 
  message,
  metadata->>'transcricao_id' as transcricao_id,
  metadata->>'transcricao_tipo' as tipo,
  metadata->>'conteudo_length' as tamanho_conteudo,
  metadata->>'conteudo_preview' as preview_conteudo,
  created_at
FROM logs 
WHERE level = 'debug' 
  AND message = 'Conteúdo da transcrição carregado'
ORDER BY created_at DESC;
```

### Debug: Verificar substituição do placeholder
```sql
SELECT 
  message,
  metadata->>'user_template_original' as template_original,
  metadata->>'contains_placeholder' as tem_placeholder,
  metadata->>'user_template_final' as template_final,
  metadata->>'still_contains_placeholder' as ainda_tem_placeholder,
  created_at
FROM logs 
WHERE level = 'debug' 
  AND message IN ('Template antes da substituição', 'Template após substituição')
ORDER BY created_at DESC;
```

### Verificar transcrições disponíveis
```sql
SELECT 
  id,
  processo_id,
  tipo_transcricao,
  status,
  LENGTH(conteudo) as tamanho_conteudo,
  LEFT(conteudo, 100) as preview_conteudo,
  created_at
FROM transcricoes 
WHERE processo_id = 'SEU_PROCESSO_ID_AQUI'
ORDER BY created_at DESC;
```

## Personalização

### Modificar Prompts
Edite os registros na tabela `prompts_analise` para personalizar o comportamento da IA.

### Adicionar Novos Tipos
Crie novos tipos de prompt e modifique a função `process_transcricao_with_openai()` para usar diferentes tipos conforme necessário.

### Configurar Modelo
Modifique o modelo da OpenAI na função `call_openai_api()` (padrão: gpt-4).

## Troubleshooting

### Problema: "External API URL not found"

**Solução:**
1. Verifique se a URL foi configurada no Vault:
   ```sql
   SELECT name FROM vault.decrypted_secrets WHERE name = 'external_api_url';
   ```
2. Se não aparecer, configure novamente no Vault
3. Reinicie a função ou execute novamente

### Problema: "API connection failed"

**Solução:**
1. Verifique se a URL da API está correta
2. Teste a conectividade:
   ```sql
   SELECT http_post(
     'https://sua-api.com/endpoint',
     '{}',
     'application/json'
   );
   ```
3. Verifique se a API está online e acessível
4. Confirme se não há problemas de firewall ou rede

### API response processing failed

**Erro:** `API response processing failed`

**Soluções:**
1. Verificar se sua API está processando os dados corretamente
2. Verificar se sua API está inserindo os dados na tabela `analise_fluxo`
3. Testar a API manualmente:
   ```bash
   curl -X POST "sua-api-url" \
     -H "Content-Type: application/json" \
     -d '{"transcricao":{"id":"test-id","conteudo":"teste"},"processo":{"id":"test-processo"}}'
   ```
4. Verificar logs da sua API para identificar erros internos

### Erro: "External API URL not configured"
```sql
-- Verificar se a URL está no Vault
SELECT name FROM vault.decrypted_secrets WHERE name = 'external_api_url';

-- Se não estiver, configurar:
-- 1. Vá no Supabase Dashboard → Settings → Vault
-- 2. Add new secret: external_api_url
```

### 🚀 Próximos Passos:
1. Execute a migração: `npx supabase db reset` (no diretório supabase)
   *A migração habilitará automaticamente a extensão HTTP necessária*
2. Configure a chave OpenAI no Supabase Vault (Settings → Vault → Add secret: `openai_api_key`)
3. Ative o trigger: `SELECT enable_openai_trigger();`
4. Teste: `SELECT test_openai_integration('uuid-do-processo');`

### 🔧 Funções de Controle:

**Ativar o trigger automático:**
```sql
SELECT enable_openai_trigger();
```

**Desativar o trigger automático:**
```sql
SELECT disable_openai_trigger();
```

**Testar manualmente:**
```sql
SELECT test_openai_integration('uuid-do-processo');
```

### Erro: "Prompt do tipo X não encontrado"
```sql
-- Verificar se há prompts ativos para cada tipo
SELECT tipo, nome, ativo FROM prompts_analise WHERE ativo = true;

-- Verificar mapeamento de tipos
SELECT 
  'Analise Inicial' as tipo_transcricao,
  map_transcricao_to_prompt_type('Analise Inicial') as tipo_prompt
UNION ALL
SELECT 
  'Estado Atual' as tipo_transcricao,
  map_transcricao_to_prompt_type('Estado Atual') as tipo_prompt
UNION ALL
SELECT 
  'Estado Futuro' as tipo_transcricao,
  map_transcricao_to_prompt_type('Estado Futuro') as tipo_prompt;
```

### Erro: "type 'http_response_result' does not exist"
A extensão `http` não está disponível no Supabase. Use Edge Functions como alternativa.

### Resposta vazia da OpenAI
Verifique se os prompts estão bem formatados e se a chave da API está correta.

## Migração do Sistema N8N

Este sistema substitui completamente o webhook N8N anterior:
- ✅ Não requer configuração externa
- ✅ Execução mais rápida e confiável
- ✅ Melhor tratamento de erros
- ✅ Logs integrados
- ✅ Customização via banco de dados

Para desativar o sistema N8N anterior, remova ou desabilite os triggers relacionados ao webhook.