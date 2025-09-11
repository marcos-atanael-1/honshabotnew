import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LogOut, User, Home, Settings, Shield } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { ConfigModal } from './ConfigModal';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, signOut, isAdmin } = useAuth();
  const location = useLocation();
  const [showConfigModal, setShowConfigModal] = useState(false);

  const isActive = (path: string) => {
    return location.pathname === path 
      ? 'bg-[#00467F] dark:bg-[#00467F] text-white' 
      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
                              <Link to="/" className="flex items-center space-x-2">
                  <div className="h-8 w-auto flex items-center">
                    <img 
                      src="/Honsha.png" 
                      alt="Logo" 
                      className="max-h-8 w-auto object-contain rounded-lg"
                    />
                  </div>
                  <span className="text-xl font-bold" style={{ color: '#5d87a1' }}>Honsha Bot</span>
                </Link>
              
              <nav className="hidden md:flex space-x-1">
                <Link
                  to="/"
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive('/')}`}
                >
                  <Home className="h-4 w-4 inline mr-2" />
                  Início
                </Link>
                
                {isAdmin && (
                  <Link
                    to="/admin"
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive('/admin')}`}
                  >
                    <Shield className="h-4 w-4 inline mr-2" />
                    Administração
                  </Link>
                )}
                
                {isAdmin && (
                  <button
                    onClick={() => setShowConfigModal(true)}
                    className="px-3 py-2 rounded-md text-sm font-medium transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <Settings className="h-4 w-4 inline mr-2" />
                    Configurações
                  </button>
                )}
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              {/* User Info Section */}
              <div className="flex items-center space-x-3 bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-600">
                {/* Avatar/Icon */}
                <div className={`p-2 rounded-full ${isAdmin ? 'bg-purple-100 dark:bg-purple-900' : 'bg-blue-100 dark:bg-blue-900'}`}>
                  {isAdmin ? (
                    <Shield className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  ) : (
                    <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                
                {/* User Details */}
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-32">
                    {user?.nome || 'Usuário'}
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-28">
                      {user?.email}
                    </span>
                    {isAdmin && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                        Admin
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <ThemeToggle />
              
              <button
                onClick={signOut}
                className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Sair</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-gray-900 dark:text-gray-100">
          {children}
        </div>
      </main>
      
      {/* Config Modal */}
      <ConfigModal 
        isOpen={showConfigModal} 
        onClose={() => setShowConfigModal(false)} 
      />
    </div>
  );
}