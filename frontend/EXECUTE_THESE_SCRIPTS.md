# Scripts para Executar no Supabase (EM ORDEM)

## 1. PRIMEIRO: Sistema de Autenticação Customizado

Execute este SQL no console do Supabase:

```sql
-- MIGRATION: Sistema de Autenticação Customizado
-- Execute todo este bloco no console SQL do Supabase

-- 1. Adicionar campos necessários para autenticação customizada
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS password_hash text,
ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_login timestamptz,
ADD COLUMN IF NOT EXISTS login_attempts integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_until timestamptz;

-- 2. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON public.users(email, email_verified);

-- 3. Extensão para criptografia (se não existir)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 4. Função para hash de senha
CREATE OR REPLACE FUNCTION hash_password(password text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT crypt(password, gen_salt('bf', 10));
$$;

-- 5. Função para verificar senha
CREATE OR REPLACE FUNCTION verify_password(password text, hash text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT crypt(password, hash) = hash;
$$;

-- 6. Função para criar usuário customizado
CREATE OR REPLACE FUNCTION create_user_custom(
  p_email text,
  p_password text,
  p_nome text,
  p_role text DEFAULT 'user'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id uuid;
  result json;
BEGIN
  -- Verificar se email já existe
  IF EXISTS (SELECT 1 FROM public.users WHERE email = p_email) THEN
    RETURN json_build_object('error', 'Email já está em uso');
  END IF;

  -- Criar novo usuário
  INSERT INTO public.users (
    email, 
    nome, 
    role, 
    password_hash, 
    email_verified,
    password_reset_required,
    is_temp_password
  )
  VALUES (
    p_email, 
    p_nome, 
    p_role::text, 
    hash_password(p_password), 
    true,
    true,
    true
  )
  RETURNING id INTO new_user_id;

  result := json_build_object(
    'success', true,
    'user_id', new_user_id,
    'email', p_email,
    'nome', p_nome,
    'role', p_role
  );

  RETURN result;
END;
$$;

-- 7. Função para login customizado
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
    RETURN json_build_object('error', 'Credenciais inválidas');
  END IF;

  -- Verificar se conta está bloqueada
  IF user_record.locked_until IS NOT NULL AND user_record.locked_until > NOW() THEN
    RETURN json_build_object('error', 'Conta temporariamente bloqueada');
  END IF;

  -- Verificar senha
  IF NOT verify_password(p_password, user_record.password_hash) THEN
    -- Incrementar tentativas de login
    UPDATE public.users 
    SET 
      login_attempts = COALESCE(login_attempts, 0) + 1,
      locked_until = CASE 
        WHEN COALESCE(login_attempts, 0) + 1 >= 5 
        THEN NOW() + INTERVAL '15 minutes'
        ELSE NULL 
      END
    WHERE id = user_record.id;
    
    RETURN json_build_object('error', 'Credenciais inválidas');
  END IF;

  -- Login bem-sucedido - reset tentativas e atualizar last_login
  UPDATE public.users 
  SET 
    login_attempts = 0,
    locked_until = NULL,
    last_login = NOW()
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
      'email_verified', user_record.email_verified,
      'created_at', user_record.created_at
    )
  );

  RETURN result;
END;
$$;

-- 8. Função para atualizar senha
CREATE OR REPLACE FUNCTION update_password_custom(
  p_user_id uuid,
  p_new_password text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users 
  SET 
    password_hash = hash_password(p_new_password),
    password_reset_required = false,
    is_temp_password = false
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Usuário não encontrado');
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

-- 9. Atualizar senha do usuário pmlean@demo.com para funcionar no sistema customizado
UPDATE public.users 
SET 
  password_hash = hash_password('123456'),
  email_verified = true,
  password_reset_required = false,
  is_temp_password = false
WHERE email = 'pmlean@demo.com';
```

## ✅ EXECUTE ESTE SCRIPT PRIMEIRO

Depois me avise que executou para eu continuar com a migração do código! 

## Próximas Etapas (após executar o script):
1. Backup do AuthContext atual
2. Substituir por CustomAuthContext  
3. Atualizar todos os imports
4. Testar sistema

**Não execute mais nada até eu falar!** Só este script primeiro.
