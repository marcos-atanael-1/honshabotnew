-- Migração para trigger na tabela transcricoes
-- Versão modificada que dispara quando uma transcrição é criada

-- Função de trigger para transcrições (versão modificada)
CREATE OR REPLACE FUNCTION trigger_transcricao_external_api_analysis()
RETURNS TRIGGER AS $$
DECLARE
  processo_info RECORD;
  success BOOLEAN;
BEGIN
  -- Verificar se a transcrição está concluída e tem conteúdo
  IF NEW.status = 'concluido' AND NEW.conteudo IS NOT NULL AND NEW.conteudo != '' THEN
    
    -- Buscar informações do processo para verificar se é do tipo texto
    SELECT p.*, c.nome as cliente_nome
    INTO processo_info
    FROM processos p
    JOIN clientes c ON p.cliente_id = c.id
    WHERE p.id = NEW.processo_id;
    
    -- Verificar se é um processo do tipo texto
    IF FOUND AND processo_info.tipo_entrada = 'texto' THEN
      BEGIN
        -- Processar com API externa
        success := process_transcricao_with_external_api(NEW.processo_id, NEW.id);
        
        -- Log de sucesso
        INSERT INTO logs (level, message, metadata, created_at)
        VALUES (
          'info',
          'External API analysis completed successfully (trigger on transcricoes)',
          jsonb_build_object(
            'processo_id', NEW.processo_id,
            'transcricao_id', NEW.id,
            'tipo_transcricao', NEW.tipo_transcricao,
            'success', success,
            'trigger_table', 'transcricoes'
          ),
          NOW()
        );
      EXCEPTION
        WHEN OTHERS THEN
          -- Log de erro mas não falha o trigger
          INSERT INTO logs (level, message, metadata, created_at)
          VALUES (
            'error',
            'External API analysis failed (trigger on transcricoes): ' || SQLERRM,
            jsonb_build_object(
              'processo_id', NEW.processo_id,
              'transcricao_id', NEW.id,
              'tipo_transcricao', COALESCE(NEW.tipo_transcricao, 'unknown'),
              'error', SQLERRM,
              'trigger_table', 'transcricoes'
            ),
            NOW()
          );
      END;
    ELSE
      -- Log quando não é processo de texto
      INSERT INTO logs (level, message, metadata, created_at)
      VALUES (
        'debug',
        'Transcription completed but process is not text type',
        jsonb_build_object(
          'processo_id', NEW.processo_id,
          'transcricao_id', NEW.id,
          'tipo_entrada', COALESCE(processo_info.tipo_entrada, 'unknown'),
          'trigger_table', 'transcricoes'
        ),
        NOW()
      );
    END IF;
  ELSE
    -- Log quando transcrição não está pronta
    INSERT INTO logs (level, message, metadata, created_at)
    VALUES (
      'debug',
      'Transcription inserted but not ready for processing',
      jsonb_build_object(
        'processo_id', NEW.processo_id,
        'transcricao_id', NEW.id,
        'status', NEW.status,
        'has_content', (NEW.conteudo IS NOT NULL AND NEW.conteudo != ''),
        'trigger_table', 'transcricoes'
      ),
      NOW()
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log do erro mas não falha a inserção da transcrição
    INSERT INTO logs (level, message, metadata, created_at)
    VALUES (
      'error',
      'Erro no trigger de transcrição da API externa: ' || SQLERRM,
      jsonb_build_object(
        'processo_id', NEW.processo_id,
        'transcricao_id', NEW.id,
        'error', SQLERRM,
        'trigger_table', 'transcricoes'
      ),
      NOW()
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para ativar o trigger na tabela transcricoes
CREATE OR REPLACE FUNCTION enable_transcricao_external_api_trigger()
RETURNS TEXT AS $$
BEGIN
  -- Criar o trigger se não existir
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_transcricao_external_api_analysis'
  ) THEN
    EXECUTE 'CREATE TRIGGER trigger_transcricao_external_api_analysis
      AFTER INSERT OR UPDATE ON transcricoes
      FOR EACH ROW
      EXECUTE FUNCTION trigger_transcricao_external_api_analysis();';
    
    RETURN 'Trigger da API externa na tabela transcricoes ativado com sucesso!';
  ELSE
    RETURN 'Trigger da API externa na tabela transcricoes já está ativo.';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Função para desativar o trigger na tabela transcricoes
CREATE OR REPLACE FUNCTION disable_transcricao_external_api_trigger()
RETURNS TEXT AS $$
BEGIN
  -- Remover o trigger se existir
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_transcricao_external_api_analysis'
  ) THEN
    DROP TRIGGER IF EXISTS trigger_transcricao_external_api_analysis ON transcricoes;
    RETURN 'Trigger da API externa na tabela transcricoes desativado com sucesso!';
  ELSE
    RETURN 'Trigger da API externa na tabela transcricoes já está inativo.';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Função para alternar entre os dois tipos de trigger
CREATE OR REPLACE FUNCTION switch_trigger_to_transcricoes()
RETURNS TEXT AS $$
DECLARE
  result_disable TEXT;
  result_enable TEXT;
BEGIN
  -- Desativar trigger da tabela processos (se existir)
  SELECT disable_external_api_trigger() INTO result_disable;
  
  -- Ativar trigger da tabela transcricoes
  SELECT enable_transcricao_external_api_trigger() INTO result_enable;
  
  RETURN 'Migração concluída: ' || result_disable || ' | ' || result_enable;
END;
$$ LANGUAGE plpgsql;

-- Comentários e instruções
COMMENT ON FUNCTION trigger_transcricao_external_api_analysis() IS 'Trigger function para processar transcrições quando inseridas/atualizadas na tabela transcricoes';
COMMENT ON FUNCTION enable_transcricao_external_api_trigger() IS 'Ativa o trigger na tabela transcricoes';
COMMENT ON FUNCTION disable_transcricao_external_api_trigger() IS 'Desativa o trigger na tabela transcricoes';
COMMENT ON FUNCTION switch_trigger_to_transcricoes() IS 'Migra do trigger em processos para trigger em transcricoes';

-- Instruções de uso:
-- 1. Para migrar do trigger atual (processos) para o novo (transcricoes):
--    SELECT switch_trigger_to_transcricoes();
--
-- 2. Para ativar apenas o trigger em transcricoes:
--    SELECT enable_transcricao_external_api_trigger();
--
-- 3. Para desativar o trigger em transcricoes:
--    SELECT disable_transcricao_external_api_trigger();
--
-- 4. Diferenças principais:
--    - Trigger anterior: Disparava quando processo era criado, buscava transcrição existente
--    - Trigger novo: Dispara quando transcrição é criada/atualizada com status 'concluido'
--    - Vantagem: Mais preciso, dispara exatamente quando a transcrição fica pronta
--    - Desvantagem: Pode disparar múltiplas vezes se a transcrição for atualizada
--
-- 5. O trigger verifica:
--    - Se a transcrição tem status 'concluido'
--    - Se tem conteúdo não vazio
--    - Se o processo associado é do tipo 'texto'
--    - Só então chama a API externa

-- Para executar a migração imediatamente, descomente a linha abaixo:
-- SELECT switch_trigger_to_transcricoes();