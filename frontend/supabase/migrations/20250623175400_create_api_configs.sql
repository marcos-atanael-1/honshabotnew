-- Create api_configs table
create table public.api_configs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  provider text not null check (provider in ('openai', 'grok', 'gemini')),
  api_key text not null,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Ensure one config per provider per user
  unique(user_id, provider)
);

-- Set up Row Level Security (RLS)
alter table public.api_configs enable row level security;

-- Create policies for api_configs
create policy "Users can view own api configs" on public.api_configs
  for select using (auth.uid() = user_id);

create policy "Users can insert own api configs" on public.api_configs
  for insert with check (auth.uid() = user_id);

create policy "Users can update own api configs" on public.api_configs
  for update using (auth.uid() = user_id);

create policy "Users can delete own api configs" on public.api_configs
  for delete using (auth.uid() = user_id);

-- Create trigger for api_configs updated_at
create trigger handle_api_configs_updated_at
  before update on public.api_configs
  for each row
  execute function public.handle_updated_at(); 