-- Adiciona coluna dropbox_filename na tabela transcricoes
-- Esta coluna armazenará o nome do arquivo no Dropbox para permitir exclusão via N8N

ALTER TABLE transcricoes 
ADD COLUMN dropbox_filename TEXT;

-- Adiciona comentário para documentar o propósito da coluna
COMMENT ON COLUMN transcricoes.dropbox_filename IS 'Nome do arquivo armazenado no Dropbox, usado para exclusão via N8N após processamento';