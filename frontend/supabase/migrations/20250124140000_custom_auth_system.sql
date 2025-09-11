/*
  # Sistema de Autenticação Customizado

  1. Alterações na tabela users
    - Adicionar campo password_hash para armazenar senhas
    - Adicionar campo email_verified para controle de email
    - Adicionar campo last_login para auditoria
    - Adicionar índices para performance

  2. Funções de autenticação
    - Função para hash de senha
    - Função para verificar senha
    - Função para login
    - Função para criar usuário

  3. Políticas RLS simplificadas
    - Baseadas apenas na tabela users
    - Controle por sessão customizada
*/

-- Adicionar campos necessários para autenticação customizada
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS password_hash text,
ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_login timestamptz,
ADD COLUMN IF NOT EXISTS login_attempts integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_until timestamptz;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON public.users(email, email_verified);

-- Função para hash de senha usando pgcrypto
CREATE OR REPLACE FUNCTION hash_password(password text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT crypt(password, gen_salt('bf', 12));
$$;

-- Função para verificar senha
CREATE OR REPLACE FUNCTION verify_password(password text, hash text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT crypt(password, hash) = hash;
$$;

-- Função para fazer login
CREATE OR REPLACE FUNCTION custom_login(user_email text, user_password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record public.users%ROWTYPE;
  session_token text;
BEGIN
  -- Buscar usuário
  SELECT * INTO user_record
  FROM public.users
  WHERE email = user_email AND email_verified = true;
  
  -- Verificar se usuário existe
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Email ou senha incorretos'
    );
  END IF;
  
  -- Verificar se conta está bloqueada
  IF user_record.locked_until IS NOT NULL AND user_record.locked_until > NOW() THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Conta temporariamente bloqueada'
    );
  END IF;
  
  -- Verificar senha
  IF NOT verify_password(user_password, user_record.password_hash) THEN
    -- Incrementar tentativas de login
    UPDATE public.users 
    SET login_attempts = login_attempts + 1,
        locked_until = CASE 
          WHEN login_attempts >= 4 THEN NOW() + INTERVAL '15 minutes'
          ELSE NULL
        END
    WHERE id = user_record.id;
    
    RETURN json_build_object(
      'success', false,
      'error', 'Email ou senha incorretos'
    );
  END IF;
  
  -- Login bem-sucedido
  session_token := encode(gen_random_bytes(32), 'base64');
  
  UPDATE public.users 
  SET last_login = NOW(),
      login_attempts = 0,
      locked_until = NULL
  WHERE id = user_record.id;
  
  -- Retornar dados do usuário (sem senha)
  RETURN json_build_object(
    'success', true,
    'user', json_build_object(
      'id', user_record.id,
      'email', user_record.email,
      'nome', user_record.nome,
      'role', user_record.role,
      'password_reset_required', user_record.password_reset_required,
      'is_temp_password', user_record.is_temp_password,
      'created_at', user_record.created_at,
      'updated_at', user_record.updated_at
    ),
    'session_token', session_token
  );
END;
$$;

-- Função para criar usuário
CREATE OR REPLACE FUNCTION create_user(
  user_email text,
  user_password text,
  user_nome text,
  user_role text DEFAULT 'user'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id uuid;
  password_hash text;
BEGIN
  -- Verificar se email já existe
  IF EXISTS (SELECT 1 FROM public.users WHERE email = user_email) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Email já está em uso'
    );
  END IF;
  
  -- Gerar hash da senha
  password_hash := hash_password(user_password);
  new_user_id := gen_random_uuid();
  
  -- Inserir usuário
  INSERT INTO public.users (
    id, email, nome, role, password_hash, 
    email_verified, password_reset_required, is_temp_password,
    created_at, updated_at
  ) VALUES (
    new_user_id, user_email, user_nome, user_role, password_hash,
    true, false, false,
    NOW(), NOW()
  );
  
  RETURN json_build_object(
    'success', true,
    'user_id', new_user_id
  );
END;
$$;

-- Função para trocar senha
CREATE OR REPLACE FUNCTION change_password(
  user_id uuid,
  old_password text,
  new_password text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record public.users%ROWTYPE;
  new_hash text;
BEGIN
  -- Buscar usuário
  SELECT * INTO user_record
  FROM public.users
  WHERE id = user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Usuário não encontrado'
    );
  END IF;
  
  -- Se não é senha temporária, verificar senha atual
  IF NOT user_record.is_temp_password AND NOT verify_password(old_password, user_record.password_hash) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Senha atual incorreta'
    );
  END IF;
  
  -- Gerar hash da nova senha
  new_hash := hash_password(new_password);
  
  -- Atualizar senha
  UPDATE public.users 
  SET password_hash = new_hash,
      password_reset_required = false,
      is_temp_password = false,
      updated_at = NOW()
  WHERE id = user_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Senha alterada com sucesso'
  );
END;
$$;

-- Tabela para sessões customizadas
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  session_token text UNIQUE NOT NULL,
  expires_at timestamptz DEFAULT (NOW() + INTERVAL '7 days'),
  created_at timestamptz DEFAULT NOW(),
  last_used timestamptz DEFAULT NOW(),
  user_agent text,
  ip_address inet
);

-- Índices para sessões
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- Função para limpar sessões expiradas
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM user_sessions WHERE expires_at < NOW();
$$;

-- Habilitar extensão pgcrypto se não estiver habilitada
CREATE EXTENSION IF NOT EXISTS pgcrypto;
