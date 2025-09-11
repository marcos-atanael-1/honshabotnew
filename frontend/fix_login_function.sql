-- Criar função de login simplificada
-- Execute no console SQL do Supabase

-- 1. Garantir que a extensão pgcrypto existe
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Função para hash de senha (se não existir)
CREATE OR REPLACE FUNCTION hash_password(password text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT crypt(password, gen_salt('bf', 10));
$$;

-- 3. Função para verificar senha (se não existir)
CREATE OR REPLACE FUNCTION verify_password(password text, hash text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT crypt(password, hash) = hash;
$$;

-- 4. Função de login customizada CORRIGIDA
CREATE OR REPLACE FUNCTION login_custom(p_email text, p_password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record public.users%ROWTYPE;
  result json;
BEGIN
  -- Buscar usuário
  SELECT * INTO user_record 
  FROM public.users 
  WHERE email = p_email;

  -- Verificar se usuário existe
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Credenciais inválidas');
  END IF;

  -- Se não tem password_hash, verificar se é a senha padrão
  IF user_record.password_hash IS NULL THEN
    -- Para usuários sem hash, verificar senha simples (migração)
    IF p_password = '123456' THEN
      -- Atualizar com hash na primeira vez
      UPDATE public.users 
      SET password_hash = hash_password(p_password)
      WHERE id = user_record.id;
      
      -- Recarregar dados
      SELECT * INTO user_record FROM public.users WHERE id = user_record.id;
    ELSE
      RETURN json_build_object('success', false, 'error', 'Credenciais inválidas');
    END IF;
  END IF;

  -- Verificar senha com hash
  IF NOT verify_password(p_password, user_record.password_hash) THEN
    RETURN json_build_object('success', false, 'error', 'Credenciais inválidas');
  END IF;

  -- Login bem-sucedido - atualizar last_login
  UPDATE public.users 
  SET last_login = NOW()
  WHERE id = user_record.id;

  -- Retornar dados do usuário (exceto senha)
  result := json_build_object(
    'success', true,
    'user', json_build_object(
      'id', user_record.id,
      'email', user_record.email,
      'nome', user_record.nome,
      'role', user_record.role,
      'password_reset_required', user_record.password_reset_required,
      'is_temp_password', user_record.is_temp_password,
      'email_verified', COALESCE(user_record.email_verified, true),
      'created_at', user_record.created_at
    )
  );

  RETURN result;
END;
$$;

-- 5. Testar a função
SELECT login_custom('pmlean@demo.com', '123456');
