-- Debug: Verificar se as funções foram criadas
-- Execute no console SQL do Supabase

-- 1. Verificar se as funções existem
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%custom%'
ORDER BY routine_name;

-- 2. Listar todas as funções criadas
SELECT 
    proname as function_name,
    prosrc as function_source
FROM pg_proc 
WHERE proname LIKE '%custom%'
OR proname LIKE '%login%'
OR proname LIKE '%password%';

-- 3. Testar a função login_custom diretamente
SELECT login_custom('pmlean@demo.com', '123456');

-- 4. Verificar estrutura da tabela users
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'users'
ORDER BY ordinal_position;
