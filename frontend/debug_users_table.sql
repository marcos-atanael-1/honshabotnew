-- Debug da tabela users e RLS
-- Execute no console SQL do Supabase

-- 1. Verificar se a tabela users existe e tem dados
SELECT 'Verificando tabela users' as step;
SELECT COUNT(*) as total_users FROM public.users;

-- 2. Verificar estrutura da tabela
SELECT 'Estrutura da tabela users' as step;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'users';

-- 3. Verificar policies de RLS
SELECT 'Policies de RLS na tabela users' as step;
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'users' 
AND schemaname = 'public';

-- 4. Verificar se RLS está habilitado
SELECT 'Status do RLS' as step;
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'users' 
AND schemaname = 'public';

-- 5. Listar todos os usuários (para admin)
SELECT 'Todos os usuários' as step;
SELECT 
    id,
    email,
    nome,
    role,
    password_reset_required,
    is_temp_password,
    created_at
FROM public.users 
ORDER BY created_at DESC;

-- 6. Verificar o usuário atual
SELECT 'Usuário logado atual' as step;
SELECT 
    auth.uid() as current_user_id,
    auth.jwt() as current_jwt
;
