-- Migration: Webhook N8N usando Edge Functions (alternativa para quando extensão http não está disponível)
-- Execute no console SQL do Supabase

-- 1. Configuração do webhook (URL hardcoded)
CREATE OR REPLACE FUNCTION get_webhook_url()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  -- URL do webhook N8N configurada
  RETURN 'https://agentes-n8n.pod3wz.easypanel.host/webhook/430e85e5-7a93-4e30-b2ce-5c71e120f1ba';
END;
$$;

-- 2. Função para chamar Edge Function que fará a requisição HTTP
CREATE OR REPLACE FUNCTION call_n8n_webhook_via_edge_function(
  webhook_url TEXT,
  payload JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url TEXT;
  response_status INTEGER;
BEGIN
  -- URL da Edge Function (você precisará criar esta função)
  -- Substitua 'YOUR_PROJECT_REF' pelo ID do seu projeto Supabase
  edge_function_url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/webhook-caller';
  
  -- Por enquanto, apenas log o payload (implementação completa requer Edge Function)
  RAISE NOTICE 'Payload para webhook N8N: %', payload;
  RAISE NOTICE 'URL do webhook: %', webhook_url;
  RAISE NOTICE 'Para implementar completamente, crie uma Edge Function em: %', edge_function_url;
  
  -- Retornar true por enquanto (será implementado na Edge Function)
  RETURN TRUE;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Erro ao preparar chamada para Edge Function: %', SQLERRM;
    RETURN FALSE;
END;
$$;

-- 3. Função trigger para chamar webhook quando transcrição de texto for criada
CREATE OR REPLACE FUNCTION trigger_webhook_transcricao_texto_edge()
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
          'source', 'supabase_trigger_edge_function',
          'trigger_name', 'trigger_webhook_transcricao_texto_edge'
        )
      );
      
      -- Chamar Edge Function
      SELECT call_n8n_webhook_via_edge_function(webhook_url, payload) INTO webhook_success;
      
      -- Log do resultado
      IF webhook_success THEN
        RAISE NOTICE 'Edge Function chamada com sucesso para transcrição % - Conteúdo: % caracteres', NEW.id, LENGTH(NEW.conteudo);
      ELSE
        RAISE NOTICE 'Falha ao chamar Edge Function para transcrição %', NEW.id;
      END IF;
      
    ELSE
      RAISE NOTICE 'Webhook N8N não configurado. Configure a URL na função get_webhook_url()';
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Criar o trigger (desabilitado por padrão)
-- Descomente as linhas abaixo após criar a Edge Function
-- DROP TRIGGER IF EXISTS trigger_webhook_transcricao_texto_edge ON transcricoes;
-- CREATE TRIGGER trigger_webhook_transcricao_texto_edge
--   AFTER INSERT ON transcricoes
--   FOR EACH ROW
--   EXECUTE FUNCTION trigger_webhook_transcricao_texto_edge();

-- 5. Comentários para documentação
COMMENT ON FUNCTION get_webhook_url() IS 'Retorna a URL do webhook N8N configurada (hardcoded)';
COMMENT ON FUNCTION call_n8n_webhook_via_edge_function(TEXT, JSONB) IS 'Função para chamar Edge Function que fará requisições HTTP para webhooks N8N';
COMMENT ON FUNCTION trigger_webhook_transcricao_texto_edge() IS 'Trigger que chama Edge Function para webhook N8N quando transcrição de texto é criada';

-- 6. Instruções para configuração
DO $$
BEGIN
  RAISE NOTICE '=== CONFIGURAÇÃO DO WEBHOOK N8N COM EDGE FUNCTIONS ==='; 
  RAISE NOTICE '1. Esta migração prepara as funções mas NÃO ativa o trigger';
  RAISE NOTICE '2. Você precisa criar uma Edge Function chamada "webhook-caller"';
  RAISE NOTICE '3. Após criar a Edge Function, descomente e execute o CREATE TRIGGER';
  RAISE NOTICE '4. A Edge Function fará as requisições HTTP para o N8N';
  RAISE NOTICE '5. Veja WEBHOOK_N8N_SETUP.md para instruções completas';
END;
$$;