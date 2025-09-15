-- Migração completa para integração com OpenAI
-- Substitui o sistema de webhook N8N por chamadas diretas à API da OpenAI
-- Inclui processamento automático da resposta e inserção na analise_fluxo

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

-- Função para processar resposta da API e inserir na analise_fluxo
CREATE OR REPLACE FUNCTION process_api_response_to_analise_fluxo(
  api_response JSONB,
  processo_id UUID,
  transcricao_id UUID,
  transcricao_tipo TEXT
)
RETURNS UUID AS $$
DECLARE
  analise_content TEXT;
  new_analise_id UUID;
  prompt_tipo TEXT;
BEGIN
  -- Extrair conteúdo da análise da resposta da API
  -- Tenta diferentes formatos de resposta
  IF api_response ? 'analise' THEN
    analise_content := api_response->>'analise';
  ELSIF api_response ? 'content' THEN
    analise_content := api_response->>'content';
  ELSIF api_response ? 'response' THEN
    analise_content := api_response->>'response';
  ELSIF api_response ? 'result' THEN
    analise_content := api_response->>'result';
  ELSIF api_response ? 'analysis' THEN
    analise_content := api_response->>'analysis';
  ELSE
    -- Se não encontrar campo específico, usa a resposta inteira como string
    analise_content := api_response::text;
  END IF;

  -- Verificar se o conteúdo não está vazio
  IF analise_content IS NULL OR analise_content = '' THEN
    RAISE EXCEPTION 'Resposta da API não contém análise válida: %', api_response::text;
  END IF;

  -- Mapear tipo de transcrição para tipo de prompt
  prompt_tipo := map_transcricao_to_prompt_type(transcricao_tipo);

  -- Inserir na tabela analise_fluxo
  INSERT INTO analise_fluxo (
    id,
    processo_id,
    transcricao_id,
    tipo_analise,
    conteudo_analise,
    status,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    processo_id,
    transcricao_id,
    prompt_tipo,
    analise_content,
    'concluido',
    NOW(),
    NOW()
  ) RETURNING id INTO new_analise_id;

  -- Log de sucesso
  INSERT INTO logs (level, message, metadata, created_at)
  VALUES (
    'info',
    'Análise inserida na analise_fluxo com sucesso',
    jsonb_build_object(
      'analise_id', new_analise_id,
      'processo_id', processo_id,
      'transcricao_id', transcricao_id,
      'tipo_analise', prompt_tipo,
      'content_length', LENGTH(analise_content)
    ),
    NOW()
  );

  RETURN new_analise_id;

EXCEPTION
  WHEN OTHERS THEN
    -- Log do erro
    INSERT INTO logs (level, message, metadata, created_at)
    VALUES (
      'error',
      'Erro ao inserir análise na analise_fluxo: ' || SQLERRM,
      jsonb_build_object(
        'processo_id', processo_id,
        'transcricao_id', transcricao_id,
        'api_response', api_response,
        'error', SQLERRM
      ),
      NOW()
    );
    
    RAISE;
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

-- Função principal para processar transcrição com API externa (VERSÃO COMPLETA)
CREATE OR REPLACE FUNCTION process_transcricao_with_external_api_complete(
  processo_id_param UUID,
  transcricao_id_param UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  transcricao_content TEXT;
  transcricao_tipo TEXT;
  api_response JSONB;
  processo_info RECORD;
  new_analise_id UUID;
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

  -- Enviar transcrição para API externa
  api_response := send_transcricao_to_api(
    transcricao_content,
    transcricao_tipo,
    processo_id_param,
    transcricao_id_param
  );

  -- Processar resposta da API e inserir na analise_fluxo
  new_analise_id := process_api_response_to_analise_fluxo(
    api_response,
    processo_id_param,
    transcricao_id_param,
    transcricao_tipo
  );

  -- Log de sucesso completo
  INSERT INTO logs (level, message, metadata, created_at)
  VALUES (
    'info',
    'Processamento completo da transcrição finalizado com sucesso',
    jsonb_build_object(
      'processo_id', processo_id_param,
      'transcricao_id', transcricao_id_param,
      'analise_id', new_analise_id,
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
      'Erro ao processar transcrição completa com API externa: ' || SQLERRM,
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

-- Função de trigger para processos do tipo texto (VERSÃO COMPLETA)
CREATE OR REPLACE FUNCTION trigger_external_api_analysis_complete()
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
        success := process_transcricao_with_external_api_complete(NEW.id, transcricao_record.id);
        
        -- Log de sucesso
        INSERT INTO logs (level, message, metadata, created_at)
        VALUES (
          'info',
          'External API analysis completed successfully (complete version)',
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
            'External API analysis failed (complete version): ' || SQLERRM,
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
      'Erro no trigger de análise completa da API externa: ' || SQLERRM,
      jsonb_build_object(
        'processo_id', NEW.id,
        'error', SQLERRM
      ),
      NOW()
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para ativar o trigger completo da API externa
CREATE OR REPLACE FUNCTION enable_complete_external_api_trigger()
RETURNS TEXT AS $$
BEGIN
  -- Desativar trigger antigo se existir
  DROP TRIGGER IF EXISTS trigger_processo_external_api_analysis ON processos;
  
  -- Criar o novo trigger completo
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_processo_external_api_analysis_complete'
  ) THEN
    EXECUTE 'CREATE TRIGGER trigger_processo_external_api_analysis_complete
      AFTER INSERT ON processos
      FOR EACH ROW
      EXECUTE FUNCTION trigger_external_api_analysis_complete();';
    
    RETURN 'Trigger completo da API externa ativado com sucesso! Agora processa resposta e insere na analise_fluxo.';
  ELSE
    RETURN 'Trigger completo da API externa já está ativo.';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Função para desativar o trigger completo da API externa
CREATE OR REPLACE FUNCTION disable_complete_external_api_trigger()
RETURNS TEXT AS $$
BEGIN
  -- Remover o trigger se existir
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_processo_external_api_analysis_complete'
  ) THEN
    DROP TRIGGER IF EXISTS trigger_processo_external_api_analysis_complete ON processos;
    RETURN 'Trigger completo da API externa desativado com sucesso!';
  ELSE
    RETURN 'Trigger completo da API externa já está inativo.';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Função para testar manualmente o sistema completo
CREATE OR REPLACE FUNCTION test_complete_external_api_integration(
  processo_id_param UUID
)
RETURNS TEXT AS $$
DECLARE
  result BOOLEAN;
  transcricao_record RECORD;
BEGIN
  -- Buscar transcrição para o processo
  SELECT id, conteudo, tipo_transcricao
  INTO transcricao_record
  FROM transcricoes
  WHERE processo_id = processo_id_param
    AND status = 'concluido'
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 'Nenhuma transcrição encontrada para o processo ' || processo_id_param;
  END IF;

  -- Processar transcrição com API externa (versão completa)
  result := process_transcricao_with_external_api_complete(processo_id_param, transcricao_record.id);

  IF result THEN
    RETURN 'Transcrição processada com sucesso! API chamada, resposta processada e dados inseridos na analise_fluxo.';
  ELSE
    RETURN 'Erro durante o processamento. Verifique os logs.';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Comentários e instruções
COMMENT ON FUNCTION process_api_response_to_analise_fluxo(JSONB, UUID, UUID, TEXT) IS 'Processa resposta da API e insere automaticamente na analise_fluxo';
COMMENT ON FUNCTION process_transcricao_with_external_api_complete(UUID, UUID) IS 'Versão completa: chama API externa E insere resultado na analise_fluxo';
COMMENT ON FUNCTION trigger_external_api_analysis_complete() IS 'Trigger completo que processa resposta da API e insere na analise_fluxo';
COMMENT ON FUNCTION test_complete_external_api_integration(UUID) IS 'Testa integração completa incluindo inserção na analise_fluxo';

-- Instruções de uso:
-- 1. Configure a URL da API externa no Supabase Vault:
--    Settings → Vault → Add new secret
--    Nome: external_api_url
--    Valor: https://sua-api-externa.com/endpoint
-- 
-- 2. Para testar manualmente (versão completa):
--    SELECT test_complete_external_api_integration('uuid-do-processo');
--
-- 3. Para ativar o trigger automático completo:
--    SELECT enable_complete_external_api_trigger();
--
-- 4. Formato esperado da resposta da API:
--    { "analise": "resultado da análise" }
--    ou
--    { "content": "resultado da análise" }
--    ou
--    { "response": "resultado da análise" }
--    ou
--    { "result": "resultado da análise" }
--    ou
--    { "analysis": "resultado da análise" }
--
-- 5. O sistema agora:
--    - Chama a API externa
--    - Processa a resposta automaticamente
--    - Insere o resultado na tabela analise_fluxo
--    - Faz logs detalhados de todo o processo
--
-- 6. Certifique-se de que a extensão http está disponível:
CREATE EXTENSION IF NOT EXISTS http;

-- Para ativar imediatamente o trigger completo, descomente:
-- SELECT enable_complete_external_api_trigger();