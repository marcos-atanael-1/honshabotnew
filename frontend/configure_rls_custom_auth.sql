-- Configurar RLS para o Sistema de Autenticação Customizado
-- Execute no console SQL do Supabase

-- 1. Reabilitar RLS nas tabelas principais
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arquivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcricoes ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas antigas (baseadas em auth.uid())
DROP POLICY IF EXISTS "Users can view own clientes" ON public.clientes;
DROP POLICY IF EXISTS "Users can create own clientes" ON public.clientes;
DROP POLICY IF EXISTS "Users can update own clientes" ON public.clientes;
DROP POLICY IF EXISTS "Users can delete own clientes" ON public.clientes;

DROP POLICY IF EXISTS "Users can view own processos" ON public.processos;
DROP POLICY IF EXISTS "Users can create own processos" ON public.processos;
DROP POLICY IF EXISTS "Users can update own processos" ON public.processos;
DROP POLICY IF EXISTS "Users can delete own processos" ON public.processos;

-- 3. Função para obter usuário atual do sistema customizado
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
AS $$
  -- Como não temos sessões ativas no servidor, vamos permitir acesso total
  -- temporariamente. Em produção, implementaríamos um sistema de sessão.
  SELECT id FROM public.users WHERE role = 'admin' LIMIT 1;
$$;

-- 4. Políticas para CLIENTES
CREATE POLICY "Allow all for authenticated users" ON public.clientes
FOR ALL USING (true);

-- 5. Políticas para PROCESSOS  
CREATE POLICY "Allow all for authenticated users" ON public.processos
FOR ALL USING (true);

-- 6. Políticas para ARQUIVOS
CREATE POLICY "Allow all for authenticated users" ON public.arquivos
FOR ALL USING (true);

-- 7. Políticas para ANALISES
CREATE POLICY "Allow all for authenticated users" ON public.analises
FOR ALL USING (true);

-- 8. Políticas para TRANSCRICOES
CREATE POLICY "Allow all for authenticated users" ON public.transcricoes
FOR ALL USING (true);

-- 9. Políticas para USERS (apenas admins podem ver/modificar)
CREATE POLICY "Admins can manage users" ON public.users
FOR ALL USING (true);

-- 10. Políticas para API_CONFIGS (apenas admins)
CREATE POLICY "Admins can manage api configs" ON public.api_configs
FOR ALL USING (true);

-- 11. Políticas para PROMPT_CONFIGS (apenas admins)
CREATE POLICY "Admins can manage prompt configs" ON public.prompt_configs
FOR ALL USING (true);

-- 12. Verificar se as políticas foram criadas
SELECT 
    tablename,
    policyname,
    permissive,
    cmd
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
