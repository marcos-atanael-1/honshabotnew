import React, { createContext, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

// Types
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

interface AuthContextType {
  user: User | null;
  userProfile: User | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, nome: string) => Promise<void>;
  signOut: () => Promise<void>;
  createDemoUser: () => Promise<void>;
  createUser: (email: string, password: string, nome: string, role?: 'admin' | 'user') => Promise<void>;
  resetUserPassword: (userId: string, userEmail: string) => Promise<void>;
  updateUserProfile: (userId: string, updates: Partial<User>) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    let mounted = true;

    // Get initial session with timeout
    const getInitialSession = async () => {
      try {
        // Timeout mais longo e tratamento melhor
        const { data: { session } } = await supabase.auth.getSession();

        if (mounted) {
          if (session?.user) {
            // Carregar perfil sem timeout rígido
            try {
              await loadUserProfile(session.user.id);
            } catch (profileError) {
              console.error('Profile loading failed:', profileError);
              // Se o carregamento do perfil falhar, criar um usuário básico
              const fallbackUser = {
                id: session.user.id,
                email: session.user.email || '',
                nome: session.user.user_metadata?.nome || session.user.email?.split('@')[0] || '',
                role: 'user' as const,
                password_reset_required: false,
                is_temp_password: false,
                created_at: session.user.created_at,
                updated_at: session.user.updated_at || session.user.created_at,
              };
              setUser(fallbackUser);
            }
          }
        }
      } catch (error) {
        console.error('Error getting initial session:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      if (!mounted) return;
      
      try {
      if (session?.user) {
          await loadUserProfile(session.user.id);
      } else {
        setUser(null);
      }
      } catch (error) {
        console.error('Error in auth state change:', error);
      } finally {
      setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Função para carregar perfil completo do usuário da tabela users
  const loadUserProfile = async (userId: string) => {
    try {
      // Primeiro, tentar buscar por ID
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (data) {
        setUser(data);
        return;
      }

      // Se não encontrou por ID, buscar dados do auth para criar perfil
      const { data: authUser } = await supabase.auth.getUser();
      if (!authUser.user) {
        throw new Error('No authenticated user found');
      }

      // Verificar se existe perfil com mesmo email
      const { data: existingByEmail } = await supabase
        .from('users')
        .select('*')
        .eq('email', authUser.user.email)
        .maybeSingle();

      let userProfile;

      if (existingByEmail) {
        // Atualizar ID do perfil existente para corresponder ao auth
        if (existingByEmail.id !== authUser.user.id) {
          await supabase
            .from('users')
            .delete()
            .eq('email', authUser.user.email);
        }
        
        userProfile = {
          ...existingByEmail,
          id: authUser.user.id,
        };
      } else {
        // Criar novo perfil
        userProfile = {
          id: authUser.user.id,
          email: authUser.user.email || '',
          nome: authUser.user.user_metadata?.nome || authUser.user.email?.split('@')[0] || '',
          role: 'user' as const,
          password_reset_required: false,
          is_temp_password: false,
          created_at: authUser.user.created_at,
          updated_at: authUser.user.updated_at || authUser.user.created_at,
        };
      }

      // Inserir/atualizar na tabela
      const { error: upsertError } = await supabase
        .from('users')
        .upsert(userProfile);

      if (upsertError) {
        console.error('Error upserting user profile:', upsertError);
      }

      setUser(userProfile);

    } catch (error) {
      console.error('Error in loadUserProfile:', error);
      
      // Fallback: criar usuário básico baseado no auth
      try {
        const { data: authUser } = await supabase.auth.getUser();
        if (authUser.user) {
          const fallbackUser = {
            id: authUser.user.id,
            email: authUser.user.email || '',
            nome: authUser.user.user_metadata?.nome || authUser.user.email?.split('@')[0] || '',
            role: 'user' as const,
            password_reset_required: false,
            is_temp_password: false,
            created_at: authUser.user.created_at,
            updated_at: authUser.user.updated_at || authUser.user.created_at,
          };
          setUser(fallbackUser);
        }
      } catch (fallbackError) {
        console.error('Fallback failed:', fallbackError);
        // Forçar logout se tudo falhar
        await supabase.auth.signOut();
      }
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      toast.success('Login realizado com sucesso!');
    } catch (error: unknown) {
      const message = error instanceof Error && error.message === 'Invalid login credentials' 
        ? 'Email ou senha incorretos' 
        : (error instanceof Error ? error.message : 'Erro ao fazer login');
      toast.error(message);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, nome: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nome: nome,
          }
        }
      });

      if (error) {
        throw error;
      }

      toast.success('Conta criada com sucesso! Verifique seu email para confirmar.');
    } catch (error: unknown) {
      const message = error instanceof Error && error.message === 'User already registered' 
        ? 'Este email já está cadastrado' 
        : (error instanceof Error ? error.message : 'Erro ao criar conta');
      toast.error(message);
      throw error;
    }
  };

  const createDemoUser = async () => {
    try {
      const demoEmail = 'pmlean@demo.com';
      const demoPassword = '123456';
      const demoName = 'pmlean';

      // Try to sign in first (in case demo user already exists)
      try {
        await signIn(demoEmail, demoPassword);
        return;
      } catch {
        // If sign in fails, try to create the demo user
      }

      // Create demo user
      const { error } = await supabase.auth.signUp({
        email: demoEmail,
        password: demoPassword,
        options: {
          data: {
            nome: demoName,
          }
        }
      });

      if (error) {
        throw error;
      }

      // Try to sign in immediately after signup
      setTimeout(async () => {
        try {
          await signIn(demoEmail, demoPassword);
        } catch (signInError) {
          console.error('Auto sign-in failed:', signInError);
        }
      }, 1000);

      toast.success('Usuário de demonstração criado com sucesso!');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar usuário de demonstração');
      throw error;
    }
  };

  // Função para criar usuário (apenas admins)
  const createUser = async (email: string, _password: string, nome: string, role: 'admin' | 'user' = 'user') => {
    try {
      console.log('🔄 Iniciando criação de usuário:', { email, nome, role });
      
      if (!isAdmin) {
        throw new Error('Apenas administradores podem criar usuários');
      }

      // Salvar a sessão atual do admin antes de criar o usuário
      const { data: currentSession } = await supabase.auth.getSession();
      const currentAdminUser = user;
      console.log('💾 Sessão do admin salva:', currentAdminUser?.email);

      // Criar usuário usando signUp (isso vai logar temporariamente o novo usuário)
      console.log('📝 Criando usuário no Supabase Auth...');
      const { data, error } = await supabase.auth.signUp({
        email,
        password: 'TempPassword123!', // Senha temporária que será obrigatório trocar
        options: {
          data: {
            nome: nome,
          }
        }
      });

      console.log('📊 Resultado do signUp:', { data, error });

      if (error) {
        console.error('❌ Erro no signUp:', error);
        throw error;
      }

      if (data.user) {
        console.log('👤 Usuário criado no Auth, criando perfil na tabela users...');
        
        // Criar/atualizar perfil na tabela users
        const { error: profileError } = await supabase
          .from('users')
          .upsert({
            id: data.user.id,
            email,
            nome,
            role,
            password_reset_required: true, // Obrigar mudança de senha no primeiro login
            is_temp_password: true,
          });

        console.log('📊 Resultado do upsert perfil:', { profileError });

        if (profileError) {
          console.error('❌ Erro criando perfil do usuário:', profileError);
          throw profileError;
        }

        // Log da ação administrativa
        console.log('📝 Criando log administrativo...');
        await supabase
          .from('admin_audit_log')
          .insert({
            admin_user_id: currentAdminUser?.id,
            target_user_id: data.user.id,
            action: 'create_user',
            details: { email, nome, role }
          });

        // IMPORTANTE: Restaurar a sessão do admin
        console.log('🔄 Restaurando sessão do admin...');
        if (currentSession?.session) {
          // Fazer signOut do usuário recém-criado
          console.log('🚪 Fazendo signOut do usuário recém-criado...');
          await supabase.auth.signOut();
          
          // Aguardar um pouco para garantir que o signOut foi processado
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Restaurar sessão do admin
          console.log('🔐 Restaurando sessão do admin...');
          const { error: sessionError } = await supabase.auth.setSession(currentSession.session);
          
          if (sessionError) {
            console.error('❌ Erro restaurando sessão do admin:', sessionError);
            // Se falhar em restaurar, pelo menos mantenha os dados do admin no estado
            setUser(currentAdminUser);
          } else {
            console.log('✅ Sessão do admin restaurada, recarregando perfil...');
            // Recarregar perfil do admin
            await loadUserProfile(currentAdminUser?.id || '');
          }
        }

        console.log('✅ Usuário criado com sucesso!');
        toast.success(`Usuário ${nome} criado com sucesso!`);
      } else {
        console.error('❌ Nenhum usuário retornado do signUp');
        throw new Error('Nenhum usuário foi criado');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao criar usuário';
      toast.error(message);
      throw error;
    }
  };

  // Função para forçar usuário a trocar senha (apenas admins)
  const resetUserPassword = async (userId: string, userEmail: string) => {
    try {
      if (!isAdmin) {
        throw new Error('Apenas administradores podem resetar senhas');
      }

      // Marcar que o usuário precisa trocar senha no próximo login
      const { error: updateError } = await supabase
        .from('users')
        .update({
          password_reset_required: true,
          is_temp_password: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      // Enviar email de reset de senha (opcional)
      try {
        await supabase.auth.resetPasswordForEmail(userEmail, {
          redirectTo: `${window.location.origin}/`
        });
      } catch (emailError) {
        console.log('Email reset opcional falhou:', emailError);
        // Não falhar se o email não funcionar
      }

      // Log da ação administrativa
      await supabase
        .from('admin_audit_log')
        .insert({
          admin_user_id: user?.id,
          target_user_id: userId,
          action: 'force_password_reset',
          details: { 
            timestamp: new Date().toISOString(),
            user_email: userEmail
          }
        });

      toast.success('Usuário será obrigado a trocar senha no próximo acesso!');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao forçar reset de senha';
      toast.error(message);
      throw error;
    }
  };

  // Função para atualizar perfil de usuário
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
        await loadUserProfile(userId);
      }

      toast.success('Perfil atualizado com sucesso!');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao atualizar perfil';
      toast.error(message);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      setUser(null);
      toast.success('Logout realizado com sucesso!');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erro ao fazer logout');
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
    createDemoUser,
    createUser,
    resetUserPassword,
    updateUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}