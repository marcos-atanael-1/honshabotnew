-- Criar tabela transcription_api para compatibilidade com a API externa
CREATE TABLE IF NOT EXISTS transcription_api (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PROCESSING',
    transcription TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_transcription_api_id ON transcription_api(id);
CREATE INDEX IF NOT EXISTS idx_transcription_api_status ON transcription_api(status);
CREATE INDEX IF NOT EXISTS idx_transcription_api_created_at ON transcription_api(created_at);

-- Comentários para documentação
COMMENT ON TABLE transcription_api IS 'Tabela usada pela API externa de transcrição';
COMMENT ON COLUMN transcription_api.id IS 'ID único da transcrição (UUID)';
COMMENT ON COLUMN transcription_api.file_name IS 'Nome do arquivo enviado';
COMMENT ON COLUMN transcription_api.status IS 'Status da transcrição (PROCESSING, DONE, ERROR)';
COMMENT ON COLUMN transcription_api.transcription IS 'Texto da transcrição ou mensagem de erro';
COMMENT ON COLUMN transcription_api.created_at IS 'Data e hora de criação do registro'; 