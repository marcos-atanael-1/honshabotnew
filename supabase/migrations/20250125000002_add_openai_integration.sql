-- Migração para integração com OpenAI
-- Substitui o sistema de webhook N8N por chamadas diretas à API da OpenAI

-- Criar tabela de logs se não existir
CREATE TABLE IF NOT EXISTS logs (
  id BIGSERIAL PRIMARY KEY,
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_metadata ON logs USING GIN(metadata);

-- Função para mapear tipo_transcricao para tipo de prompt
CREATE OR REPLACE FUNCTION map_transcricao_to_prompt_type(tipo_transcricao TEXT)
RETURNS TEXT AS $$
BEGIN
  CASE tipo_transcricao
    WHEN 'Analise Inicial' THEN RETURN 'analise_inicial';
    WHEN 'Estado Atual' THEN RETURN 'as_is';
    WHEN 'Estado Futuro' THEN RETURN 'to_be';
    ELSE RETURN 'analise_inicial'; -- Default
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Função auxiliar para buscar prompts da tabela prompts_analise
CREATE OR REPLACE FUNCTION get_prompt_analise(prompt_tipo TEXT)
RETURNS TABLE(
  system_prompt TEXT,
  user_template TEXT,
  nome TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pa.system_prompt,
    pa.user_template,
    pa.nome
  FROM prompts_analise pa
  WHERE pa.tipo = prompt_tipo
    AND pa.ativo = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Função para enviar transcrição para API externa
CREATE OR REPLACE FUNCTION send_transcricao_to_api(
  transcricao_content TEXT,
  transcricao_tipo TEXT,
  processo_id UUID,
  transcricao_id UUID,
  api_url TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  response_status INTEGER;
  response_content TEXT;
  external_api_url TEXT;
  request_body JSONB;
  result JSONB;
  processo_info RECORD;
BEGIN
  -- Buscar informações do processo
  SELECT p.*, c.nome as cliente_nome
  INTO processo_info
  FROM processos p
  JOIN clientes c ON p.cliente_id = c.id
  WHERE p.id = processo_id;

  -- Usar URL fornecida ou buscar no Supabase Vault
  IF api_url IS NULL THEN
    -- Buscar URL da API no Supabase Vault
    BEGIN
      SELECT decrypted_secret INTO external_api_url 
      FROM vault.decrypted_secrets 
      WHERE name = 'external_api_url';
    EXCEPTION
      WHEN OTHERS THEN
        RAISE EXCEPTION 'External API URL not configured. Vá em Settings → Vault e adicione external_api_url';
    END;
    
    IF external_api_url IS NULL OR external_api_url = '' THEN
      RAISE EXCEPTION 'External API URL is empty. Vá em Settings → Vault e adicione external_api_url';
    END IF;
  ELSE
    external_api_url := api_url;
  END IF;

  -- Montar o corpo da requisição
  request_body := jsonb_build_object(
    'transcricao', jsonb_build_object(
      'id', transcricao_id,
      'conteudo', transcricao_content,
      'tipo', transcricao_tipo
    ),
    'processo', jsonb_build_object(
      'id', processo_id,
      'nome', processo_info.nome,
      'cliente', processo_info.cliente_nome,
      'tipo_entrada', processo_info.tipo_entrada
    ),
    'timestamp', NOW()
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

  -- Parsear a resposta JSON (se houver)
  BEGIN
    result := response_content::jsonb;
  EXCEPTION
    WHEN OTHERS THEN
      -- Se não for JSON válido, criar objeto com o conteúdo
      result := jsonb_build_object('response', response_content);
  END;
  
  -- Log da requisição com resposta completa
  INSERT INTO logs (level, message, metadata, created_at)
  VALUES (
    'info',
    'External API call successful',
    jsonb_build_object(
      'status', response_status,
      'api_url', external_api_url,
      'transcricao_id', transcricao_id,
      'processo_id', processo_id,
      'response_content', response_content,
      'full_response', result
    ),
    NOW()
  );

  RETURN result;

EXCEPTION
  WHEN OTHERS THEN
    -- Log do erro
    INSERT INTO logs (level, message, metadata, created_at)
    VALUES (
      'error',
      'External API call failed: ' || SQLERRM,
      jsonb_build_object(
        'error', SQLERRM,
        'api_url', external_api_url,
        'transcricao_id', transcricao_id,
        'processo_id', processo_id,
        'transcricao_length', LENGTH(transcricao_content)
      ),
      NOW()
    );
    
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- Função principal para processar transcrição com API externa
CREATE OR REPLACE FUNCTION process_transcricao_with_external_api(
  processo_id_param UUID,
  transcricao_id_param UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  transcricao_content TEXT;
  transcricao_tipo TEXT;
  api_response JSONB;
  processo_info RECORD;
BEGIN
  -- Buscar informações do processo
  SELECT p.*, c.nome as cliente_nome
  INTO processo_info
  FROM processos p
  JOIN clientes c ON p.cliente_id = c.id
  WHERE p.id = processo_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Processo não encontrado: %', processo_id_param;
  END IF;

  -- Buscar conteúdo e tipo da transcrição
  SELECT conteudo, tipo_transcricao
  INTO transcricao_content, transcricao_tipo
  FROM transcricoes
  WHERE id = transcricao_id_param
    AND processo_id = processo_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transcrição não encontrada: %', transcricao_id_param;
  END IF;

  -- Verificar se o conteúdo da transcrição não está vazio
  IF transcricao_content IS NULL OR transcricao_content = '' THEN
    RAISE EXCEPTION 'Conteúdo da transcrição está vazio para ID: %', transcricao_id_param;
  END IF;

  -- Log de debug do conteúdo da transcrição
  INSERT INTO logs (level, message, metadata, created_at)
  VALUES (
    'debug',
    'Enviando transcrição para API externa',
    jsonb_build_object(
      'transcricao_id', transcricao_id_param,
      'transcricao_tipo', transcricao_tipo,
      'conteudo_length', LENGTH(transcricao_content),
      'conteudo_preview', LEFT(transcricao_content, 200)
    ),
    NOW()
  );

  -- Enviar transcrição para API externa (que fará a inserção na analise_fluxo)
  api_response := send_transcricao_to_api(
    transcricao_content,
    transcricao_tipo,
    processo_id_param,
    transcricao_id_param
  );

  -- Log de sucesso - API externa é responsável pela inserção dos dados
  INSERT INTO logs (level, message, metadata, created_at)
  VALUES (
    'info',
    'Transcrição enviada com sucesso para API externa',
    jsonb_build_object(
      'processo_id', processo_id_param,
      'transcricao_id', transcricao_id_param,
      'cliente', processo_info.cliente_nome,
      'processo_nome', processo_info.nome,
      'transcricao_tipo', transcricao_tipo,
      'api_response', api_response
    ),
    NOW()
  );

  RETURN TRUE;

EXCEPTION
  WHEN OTHERS THEN
    -- Log do erro
    INSERT INTO logs (level, message, metadata, created_at)
    VALUES (
      'error',
      'Erro ao processar transcrição com API externa: ' || SQLERRM,
      jsonb_build_object(
        'processo_id', processo_id_param,
        'transcricao_id', transcricao_id_param,
        'error', SQLERRM
      ),
      NOW()
    );
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Função de trigger para processos do tipo texto
CREATE OR REPLACE FUNCTION trigger_external_api_analysis()
RETURNS TRIGGER AS $$
DECLARE
  transcricao_record RECORD;
  success BOOLEAN;
BEGIN
  -- Verificar se é um processo do tipo texto
  IF NEW.tipo_entrada = 'texto' THEN
    -- Buscar a transcrição mais recente e concluída para este processo
    -- Prioriza 'Analise Inicial', depois qualquer tipo disponível
    SELECT t.*
    INTO transcricao_record
    FROM transcricoes t
    WHERE t.processo_id = NEW.id
      AND t.status = 'concluido'
      AND t.conteudo IS NOT NULL
      AND t.conteudo != ''
    ORDER BY 
      CASE 
        WHEN t.tipo_transcricao = 'Analise Inicial' THEN 1
        WHEN t.tipo_transcricao = 'Estado Atual' THEN 2
        WHEN t.tipo_transcricao = 'Estado Futuro' THEN 3
        ELSE 4
      END,
      t.created_at DESC
    LIMIT 1;

    -- Se encontrou uma transcrição, processar com API externa
    IF FOUND THEN
      BEGIN
        success := process_transcricao_with_external_api(NEW.id, transcricao_record.id);
        
        -- Log de sucesso
        INSERT INTO logs (level, message, metadata, created_at)
        VALUES (
          'info',
          'External API analysis completed successfully',
          jsonb_build_object(
            'processo_id', NEW.id,
            'transcricao_id', transcricao_record.id,
            'tipo_transcricao', transcricao_record.tipo_transcricao,
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
            'External API analysis failed: ' || SQLERRM,
            jsonb_build_object(
              'processo_id', NEW.id,
              'transcricao_id', transcricao_record.id,
              'tipo_transcricao', COALESCE(transcricao_record.tipo_transcricao, 'unknown'),
              'error', SQLERRM
            ),
            NOW()
          );
      END;
    ELSE
      -- Log quando não encontra transcrição
      INSERT INTO logs (level, message, metadata, created_at)
      VALUES (
        'info',
        'No completed transcription found for text process',
        jsonb_build_object(
          'processo_id', NEW.id,
          'tipo_entrada', NEW.tipo_entrada
        ),
        NOW()
      );
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log do erro mas não falha a inserção do processo
    INSERT INTO logs (level, message, metadata, created_at)
    VALUES (
      'error',
      'Erro no trigger de análise da API externa: ' || SQLERRM,
      jsonb_build_object(
        'processo_id', NEW.id,
        'error', SQLERRM
      ),
      NOW()
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para processos (DESABILITADO por padrão)
-- Descomente a linha abaixo quando estiver pronto para ativar
-- CREATE TRIGGER trigger_processo_external_api_analysis
--   AFTER INSERT ON processos
--   FOR EACH ROW
--   EXECUTE FUNCTION trigger_external_api_analysis();

-- Função para ativar o trigger da API externa
CREATE OR REPLACE FUNCTION enable_external_api_trigger()
RETURNS TEXT AS $$
BEGIN
  -- Criar o trigger se não existir
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_processo_external_api_analysis'
  ) THEN
    EXECUTE 'CREATE TRIGGER trigger_processo_external_api_analysis
      AFTER INSERT ON processos
      FOR EACH ROW
      EXECUTE FUNCTION trigger_external_api_analysis();';
    
    RETURN 'Trigger da API externa ativado com sucesso!';
  ELSE
    RETURN 'Trigger da API externa já está ativo.';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Função para desativar o trigger da API externa
CREATE OR REPLACE FUNCTION disable_external_api_trigger()
RETURNS TEXT AS $$
BEGIN
  -- Remover o trigger se existir
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_processo_external_api_analysis'
  ) THEN
    DROP TRIGGER IF EXISTS trigger_processo_external_api_analysis ON processos;
    RETURN 'Trigger da API externa desativado com sucesso!';
  ELSE
    RETURN 'Trigger da API externa já está inativo.';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Função para testar manualmente o sistema
CREATE OR REPLACE FUNCTION test_external_api_integration(
  processo_id_param UUID
)
RETURNS TEXT AS $$
DECLARE
  result BOOLEAN;
  transcricao_record RECORD;
BEGIN
  -- Buscar transcrição para o processo
  SELECT id, conteudo
  INTO transcricao_record
  FROM transcricoes
  WHERE processo_id = processo_id_param
    AND status = 'concluido'
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 'Nenhuma transcrição encontrada para o processo ' || processo_id_param;
  END IF;

  -- Enviar transcrição para API externa
  result := process_transcricao_with_external_api(processo_id_param, transcricao_record.id);

  IF result THEN
    RETURN 'Transcrição enviada com sucesso para a API externa! Sua API é responsável por inserir os dados na tabela analise_fluxo.';
  ELSE
    RETURN 'Erro durante o envio. Verifique os logs.';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Comentários e instruções
COMMENT ON FUNCTION get_prompt_analise(TEXT) IS 'Busca prompts ativos da tabela prompts_analise por tipo';
COMMENT ON FUNCTION send_transcricao_to_api(TEXT, TEXT, UUID, UUID, TEXT) IS 'Envia transcrição para API externa via POST';
COMMENT ON FUNCTION process_transcricao_with_external_api(UUID, UUID) IS 'Processa transcrição com API externa e insere resultado na analise_fluxo';
COMMENT ON FUNCTION trigger_external_api_analysis() IS 'Trigger function para processar automaticamente processos do tipo texto';
COMMENT ON FUNCTION test_external_api_integration(UUID) IS 'Função para testar manualmente a integração com API externa';

-- Instruções de uso:
-- 1. Configure a URL da API externa no Supabase Vault:
--    Settings → Vault → Add new secret
--    Nome: external_api_url
--    Valor: https://sua-api-externa.com/endpoint
-- 
-- 2. Para testar manualmente:
--    SELECT test_external_api_integration('uuid-do-processo');
--
-- 3. Para ativar o trigger automático, execute:
--    SELECT enable_external_api_trigger();
--    ou
--    CREATE TRIGGER trigger_processo_external_api_analysis
--      AFTER INSERT ON processos
--      FOR EACH ROW
--      EXECUTE FUNCTION trigger_external_api_analysis();
--
-- 4. Formato esperado da API externa:
--    POST /endpoint
--    Content-Type: application/json
--    Body: {
--      "transcricao": {
--        "id": "uuid",
--        "conteudo": "texto da transcrição",
--        "tipo": "Analise Inicial"
--      },
--      "processo": {
--        "id": "uuid",
--        "nome": "nome do processo",
--        "cliente": "nome do cliente",
--        "tipo_entrada": "texto"
--      },
--      "timestamp": "2024-01-25T10:00:00Z"
--    }
--
-- 5. Resposta esperada da API (pode ser JSON ou texto):
--    { "analise": "resultado da análise" }
--    ou
--    { "content": "resultado da análise" }
--    ou
--    { "response": "resultado da análise" }
--
-- 6. Certifique-se de que a extensão http está disponível:
CREATE EXTENSION IF NOT EXISTS http;