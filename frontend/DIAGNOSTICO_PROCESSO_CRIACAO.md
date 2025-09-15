# 🔧 Diagnóstico: Erro na Criação de Processos com Áudio/Vídeo

## 📋 Situação Atual
Após executar a query `fix_rls_policies.sql`, ainda há problemas na criação de processos com arquivos de áudio/vídeo.

## 🔍 Passos para Diagnóstico

### 1. Verificar Status das Políticas RLS
```sql
-- Execute no console SQL do Supabase:
-- Copie e cole o conteúdo de verify_rls_status.sql
```

### 2. Testar Criação de Processo no Frontend
```javascript
// Execute no console do navegador (F12) na página da aplicação:
// Copie e cole o conteúdo de test_processo_creation.js
```

### 3. Verificar Logs do Supabase
1. Acesse o painel do Supabase
2. Vá em **Logs** > **API**
3. Procure por erros relacionados a `processos` ou `RLS`

## 🚨 Possíveis Causas do Problema

### A. Políticas RLS Não Aplicadas Corretamente
**Sintomas:**
- Erro 403 Unauthorized
- Mensagem "new row violates row-level security policy"

**Solução:**
```sql
-- Re-executar fix_rls_policies.sql
-- Verificar se todas as políticas foram criadas
```

### B. Problema de Autenticação
**Sintomas:**
- `auth.uid()` retorna NULL
- Usuário não está logado corretamente

**Verificação:**
```javascript
// No console do navegador:
const { data: { user } } = await supabase.auth.getUser();
console.log('Usuário:', user);
```

### C. Problema na Estrutura da Tabela
**Sintomas:**
- Campos obrigatórios faltando
- Constraints violadas

**Verificação:**
```sql
-- Verificar estrutura da tabela processos
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'processos'
ORDER BY ordinal_position;
```

### D. Problema no Código Frontend
**Sintomas:**
- Dados inválidos sendo enviados
- Campos obrigatórios não preenchidos

**Verificação:**
- Verificar se `cliente_id` está sendo passado corretamente
- Verificar se todos os campos obrigatórios estão presentes

## 🛠️ Soluções por Prioridade

### 1. **ALTA PRIORIDADE** - Recriar Políticas RLS
```sql
-- Execute fix_rls_policies.sql novamente
-- Depois execute verify_rls_status.sql para confirmar
```

### 2. **MÉDIA PRIORIDADE** - Verificar Autenticação
```javascript
// Verificar se o usuário está logado
// Verificar se o token JWT é válido
// Re-fazer login se necessário
```

### 3. **BAIXA PRIORIDADE** - Verificar Dados
```javascript
// Verificar se cliente_id existe
// Verificar se todos os campos obrigatórios estão preenchidos
```

## 📊 Checklist de Verificação

- [ ] Executei `fix_rls_policies.sql`
- [ ] Executei `verify_rls_status.sql` e verifiquei os resultados
- [ ] Executei `test_processo_creation.js` no console do navegador
- [ ] Verifiquei os logs do Supabase
- [ ] Confirmei que o usuário está autenticado
- [ ] Verifiquei se existe pelo menos um cliente
- [ ] Testei criar um processo simples (só texto) primeiro
- [ ] Testei criar um processo com áudio/vídeo

## 🔄 Processo de Teste Completo

### Teste 1: Processo de Texto (Mais Simples)
1. Faça login na aplicação
2. Vá para um cliente existente
3. Tente criar um processo do tipo "Texto"
4. Se funcionar, o problema é específico de áudio/vídeo

### Teste 2: Processo de Áudio/Vídeo
1. Após confirmar que texto funciona
2. Tente criar um processo do tipo "Áudio/Vídeo"
3. Observe o erro específico no console

### Teste 3: Verificação Manual
1. Execute o script `test_processo_creation.js`
2. Analise os logs detalhados
3. Identifique exatamente onde está falhando

## 📞 Próximos Passos

1. **Execute os scripts de diagnóstico**
2. **Colete os resultados**
3. **Identifique a causa raiz**
4. **Aplique a solução apropriada**
5. **Teste novamente**

## 🆘 Se Nada Funcionar

Como último recurso, podemos:

1. **Desabilitar RLS temporariamente:**
```sql
ALTER TABLE processos DISABLE ROW LEVEL SECURITY;
```

2. **Recriar a tabela processos** (⚠️ CUIDADO - pode perder dados)

3. **Verificar se há migrações conflitantes**

---

**💡 Dica:** Execute sempre os scripts de diagnóstico antes de tentar soluções mais drásticas.