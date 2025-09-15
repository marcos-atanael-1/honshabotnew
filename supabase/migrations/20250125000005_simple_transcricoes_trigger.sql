-- Trigger simples para enviar transcrições para API externa
-- Dispara quando uma nova linha é inserida na tabela transcricoes
-- Verifica se o processo é do tipo 'texto' e envia para API externa

-- Função para enviar transcrição para API externa (formato específico)
CREATE OR REPLACE FUNCTION send_transcricao_to_external_api(
  transcricao_id UUID,
  processo_id UUID,
  conteudo TEXT,
  tipo_transcricao TEXT,
  api_url TEXT DEFAULT 'https://sua-api-externa.com/webhook'
)
RETURNS BOOLEAN AS $$
DECLARE
  response_status INTEGER;
  response_content TEXT;
  external_api_url TEXT;
  request_body JSONB;
  processo_info RECORD;
  cliente_nome TEXT;
BEGIN
  -- Usar a URL fornecida como parâmetro
  external_api_url := api_url;
  
  IF external_api_url IS NULL OR external_api_url = '' THEN
    RAISE EXCEPTION 'External API URL is empty. Provide a valid URL.';
  END IF;

  -- Buscar informações do processo e cliente
  SELECT 
    p.id,
    p.nome,
    p.tipo_entrada,
    c.nome as cliente_nome
  INTO processo_info
  FROM processos p
  JOIN clientes c ON p.cliente_id = c.id
  WHERE p.id = processo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Processo não encontrado: %', processo_id;
  END IF;

  -- Montar o corpo da requisição no formato especificado (sem body duplicado)
  request_body := jsonb_build_object(
    'headers', jsonb_build_object(
      'content-type', 'application/json',
      'accept', '*/*',
      'user-agent', 'PostgreSQL Supabase Function'
    ),
    'params', jsonb_build_object(),
    'query', jsonb_build_object(),
    'body', jsonb_build_object(
      'processo', jsonb_build_object(
        'id', processo_id,
        'nome', processo_info.nome,
        'cliente', processo_info.cliente_nome,
        'tipo_entrada', processo_info.tipo_entrada
      ),
      'timestamp', NOW(),
      'transcricao', jsonb_build_object(
        'id', transcricao_id,
        'tipo', tipo_transcricao,
        'conteudo', conteudo
      )
    )
  );

  -- Fazer a requisição HTTP para a API externa
  SELECT 
    status,
    content
  INTO 
    response_status,
    response_content
  FROM http((
    'POST',
    external_api_url,
    ARRAY[
      ('Content-Type', 'application/json')::http_header
    ],
    'application/json',
    request_body::text
  ));

  -- Verificar se a requisição foi bem-sucedida
  IF response_status NOT BETWEEN 200 AND 299 THEN
    RAISE EXCEPTION 'External API request failed with status %: %', response_status, response_content;
  END IF;

  -- Log de sucesso (opcional)
  INSERT INTO logs (level, message, metadata, created_at)
  VALUES (
    'info',
    'Transcrição enviada para API externa com sucesso',
    jsonb_build_object(
      'transcricao_id', transcricao_id,
      'processo_id', processo_id,
      'status', response_status,
      'api_url', external_api_url
    ),
    NOW()
  );

  RETURN TRUE;

EXCEPTION
  WHEN OTHERS THEN
    -- Log do erro (opcional)
    INSERT INTO logs (level, message, metadata, created_at)
    VALUES (
      'error',
      'Erro ao enviar transcrição para API externa: ' || SQLERRM,
      jsonb_build_object(
        'transcricao_id', transcricao_id,
        'processo_id', processo_id,
        'error', SQLERRM
      ),
      NOW()
    );
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Função do trigger para transcrições
CREATE OR REPLACE FUNCTION trigger_new_transcricao()
RETURNS TRIGGER AS $$
DECLARE
  processo_tipo_entrada TEXT;
  success BOOLEAN;
BEGIN
  -- Buscar o tipo_entrada do processo relacionado
  SELECT tipo_entrada
  INTO processo_tipo_entrada
  FROM processos
  WHERE id = NEW.processo_id;

  -- Verificar se o processo é do tipo 'texto'
  IF processo_tipo_entrada = 'texto' THEN
    -- Enviar transcrição para API externa
    BEGIN
      success := send_transcricao_to_external_api(
        NEW.id,
        NEW.processo_id,
        NEW.conteudo,
        NEW.tipo_transcricao,
        'https://sua-api-externa.com/webhook'  -- URL da API diretamente no código
      );
      
      -- Log de sucesso (opcional)
      INSERT INTO logs (level, message, metadata, created_at)
      VALUES (
        'info',
        'Trigger executado com sucesso para nova transcrição',
        jsonb_build_object(
          'transcricao_id', NEW.id,
          'processo_id', NEW.processo_id,
          'tipo_transcricao', NEW.tipo_transcricao,
          'success', success
        ),
        NOW()
      );
    EXCEPTION
      WHEN OTHERS THEN
        -- Log de erro mas não falha o trigger
        INSERT INTO logs (level, message, metadata, created_at)
        VALUES (
          'error',
          'Erro no trigger de nova transcrição: ' || SQLERRM,
          jsonb_build_object(
            'transcricao_id', NEW.id,
            'processo_id', NEW.processo_id,
            'error', SQLERRM
          ),
          NOW()
        );
    END;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log do erro mas não falha a inserção da transcrição
    INSERT INTO logs (level, message, metadata, created_at)
    VALUES (
      'error',
      'Erro no trigger de transcrição: ' || SQLERRM,
      jsonb_build_object(
        'transcricao_id', NEW.id,
        'processo_id', NEW.processo_id,
        'error', SQLERRM
      ),
      NOW()
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar o trigger na tabela transcricoes (apenas se não existir)
DROP TRIGGER IF EXISTS trigger_new_transcricao_to_api ON transcricoes;
CREATE TRIGGER trigger_new_transcricao_to_api
  AFTER INSERT ON transcricoes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_new_transcricao();

-- Função para ativar o trigger
CREATE OR REPLACE FUNCTION enable_transcricao_api_trigger()
RETURNS TEXT AS $$
BEGIN
  -- Remover trigger existente e criar novamente
  DROP TRIGGER IF EXISTS trigger_new_transcricao_to_api ON transcricoes;
  
  -- Criar o trigger
  CREATE TRIGGER trigger_new_transcricao_to_api
    AFTER INSERT ON transcricoes
    FOR EACH ROW
    EXECUTE FUNCTION trigger_new_transcricao();
  
  RETURN 'Trigger ativado com sucesso na tabela transcricoes!';
END;
$$ LANGUAGE plpgsql;

-- Função para desativar o trigger
CREATE OR REPLACE FUNCTION disable_transcricao_api_trigger()
RETURNS TEXT AS $$
BEGIN
  -- Remover o trigger se existir
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_new_transcricao_to_api'
  ) THEN
    DROP TRIGGER IF EXISTS trigger_new_transcricao_to_api ON transcricoes;
    RETURN 'Trigger desativado com sucesso!';
  ELSE
    RETURN 'Trigger já está inativo.';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Função para testar manualmente
CREATE OR REPLACE FUNCTION test_transcricao_api_trigger(
  transcricao_id_param UUID
)
RETURNS TEXT AS $$
DECLARE
  transcricao_record RECORD;
  success BOOLEAN;
BEGIN
  -- Buscar dados da transcrição
  SELECT 
    t.id,
    t.processo_id,
    t.conteudo,
    t.tipo_transcricao
  INTO transcricao_record
  FROM transcricoes t
  WHERE t.id = transcricao_id_param;

  IF NOT FOUND THEN
    RETURN 'Transcrição não encontrada: ' || transcricao_id_param;
  END IF;

  -- Testar envio para API
  success := send_transcricao_to_external_api(
    transcricao_record.id,
    transcricao_record.processo_id,
    transcricao_record.conteudo,
    transcricao_record.tipo_transcricao,
    'https://sua-api-externa.com/webhook'  -- URL da API diretamente no código
  );

  IF success THEN
    RETURN 'Teste realizado com sucesso! Transcrição enviada para API externa.';
  ELSE
    RETURN 'Erro durante o teste. Verifique os logs.';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Garantir que a extensão http está disponível
CREATE EXTENSION IF NOT EXISTS http;

-- Comentários e instruções
COMMENT ON FUNCTION trigger_new_transcricao() IS 'Trigger que dispara quando nova transcrição é inserida e envia para API externa se processo for tipo texto';
COMMENT ON FUNCTION send_transcricao_to_external_api(UUID, UUID, TEXT, TEXT) IS 'Envia transcrição para API externa no formato especificado';
COMMENT ON FUNCTION test_transcricao_api_trigger(UUID) IS 'Testa o envio de uma transcrição específica para a API externa';

-- Instruções de uso:
-- 1. A URL da API está configurada diretamente no código (https://sua-api-externa.com/webhook)
--    Para alterar, modifique a URL nas funções trigger_new_transcricao() e test_transcricao_api_trigger()
-- 
-- 2. O trigger já está ativo após executar esta migração
--
-- 3. Para testar manualmente:
--    SELECT test_transcricao_api_trigger('uuid-da-transcricao');
--
-- 4. Para desativar o trigger:
--    SELECT disable_transcricao_api_trigger();
--
-- 5. Para reativar o trigger:
--    SELECT enable_transcricao_api_trigger();
--
-- 6. O trigger só envia dados quando:
--    - Nova transcrição é inserida (AFTER INSERT)
--    - O processo relacionado tem tipo_entrada = 'texto'
--
-- 7. Formato enviado para API (corrigido - sem body duplicado):
--    {
--      "headers": { "content-type": "application/json", ... },
--      "params": {},
--      "query": {},
--      "body": {
--        "processo": { "id": "...", "nome": "...", "cliente": "...", "tipo_entrada": "texto" },
--        "timestamp": "2025-01-25T...",
--        "transcricao": { "id": "...", "tipo": "...", "conteudo": "..." }
--      }
--    }