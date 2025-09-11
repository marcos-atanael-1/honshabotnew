import React, { createContext, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import type { User } from '../lib/supabase';

interface CustomAuthContextType {
  user: User | null;
  userProfile: User | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, nome: string) => Promise<void>;
  signOut: () => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  createUser: (email: string, password: string, nome: string, role?: 'admin' | 'user') => Promise<void>;
  resetUserPassword: (userId: string, newPassword: string) => Promise<void>;
  updateUserProfile: (userId: string, updates: Partial<User>) => Promise<void>;
}

export const CustomAuthContext = createContext<CustomAuthContextType | undefined>(undefined);

export function CustomAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const sessionToken = localStorage.getItem('session_token');
      if (!sessionToken) {
        setLoading(false);
        return;
      }

      // Verificar se sessão é válida
      const { data, error } = await supabase
        .from('user_sessions')
        .select(`
          user_id,
          expires_at,
          users:user_id (*)
        `)
        .eq('session_token', sessionToken)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data || !data.users) {
        localStorage.removeItem('session_token');
        setLoading(false);
        return;
      }

      // Atualizar last_used da sessão
      await supabase
        .from('user_sessions')
        .update({ last_used: new Date().toISOString() })
        .eq('session_token', sessionToken);

      setUser(data.users as User);
    } catch (error) {
      console.error('Error checking session:', error);
      localStorage.removeItem('session_token');
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.rpc('custom_login', {
        user_email: email,
        user_password: password
      });

      if (error) {
        throw error;
      }

      const result = data as { success: boolean; user?: User; session_token?: string; error?: string };

      if (!result.success) {
        throw new Error(result.error || 'Erro ao fazer login');
      }

      if (result.user && result.session_token) {
        // Salvar sessão
        localStorage.setItem('session_token', result.session_token);
        
        // Criar registro na tabela de sessões
        await supabase
          .from('user_sessions')
          .insert({
            user_id: result.user.id,
            session_token: result.session_token,
            user_agent: navigator.userAgent,
          });

        setUser(result.user);
        toast.success('Login realizado com sucesso!');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao fazer login';
      toast.error(message);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, nome: string) => {
    try {
      const { data, error } = await supabase.rpc('create_user', {
        user_email: email,
        user_password: password,
        user_nome: nome,
        user_role: 'user'
      });

      if (error) {
        throw error;
      }

      const result = data as { success: boolean; user_id?: string; error?: string };

      if (!result.success) {
        throw new Error(result.error || 'Erro ao criar conta');
      }

      toast.success('Conta criada com sucesso! Faça login para continuar.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao criar conta';
      toast.error(message);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const sessionToken = localStorage.getItem('session_token');
      if (sessionToken) {
        // Remover sessão do banco
        await supabase
          .from('user_sessions')
          .delete()
          .eq('session_token', sessionToken);
        
        localStorage.removeItem('session_token');
      }
      
      setUser(null);
      toast.success('Logout realizado com sucesso!');
    } catch (error: unknown) {
      console.error('Error during logout:', error);
      localStorage.removeItem('session_token');
      setUser(null);
    }
  };

  const changePassword = async (oldPassword: string, newPassword: string) => {
    try {
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error } = await supabase.rpc('change_password', {
        user_id: user.id,
        old_password: oldPassword,
        new_password: newPassword
      });

      if (error) {
        throw error;
      }

      const result = data as { success: boolean; message?: string; error?: string };

      if (!result.success) {
        throw new Error(result.error || 'Erro ao alterar senha');
      }

      // Atualizar usuário local
      setUser({
        ...user,
        password_reset_required: false,
        is_temp_password: false,
      });

      toast.success(result.message || 'Senha alterada com sucesso!');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao alterar senha';
      toast.error(message);
      throw error;
    }
  };

  const createUser = async (email: string, password: string, nome: string, role: 'admin' | 'user' = 'user') => {
    try {
      if (!isAdmin) {
        throw new Error('Apenas administradores podem criar usuários');
      }

      const { data, error } = await supabase.rpc('create_user', {
        user_email: email,
        user_password: password,
        user_nome: nome,
        user_role: role
      });

      if (error) {
        throw error;
      }

      const result = data as { success: boolean; user_id?: string; error?: string };

      if (!result.success) {
        throw new Error(result.error || 'Erro ao criar usuário');
      }

      // Marcar como senha temporária se criado por admin
      if (result.user_id) {
        await supabase
          .from('users')
          .update({
            password_reset_required: true,
            is_temp_password: true,
          })
          .eq('id', result.user_id);

        // Log da ação administrativa
        await supabase
          .from('admin_audit_log')
          .insert({
            admin_user_id: user?.id,
            target_user_id: result.user_id,
            action: 'create_user',
            details: { email, nome, role }
          });
      }

      toast.success(`Usuário ${nome} criado com sucesso!`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao criar usuário';
      toast.error(message);
      throw error;
    }
  };

  const resetUserPassword = async (userId: string, newPassword: string) => {
    try {
      if (!isAdmin) {
        throw new Error('Apenas administradores podem resetar senhas');
      }

      // Atualizar senha diretamente
      const newHash = await supabase.rpc('hash_password', { password: newPassword });
      
      const { error } = await supabase
        .from('users')
        .update({
          password_hash: newHash.data,
          password_reset_required: true,
          is_temp_password: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        throw error;
      }

      // Log da ação administrativa
      await supabase
        .from('admin_audit_log')
        .insert({
          admin_user_id: user?.id,
          target_user_id: userId,
          action: 'reset_password',
          details: { timestamp: new Date().toISOString() }
        });

      toast.success('Senha resetada com sucesso!');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao resetar senha';
      toast.error(message);
      throw error;
    }
  };

  const updateUserProfile = async (userId: string, updates: Partial<User>) => {
    try {
      // Verificar se pode atualizar (próprio usuário ou admin)
      if (userId !== user?.id && !isAdmin) {
        throw new Error('Você não tem permissão para atualizar este perfil');
      }

      const { error } = await supabase
        .from('users')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        throw error;
      }

      // Se está atualizando próprio perfil, recarregar dados
      if (userId === user?.id) {
        setUser({ ...user, ...updates });
      }

      toast.success('Perfil atualizado com sucesso!');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao atualizar perfil';
      toast.error(message);
      throw error;
    }
  };

  const value = {
    user,
    userProfile: user, // Same as user for compatibility
    loading,
    isAdmin,
    signIn,
    signUp,
    signOut,
    changePassword,
    createUser,
    resetUserPassword,
    updateUserProfile,
  };

  return <CustomAuthContext.Provider value={value}>{children}</CustomAuthContext.Provider>;
}
