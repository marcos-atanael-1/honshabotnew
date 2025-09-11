-- Adicionar campo external_id na tabela transcricoes para referenciar o ID da API externa
ALTER TABLE transcricoes ADD COLUMN external_id TEXT;

-- Criar índice para external_id
CREATE INDEX idx_transcricoes_external_id ON transcricoes(external_id); 