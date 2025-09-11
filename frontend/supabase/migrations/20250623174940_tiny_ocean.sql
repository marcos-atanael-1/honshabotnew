/*
  # Remove user_id column and update RLS policies

  1. Changes
    - Remove user_id column from clientes table
    - Update all RLS policies to be permissive for authenticated users
    - Remove foreign key constraints and indexes related to user_id

  2. Security
    - Simplify RLS policies since we now have a single local user
    - All authenticated users can perform all operations
*/

-- Drop all policies that depend on user_id column across all tables
-- Clientes policies
DROP POLICY IF EXISTS "Users can delete own clientes" ON clientes;
DROP POLICY IF EXISTS "Users can insert own clientes" ON clientes;
DROP POLICY IF EXISTS "Users can read own clientes" ON clientes;
DROP POLICY IF EXISTS "Users can update own clientes" ON clientes;

-- Processos policies
DROP POLICY IF EXISTS "Users can delete own processos" ON processos;
DROP POLICY IF EXISTS "Users can insert own processos" ON processos;
DROP POLICY IF EXISTS "Users can read own processos" ON processos;
DROP POLICY IF EXISTS "Users can update own processos" ON processos;

-- Arquivos policies
DROP POLICY IF EXISTS "Users can delete own arquivos" ON arquivos;
DROP POLICY IF EXISTS "Users can insert own arquivos" ON arquivos;
DROP POLICY IF EXISTS "Users can read own arquivos" ON arquivos;
DROP POLICY IF EXISTS "Users can update own arquivos" ON arquivos;

-- Analises policies
DROP POLICY IF EXISTS "Users can delete own analises" ON analises;
DROP POLICY IF EXISTS "Users can insert own analises" ON analises;
DROP POLICY IF EXISTS "Users can read own analises" ON analises;
DROP POLICY IF EXISTS "Users can update own analises" ON analises;

-- Now we can safely remove the foreign key constraint and index
ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_user_id_fkey;
DROP INDEX IF EXISTS idx_clientes_user_id;

-- Remove the user_id column
ALTER TABLE clientes DROP COLUMN IF EXISTS user_id;

-- Create new permissive policies for clientes
CREATE POLICY "Allow all operations on clientes"
  ON clientes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create new permissive policies for processos
CREATE POLICY "Allow all operations on processos"
  ON processos
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create new permissive policies for arquivos
CREATE POLICY "Allow all operations on arquivos"
  ON arquivos
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create new permissive policies for analises
CREATE POLICY "Allow all operations on analises"
  ON analises
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);