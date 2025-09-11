/*
  # Remove user_id column from all tables

  1. Changes
    - Remove user_id column from clientes table
    - Remove user_id foreign key constraint
    - Update RLS policies to allow all authenticated users
    - Remove user_id index

  2. Security
    - Update RLS policies to be more permissive since we have single local user
    - Keep RLS enabled for security but allow broader access
*/

-- Remove foreign key constraint first
ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_user_id_fkey;

-- Drop the index
DROP INDEX IF EXISTS idx_clientes_user_id;

-- Remove the user_id column
ALTER TABLE clientes DROP COLUMN IF EXISTS user_id;

-- Update RLS policies for clientes to allow all authenticated users
DROP POLICY IF EXISTS "Users can delete own clientes" ON clientes;
DROP POLICY IF EXISTS "Users can insert own clientes" ON clientes;
DROP POLICY IF EXISTS "Users can read own clientes" ON clientes;
DROP POLICY IF EXISTS "Users can update own clientes" ON clientes;

-- Create new permissive policies
CREATE POLICY "Allow all operations on clientes"
  ON clientes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Update RLS policies for processos to be more permissive
DROP POLICY IF EXISTS "Users can delete own processos" ON processos;
DROP POLICY IF EXISTS "Users can insert own processos" ON processos;
DROP POLICY IF EXISTS "Users can read own processos" ON processos;
DROP POLICY IF EXISTS "Users can update own processos" ON processos;

-- Create new permissive policies for processos
CREATE POLICY "Allow all operations on processos"
  ON processos
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Update RLS policies for arquivos to be more permissive
DROP POLICY IF EXISTS "Users can delete own arquivos" ON arquivos;
DROP POLICY IF EXISTS "Users can insert own arquivos" ON arquivos;
DROP POLICY IF EXISTS "Users can read own arquivos" ON arquivos;
DROP POLICY IF EXISTS "Users can update own arquivos" ON arquivos;

-- Create new permissive policies for arquivos
CREATE POLICY "Allow all operations on arquivos"
  ON arquivos
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Update RLS policies for analises to be more permissive
DROP POLICY IF EXISTS "Users can delete own analises" ON analises;
DROP POLICY IF EXISTS "Users can insert own analises" ON analises;
DROP POLICY IF EXISTS "Users can read own analises" ON analises;
DROP POLICY IF EXISTS "Users can update own analises" ON analises;

-- Create new permissive policies for analises
CREATE POLICY "Allow all operations on analises"
  ON analises
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);