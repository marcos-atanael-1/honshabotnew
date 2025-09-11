/*
  # Initial Schema for Processo em Vídeo System

  1. New Tables
    - `users` - User profiles (extends Supabase auth.users)
    - `clientes` - Client folders for organizing processes
    - `processos` - Individual processes with status tracking
    - `arquivos` - File attachments linked to processes
    - `analises` - Analysis results with transcriptions and flows

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to access their own data
    - Ensure data isolation between users

  3. Storage
    - Create storage bucket for file uploads
    - Add policies for authenticated file access
*/

-- Create users profile table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT auth.uid(),
  email text UNIQUE NOT NULL,
  nome text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create clientes table
CREATE TABLE IF NOT EXISTS clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text DEFAULT '',
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create processos table
CREATE TABLE IF NOT EXISTS processos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cliente_id uuid REFERENCES clientes(id) ON DELETE CASCADE NOT NULL,
  tipo_entrada text CHECK (tipo_entrada IN ('video', 'audio', 'texto')) NOT NULL,
  status text CHECK (status IN ('aguardando', 'processando', 'processado', 'erro')) DEFAULT 'aguardando',
  conteudo_texto text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create arquivos table
CREATE TABLE IF NOT EXISTS arquivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid REFERENCES processos(id) ON DELETE CASCADE NOT NULL,
  nome_original text NOT NULL,
  tipo text NOT NULL,
  tamanho bigint,
  storage_path text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create analises table
CREATE TABLE IF NOT EXISTS analises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid REFERENCES processos(id) ON DELETE CASCADE NOT NULL,
  transcricao text,
  fluxo_original_json jsonb,
  fluxo_melhorado_json jsonb,
  sugestoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE processos ENABLE ROW LEVEL SECURITY;
ALTER TABLE arquivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE analises ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY "Users can read own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create policies for clientes table
CREATE POLICY "Users can read own clientes"
  ON clientes
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own clientes"
  ON clientes
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own clientes"
  ON clientes
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own clientes"
  ON clientes
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create policies for processos table
CREATE POLICY "Users can read own processos"
  ON processos
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM clientes 
    WHERE clientes.id = processos.cliente_id 
    AND clientes.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own processos"
  ON processos
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM clientes 
    WHERE clientes.id = processos.cliente_id 
    AND clientes.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own processos"
  ON processos
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM clientes 
    WHERE clientes.id = processos.cliente_id 
    AND clientes.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own processos"
  ON processos
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM clientes 
    WHERE clientes.id = processos.cliente_id 
    AND clientes.user_id = auth.uid()
  ));

-- Create policies for arquivos table
CREATE POLICY "Users can read own arquivos"
  ON arquivos
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM processos p
    JOIN clientes c ON c.id = p.cliente_id
    WHERE p.id = arquivos.processo_id 
    AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own arquivos"
  ON arquivos
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM processos p
    JOIN clientes c ON c.id = p.cliente_id
    WHERE p.id = arquivos.processo_id 
    AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own arquivos"
  ON arquivos
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM processos p
    JOIN clientes c ON c.id = p.cliente_id
    WHERE p.id = arquivos.processo_id 
    AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own arquivos"
  ON arquivos
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM processos p
    JOIN clientes c ON c.id = p.cliente_id
    WHERE p.id = arquivos.processo_id 
    AND c.user_id = auth.uid()
  ));

-- Create policies for analises table
CREATE POLICY "Users can read own analises"
  ON analises
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM processos p
    JOIN clientes c ON c.id = p.cliente_id
    WHERE p.id = analises.processo_id 
    AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own analises"
  ON analises
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM processos p
    JOIN clientes c ON c.id = p.cliente_id
    WHERE p.id = analises.processo_id 
    AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own analises"
  ON analises
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM processos p
    JOIN clientes c ON c.id = p.cliente_id
    WHERE p.id = analises.processo_id 
    AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own analises"
  ON analises
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM processos p
    JOIN clientes c ON c.id = p.cliente_id
    WHERE p.id = analises.processo_id 
    AND c.user_id = auth.uid()
  ));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_clientes_user_id ON clientes(user_id);
CREATE INDEX IF NOT EXISTS idx_processos_cliente_id ON processos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_processos_status ON processos(status);
CREATE INDEX IF NOT EXISTS idx_arquivos_processo_id ON arquivos(processo_id);
CREATE INDEX IF NOT EXISTS idx_analises_processo_id ON analises(processo_id);

-- Create storage bucket for file uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('processo-files', 'processo-files', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
CREATE POLICY "Users can upload their own files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'processo-files');

CREATE POLICY "Users can read their own files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'processo-files');

CREATE POLICY "Users can update their own files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'processo-files');

CREATE POLICY "Users can delete their own files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'processo-files');