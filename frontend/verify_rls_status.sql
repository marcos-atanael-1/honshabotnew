-- Script para verificar o status atual das políticas RLS
-- Execute no console SQL do Supabase

-- 1. Verificar se RLS está habilitado nas tabelas
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✅ Habilitado'
        ELSE '❌ Desabilitado'
    END as status
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN ('processos', 'clientes', 'transcricoes', 'analises', 'arquivos')
ORDER BY tablename;

-- 2. Listar todas as políticas RLS atuais
SELECT 
    tablename,
    policyname,
    permissive,
    cmd as operacao,
    CASE 
        WHEN cmd = 'ALL' THEN '🔓 Todas'
        WHEN cmd = 'SELECT' THEN '👁️ Leitura'
        WHEN cmd = 'INSERT' THEN '➕ Inserção'
        WHEN cmd = 'UPDATE' THEN '✏️ Atualização'
        WHEN cmd = 'DELETE' THEN '🗑️ Exclusão'
    END as tipo_operacao,
    qual as condicao_using,
    with_check as condicao_with_check
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN ('processos', 'clientes', 'transcricoes', 'analises', 'arquivos')
ORDER BY tablename, policyname;

-- 3. Verificar se existem políticas conflitantes ou duplicadas
SELECT 
    tablename,
    COUNT(*) as total_policies,
    STRING_AGG(policyname, ', ') as policy_names
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN ('processos', 'clientes', 'transcricoes', 'analises', 'arquivos')
GROUP BY tablename
ORDER BY tablename;

-- 4. Testar se um usuário autenticado pode inserir na tabela processos
-- (Este teste só funciona se você estiver logado)
SELECT 
    'Testando permissões de INSERT na tabela processos...' as teste;

-- 5. Verificar se há usuários na tabela auth.users
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN email_confirmed_at IS NOT NULL THEN 1 END) as confirmed_users
FROM auth.users;

-- 6. Verificar estrutura da tabela processos
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'processos'
ORDER BY ordinal_position;

-- 7. Verificar se há triggers ou funções que podem estar interferindo
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_schema = 'public'
AND event_object_table IN ('processos', 'clientes', 'transcricoes', 'analises', 'arquivos')
ORDER BY event_object_table, trigger_name;

-- 8. Verificar constraints que podem estar causando problemas
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu 
    ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_schema = 'public'
AND tc.table_name IN ('processos', 'clientes', 'transcricoes', 'analises', 'arquivos')
ORDER BY tc.table_name, tc.constraint_type;

-- 9. Verificar se auth.uid() está funcionando
SELECT 
    auth.uid() as current_user_id,
    CASE 
        WHEN auth.uid() IS NOT NULL THEN '✅ Usuário autenticado'
        ELSE '❌ Usuário não autenticado'
    END as auth_status;

-- 10. Resumo final
SELECT 
    '=== RESUMO DO DIAGNÓSTICO ===' as diagnostico
UNION ALL
SELECT 
    CONCAT('Tabelas com RLS: ', COUNT(CASE WHEN rowsecurity THEN 1 END), '/', COUNT(*))
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN ('processos', 'clientes', 'transcricoes', 'analises', 'arquivos')
UNION ALL
SELECT 
    CONCAT('Total de políticas: ', COUNT(*))
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN ('processos', 'clientes', 'transcricoes', 'analises', 'arquivos');