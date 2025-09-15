# 🚨 Guia Rápido - Reverter Políticas RLS

## ❌ Problema
Após aplicar as correções RLS, os clientes não aparecem mais na página de clientes.

## ✅ Solução Rápida

### Passo 1: Executar Script
1. Abra o **Supabase Dashboard**
2. Vá em **SQL Editor**
3. Abra o arquivo `reverter_politicas_rls.sql`
4. **Execute o script completo**

### Passo 2: Verificar Resultado
Após executar o script, você deve ver:
- ✅ "RLS desabilitado em todas as tabelas"
- ✅ Lista de tabelas com status "🔓 RLS Desabilitado"
- ✅ Contagem de clientes (se aparecer número, está funcionando)

### Passo 3: Testar Aplicação
1. Recarregue a página de clientes
2. Os clientes devem aparecer normalmente
3. Teste criar um novo processo

## 🔧 Duas Opções Disponíveis

### Opção 1: Desabilitar RLS (RECOMENDADO AGORA)
- ✅ **Mais rápido**
- ✅ **Resolve imediatamente**
- ⚠️ Remove segurança temporariamente
- 📝 **Já está ativo no script**

### Opção 2: Ajustar Políticas (Para depois)
- ✅ Mantém alguma segurança
- ✅ Permite leitura, controla escrita
- ⚠️ Mais complexo
- 📝 **Está comentado no script**

## 🎯 Próximos Passos

1. **Execute o script agora** (Opção 1)
2. **Teste se os clientes aparecem**
3. **Teste criação de processos**
4. **Depois decida** se quer reativar RLS com políticas ajustadas

## 🔄 Para Reativar RLS Depois

Se quiser reativar RLS mais tarde com políticas corretas:

```sql
-- 1. Reativar RLS
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE processos ENABLE ROW LEVEL SECURITY;
-- ... outras tabelas

-- 2. Usar Opção 2 do script (descomente as linhas)
```

## ⚡ Comando Rápido

Se quiser apenas desabilitar RLS rapidamente:

```sql
ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE processos DISABLE ROW LEVEL SECURITY;
ALTER TABLE transcricoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE analises DISABLE ROW LEVEL SECURITY;
ALTER TABLE arquivos DISABLE ROW LEVEL SECURITY;
```

---

**💡 Dica**: Execute o script completo primeiro. Se os clientes aparecerem, o problema está resolvido. Você pode configurar RLS adequadamente mais tarde quando tiver tempo.