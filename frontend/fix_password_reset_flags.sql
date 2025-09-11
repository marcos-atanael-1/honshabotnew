-- Corrigir flags de senha após troca de senha
-- Execute no console SQL do Supabase

-- 1. Verificar estado atual do usuário
SELECT 
    email,
    nome,
    role,
    password_reset_required,
    is_temp_password,
    email_verified,
    updated_at
FROM public.users 
WHERE email = 'pmlean@demo.com';

-- 2. CORRIGIR: Marcar que não precisa mais trocar senha
UPDATE public.users 
SET 
    password_reset_required = false,
    is_temp_password = false,
    email_verified = true,
    updated_at = NOW()
WHERE email = 'pmlean@demo.com';

-- 3. Verificar se foi corrigido
SELECT 
    email,
    nome,
    role,
    password_reset_required,
    is_temp_password,
    email_verified,
    'Flags corrigidos - usuário pode acessar normalmente' as status
FROM public.users 
WHERE email = 'pmlean@demo.com';
