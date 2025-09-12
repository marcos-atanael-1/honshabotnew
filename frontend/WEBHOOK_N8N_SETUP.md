# Configuração do Webhook N8N para Transcrições de Texto

Este documento explica como configurar e usar o sistema de webhook N8N que é chamado automaticamente quando uma transcrição de texto é criada.

## 📋 Visão Geral

Quando um processo do tipo "texto" é criado na tabela `processos`, automaticamente uma linha é inserida na tabela `transcricoes` com o conteúdo da coluna `conteudo_texto`. O sistema agora inclui um trigger que chama um webhook N8N sempre que isso acontece.

## 🚀 Configuração Inicial

### 1. Executar a Migração SQL

Primeiro, execute a migração SQL no console do Supabase:

```bash
# Arquivo: supabase/migrations/20250125000000_add_webhook_trigger.sql
```

Esta migração irá:
- Instalar a extensão `http` para fazer requisições HTTP
- Criar a tabela `webhook_configs` para gerenciar URLs de webhook
- Criar funções para chamar webhooks
- Criar o trigger que monitora inserções na tabela `transcricoes`
- Configurar políticas RLS apropriadas

### 2. Configurar no N8N

1. **Criar um novo Workflow no N8N:**
   - Abra seu N8N
   - Crie um novo workflow
   - Adicione um nó "Webhook" como trigger

2. **Configurar o Webhook:**
   - Método: `POST`
   - Caminho: `/webhook/transcricao-texto` (ou outro de sua escolha)
   - Copie a URL completa gerada

3. **Estrutura do Payload:**
   O webhook receberá um JSON com a seguinte estrutura:
   ```json
   {
     "event_type": "transcricao_texto_created",
     "transcricao": {
       "id": "uuid-da-transcricao",
       "processo_id": "uuid-do-processo",
       "conteudo": "Conteúdo da transcrição...",
       "status": "pendente",
       "created_at": "2025-01-25T10:30:00Z"
     },
     "processo": {
       "id": "uuid-do-processo",
       "nome": "Nome do processo",
       "cliente_id": "uuid-do-cliente",
       "tipo_entrada": "texto",
       "conteudo_texto": "Texto original do processo..."
     },
     "timestamp": "2025-01-25T10:30:00Z"
   }
   ```

### 3. Configurar no Frontend

1. **Acessar o Painel de Administração:**
   - Faça login como administrador
   - Acesse `/admin` no navegador
   - Clique na aba "Webhooks"

2. **Configurar a URL do Webhook:**
   - Cole a URL do webhook N8N no campo "URL do Webhook N8N"
   - Ative o webhook usando o switch "Webhook ativo"
   - Clique em "Salvar Configuração"

3. **Testar o Webhook:**
   - Clique no botão "Testar"
   - Verifique se o webhook recebe o payload de teste no N8N

## 🔧 Funções Disponíveis

### Funções SQL Criadas

1. **`call_n8n_webhook(webhook_url, payload)`**
   - Faz uma requisição HTTP POST para o webhook
   - Retorna `true` se sucesso, `false` se erro

2. **`update_webhook_url(webhook_name, new_url)`**
   - Atualiza a URL de um webhook (apenas admins)
   - Usado pelo frontend para salvar configurações

3. **`toggle_webhook(webhook_name, active)`**
   - Ativa/desativa um webhook (apenas admins)
   - Usado pelo frontend para controlar status

### Trigger Criado

- **`trigger_webhook_transcricao_texto`**
  - Executado após inserção na tabela `transcricoes`
  - Verifica se o processo relacionado é do tipo "texto"
  - Chama o webhook N8N se configurado e ativo

## 📊 Monitoramento

### Logs do Sistema

O sistema gera logs que podem ser visualizados:

```sql
-- Ver logs recentes do Postgres
SELECT * FROM pg_stat_statements WHERE query LIKE '%webhook%';
```

### Verificar Status do Webhook

```sql
-- Ver configurações de webhook
SELECT * FROM webhook_configs WHERE name = 'n8n_transcricao_texto';

-- Testar webhook manualmente
SELECT call_n8n_webhook(
  'https://sua-url-n8n.com/webhook/transcricao-texto',
  '{"test": "payload"}'
);
```

## 🛠️ Troubleshooting

### Webhook não está sendo chamado

1. **Verificar se o webhook está ativo:**
   ```sql
   SELECT is_active FROM webhook_configs WHERE name = 'n8n_transcricao_texto';
   ```

2. **Verificar se o trigger existe:**
   ```sql
   SELECT * FROM information_schema.triggers 
   WHERE trigger_name = 'trigger_webhook_transcricao_texto';
   ```

3. **Verificar logs do Postgres:**
   - Os logs aparecem como `NOTICE` no console do Supabase
   - Procure por mensagens como "Webhook N8N chamado com sucesso"

### Erro de permissão

- Certifique-se de que o usuário tem role 'admin' na tabela `users`
- Verifique as políticas RLS da tabela `webhook_configs`

### Webhook recebe dados mas N8N não processa

1. **Verificar configuração do N8N:**
   - Método deve ser POST
   - Content-Type deve aceitar application/json

2. **Verificar estrutura do payload:**
   - Use o botão "Testar" no frontend para enviar um payload de exemplo
   - Verifique se o N8N está recebendo os dados corretamente

## 🔄 Fluxo Completo

1. **Usuário cria processo de texto** → Frontend envia dados para `processos`
2. **Sistema cria transcrição** → Trigger insere em `transcricoes` com `conteudo_texto`
3. **Trigger detecta inserção** → Verifica se processo é tipo "texto"
4. **Webhook é chamado** → Envia dados para N8N
5. **N8N processa** → Executa workflow configurado

## 📝 Exemplo de Workflow N8N

Aqui está um exemplo básico de workflow N8N:

```json
{
  "nodes": [
    {
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "httpMethod": "POST",
        "path": "transcricao-texto"
      }
    },
    {
      "name": "Processar Transcrição",
      "type": "n8n-nodes-base.function",
      "parameters": {
        "functionCode": "// Processar dados da transcrição\nconst transcricao = $json.transcricao;\nconst processo = $json.processo;\n\n// Sua lógica aqui\nconsole.log('Nova transcrição:', transcricao.id);\n\nreturn $json;"
      }
    }
  ]
}
```

## 🔐 Segurança

- Apenas administradores podem configurar webhooks
- URLs de webhook são validadas antes de serem salvas
- Triggers são executados com `SECURITY DEFINER` para garantir permissões adequadas
- Logs são gerados para auditoria

## 📞 Suporte

Se encontrar problemas:

1. Verifique os logs do Supabase
2. Teste o webhook manualmente usando o botão "Testar"
3. Verifique se o N8N está acessível e configurado corretamente
4. Consulte a documentação do N8N para configurações específicas