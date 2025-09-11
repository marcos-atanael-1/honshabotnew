# Sistema de Autenticação Customizado - FlowMind

## Por que migrar do Supabase Auth?

### Problemas com Supabase Auth:
- ❌ Necessita sincronização entre `auth.users` e `public.users`
- ❌ Conflitos de ID entre tabelas
- ❌ Loading infinito em refreshs
- ❌ Complexidade desnecessária para auth simples
- ❌ Limitações nas funções admin no frontend

### Vantagens do Sistema Customizado:
- ✅ **Uma única tabela** `public.users` com hash de senhas
- ✅ **Controle total** sobre autenticação e autorização
- ✅ **Sessões customizadas** com tokens seguros
- ✅ **Sem sincronização** entre tabelas
- ✅ **Performance melhor** - menos queries
- ✅ **Funcionalidades admin** completas
- ✅ **Auditoria integrada** de todas as ações

## Arquitetura do Sistema

### 1. Tabela Users Atualizada
```sql
public.users:
- id (uuid, primary key)
- email (text, unique)
- nome (text)
- role ('admin' | 'user')
- password_hash (text) -- Hash bcrypt da senha
- email_verified (boolean)
- password_reset_required (boolean)
- is_temp_password (boolean)
- last_login (timestamptz)
- login_attempts (integer)
- locked_until (timestamptz)
- created_at, updated_at
```

### 2. Tabela de Sessões
```sql
user_sessions:
- id (uuid)
- user_id (uuid, FK)
- session_token (text, unique)
- expires_at (timestamptz)
- created_at, last_used
- user_agent, ip_address
```

### 3. Funções SQL Seguras
- `hash_password()` - Hash bcrypt
- `verify_password()` - Verificação de senha
- `custom_login()` - Login completo
- `create_user()` - Criação de usuário
- `change_password()` - Troca de senha

## Como Migrar

### Passo 1: Execute a Migration
```sql
-- Execute no console SQL do Supabase:
-- (Conteúdo do arquivo: supabase/migrations/20250124140000_custom_auth_system.sql)
```

### Passo 2: Substitua os Imports
```tsx
// ANTES (usando Supabase Auth):
import { useAuth } from '../hooks/useAuth';

// DEPOIS (usando sistema customizado):
import { useCustomAuth } from '../hooks/useCustomAuth';
```

### Passo 3: Atualize o App.tsx
```tsx
// Substitua AuthProvider por CustomAuthProvider
import { CustomAuthProvider } from './contexts/CustomAuthContext';
import { CustomPasswordResetGuard } from './components/CustomPasswordResetGuard';

// Wrape rotas com CustomPasswordResetGuard
```

### Passo 4: Migre Dados Existentes
```sql
-- Migrar usuários existentes do Supabase Auth:
UPDATE public.users 
SET password_hash = hash_password('TempPassword123!'),
    email_verified = true,
    password_reset_required = true,
    is_temp_password = true
WHERE password_hash IS NULL;
```

## API do Sistema Customizado

### Hook: useCustomAuth()
```tsx
const {
  user,           // Usuário atual
  loading,        // Estado de carregamento
  isAdmin,        // Se é administrador
  
  // Funções de autenticação
  signIn,         // (email, password) => Promise<void>
  signUp,         // (email, password, nome) => Promise<void>
  signOut,        // () => Promise<void>
  changePassword, // (oldPass, newPass) => Promise<void>
  
  // Funções administrativas
  createUser,     // (email, pass, nome, role?) => Promise<void>
  resetUserPassword,    // (userId, newPass) => Promise<void>
  updateUserProfile,    // (userId, updates) => Promise<void>
} = useCustomAuth();
```

### Componentes Customizados
- `CustomPasswordResetModal` - Modal de troca de senha
- `CustomPasswordResetGuard` - Proteção de primeira troca
- `CustomAuthProvider` - Provider de contexto

## Funcionalidades Implementadas

### 🔐 Autenticação Segura
- Hash bcrypt com salt aleatório
- Proteção contra força bruta (5 tentativas)
- Bloqueio temporário de conta (15 min)
- Sessões com expiração configurável (7 dias)
- Limpeza automática de sessões expiradas

### 👥 Gestão de Usuários
- Criação de usuários por admin
- Senhas temporárias obrigatórias
- Reset de senha por admin
- Controle de roles (admin/user)
- Auditoria completa de ações

### 🛡️ Segurança
- Validação de entrada em todas as funções
- SQL injection protection (prepared statements)
- Rate limiting de login
- Logs de auditoria administrativos
- Session management seguro

## Fluxo de Funcionamento

### 1. Login de Usuário
```
1. Usuário envia email/senha
2. Sistema busca usuário por email
3. Verifica se conta não está bloqueada
4. Valida senha com bcrypt
5. Gera token de sessão seguro
6. Salva sessão no banco
7. Retorna dados do usuário
```

### 2. Criação de Usuário (Admin)
```
1. Admin preenche formulário
2. Sistema valida se email já existe
3. Gera hash da senha temporária
4. Cria usuário com password_reset_required=true
5. Log de auditoria
6. Modal com credenciais
```

### 3. Primeira Troca de Senha
```
1. Sistema detecta password_reset_required=true
2. Bloqueia interface com overlay
3. Exibe modal obrigatório
4. Usuário define nova senha
5. Atualiza flags no banco
6. Libera acesso ao sistema
```

## Comparação de Performance

### Sistema Atual (Supabase Auth)
- 3-4 queries por login/refresh
- Sincronização auth.users ↔ public.users
- Timeout issues frequentes
- Complexidade de sessão

### Sistema Customizado
- 1-2 queries por login/refresh
- Tabela única `public.users`
- Sem timeouts desnecessários
- Controle total de sessão

## Migração Gradual

### Opção 1: Migração Completa
- Substitua todo o sistema de uma vez
- Mais eficiente, mas requer teste completo

### Opção 2: Migração Gradual
- Mantenha ambos sistemas temporariamente
- Migre componente por componente
- Teste cada parte antes de continuar

## Conclusão

O sistema customizado elimina:
- ✅ Problemas de loading infinito
- ✅ Conflitos de sincronização
- ✅ Complexidade desnecessária
- ✅ Limitações do Supabase Auth

E adiciona:
- ✅ Controle total sobre autenticação
- ✅ Performance superior
- ✅ Funcionalidades admin completas
- ✅ Código mais simples e mantível
