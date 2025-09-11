-- Script para debug do sistema de autenticação
-- Execute no console SQL do Supabase para verificar o estado dos usuários

-- 1. Verificar usuários em auth.users
SELECT 
    'auth.users' as tabela,
    id,
    email,
    created_at,
    email_confirmed_at,
    raw_user_meta_data->>'nome' as nome_metadata
FROM auth.users
ORDER BY created_at DESC;

-- 2. Verificar usuários em public.users
SELECT 
    'public.users' as tabela,
    id,
    email,
    nome,
    role,
    password_reset_required,
    is_temp_password,
    created_at
FROM public.users
ORDER BY created_at DESC;

-- 3. Verificar usuários que estão em auth mas não em public
SELECT 
    'missing_in_public' as status,
    au.id,
    au.email,
    au.created_at
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL;

-- 4. Verificar usuários que estão em public mas não em auth (não deveria existir)
SELECT 
    'missing_in_auth' as status,
    pu.id,
    pu.email,
    pu.created_at
FROM public.users pu
LEFT JOIN auth.users au ON pu.id = au.id
WHERE au.id IS NULL;

-- 5. Contar totais
SELECT 
    (SELECT COUNT(*) FROM auth.users) as total_auth_users,
    (SELECT COUNT(*) FROM public.users) as total_public_users,
    (SELECT COUNT(*) FROM public.users WHERE role = 'admin') as total_admins;
