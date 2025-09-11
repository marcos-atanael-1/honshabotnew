-- Adicionar campo ai_model na tabela processos
ALTER TABLE processos ADD COLUMN ai_model TEXT DEFAULT 'openai' CHECK (ai_model IN ('openai', 'groq'));

-- Criar tabela para armazenar transcrições
CREATE TABLE transcricoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id UUID REFERENCES processos(id) ON DELETE CASCADE,
  conteudo TEXT NOT NULL,
  modelo_usado TEXT NOT NULL,
  status TEXT DEFAULT 'processando' CHECK (status IN ('processando', 'concluido', 'erro')),
  tempo_processamento INTEGER, -- em segundos
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Criar índices
CREATE INDEX idx_transcricoes_processo_id ON transcricoes(processo_id);
CREATE INDEX idx_transcricoes_status ON transcricoes(status);

-- Habilitar RLS
ALTER TABLE transcricoes ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS para transcricoes
CREATE POLICY "Users can view their own transcricoes" ON transcricoes
  FOR SELECT USING (
    processo_id IN (
      SELECT p.id FROM processos p 
      JOIN clientes c ON p.cliente_id = c.id 
      WHERE c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert transcricoes for their processos" ON transcricoes
  FOR INSERT WITH CHECK (
    processo_id IN (
      SELECT p.id FROM processos p 
      JOIN clientes c ON p.cliente_id = c.id 
      WHERE c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own transcricoes" ON transcricoes
  FOR UPDATE USING (
    processo_id IN (
      SELECT p.id FROM processos p 
      JOIN clientes c ON p.cliente_id = c.id 
      WHERE c.user_id = auth.uid()
    )
  );

-- Criar função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Criar trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_transcricoes_updated_at BEFORE UPDATE ON transcricoes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update tipo_entrada enum to use audio_video instead of separate audio and video
ALTER TABLE processos DROP CONSTRAINT IF EXISTS processos_tipo_entrada_check;
ALTER TABLE processos ADD CONSTRAINT processos_tipo_entrada_check CHECK (tipo_entrada IN ('texto', 'audio_video'));

-- Update existing records: convert 'audio' and 'video' to 'audio_video'
UPDATE processos SET tipo_entrada = 'audio_video' WHERE tipo_entrada IN ('audio', 'video'); 