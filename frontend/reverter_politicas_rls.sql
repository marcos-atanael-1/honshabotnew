-- Script para reverter políticas RLS que estão bloqueando a visualização de clientes
-- Execute no console SQL do Supabase

-- OPÇÃO 1: DESABILITAR RLS TEMPORARIAMENTE (MAIS RÁPIDO)
-- ⚠️ ATENÇÃO: Isso remove toda a segurança RLS temporariamente

-- Desabilitar RLS em todas as tabelas principais
ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE processos DISABLE ROW LEVEL SECURITY;
ALTER TABLE transcricoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE analises DISABLE ROW LEVEL SECURITY;
ALTER TABLE arquivos DISABLE ROW LEVEL SECURITY;

SELECT 'RLS desabilitado em todas as tabelas' as status;

-- OPÇÃO 2: AJUSTAR POLÍTICAS PARA PERMITIR LEITURA (MAIS SEGURO)
-- Descomente as linhas abaixo se preferir manter RLS ativo mas permitir leitura

/*
-- Remover políticas restritivas atuais
DROP POLICY IF EXISTS "Users can view own clientes" ON clientes;
DROP POLICY IF EXISTS "Users can view own processos" ON processos;
DROP POLICY IF EXISTS "Users can view own transcricoes" ON transcricoes;
DROP POLICY IF EXISTS "Users can view own analises" ON analises;
DROP POLICY IF EXISTS "Users can view own arquivos" ON arquivos;

-- Criar políticas mais permissivas para SELECT (leitura)
CREATE POLICY "Allow all users to view clientes" ON clientes
    FOR SELECT USING (true);

CREATE POLICY "Allow all users to view processos" ON processos
    FOR SELECT USING (true);

CREATE POLICY "Allow all users to view transcricoes" ON transcricoes
    FOR SELECT USING (true);

CREATE POLICY "Allow all users to view analises" ON analises
    FOR SELECT USING (true);

CREATE POLICY "Allow all users to view arquivos" ON arquivos
    FOR SELECT USING (true);

-- Manter políticas restritivas para INSERT/UPDATE/DELETE
CREATE POLICY "Users can insert own clientes" ON clientes
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own processos" ON processos
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own transcricoes" ON transcricoes
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own analises" ON analises
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own arquivos" ON arquivos
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

SELECT 'Políticas RLS ajustadas - leitura liberada, escrita controlada' as status;
*/

-- VERIFICAÇÃO: Listar status atual das tabelas
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '🔒 RLS Ativo'
        ELSE '🔓 RLS Desabilitado'
    END as status
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN ('processos', 'clientes', 'transcricoes', 'analises', 'arquivos')
ORDER BY tablename;

-- VERIFICAÇÃO: Contar políticas restantes
SELECT 
    tablename,
    COUNT(*) as total_policies
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN ('processos', 'clientes', 'transcricoes', 'analises', 'arquivos')
GROUP BY tablename
ORDER BY tablename;

-- TESTE: Verificar se consegue ler clientes
SELECT 
    COUNT(*) as total_clientes,
    'Se este número aparecer, a leitura está funcionando' as teste
FROM clientes;

-- INSTRUÇÕES PARA REATIVAR RLS DEPOIS (se necessário):
/*
Para reativar RLS mais tarde, execute:

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE processos ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcricoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE analises ENABLE ROW LEVEL SECURITY;
ALTER TABLE arquivos ENABLE ROW LEVEL SECURITY;
*/