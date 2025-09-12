-- Migration: Adicionar trigger para webhook N8N quando transcrição de texto for criada
-- Execute no console SQL do Supabase

-- 1. Criar extensão para fazer requisições HTTP (se não existir)
-- Nota: A extensão 'http' precisa estar disponível no Supabase
CREATE EXTENSION IF NOT EXISTS http;

-- Verificar se a extensão foi criada com sucesso
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'http') THEN
    RAISE EXCEPTION 'Extensão http não está disponível. Verifique se está habilitada no Supabase.';
  END IF;
  RAISE NOTICE 'Extensão http carregada com sucesso';
END;
$$;

-- 2. Configuração do webhook (URL hardcoded)
-- IMPORTANTE: Altere a URL abaixo para sua instância N8N
-- Exemplo: 'https://seu-n8n-instance.com/webhook/transcricao-texto'
CREATE OR REPLACE FUNCTION get_webhook_url()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  -- URL do webhook N8N configurada
  RETURN 'https://agentes-n8n.pod3wz.easypanel.host/webhook/430e85e5-7a93-4e30-b2ce-5c71e120f1ba';
END;
$$;

-- 5. Função para chamar webhook N8N
CREATE OR REPLACE FUNCTION call_n8n_webhook(
  webhook_url TEXT,
  payload JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response_status INTEGER;
  response_content TEXT;
BEGIN
  -- Fazer requisição HTTP POST para o webhook
  SELECT status, content INTO response_status, response_content
  FROM http_post(
    webhook_url,
    payload::TEXT,
    'application/json'
  );
  
  -- Log da resposta (opcional)
  RAISE NOTICE 'Webhook response status: %, content: %', response_status, response_content;
  
  -- Retornar true se sucesso (status 2xx)
  RETURN response_status >= 200 AND response_status < 300;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erro ao chamar webhook: %', SQLERRM;
    RETURN FALSE;
END;
$$;

-- 6. Função trigger para chamar webhook quando transcrição de texto for criada
CREATE OR REPLACE FUNCTION trigger_webhook_transcricao_texto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  processo_record processos%ROWTYPE;
  cliente_record clientes%ROWTYPE;
  webhook_url TEXT;
  payload JSONB;
  webhook_success BOOLEAN;
BEGIN
  -- Buscar informações do processo relacionado
  SELECT * INTO processo_record
  FROM processos
  WHERE id = NEW.processo_id;
  
  -- Verificar se o processo é do tipo 'texto'
  IF processo_record.tipo_entrada = 'texto' THEN
    
    -- Buscar informações do cliente
    SELECT * INTO cliente_record
    FROM clientes
    WHERE id = processo_record.cliente_id;
    
    -- Obter URL do webhook
    SELECT get_webhook_url() INTO webhook_url;
    
    -- Verificar se URL está configurada
     IF webhook_url IS NOT NULL THEN
      
      -- Preparar payload completo com TODO o conteúdo da transcrição
      payload := jsonb_build_object(
        'event_type', 'transcricao_texto_created',
        'transcricao', jsonb_build_object(
          'id', NEW.id,
          'processo_id', NEW.processo_id,
          'conteudo_completo', NEW.conteudo, -- TODO o conteúdo da coluna conteudo
          'status', NEW.status,
          'created_at', NEW.created_at,
          'updated_at', NEW.updated_at
        ),
        'processo', jsonb_build_object(
          'id', processo_record.id,
          'nome', processo_record.nome,
          'cliente_id', processo_record.cliente_id,
          'tipo_entrada', processo_record.tipo_entrada,
          'conteudo_texto_original', processo_record.conteudo_texto, -- Texto original do processo
          'created_at', processo_record.created_at
        ),
        'cliente', jsonb_build_object(
          'id', cliente_record.id,
          'nome', cliente_record.nome,
          'email', cliente_record.email,
          'telefone', cliente_record.telefone
        ),
        'timestamp', NOW(),
        'metadata', jsonb_build_object(
          'source', 'supabase_trigger',
          'trigger_name', 'trigger_webhook_transcricao_texto'
        )
      );
      
      -- Chamar webhook (de forma assíncrona para não bloquear a inserção)
      SELECT call_n8n_webhook(webhook_url, payload) INTO webhook_success;
      
      -- Log do resultado
      IF webhook_success THEN
        RAISE NOTICE 'Webhook N8N chamado com sucesso para transcrição % - Conteúdo enviado: % caracteres', NEW.id, LENGTH(NEW.conteudo);
      ELSE
        RAISE NOTICE 'Falha ao chamar webhook N8N para transcrição %', NEW.id;
      END IF;
      
    ELSE
      RAISE NOTICE 'Webhook N8N não configurado. Configure a URL na função get_webhook_url()';
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- 7. Criar o trigger
DROP TRIGGER IF EXISTS trigger_webhook_transcricao_texto ON transcricoes;
CREATE TRIGGER trigger_webhook_transcricao_texto
  AFTER INSERT ON transcricoes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_webhook_transcricao_texto();

-- 8. Comentários para documentação
COMMENT ON FUNCTION get_webhook_url() IS 'Retorna a URL do webhook N8N configurada (hardcoded)';
COMMENT ON FUNCTION call_n8n_webhook(TEXT, JSONB) IS 'Função para fazer chamadas HTTP para webhooks N8N';
COMMENT ON FUNCTION trigger_webhook_transcricao_texto() IS 'Trigger que chama webhook N8N quando transcrição de texto é criada - envia TODO o conteúdo da coluna conteudo';

-- 9. Função para testar webhook manualmente (apenas para debug)
CREATE OR REPLACE FUNCTION test_webhook_manual(
  test_transcricao_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  webhook_url TEXT;
  test_payload JSONB;
  webhook_success BOOLEAN;
BEGIN
  -- Obter URL do webhook
  SELECT get_webhook_url() INTO webhook_url;
  
  -- Criar payload de teste
  test_payload := jsonb_build_object(
    'event_type', 'test_webhook_manual',
    'message', 'Teste manual do webhook N8N',
    'test_transcricao_id', COALESCE(test_transcricao_id::TEXT, 'test-id'),
    'timestamp', NOW(),
    'test_data', jsonb_build_object(
      'conteudo_exemplo', 'Este é um exemplo de conteúdo completo que seria enviado pelo trigger quando uma transcrição de texto é criada. O sistema envia TODO o conteúdo da coluna conteudo da tabela transcricoes.',
      'caracteres_exemplo', 150
    )
  );
  
  -- Chamar webhook
  SELECT call_n8n_webhook(webhook_url, test_payload) INTO webhook_success;
  
  -- Log do resultado
  IF webhook_success THEN
    RAISE NOTICE 'Teste do webhook executado com sucesso';
  ELSE
    RAISE NOTICE 'Falha no teste do webhook';
  END IF;
  
  RETURN webhook_success;
END;
$$;

-- 10. Instruções para configuração
DO $$
BEGIN
  RAISE NOTICE '=== CONFIGURAÇÃO DO WEBHOOK N8N ===';
  RAISE NOTICE '1. Edite a função get_webhook_url() e altere a URL para sua instância N8N';
  RAISE NOTICE '2. O trigger enviará TODO o conteúdo da coluna "conteudo" da tabela transcricoes';
  RAISE NOTICE '3. Use SELECT test_webhook_manual(); para testar a configuração';
  RAISE NOTICE '4. O webhook será chamado automaticamente quando processos tipo "texto" gerarem transcrições';
END;
$$;