# Diagnóstico e Solução para Erro 403 RLS

## Problema
Erro 403 "new row violates row-level security policy" ao criar novos processos no frontend hospedado no Vercel.

## Possíveis Causas

### 1. Políticas RLS Incorretas
As políticas RLS podem estar configuradas apenas com `USING (true)` mas sem `WITH CHECK (true)` para operações de INSERT.

### 2. Token JWT Inválido ou Expirado
O token de autenticação pode não estar sendo enviado corretamente ou estar expirado.

### 3. Configuração de Ambiente no Vercel
As variáveis de ambiente `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` podem estar incorretas no Vercel.

## Soluções

### Solução 1: Corrigir Políticas RLS

1. **Execute o script SQL no console do Supabase:**
   - Abra o console SQL do seu projeto Supabase
   - Execute o conteúdo do arquivo `fix_rls_policies.sql`

### Solução 2: Verificar Configuração no Vercel

1. **Verificar variáveis de ambiente no Vercel:**
   ```bash
   # No dashboard do Vercel, vá em Settings > Environment Variables
   # Verifique se estas variáveis estão configuradas:
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-anonima
   ```

2. **Redeployar após alterar variáveis:**
   - Após alterar as variáveis, faça um novo deploy
   - Ou force um redeploy no dashboard do Vercel

### Solução 3: Verificar Autenticação

1. **Adicionar logs de debug temporários:**
   ```javascript
   // No arquivo onde você cria o processo, adicione:
   console.log('Auth status:', await supabase.auth.getSession());
   console.log('User:', await supabase.auth.getUser());
   ```

2. **Verificar se o usuário está autenticado:**
   - Abra o DevTools do navegador
   - Verifique se há erros de autenticação no console
   - Verifique se o token JWT está presente nas requisições

### Solução 4: Teste Local vs Produção

1. **Teste localmente primeiro:**
   ```bash
   npm run dev
   # Tente criar um processo localmente
   ```

2. **Compare comportamento:**
   - Se funciona localmente mas não no Vercel, é problema de configuração
   - Se não funciona em nenhum lugar, é problema de RLS

## Script de Verificação Rápida

Execute no console SQL do Supabase para verificar as políticas atuais:

```sql
-- Verificar políticas RLS atuais
SELECT 
    tablename,
    policyname,
    permissive,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename = 'processos'
ORDER BY policyname;

-- Verificar se RLS está habilitado
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'processos'
AND schemaname = 'public';
```

## Próximos Passos

1. Execute o script `fix_rls_policies.sql` no Supabase
2. Verifique as variáveis de ambiente no Vercel
3. Faça um redeploy no Vercel
4. Teste a criação de processos novamente
5. Se ainda não funcionar, adicione logs de debug e verifique o console do navegador

## Contato para Suporte

Se o problema persistir após seguir todos os passos:
1. Compartilhe os logs do console do navegador
2. Compartilhe o resultado das queries de verificação RLS
3. Confirme se as variáveis de ambiente estão corretas no Vercel