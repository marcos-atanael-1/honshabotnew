# Configuração do Módulo de Administração

## Como configurar o primeiro usuário administrador

### 1. Execute a migration

Certifique-se de que a migration `20250124120000_add_user_roles_and_password_reset.sql` foi aplicada ao banco de dados.

### 2. Faça signup normalmente

1. Acesse a aplicação
2. Crie sua conta normalmente pelo formulário de registro

### 3. Promova o usuário a administrador

Execute o seguinte SQL no painel do Supabase ou via psql:

```sql
-- Substitua 'seu-email@exemplo.com' pelo seu email
UPDATE users 
SET role = 'admin' 
WHERE email = 'seu-email@exemplo.com';
```

### 4. Teste a funcionalidade

1. Faça logout e login novamente
2. Você verá a opção "Administração" no menu
3. Na página de administração você pode:
   - Criar novos usuários
   - Resetar senhas
   - Promover/rebaixar usuários entre admin e user

## Funcionalidades Implementadas

### Para Administradores:
- ✅ Criar novos usuários com senha temporária
- ✅ Forçar troca de senha de usuários existentes  
- ✅ Promover/rebaixar funções de usuários
- ✅ Visualizar status de usuários (senha temporária, primeiro acesso)
- ✅ Log de auditoria de ações administrativas

### Para Usuários:
- ✅ Troca obrigatória de senha no primeiro acesso
- ✅ Modal de troca de senha quando marcado como obrigatório
- ✅ Bloqueio do sistema até trocar a senha temporária

### Segurança:
- ✅ Row Level Security (RLS) ativo em todas as tabelas
- ✅ Verificação de permissões a nível de aplicação e banco
- ✅ Auditoria de ações administrativas
- ✅ Senhas temporárias obrigatórias para novos usuários

## Fluxo de Criação de Usuário

1. **Admin cria usuário completo:**
   - Define nome, email e função
   - Sistema cria usuário no Supabase Auth com senha temporária
   - Admin recebe credenciais completas em modal dedicado
   - Senha padrão: `TempPassword123!`

2. **Admin fornece credenciais:**
   - Modal exibe email e senha temporária
   - Função de copiar credenciais para área de transferência
   - Admin informa credenciais ao usuário de forma segura

3. **Primeiro login do usuário:**
   - Usuário faz login com email e senha temporária
   - Sistema detecta `password_reset_required = true`
   - Bloqueia acesso ao app com overlay
   - Exibe modal obrigatório de troca de senha
   - Após trocar senha, flags são resetadas para `false`

4. **Forçar troca de senha pelo admin:**
   - Admin pode forçar qualquer usuário a trocar senha
   - Sistema marca `password_reset_required = true`
   - Usuário será obrigado a trocar senha no próximo login
   - Opcionalmente, um email de reset é enviado para o usuário

## Estrutura do Banco

### Tabela `users`:
- `role`: 'admin' | 'user'
- `password_reset_required`: boolean
- `is_temp_password`: boolean

### Tabela `admin_audit_log`:
- Log de todas as ações administrativas
- Rastreamento de criação de usuários, reset de senhas, etc.

## Componentes Criados

1. **UserManagement.tsx** - Interface principal de gerenciamento
2. **PasswordResetModal.tsx** - Modal para troca de senha
3. **PasswordResetGuard.tsx** - Componente que bloqueia acesso até trocar senha
4. **AdminPage.tsx** - Página da área administrativa
5. **hooks/useAuth.ts** - Hook separado para melhor organização

## Rotas Adicionadas

- `/admin` - Área administrativa (apenas para admins)

A navegação administrativa aparece automaticamente no menu para usuários com role 'admin'.

## Limitações Atuais

⚠️ **Solução Implementada**: Como o frontend não possui acesso às funções admin do Supabase (que requerem service key), foi implementada uma solução híbrida robusta:

- **Criação de usuários**: Usa `signUp` + restauração de sessão admin para criar usuários completos
- **Sessão protegida**: Admin mantém sua sessão mesmo após criar usuários
- **Credenciais imediatas**: Sistema fornece credenciais prontas para uso
- **Reset de senha**: Força a troca no próximo login + envia email de reset opcional

### Para funcionalidade completa de admin:
Se precisar de controle total sobre senhas e criação de usuários sem confirmação de email, será necessário:
1. Criar uma API backend com service key do Supabase
2. Implementar endpoints protegidos para operações admin
3. Atualizar o frontend para usar essa API
