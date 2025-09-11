-- Debug da tabela clientes
-- Execute no console SQL do Supabase

-- 1. Verificar se a tabela clientes existe
SELECT 'Verificando tabela clientes' as step;
SELECT COUNT(*) as total_clientes FROM public.clientes;

-- 2. Listar todos os clientes
SELECT 'Todos os clientes' as step;
SELECT 
    id,
    nome,
    created_at,
    user_id
FROM public.clientes 
ORDER BY created_at DESC
LIMIT 10;

-- 3. Verificar se há policies de RLS bloqueando
SELECT 'Policies RLS da tabela clientes' as step;
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'clientes' 
AND schemaname = 'public';

-- 4. Verificar estrutura da tabela
SELECT 'Estrutura da tabela clientes' as step;
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'clientes'
ORDER BY ordinal_position;

-- 5. Criar alguns clientes de teste (se não existir nenhum)
INSERT INTO public.clientes (nome, descricao, user_id) 
SELECT 
    'Cliente Teste ' || generate_series,
    'Descrição do cliente teste ' || generate_series,
    (SELECT id FROM public.users WHERE role = 'admin' LIMIT 1)
FROM generate_series(1, 3)
WHERE NOT EXISTS (SELECT 1 FROM public.clientes);

-- 6. Verificar novamente após inserção
SELECT 'Clientes após inserção' as step;
SELECT COUNT(*) as total_clientes FROM public.clientes;
