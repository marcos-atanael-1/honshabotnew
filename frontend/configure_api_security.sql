-- Configurar segurança das chaves de API
-- Execute no console SQL do Supabase

-- 1. Políticas para API_CONFIGS - apenas admins podem VER/EDITAR
DROP POLICY IF EXISTS "Admins can manage api configs" ON public.api_configs;

CREATE POLICY "Only admins can view api configs" ON public.api_configs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Only admins can insert api configs" ON public.api_configs
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Only admins can update api configs" ON public.api_configs
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Only admins can delete api configs" ON public.api_configs
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 2. Função para obter chaves de API (todos podem usar, mas não ver)
CREATE OR REPLACE FUNCTION get_api_key(provider_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER  -- Executa com privilégios do dono da função
AS $$
DECLARE
  api_key text;
BEGIN
  SELECT api_key INTO api_key
  FROM public.api_configs
  WHERE provider = provider_name AND ativo = true
  LIMIT 1;
  
  RETURN api_key;
END;
$$;

-- 3. Função para verificar se API está configurada
CREATE OR REPLACE FUNCTION is_api_configured(provider_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.api_configs
    WHERE provider = provider_name AND ativo = true AND api_key IS NOT NULL
  );
END;
$$;

-- 4. Políticas similares para PROMPT_CONFIGS
DROP POLICY IF EXISTS "Admins can manage prompt configs" ON public.prompt_configs;

CREATE POLICY "Only admins can manage prompt configs" ON public.prompt_configs
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 5. Verificar as políticas criadas
SELECT 
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('api_configs', 'prompt_configs')
ORDER BY tablename, policyname;
