-- Criar função create_user_custom corrigida
-- Execute no console SQL do Supabase

-- 1. Garantir extensão pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Função para criar usuário customizado
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
    RETURN json_build_object('success', false, 'error', 'Email já está em uso');
  END IF;

  -- Gerar ID para o novo usuário
  new_user_id := gen_random_uuid();

  -- Criar novo usuário
  INSERT INTO public.users (
    id,
    email, 
    nome, 
    role, 
    password_hash, 
    email_verified,
    password_reset_required,
    is_temp_password,
    created_at
  )
  VALUES (
    new_user_id,
    p_email, 
    p_nome, 
    p_role::text, 
    crypt(p_password, gen_salt('bf', 10)), 
    true,
    true,
    true,
    NOW()
  );

  result := json_build_object(
    'success', true,
    'user_id', new_user_id,
    'email', p_email,
    'nome', p_nome,
    'role', p_role
  );

  RETURN result;
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'error', 'Email já está em uso');
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Erro interno: ' || SQLERRM);
END;
$$;

-- 3. Função para atualizar senha customizada
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
    password_hash = crypt(p_new_password, gen_salt('bf', 10)),
    password_reset_required = false,
    is_temp_password = false,
    updated_at = NOW()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não encontrado');
  END IF;

  RETURN json_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'Erro interno: ' || SQLERRM);
END;
$$;

-- 4. Testar as funções
SELECT 'Testando create_user_custom' as test;
SELECT create_user_custom('teste@example.com', 'senha123', 'Usuario Teste', 'user');

-- 5. Verificar se o usuário foi criado
SELECT 'Usuário criado' as verification;
SELECT id, email, nome, role FROM public.users WHERE email = 'teste@example.com';

-- 6. Limpar teste
DELETE FROM public.users WHERE email = 'teste@example.com';
