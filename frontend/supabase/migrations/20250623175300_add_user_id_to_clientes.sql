-- Add user_id column to clientes table
alter table public.clientes 
add column user_id uuid references auth.users(id) on delete cascade;

-- Update existing clientes to have a default user_id (optional, for existing data)
-- You can remove this if you want to start fresh
-- update public.clientes set user_id = (select id from auth.users limit 1);

-- Drop existing policies
drop policy if exists "Allow all operations on clientes" on public.clientes;
drop policy if exists "Permitir acesso público" on public.clientes;

-- Enable RLS
alter table public.clientes enable row level security;

-- Create new policies for authenticated users
create policy "Users can view own clientes" on public.clientes
  for select using (auth.uid() = user_id);

create policy "Users can insert own clientes" on public.clientes
  for insert with check (auth.uid() = user_id);

create policy "Users can update own clientes" on public.clientes
  for update using (auth.uid() = user_id);

create policy "Users can delete own clientes" on public.clientes
  for delete using (auth.uid() = user_id); 