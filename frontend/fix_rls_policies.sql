-- Corrigir políticas RLS para permitir INSERT/UPDATE
-- Execute no console SQL do Supabase

-- 1. Remover políticas existentes que podem estar causando conflito
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.processos;
DROP POLICY IF EXISTS "Allow all operations on processos" ON public.processos;
DROP POLICY IF EXISTS "Users can read own processos" ON public.processos;
DROP POLICY IF EXISTS "Users can insert own processos" ON public.processos;
DROP POLICY IF EXISTS "Users can update own processos" ON public.processos;
DROP POLICY IF EXISTS "Users can delete own processos" ON public.processos;

-- 2. Criar nova política permissiva para todas as operações
CREATE POLICY "Allow all operations for authenticated users" ON public.processos
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- 3. Fazer o mesmo para outras tabelas relacionadas
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.clientes;
DROP POLICY IF EXISTS "Allow all operations on clientes" ON public.clientes;

CREATE POLICY "Allow all operations for authenticated users" ON public.clientes
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- 4. Transcricoes
DROP POLICY IF EXISTS "Users can view their own transcricoes" ON public.transcricoes;
DROP POLICY IF EXISTS "Users can insert transcricoes for their processos" ON public.transcricoes;
DROP POLICY IF EXISTS "Users can update their own transcricoes" ON public.transcricoes;
DROP POLICY IF EXISTS "Users can delete their own transcricoes" ON public.transcricoes;

CREATE POLICY "Allow all operations for authenticated users" ON public.transcricoes
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- 5. Analises
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.analises;
DROP POLICY IF EXISTS "Allow all operations on analises" ON public.analises;

CREATE POLICY "Allow all operations for authenticated users" ON public.analises
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- 6. Arquivos
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.arquivos;
DROP POLICY IF EXISTS "Allow all operations on arquivos" ON public.arquivos;

CREATE POLICY "Allow all operations for authenticated users" ON public.arquivos
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- 7. Verificar se as políticas foram criadas corretamente
SELECT 
    tablename,
    policyname,
    permissive,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN ('processos', 'clientes', 'transcricoes', 'analises', 'arquivos')
ORDER BY tablename, policyname;

-- 8. Verificar se RLS está habilitado
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('processos', 'clientes', 'transcricoes', 'analises', 'arquivos')
AND schemaname = 'public';