import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface User {
  id: string;
  email: string;
  nome?: string;
  role: 'admin' | 'user';
  password_reset_required: boolean;
  is_temp_password: boolean;
  created_at: string;
  updated_at: string;
}

export interface Cliente {
  id: string;
  nome: string;
  descricao: string;
  imagem_url?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface Processo {
  id: string;
  nome: string;
  cliente_id: string;
  tipo_entrada: 'video' | 'audio' | 'texto';
  status: 'aguardando' | 'processando' | 'processado' | 'erro';
  conteudo_texto?: string;
  created_at: string;
  updated_at: string;
}

export interface Arquivo {
  id: string;
  processo_id: string;
  nome_original: string;
  tipo: string;
  tamanho?: number;
  storage_path: string;
  created_at: string;
}

export interface Analise {
  id: string;
  processo_id: string;
  transcricao?: string;
  fluxo_original_json?: Record<string, unknown>;
  fluxo_melhorado_json?: Record<string, unknown>;
  sugestoes?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiConfig {
  id: string;
  user_id: string;
  provider: 'openai' | 'grok' | 'gemini';
  api_key: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PromptConfig {
  id: string;
  user_id: string | null;
  prompt_type: 'fluxo_atual' | 'fluxo_melhorado' | 'sugestoes';
  prompt_content: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}