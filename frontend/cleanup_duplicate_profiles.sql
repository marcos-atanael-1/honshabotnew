-- Script para limpar perfis duplicados e inconsistências na tabela users
-- Execute no console SQL do Supabase

-- 1. Verificar perfis duplicados por email
SELECT 
    email, 
    COUNT(*) as duplicates,
    array_agg(id) as user_ids
FROM public.users 
GROUP BY email 
HAVING COUNT(*) > 1;

-- 2. Verificar usuários em auth.users que não existem em public.users
SELECT 
    'auth_only' as status,
    au.id,
    au.email,
    au.created_at
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL;

-- 3. Verificar usuários em public.users que não existem em auth.users
SELECT 
    'public_only' as status,
    pu.id,
    pu.email,
    pu.created_at
FROM public.users pu
LEFT JOIN auth.users au ON pu.id = au.id
WHERE au.id IS NULL;

-- 4. LIMPEZA: Deletar perfis órfãos que não têm usuário correspondente no auth
DELETE FROM public.users 
WHERE id NOT IN (SELECT id FROM auth.users);

-- 5. LIMPEZA: Para cada email duplicado, manter apenas o que tem ID correto do auth
WITH duplicates AS (
    SELECT 
        email,
        id,
        ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at DESC) as rn,
        EXISTS(SELECT 1 FROM auth.users WHERE auth.users.id = users.id) as has_auth
    FROM public.users
    WHERE email IN (
        SELECT email 
        FROM public.users 
        GROUP BY email 
        HAVING COUNT(*) > 1
    )
)
DELETE FROM public.users 
WHERE id IN (
    SELECT id FROM duplicates 
    WHERE rn > 1 OR has_auth = false
);

-- 6. SINCRONIZAÇÃO: Criar perfis para usuários auth que não têm perfil
INSERT INTO public.users (id, email, nome, role, password_reset_required, is_temp_password, created_at, updated_at)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'nome', split_part(au.email, '@', 1)),
    'user',
    false,
    false,
    au.created_at,
    COALESCE(au.updated_at, au.created_at)
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
AND au.email IS NOT NULL;

-- 7. Verificação final: contar usuários
SELECT 
    (SELECT COUNT(*) FROM auth.users) as auth_count,
    (SELECT COUNT(*) FROM public.users) as public_count,
    (SELECT COUNT(*) FROM public.users WHERE role = 'admin') as admin_count;
