/*
  # Adicionar funcionalidades de administração e controle de senha

  1. Alterações na tabela users
    - Adicionar campo 'role' para controle de acesso (admin/user)
    - Adicionar campo 'password_reset_required' para forçar troca de senha
    - Adicionar campo 'is_temp_password' para identificar senhas temporárias

  2. Funções auxiliares
    - Função para verificar se usuário é admin
    - Trigger para atualizar updated_at

  3. Políticas RLS
    - Admins podem visualizar e gerenciar todos os usuários
    - Usuários normais só podem ver seu próprio perfil
*/

-- Adicionar colunas à tabela users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role text CHECK (role IN ('admin', 'user')) DEFAULT 'user',
ADD COLUMN IF NOT EXISTS password_reset_required boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_temp_password boolean DEFAULT false;

-- Criar função para verificar se o usuário atual é admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Criar trigger para atualizar updated_at na tabela users
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Atualizar políticas RLS para users
DROP POLICY IF EXISTS "Users can read own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;

-- Política para leitura: usuários podem ver próprio perfil, admins podem ver todos
CREATE POLICY "Users can read profiles"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id OR is_admin()
  );

-- Política para atualização: usuários podem atualizar próprio perfil, admins podem atualizar todos
CREATE POLICY "Users can update profiles"
  ON users
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id OR is_admin()
  );

-- Política para inserção: apenas admins podem criar novos usuários
CREATE POLICY "Only admins can create users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Política para exclusão: apenas admins podem deletar usuários
CREATE POLICY "Only admins can delete users"
  ON users
  FOR DELETE
  TO authenticated
  USING (is_admin() AND id != auth.uid()); -- Admin não pode deletar a si mesmo

-- Criar pelo menos um usuário admin inicial (opcional - remova se não quiser)
-- Você pode executar isso manualmente após fazer o primeiro signup
-- UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';

-- Criar tabela para auditoria de ações administrativas (opcional)
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL, -- 'create_user', 'reset_password', 'change_role', etc.
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Política para audit log: apenas admins podem ver e inserir
CREATE POLICY "Only admins can access audit log"
  ON admin_audit_log
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
