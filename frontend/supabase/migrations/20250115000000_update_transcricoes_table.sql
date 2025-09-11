-- Migração para atualizar tabela transcricoes
-- Adicionar novas colunas e remover modelo_usado

-- 1. Adicionar novas colunas necessárias
ALTER TABLE transcricoes 
ADD COLUMN IF NOT EXISTS dropbox_url TEXT,
ADD COLUMN IF NOT EXISTS order_id TEXT,
ADD COLUMN IF NOT EXISTS tipo_transcricao TEXT CHECK (tipo_transcricao IN ('Analise Inicial', 'Estado Atual', 'Estado Futuro'));

-- 2. Remover coluna modelo_usado (não está sendo usada efetivamente)
ALTER TABLE transcricoes DROP COLUMN IF EXISTS modelo_usado;

-- 3. Atualizar constraint do status para incluir 'Em Andamento'
ALTER TABLE transcricoes DROP CONSTRAINT IF EXISTS transcricoes_status_check;
ALTER TABLE transcricoes ADD CONSTRAINT transcricoes_status_check 
CHECK (status IN ('processando', 'concluido', 'erro', 'Em Andamento'));

-- 4. Criar índices para as novas colunas
CREATE INDEX IF NOT EXISTS idx_transcricoes_order_id ON transcricoes(order_id);
CREATE INDEX IF NOT EXISTS idx_transcricoes_tipo_transcricao ON transcricoes(tipo_transcricao);

-- 5. Comentários para documentação
COMMENT ON COLUMN transcricoes.dropbox_url IS 'URL do arquivo no Dropbox após upload';
COMMENT ON COLUMN transcricoes.order_id IS 'ID do pedido retornado pela API do Transkriptor';
COMMENT ON COLUMN transcricoes.tipo_transcricao IS 'Tipo da transcrição baseado na ordem: Analise Inicial, Estado Atual, Estado Futuro';

-- 6. Função para determinar tipo_transcricao automaticamente
CREATE OR REPLACE FUNCTION determine_tipo_transcricao(p_processo_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    transcricao_count INTEGER;
BEGIN
    -- Contar quantas transcrições já existem para este processo
    SELECT COUNT(*) INTO transcricao_count
    FROM transcricoes 
    WHERE processo_id = p_processo_id;
    
    -- Determinar o tipo baseado na contagem
    CASE transcricao_count
        WHEN 0 THEN RETURN 'Analise Inicial';
        WHEN 1 THEN RETURN 'Estado Atual';
        WHEN 2 THEN RETURN 'Estado Futuro';
        ELSE RETURN 'Estado Futuro'; -- Para casos com mais de 3 transcrições
    END CASE;
END;
$$;

-- 7. Trigger para definir tipo_transcricao automaticamente
CREATE OR REPLACE FUNCTION set_tipo_transcricao_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Se tipo_transcricao não foi definido, determinar automaticamente
    IF NEW.tipo_transcricao IS NULL THEN
        NEW.tipo_transcricao := determine_tipo_transcricao(NEW.processo_id);
    END IF;
    
    RETURN NEW;
END;
$$;

-- Criar o trigger
DROP TRIGGER IF EXISTS trigger_set_tipo_transcricao ON transcricoes;
CREATE TRIGGER trigger_set_tipo_transcricao
    BEFORE INSERT ON transcricoes
    FOR EACH ROW
    EXECUTE FUNCTION set_tipo_transcricao_trigger();