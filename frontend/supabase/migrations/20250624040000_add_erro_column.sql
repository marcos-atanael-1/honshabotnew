-- Adicionar coluna 'erro' na tabela transcricoes
ALTER TABLE transcricoes ADD COLUMN IF NOT EXISTS erro TEXT; 