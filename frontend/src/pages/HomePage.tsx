import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase, Cliente } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Plus, FolderOpen, Calendar, Trash2, Search, X, Upload, User, Edit2, FileText, AlertTriangle, Grid3X3, List, Users, Clock, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';

interface ClienteWithProcessCount extends Cliente {
  processo_count: number;
}

export function HomePage() {
  const { user } = useAuth();
  const [clientes, setClientes] = useState<ClienteWithProcessCount[]>([]);
  const [filteredClientes, setFilteredClientes] = useState<ClienteWithProcessCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingClient, setEditingClient] = useState<ClienteWithProcessCount | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [newClientData, setNewClientData] = useState({
    nome: '',
    descricao: '',
    imagem_url: '',
  });
  const [editClientData, setEditClientData] = useState({
    nome: '',
    descricao: '',
    imagem_url: '',
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [editSelectedImage, setEditSelectedImage] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [clienteToDelete, setClienteToDelete] = useState<{ id: string; nome: string } | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid'); // Default para grid
  
  // Estados para KPIs
  const [kpis, setKpis] = useState({
    totalClientes: 0,
    totalProcessos: 0,
    transcricoesAndamento: 2, // Valor mockado
    transcricoesFinalizadas: 3 // Valor mockado
  });

  useEffect(() => {
    loadClientes();
    loadKpis();
  }, [user]);

  useEffect(() => {
    // Filter clientes based on search term
    if (searchTerm.trim() === '') {
      setFilteredClientes(clientes);
    } else {
      const filtered = clientes.filter(cliente =>
        cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (cliente.descricao && cliente.descricao.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredClientes(filtered);
    }
  }, [clientes, searchTerm]);

  const loadClientes = async () => {
    try {
      console.log('🔍 Carregando clientes...');
      
      // Load clientes with process count
      const { data, error } = await supabase
        .from('clientes')
        .select(`
          *,
          processos(count)
        `)
        .order('created_at', { ascending: false });

      console.log('📊 Resultado da query clientes:', { data, error });

      if (error) {
        console.error('❌ Erro na query clientes:', error);
        throw error;
      }

      // Transform the data to include process count
      const clientesWithCount = (data || []).map(cliente => ({
        ...cliente,
        processo_count: cliente.processos?.[0]?.count || 0
      }));

      console.log('✅ Clientes carregados:', clientesWithCount.length);
      setClientes(clientesWithCount);
      
      // Atualizar KPIs após carregar clientes
      loadKpis();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro ao carregar clientes';
      console.error('❌ Erro carregando clientes:', error);
      toast.error('Erro ao carregar clientes: ' + message);
    } finally {
      setLoading(false);
    }
  };

  const loadKpis = async () => {
    try {
      // Buscar total de clientes
      const { count: clientesCount } = await supabase
        .from('clientes')
        .select('*', { count: 'exact', head: true });

      // Buscar total de processos
      const { count: processosCount } = await supabase
        .from('processos')
        .select('*', { count: 'exact', head: true });

      setKpis(prev => ({
        ...prev,
        totalClientes: clientesCount || 0,
        totalProcessos: processosCount || 0
      }));
    } catch (error) {
      console.error('Erro ao carregar KPIs:', error);
      // Em caso de erro, manter os valores atuais
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Por favor, selecione apenas arquivos de imagem');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('A imagem deve ter no máximo 5MB');
        return;
      }

      setSelectedImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Por favor, selecione apenas arquivos de imagem');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('A imagem deve ter no máximo 5MB');
        return;
      }

      setEditSelectedImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setEditImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const convertImageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    
    try {
      let imageUrl = '';
      
      // Convert image to base64 if selected (temporary solution)
      if (selectedImage) {
        imageUrl = await convertImageToBase64(selectedImage);
      }

      // Create cliente
      const { error } = await supabase
        .from('clientes')
        .insert([
          {
            nome: newClientData.nome,
            descricao: newClientData.descricao,
            imagem_url: imageUrl || null,
          },
        ]);

      if (error) {
        throw error;
      }

      toast.success('Cliente criado com sucesso!');
      resetCreateModal();
      loadClientes();
    } catch (error: any) {
      toast.error('Erro ao criar cliente');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleEditClient = (cliente: ClienteWithProcessCount) => {
    setEditingClient(cliente);
    setEditClientData({
      nome: cliente.nome,
      descricao: cliente.descricao || '',
      imagem_url: cliente.imagem_url || '',
    });
    setEditImagePreview(cliente.imagem_url || '');
    setEditSelectedImage(null);
    setShowEditModal(true);
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    
    setUploading(true);
    
    try {
      let imageUrl = editClientData.imagem_url;
      
      // Convert new image to base64 if selected
      if (editSelectedImage) {
        imageUrl = await convertImageToBase64(editSelectedImage);
      }

      // Update cliente
      const { error } = await supabase
        .from('clientes')
        .update({
          nome: editClientData.nome,
          descricao: editClientData.descricao,
          imagem_url: imageUrl || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingClient.id);

      if (error) {
        throw error;
      }

      toast.success('Cliente atualizado com sucesso!');
      resetEditModal();
      loadClientes();
    } catch (error: any) {
      toast.error('Erro ao atualizar cliente');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteClient = (clientId: string, clienteNome: string) => {
    setClienteToDelete({ id: clientId, nome: clienteNome });
    setShowDeleteModal(true);
  };

  const confirmDeleteClient = async () => {
    if (!clienteToDelete) return;

    try {
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', clienteToDelete.id);

      if (error) {
        throw error;
      }

      toast.success('Cliente excluído com sucesso!');
      setShowDeleteModal(false);
      setClienteToDelete(null);
      loadClientes();
    } catch (error: any) {
      toast.error('Erro ao excluir cliente');
      console.error(error);
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
  };

  const resetCreateModal = () => {
    setNewClientData({ nome: '', descricao: '', imagem_url: '' });
    setSelectedImage(null);
    setImagePreview('');
    setShowCreateModal(false);
  };

  const resetEditModal = () => {
    setEditClientData({ nome: '', descricao: '', imagem_url: '' });
    setEditSelectedImage(null);
    setEditImagePreview('');
    setEditingClient(null);
    setShowEditModal(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">Todos os Clientes</h1>
          <p className="mt-2 text-gray-600">
            Visualize e gerencie todos os clientes e processos do sistema
          </p>
        </div>
        
        {/* KPIs - No Header */}
        <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500 mr-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" style={{ color: '#00467F' }} />
            <span className="font-medium text-gray-900">{kpis.totalClientes}</span>
            <span>clientes</span>
          </div>
          
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" style={{ color: '#00467F' }} />
            <span className="font-medium text-gray-900">{kpis.totalProcessos}</span>
            <span>processos</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" style={{ color: '#00467F' }} />
            <span className="font-medium text-gray-900">{kpis.transcricoesAndamento}</span>
            <span>em andamento</span>
          </div>
          
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" style={{ color: '#00467F' }} />
            <span className="font-medium text-gray-900">{kpis.transcricoesFinalizadas}</span>
            <span>finalizadas</span>
          </div>
        </div>
        
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 bg-[#00467F] text-white px-4 py-2 rounded-lg hover:bg-[#00365c] transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>Novo Cliente</span>
        </button>
      </div>

      {/* Search Bar and View Toggle */}
      {clientes.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative max-w-md flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar clientes..."
              className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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

          {/* View Mode Toggle */}
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
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
          </div>
        </div>
      )}

      {/* Results Summary */}
      {searchTerm && (
        <div className="text-sm text-gray-600">
          {filteredClientes.length === 0 ? (
            <span>Nenhum cliente encontrado para "{searchTerm}"</span>
          ) : (
            <span>
              {filteredClientes.length} cliente{filteredClientes.length !== 1 ? 's' : ''} encontrado{filteredClientes.length !== 1 ? 's' : ''} para "{searchTerm}"
            </span>
          )}
        </div>
      )}

      {/* Clientes Grid */}
      {clientes.length === 0 ? (
        <div className="text-center py-12">
          <FolderOpen className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum cliente encontrado</h3>
          <p className="mt-1 text-sm text-gray-500">
            Comece criando o primeiro cliente do sistema.
          </p>
          <div className="mt-6">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[#00467F] hover:bg-[#00365c]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Cliente
            </button>
          </div>
        </div>
      ) : filteredClientes.length === 0 ? (
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
            {' '}para ver todos os clientes.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClientes.map((cliente) => (
            <div
              key={cliente.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start space-x-4">
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
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate">
                          {cliente.nome}
                        </h3>
                        
                        {/* Process Count */}
                        <div className="flex items-center space-x-1 mb-2">
                          <FileText className="h-4 w-4 text-gray-500" />
                          <span className="text-sm text-gray-600">
                            {cliente.processo_count} processo{cliente.processo_count !== 1 ? 's' : ''}
                          </span>
                        </div>
                        
                        {cliente.descricao && (
                          <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                            {cliente.descricao}
                          </p>
                        )}
                        <div className="flex items-center text-xs text-gray-500">
                          <Calendar className="h-4 w-4 mr-1" />
                          <span>
                            Criado em {format(new Date(cliente.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex space-x-1 ml-2">
                        <button
                          onClick={() => handleEditClient(cliente)}
                          className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Editar cliente"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClient(cliente.id, cliente.nome)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          title="Excluir cliente"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6">
                  <Link
                    to={`/cliente/${cliente.id}`}
                    className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                  >
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Ver Processos
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Processos
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Criado em
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredClientes.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          {cliente.imagem_url ? (
                            <img
                              src={cliente.imagem_url}
                              alt={cliente.nome}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                              <User className="h-5 w-5 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {cliente.nome}
                          </div>
                          {cliente.descricao && (
                            <div className="text-sm text-gray-500 truncate max-w-xs">
                              {cliente.descricao}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900">
                          {cliente.processo_count} processo{cliente.processo_count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(cliente.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <Link
                          to={`/cliente/${cliente.id}`}
                          className="text-[#00467F] hover:text-[#00365c] font-medium"
                        >
                          Ver Processos
                        </Link>
                        <button
                          onClick={() => handleEditClient(cliente)}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                          title="Editar cliente"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClient(cliente.id, cliente.nome)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                          title="Excluir cliente"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Client Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Criar Novo Cliente
            </h2>
            
            <form onSubmit={handleCreateClient} className="space-y-4">
              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Imagem do Cliente (opcional)
                </label>
                <div className="flex items-center space-x-4">
                  {/* Image Preview */}
                  <div className="flex-shrink-0">
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300">
                        <User className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                  </div>
                  
                  {/* Upload Button */}
                  <div className="flex-1">
                    <label htmlFor="image-upload" className="cursor-pointer">
                      <div className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
                        <Upload className="h-4 w-4 mr-2" />
                        {selectedImage ? 'Alterar Imagem' : 'Selecionar Imagem'}
                      </div>
                      <input
                        id="image-upload"
                        type="file"
                        className="sr-only"
                        accept="image/*"
                        onChange={handleImageSelect}
                      />
                    </label>
                    <p className="mt-1 text-xs text-gray-500">
                      PNG, JPG até 5MB
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="nome" className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Cliente
                </label>
                <input
                  type="text"
                  id="nome"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={newClientData.nome}
                  onChange={(e) => setNewClientData({ ...newClientData, nome: e.target.value })}
                />
              </div>
              
              <div>
                <label htmlFor="descricao" className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição (opcional)
                </label>
                <textarea
                  id="descricao"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={newClientData.descricao}
                  onChange={(e) => setNewClientData({ ...newClientData, descricao: e.target.value })}
                />
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetCreateModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 px-4 py-2 bg-[#00467F] text-white rounded-md hover:bg-[#00365c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  {uploading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    'Criar Cliente'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {showEditModal && editingClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Editar Cliente
            </h2>
            
            <form onSubmit={handleUpdateClient} className="space-y-4">
              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Imagem do Cliente (opcional)
                </label>
                <div className="flex items-center space-x-4">
                  {/* Image Preview */}
                  <div className="flex-shrink-0">
                    {editImagePreview ? (
                      <img
                        src={editImagePreview}
                        alt="Preview"
                        className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300">
                        <User className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                  </div>
                  
                  {/* Upload Button */}
                  <div className="flex-1">
                    <label htmlFor="edit-image-upload" className="cursor-pointer">
                      <div className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
                        <Upload className="h-4 w-4 mr-2" />
                        {editSelectedImage ? 'Alterar Imagem' : editImagePreview ? 'Trocar Imagem' : 'Selecionar Imagem'}
                      </div>
                      <input
                        id="edit-image-upload"
                        type="file"
                        className="sr-only"
                        accept="image/*"
                        onChange={handleEditImageSelect}
                      />
                    </label>
                    <p className="mt-1 text-xs text-gray-500">
                      PNG, JPG até 5MB
                    </p>
                    {editImagePreview && !editSelectedImage && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditImagePreview('');
                          setEditClientData({ ...editClientData, imagem_url: '' });
                        }}
                        className="mt-1 text-xs text-red-600 hover:text-red-800"
                      >
                        Remover imagem atual
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="edit-nome" className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Cliente
                </label>
                <input
                  type="text"
                  id="edit-nome"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={editClientData.nome}
                  onChange={(e) => setEditClientData({ ...editClientData, nome: e.target.value })}
                />
              </div>
              
              <div>
                <label htmlFor="edit-descricao" className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição (opcional)
                </label>
                <textarea
                  id="edit-descricao"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={editClientData.descricao}
                  onChange={(e) => setEditClientData({ ...editClientData, descricao: e.target.value })}
                />
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetEditModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 px-4 py-2 bg-[#00467F] text-white rounded-md hover:bg-[#00365c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  {uploading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    'Salvar Alterações'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {showDeleteModal && clienteToDelete && (
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
                Tem certeza que deseja excluir o cliente <strong>"{clienteToDelete.nome}"</strong>?
              </p>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-800 font-medium mb-2">
                  ⚠️ Esta ação não pode ser desfeita
                </p>
                <p className="text-sm text-red-700">
                  Será removido permanentemente:
                </p>
                <ul className="text-sm text-red-700 mt-2 space-y-1">
                  <li>• O cliente completo</li>
                  <li>• Todos os processos relacionados</li>
                  <li>• Arquivos, transcrições e análises</li>
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
                onClick={confirmDeleteClient}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Excluir Cliente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}