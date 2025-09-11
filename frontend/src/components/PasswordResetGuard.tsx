import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { PasswordResetModal } from './PasswordResetModal';

interface PasswordResetGuardProps {
  children: React.ReactNode;
}

export function PasswordResetGuard({ children }: PasswordResetGuardProps) {
  const { user, loading } = useAuth();
  const [showPasswordReset, setShowPasswordReset] = useState(false);

  useEffect(() => {
    // Verificar se o usuário logado precisa trocar a senha
    if (!loading && user && user.password_reset_required) {
      setShowPasswordReset(true);
    } else {
      setShowPasswordReset(false);
    }
  }, [user, loading]);

  // Se o usuário precisa trocar a senha, bloquear acesso ao app
  if (!loading && user && user.password_reset_required) {
    return (
      <>
        {/* Conteúdo bloqueado com overlay */}
        <div className="relative">
          <div className="blur-sm pointer-events-none">
            {children}
          </div>
          
          {/* Overlay para bloquear interação */}
          <div className="absolute inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center">
            <div className="text-center text-white p-8">
              <h2 className="text-2xl font-bold mb-4">Ação Necessária</h2>
              <p className="text-lg">
                Você precisa alterar sua senha antes de continuar usando o sistema.
              </p>
            </div>
          </div>
        </div>

        {/* Modal obrigatório de troca de senha */}
        <PasswordResetModal 
          isOpen={showPasswordReset} 
          isRequired={true}
        />
      </>
    );
  }

  // Se não precisa trocar senha, renderizar normalmente
  return <>{children}</>;
}
