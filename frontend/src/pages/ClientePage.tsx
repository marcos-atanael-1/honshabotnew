import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase, Cliente, Processo } from '../lib/supabase';
import { ArrowLeft, Plus, FileText, Clock, CheckCircle, XCircle, AlertCircle, Search, X, Trash2, RefreshCw, Filter, AlertTriangle, Grid3X3, List, CalendarDays, Shield, User } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { NovoProcessoModal } from '../components/NovoProcessoModal';

export function ClientePage() {
  const { id } = useParams<{ id: string }>();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [filteredProcessos, setFilteredProcessos] = useState<Processo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [tipoFilter, setTipoFilter] = useState<string>('todos');
  const [dateFilter, setDateFilter] = useState<string>('todos');
  const [showNovoProcessoModal, setShowNovoProcessoModal] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list'); // Default para lista
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [processoToDelete, setProcessoToDelete] = useState<{ id: string; nome: string } | null>(null);

  useEffect(() => {
    if (id) {
      loadClienteData();
    }
  }, [id]);

  useEffect(() => {
    // Filter processos based on search term, status, type, and date
    let filtered = processos;

    // Apply search filter
    if (searchTerm.trim() !== '') {
      filtered = filtered.filter(processo =>
        processo.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        processo.tipo_entrada.toLowerCase().includes(searchTerm.toLowerCase()) ||
        processo.status.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'todos') {
      filtered = filtered.filter(processo => processo.status === statusFilter);
    }

    // Apply type filter
    if (tipoFilter !== 'todos') {
      filtered = filtered.filter(processo => processo.tipo_entrada === tipoFilter);
    }

    // Apply date filter
    if (dateFilter !== 'todos') {
      const now = new Date();
      filtered = filtered.filter(processo => {
        const processoDate = new Date(processo.created_at);
        const diffDays = Math.floor((now.getTime() - processoDate.getTime()) / (1000 * 60 * 60 * 24));
        
        switch (dateFilter) {
          case 'hoje':
            return diffDays === 0;
          case 'semana':
            return diffDays <= 7;
          case 'mes':
            return diffDays <= 30;
          case 'antigo':
            return diffDays > 30;
          default:
            return true;
        }
      });
    }

    setFilteredProcessos(filtered);
  }, [processos, searchTerm, statusFilter, tipoFilter, dateFilter]);

  const loadClienteData = async () => {
    try {
      // Load cliente
      const { data: clienteData, error: clienteError } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', id)
        .single();

      if (clienteError) {
        throw clienteError;
      }

      setCliente(clienteData);

      // Load ALL processos for this cliente (not filtered by user)
      const { data: processosData, error: processosError } = await supabase
        .from('processos')
        .select('*')
        .eq('cliente_id', id)
        .order('created_at', { ascending: false });

      if (processosError) {
        throw processosError;
      }

      setProcessos(processosData || []);
    } catch (error) {
      toast.error('Erro ao carregar dados do cliente');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'aguardando':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'processando':
        return <AlertCircle className="h-5 w-5 text-blue-500" />;
      case 'processado':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'erro':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'aguardando':
        return 'Aguardando processamento';
      case 'processando':
        return 'Processando';
      case 'processado':
        return 'Processado com sucesso';
      case 'erro':
        return 'Erro no processamento';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aguardando':
        return 'bg-yellow-100 text-yellow-800';
      case 'processando':
        return 'bg-blue-100 text-blue-800';
      case 'processado':
        return 'bg-green-100 text-green-800';
      case 'erro':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadClienteData();
      toast.success('Lista atualizada!');
    } catch {
      toast.error('Erro ao atualizar lista');
    } finally {
      setRefreshing(false);
    }
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setStatusFilter('todos');
    setTipoFilter('todos');
    setDateFilter('todos');
  };

  const handleDeleteProcesso = (processoId: string, processoNome: string) => {
    setProcessoToDelete({ id: processoId, nome: processoNome });
    setShowDeleteModal(true);
  };

  const confirmDeleteProcesso = async () => {
    if (!processoToDelete) return;

    try {
      // Delete processo (cascade will handle related records)
      const { error } = await supabase
        .from('processos')
        .delete()
        .eq('id', processoToDelete.id);

      if (error) {
        throw error;
      }

      toast.success('Processo excluído com sucesso!');
      setShowDeleteModal(false);
      setProcessoToDelete(null);
      
      // Reload data to update the list
      await loadClienteData();
    } catch (error) {
      console.error('Erro ao excluir processo:', error);
      toast.error('Erro ao excluir processo. Tente novamente.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900">Cliente não encontrado</h2>
        <Link
          to="/"
          className="mt-4 inline-flex items-center text-blue-600 hover:text-blue-500"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar ao início
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <Link
            to="/"
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Voltar
          </Link>
          
          {/* Client Profile Section */}
          <div className="flex items-center space-x-4">
            {/* Client Image */}
            <div className="flex-shrink-0">
              {cliente.imagem_url ? (
                <img
                  src={cliente.imagem_url}
                  alt={cliente.nome}
                  className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <User className="h-8 w-8 text-white" />
                </div>
              )}
            </div>
            
            {/* Client Info */}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{cliente.nome}</h1>
              {cliente.descricao && (
                <p className="mt-1 text-gray-600">{cliente.descricao}</p>
              )}
              <div className="flex items-center mt-2 text-sm text-gray-500">
                <FileText className="h-4 w-4 mr-1" />
                <span>{processos.length} processo{processos.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2 px-3 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            title="Atualizar lista"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
          
          <button
            onClick={() => setShowNovoProcessoModal(true)}
            className="flex items-center space-x-2 bg-[#00467F] text-white px-4 py-2 rounded-lg hover:bg-[#00365c] transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Novo Processo</span>
          </button>
        </div>
      </div>



      {/* Search Bar, Filters and View Toggle */}
      {processos.length > 0 && (
        <div className="flex flex-col lg:flex-row gap-4 lg:justify-between lg:items-center">
          {/* Left Side: Search Bar and Filters */}
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            {/* Search Bar */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Buscar processos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#00467F] focus:border-[#00467F] dark:bg-gray-700 dark:text-white"
              />
              {searchTerm && (
                <button
                  onClick={clearSearch}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              {/* Status Filter */}
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="appearance-none bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 pr-8 text-sm focus:ring-2 focus:ring-[#00467F] focus:border-[#00467F] dark:text-white"
                >
                  <option value="todos">Todos os Status</option>
                  <option value="aguardando">Aguardando</option>
                  <option value="processando">Processando</option>
                  <option value="processado">Processado</option>
                  <option value="erro">Erro</option>
                </select>
                <Filter className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
              </div>

              {/* Type Filter */}
              <div className="relative">
                <select
                  value={tipoFilter}
                  onChange={(e) => setTipoFilter(e.target.value)}
                  className="appearance-none bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 pr-8 text-sm focus:ring-2 focus:ring-[#00467F] focus:border-[#00467F] dark:text-white"
                >
                  <option value="todos">Todos os Tipos</option>
                  <option value="texto">Texto</option>
                  <option value="audio_video">Áudio/Vídeo</option>
                  <option value="documento">Documento</option>
                </select>
                <Shield className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
              </div>

              {/* Date Filter */}
              <div className="relative">
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="appearance-none bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 pr-8 text-sm focus:ring-2 focus:ring-[#00467F] focus:border-[#00467F] dark:text-white"
                >
                  <option value="todos">Todas as Datas</option>
                  <option value="hoje">Hoje</option>
                  <option value="semana">Última Semana</option>
                  <option value="mes">Último Mês</option>
                  <option value="antigo">Mais Antigo</option>
                </select>
                <CalendarDays className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
              </div>

              {/* Clear Filters Button */}
              {(statusFilter !== 'todos' || tipoFilter !== 'todos' || dateFilter !== 'todos' || searchTerm) && (
                <button
                  onClick={clearAllFilters}
                  className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Limpar Filtros
                </button>
              )}
            </div>
          </div>

          {/* Right Side: View Mode Toggle */}
          <div className="flex justify-end">
            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-[#00467F] text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
                title="Visualização em Lista"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-[#00467F] text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
                title="Visualização em Grade"
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results Summary */}
      {(searchTerm || statusFilter !== 'todos' || tipoFilter !== 'todos' || dateFilter !== 'todos') && (
        <div className="text-sm text-gray-600">
          {filteredProcessos.length === 0 ? (
            <span>Nenhum processo encontrado com os filtros aplicados</span>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span>
                {filteredProcessos.length} processo{filteredProcessos.length !== 1 ? 's' : ''} encontrado{filteredProcessos.length !== 1 ? 's' : ''}
                {searchTerm && ` para "${searchTerm}"`}
              </span>
              <div className="flex items-center space-x-2 text-xs">
                {statusFilter !== 'todos' && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                    Status: {statusFilter}
                  </span>
                )}
                {tipoFilter !== 'todos' && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                    Tipo: {tipoFilter === 'audio_video' ? 'Áudio/Vídeo' : 'Texto'}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Processos List */}
      {processos.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum processo encontrado</h3>
          <p className="mt-1 text-sm text-gray-500">
            Comece criando o primeiro processo para este cliente.
          </p>
          <div className="mt-6">
            <button
              onClick={() => setShowNovoProcessoModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[#00467F] hover:bg-[#00365c]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Processo
            </button>
          </div>
        </div>
      ) : filteredProcessos.length === 0 ? (
        <div className="text-center py-12">
          <Search className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum resultado encontrado</h3>
          <p className="mt-1 text-sm text-gray-500">
            Tente buscar com outros termos ou{' '}
            <button
              onClick={clearSearch}
              className="text-blue-600 hover:text-blue-500"
            >
              limpe a busca
            </button>
            {' '}para ver todos os processos.
          </p>
        </div>
      ) : viewMode === 'list' ? (
        /* List View */
        <div className="space-y-4">
          {filteredProcessos.map((processo) => (
            <div
              key={processo.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(processo.status)}
                      <h3 className="text-lg font-semibold text-gray-900">
                        {processo.nome}
                      </h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(processo.status)}`}>
                        {getStatusText(processo.status)}
                      </span>
                    </div>
                    
                    <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                      <span className="capitalize">Tipo: {processo.tipo_entrada}</span>
                      <span>
                        Criado em {format(new Date(processo.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleDeleteProcesso(processo.id, processo.nome)}
                      className="flex items-center space-x-2 px-3 py-2 text-red-600 border border-red-600 rounded-md hover:bg-red-50 transition-colors"
                      title="Excluir processo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    
                    <Link
                      to={`/cliente/${cliente.id}/processo/${processo.id}`}
                      className="flex items-center space-x-2 px-4 py-2 text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50 transition-colors"
                    >
                      <FileText className="h-4 w-4" />
                      <span>Ver Detalhes</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProcessos.map((processo) => (
            <div
              key={processo.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(processo.status)}
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(processo.status)}`}>
                      {getStatusText(processo.status)}
                    </span>
                  </div>
                  
                  <button
                    onClick={() => handleDeleteProcesso(processo.id, processo.nome)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    title="Excluir processo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 mb-3 line-clamp-2">
                  {processo.nome}
                </h3>
                
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-500">
                    <FileText className="h-4 w-4 mr-2" />
                    <span className="capitalize">Tipo: {processo.tipo_entrada}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-500">
                    <Clock className="h-4 w-4 mr-2" />
                    <span>
                      {format(new Date(processo.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </span>
                  </div>
                </div>
                
                <Link
                  to={`/cliente/${cliente.id}/processo/${processo.id}`}
                  className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-[#00467F] bg-blue-50 hover:bg-blue-100 transition-colors"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Ver Detalhes
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Novo Processo */}
      <NovoProcessoModal
        isOpen={showNovoProcessoModal}
        onClose={() => setShowNovoProcessoModal(false)}
        cliente={cliente}
        onProcessoCreated={loadClienteData}
      />

      {/* Modal de Confirmação de Exclusão */}
      {showDeleteModal && processoToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Confirmar Exclusão
                </h3>
              </div>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Tem certeza que deseja excluir o processo <strong>"{processoToDelete.nome}"</strong>?
              </p>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-800 font-medium mb-2">
                  ⚠️ Esta ação não pode ser desfeita
                </p>
                <p className="text-sm text-red-700">
                  Será removido permanentemente:
                </p>
                <ul className="text-sm text-red-700 mt-2 space-y-1">
                  <li>• O processo completo</li>
                  <li>• Todos os arquivos relacionados</li>
                  <li>• Transcrições e análises</li>
                  <li>• Histórico completo</li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteProcesso}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Excluir Processo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}