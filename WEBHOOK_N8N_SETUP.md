# Configuração do Webhook N8N para Transcrições de Texto

Este documento explica como configurar o sistema de webhook N8N para receber notificações automáticas quando transcrições de texto são criadas no sistema.

## Visão Geral

O sistema automaticamente chama um webhook N8N sempre que:
- Um processo do tipo "texto" é criado
- Uma transcrição é gerada a partir desse processo
- **O webhook envia TODO o conteúdo da coluna `conteudo` da tabela `transcricoes`**

## 1. Executar a Migração

Primeiro, execute a migração SQL no Supabase:

```sql
-- Execute o arquivo: 20250125000000_add_webhook_trigger.sql
-- Isso criará:
-- - Extensão HTTP para fazer chamadas externas
-- - Função get_webhook_url() com URL hardcoded
-- - Função para chamar webhooks
-- - Trigger automático para transcrições de texto
```

## 2. URL do Webhook Configurada ✅

A URL do webhook N8N já está configurada na função `get_webhook_url()`:

```
https://agentes-n8n.pod3wz.easypanel.host/webhook/430e85e5-7a93-4e30-b2ce-5c71e120f1ba
```

**✅ PRONTO**: O sistema está configurado para enviar dados para sua instância N8N automaticamente.

## 3. Configurar N8N Workflow

### 3.1 Criar Webhook Node

1. No N8N, crie um novo workflow
2. Adicione um node "Webhook"
3. Configure:
   - **HTTP Method**: POST
   - **Path**: `/webhook/transcricao-texto`
   - **Authentication**: None (ou configure conforme necessário)

### 3.2 Estrutura do Payload

O webhook receberá um payload JSON com esta estrutura completa:

```json
{
  "event_type": "transcricao_texto_created",
  "transcricao": {
    "id": "uuid-da-transcricao",
    "processo_id": "uuid-do-processo",
    "conteudo_completo": "TODO O CONTEÚDO DA TRANSCRIÇÃO AQUI - pode ser muito longo...",
    "status": "concluida",
    "created_at": "2025-01-25T10:30:00Z",
    "updated_at": "2025-01-25T10:30:00Z"
  },
  "processo": {
    "id": "uuid-do-processo",
    "nome": "Nome do Processo",
    "cliente_id": "uuid-do-cliente",
    "tipo_entrada": "texto",
    "conteudo_texto_original": "Texto original inserido pelo usuário...",
    "created_at": "2025-01-25T10:25:00Z"
  },
  "cliente": {
    "id": "uuid-do-cliente",
    "nome": "Nome do Cliente",
    "email": "cliente@email.com",
    "telefone": "+55 11 99999-9999"
  },
  "timestamp": "2025-01-25T10:30:00Z",
  "metadata": {
    "source": "supabase_trigger",
    "trigger_name": "trigger_webhook_transcricao_texto"
  }
}
```

**📝 NOTA IMPORTANTE**: O campo `conteudo_completo` contém **TODO** o texto da transcrição, que pode ser muito extenso dependendo do tamanho do documento processado.

## 4. Testar a Configuração

### 4.1 Teste Manual

Após configurar a URL, teste o webhook:

```sql
-- Testar webhook manualmente
SELECT test_webhook_manual();

-- Ou com ID específico para debug
SELECT test_webhook_manual('test-uuid-123');
```

### 4.2 Verificar Logs

Monitore os logs do PostgreSQL no Supabase:
- Sucesso: "Webhook N8N chamado com sucesso para transcrição {id} - Conteúdo enviado: {X} caracteres"
- Falha: "Falha ao chamar webhook N8N para transcrição {id}"
- Não configurado: "Webhook N8N não configurado. Configure a URL na função get_webhook_url()"

## 5. Fluxo de Funcionamento

1. **Usuário cria processo tipo "texto"**
   - Sistema salva na tabela `processos`
   - Campo `tipo_entrada = 'texto'`

2. **Sistema processa e cria transcrição**
   - Insere registro na tabela `transcricoes`
   - **Campo `conteudo` contém TODO o texto processado**
   - Trigger `trigger_webhook_transcricao_texto` é ativado automaticamente

3. **Trigger verifica condições**
   - Confirma que processo é tipo "texto"
   - Obtém URL do webhook via `get_webhook_url()`
   - Verifica se URL foi configurada (diferente da URL padrão)
   - Prepara payload completo com **TODO o conteúdo**

4. **Chamada do webhook**
   - Faz requisição HTTP POST para N8N
   - Envia payload JSON com conteúdo completo
   - Registra resultado e tamanho do conteúdo nos logs

## 6. Troubleshooting

### 6.1 Erro: type "http_response_result" does not exist

Este erro indica que a extensão `http` não está disponível no Supabase:

1. **Verificar extensões disponíveis:**
   ```sql
   SELECT * FROM pg_available_extensions WHERE name = 'http';
   ```

2. **Se a extensão não estiver disponível:**
   - A extensão `http` pode não estar habilitada em todas as instâncias do Supabase
   - Entre em contato com o suporte do Supabase para habilitar a extensão
   - Como alternativa, use Edge Functions do Supabase para fazer requisições HTTP

3. **Solução alternativa com Edge Functions:**
   
   Se a extensão `http` não estiver disponível, use a migração alternativa:
   
   ```sql
   -- Execute esta migração ao invés da principal
   \i supabase/migrations/20250125000001_add_webhook_trigger_edge_function.sql
   ```
   
   **Passos para configurar Edge Functions:**
   
   a) **Deploy da Edge Function:**
   ```bash
   # No diretório do projeto
   supabase functions deploy webhook-caller
   ```
   
   b) **Atualizar URL da Edge Function na migração:**
   ```sql
   -- Substitua YOUR_PROJECT_REF pelo ID do seu projeto
   -- Encontre em: Supabase Dashboard > Settings > General > Reference ID
   UPDATE pg_proc 
   SET prosrc = REPLACE(prosrc, 'YOUR_PROJECT_REF', 'seu-project-ref-aqui')
   WHERE proname = 'call_n8n_webhook_via_edge_function';
   ```
   
   c) **Ativar o trigger:**
   ```sql
   -- Descomente e execute estas linhas na migração
   DROP TRIGGER IF EXISTS trigger_webhook_transcricao_texto_edge ON transcricoes;
   CREATE TRIGGER trigger_webhook_transcricao_texto_edge
     AFTER INSERT ON transcricoes
     FOR EACH ROW
     EXECUTE FUNCTION trigger_webhook_transcricao_texto_edge();
   ```
   
   d) **Testar a Edge Function:**
   ```bash
   curl -X POST 'https://seu-project-ref.supabase.co/functions/v1/webhook-caller' \
     -H 'Authorization: Bearer YOUR_ANON_KEY' \
     -H 'Content-Type: application/json' \
     -d '{
       "webhook_url": "https://agentes-n8n.pod3wz.easypanel.host/webhook/430e85e5-7a93-4e30-b2ce-5c71e120f1ba",
       "payload": {"test": "message"}
     }'
   ```

### 6.2 Webhook não está sendo chamado

```sql
-- Verificar se trigger existe
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'trigger_webhook_transcricoes_texto';

-- Verificar URL configurada
SELECT get_webhook_url();

-- Testar manualmente
SELECT test_webhook_manual();
```

### 6.3 Erro de conectividade

1. Verifique se a extensão `http` está instalada:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'http';
   ```

2. Teste conectividade básica:
   ```sql
   SELECT status FROM http_get('https://httpbin.org/get');
   ```

### 6.3 Verificar URL Configurada

Para verificar se a URL está correta:

```sql
-- Verificar URL configurada
SELECT get_webhook_url();
-- Deve retornar: https://agentes-n8n.pod3wz.easypanel.host/webhook/430e85e5-7a93-4e30-b2ce-5c71e120f1ba
```

## 7. Segurança

### 7.1 Considerações

- Função usa `SECURITY DEFINER` para execução privilegiada
- Webhook é chamado apenas para processos tipo "texto"
- Logs detalhados para auditoria
- **Conteúdo completo é enviado** - certifique-se de que seu N8N está seguro

### 7.2 Proteção de Dados

- Configure autenticação no seu webhook N8N se necessário
- Use HTTPS para conexões seguras
- Monitore logs para detectar chamadas não autorizadas

## 8. Exemplo de Workflow N8N

```javascript
// Node de processamento no N8N
const payload = $json;
const transcricao = payload.transcricao;
const processo = payload.processo;
const cliente = payload.cliente;

// Acessar o conteúdo completo da transcrição
const conteudoCompleto = transcricao.conteudo_completo;
const tamanhoTexto = conteudoCompleto.length;

console.log(`Nova transcrição recebida: ${transcricao.id}`);
console.log(`Cliente: ${cliente.nome}`);
console.log(`Processo: ${processo.nome}`);
console.log(`Tamanho do conteúdo: ${tamanhoTexto} caracteres`);

// Processar o conteúdo completo conforme necessário
// Exemplo: enviar para outro serviço, salvar em arquivo, etc.

return {
  processado: true,
  transcricao_id: transcricao.id,
  caracteres_processados: tamanhoTexto,
  timestamp: new Date().toISOString()
};
```

---

**✅ RESUMO**: O sistema envia **TODO** o conteúdo da coluna `conteudo` da tabela `transcricoes` para o webhook N8N quando um processo tipo "texto" gera uma transcrição. Basta configurar a URL na função `get_webhook_url()` e o sistema funcionará automaticamente.