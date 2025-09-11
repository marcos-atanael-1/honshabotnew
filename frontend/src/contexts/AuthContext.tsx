import React, { createContext, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import type { User } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, nome: string) => Promise<void>;
  signOut: () => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  createUser: (email: string, password: string, nome: string, role?: 'admin' | 'user') => Promise<void>;
  resetUserPassword: (userId: string, email: string) => Promise<void>;
  updateUserProfile: (userId: string, updates: Partial<User>) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      console.log('🔍 Verificando sessão...');
      
      // Verificar se há usuário logado no localStorage
      const userData = localStorage.getItem('user_data');
      if (!userData) {
        console.log('❌ Nenhum usuário no localStorage');
        setLoading(false);
        return;
      }

      const parsedUser = JSON.parse(userData);
      console.log('👤 Usuário encontrado no localStorage:', parsedUser.email);

      // Validar se usuário ainda existe e está ativo
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', parsedUser.id)
        .single();

      if (error || !data) {
        console.log('❌ Usuário não encontrado no banco, removendo localStorage');
        localStorage.removeItem('user_data');
        setLoading(false);
        return;
      }

      console.log('✅ Usuário validado no banco');
      setUser(data);
    } catch (error) {
      console.error('❌ Erro verificando sessão:', error);
      localStorage.removeItem('user_data');
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('🔐 Tentando login:', email);
      
      const { data, error } = await supabase.rpc('login_custom', {
        p_email: email,
        p_password: password
      });

      console.log('📊 Resultado do login:', { data, error });

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Credenciais inválidas');
      }

      console.log('✅ Login bem-sucedido');
      
      // Salvar usuário no localStorage e state
      localStorage.setItem('user_data', JSON.stringify(data.user));
      setUser(data.user);
      
      toast.success('Login realizado com sucesso!');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao fazer login';
      console.error('❌ Erro no login:', message);
      toast.error(message);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, nome: string) => {
    try {
      console.log('📝 Criando conta:', email);
      
      const { data, error } = await supabase.rpc('create_user_custom', {
        p_email: email,
        p_password: password,
        p_nome: nome,
        p_role: 'user'
      });

      console.log('📊 Resultado do signUp:', { data, error });

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro ao criar conta');
      }

      console.log('✅ Conta criada com sucesso');
      toast.success('Conta criada com sucesso! Faça login para continuar.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao criar conta';
      console.error('❌ Erro no signUp:', message);
      toast.error(message);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      console.log('🚪 Fazendo logout...');
      localStorage.removeItem('user_data');
      setUser(null);
      toast.success('Logout realizado com sucesso!');
    } catch (error: unknown) {
      console.error('❌ Erro no logout:', error);
      localStorage.removeItem('user_data');
      setUser(null);
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      console.log('🔑 Atualizando senha...');

      const { data, error } = await supabase.rpc('update_password_custom', {
        p_user_id: user.id,
        p_new_password: newPassword
      });

      console.log('📊 Resultado da atualização de senha:', { data, error });

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro ao alterar senha');
      }

      // Atualizar usuário local
      const updatedUser = {
        ...user,
        password_reset_required: false,
        is_temp_password: false,
      };
      
      setUser(updatedUser);
      localStorage.setItem('user_data', JSON.stringify(updatedUser));

      console.log('✅ Senha atualizada com sucesso');
      toast.success('Senha alterada com sucesso!');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao alterar senha';
      console.error('❌ Erro atualizando senha:', message);
      toast.error(message);
      throw error;
    }
  };

  const createUser = async (email: string, password: string, nome: string, role: 'admin' | 'user' = 'user') => {
    try {
      console.log('👥 Admin criando usuário:', { email, nome, role });
      
      if (!isAdmin) {
        throw new Error('Apenas administradores podem criar usuários');
      }

      const { data, error } = await supabase.rpc('create_user_custom', {
        p_email: email,
        p_password: password,
        p_nome: nome,
        p_role: role
      });

      console.log('📊 Resultado da criação de usuário:', { data, error });

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro ao criar usuário');
      }

      // Log da ação administrativa
      if (data.user_id) {
        await supabase
          .from('admin_audit_log')
          .insert({
            admin_user_id: user?.id,
            target_user_id: data.user_id,
            action: 'create_user',
            details: { email, nome, role }
          });
      }

      console.log('✅ Usuário criado com sucesso');
      toast.success(`Usuário ${nome} criado com sucesso!`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao criar usuário';
      console.error('❌ Erro criando usuário:', message);
      toast.error(message);
      throw error;
    }
  };

  const resetUserPassword = async (userId: string, email: string) => {
    try {
      console.log('🔑 Admin resetando senha do usuário:', email);
      
      if (!isAdmin) {
        throw new Error('Apenas administradores podem resetar senhas');
      }

      // Gerar nova senha temporária
      const tempPassword = 'TempPassword123!';
      
      // Atualizar senha usando a função SQL
      const { data, error } = await supabase.rpc('update_password_custom', {
        p_user_id: userId,
        p_new_password: tempPassword
      });

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro ao resetar senha');
      }

      // Marcar como senha temporária que precisa ser trocada
      const { error: updateError } = await supabase
        .from('users')
        .update({
          password_reset_required: true,
          is_temp_password: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Erro atualizando flags:', updateError);
      }

      // Log da ação administrativa
      await supabase
        .from('admin_audit_log')
        .insert({
          admin_user_id: user?.id,
          target_user_id: userId,
          action: 'reset_password',
          details: { email, timestamp: new Date().toISOString() }
        });

      console.log('✅ Senha resetada com sucesso');
      toast.success(`Senha resetada! Nova senha temporária: ${tempPassword}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao resetar senha';
      console.error('❌ Erro resetando senha:', message);
      toast.error(message);
      throw error;
    }
  };

  const updateUserProfile = async (userId: string, updates: Partial<User>) => {
    try {
      console.log('👤 Atualizando perfil:', userId, updates);
      
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
        const updatedUser = { ...user, ...updates };
        setUser(updatedUser);
        localStorage.setItem('user_data', JSON.stringify(updatedUser));
      }

      console.log('✅ Perfil atualizado com sucesso');
      toast.success('Perfil atualizado com sucesso!');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao atualizar perfil';
      console.error('❌ Erro atualizando perfil:', message);
      toast.error(message);
      throw error;
    }
  };

  const value = {
    user,
    loading,
    isAdmin,
    signIn,
    signUp,
    signOut,
    updatePassword,
    createUser,
    resetUserPassword,
    updateUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}