import React, { useState } from 'react';
import { Copy, Eye, EyeOff, CheckCircle, User } from 'lucide-react';
import toast from 'react-hot-toast';

interface UserCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userName: string;
  tempPassword: string;
}

export function UserCredentialsModal({ 
  isOpen, 
  onClose, 
  userEmail, 
  userName, 
  tempPassword 
}: UserCredentialsModalProps) {
  const [showPassword, setShowPassword] = useState(false);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado para a área de transferência!`);
  };

  const copyCredentials = () => {
    const credentials = `Email: ${userEmail}\nSenha: ${tempPassword}`;
    navigator.clipboard.writeText(credentials);
    toast.success('Credenciais copiadas para a área de transferência!');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Usuário Criado com Sucesso!
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Credenciais de acesso geradas
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Dados do Usuário
                </span>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Nome
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-sm text-gray-900 dark:text-white font-medium">
                      {userName}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Email de Login
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-sm text-gray-900 dark:text-white font-mono">
                      {userEmail}
                    </span>
                    <button
                      onClick={() => copyToClipboard(userEmail, 'Email')}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      title="Copiar email"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Senha Temporária
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-sm text-gray-900 dark:text-white font-mono">
                      {showPassword ? tempPassword : '••••••••••••••'}
                    </span>
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => copyToClipboard(tempPassword, 'Senha')}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      title="Copiar senha"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md p-4">
              <p className="text-sm text-orange-800 dark:text-orange-200">
                <strong>Importante:</strong> O usuário será obrigado a trocar a senha no primeiro acesso. 
                Forneça essas credenciais ao usuário de forma segura.
              </p>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={copyCredentials}
              className="flex-1 px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800 flex items-center justify-center gap-2"
            >
              <Copy className="h-4 w-4" />
              Copiar Credenciais
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500"
            >
              Entendi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
