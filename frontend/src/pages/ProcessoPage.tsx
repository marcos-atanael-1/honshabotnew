import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase, Cliente, Processo, Analise } from '../lib/supabase';
import { ArrowLeft, Upload, Video, Music, Type, Save, X, AlertTriangle, Clock, AlertCircle, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ProcessoVisualizacao } from '../components/ProcessoVisualizacao';
import { transcriptionService } from '../lib/transcription';

// Funções para exibir status
const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pendente':
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case 'processando':
      return <AlertCircle className="h-4 w-4 text-blue-500 animate-pulse" />;
    case 'processado':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'erro':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-500" />;
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'pendente':
      return 'Pendente';
    case 'processando':
      return 'Processando';
    case 'processado':
      return 'Processado';
    case 'erro':
      return 'Erro';
    default:
      return 'Desconhecido';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pendente':
      return 'bg-yellow-100 text-yellow-700';
    case 'processando':
      return 'bg-blue-100 text-blue-700';
    case 'processado':
      return 'bg-green-100 text-green-700';
    case 'erro':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

export function ProcessoPage() {
  const { cliente_id, id } = useParams<{ cliente_id: string; id: string }>();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [processo, setProcesso] = useState<Processo | null>(null);
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNew, setIsNew] = useState(false);
  
  // Form state for new processo
  const [formData, setFormData] = useState({
    nome: '',
    tipo_entrada: 'texto' as 'audio_video' | 'texto',
    conteudo_texto: '',
    ai_model: 'openai' as 'openai' | 'groq',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (cliente_id) {
      loadData();
    }
  }, [cliente_id, id]);

  const loadData = async () => {
    try {
      // Load cliente
      await supabase
        .from('clientes')
        .select('*')
        .eq('id', cliente_id)
        .single()
        .then(({ data: clienteData, error: clienteError }) => {
          if (clienteError) {
            throw clienteError;
          }
          setCliente(clienteData);
        });

      if (id === 'novo') {
        setIsNew(true);
        setLoading(false);
        return;
      }

      // Load processo
      await supabase
        .from('processos')
        .select('*')
        .eq('id', id)
        .single()
        .then(({ data: processoData, error: processoError }) => {
          if (processoError) {
            throw processoError;
          }
          setProcesso(processoData);
        });

      // Load analise if exists
      await supabase
        .from('analises')
        .select('*')
        .eq('processo_id', id)
        .single()
        .then(({ data: analiseData, error: analiseError }) => {
          if (!analiseError && analiseData) {
            setAnalise(analiseData);
          }
        });

    } catch (error) {
      toast.error('Erro ao carregar dados');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        // Verificar se é um arquivo de áudio/vídeo válido
        const isValidType = file.type.startsWith('audio/') || file.type.startsWith('video/');
        
        if (!isValidType) {
          toast.error('Tipo de arquivo não suportado. Selecione um arquivo de áudio ou vídeo.');
          e.target.value = '';
          return;
        }
        
        setSelectedFile(file);
        toast.success(`Arquivo selecionado: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      } catch (error) {
        console.error('Erro ao processar arquivo:', error);
        toast.error('Erro ao processar arquivo. Tente novamente.');
        e.target.value = '';
      }
    }
  };

  const uploadFile = async (file: File, processoId: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${processoId}/${fileName}`;

    // Mock file upload
    await supabase.storage
      .from('processo-files')
      .upload(filePath, file);

    // Save file record
    await supabase
      .from('arquivos')
      .insert([
        {
          processo_id: processoId,
          nome_original: file.name,
          tipo: file.type,
          tamanho: file.size,
          storage_path: filePath,
        },
      ]);

    return filePath;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    try {
      // Create processo
      await supabase
        .from('processos')
        .insert([
          {
            nome: formData.nome,
            cliente_id: cliente_id!,
            tipo_entrada: formData.tipo_entrada,
            conteudo_texto: formData.tipo_entrada === 'texto' ? formData.conteudo_texto : null,
            ai_model: formData.ai_model,
            status: 'aguardando',
          },
        ])
        .select()
        .single()
        .then(async ({ data: processoData, error: processoError }) => {
          if (processoError) {
            throw processoError;
          }

          // Upload file if selected
          if (selectedFile && formData.tipo_entrada !== 'texto') {
            await uploadFile(selectedFile, processoData.id);
          }

          // Start background processing (não aguarda conclusão)
          processFile(processoData.id, selectedFile, formData.tipo_entrada)
            .catch(error => {
              console.error('Erro no processamento em background:', error);
            });

          toast.success('Processo criado! O processamento continuará em segundo plano.');
          navigate(`/cliente/${cliente_id}/processo/${processoData.id}`);
        });
    } catch (error) {
      toast.error('Erro ao criar processo');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const processFile = async (
    processoId: string, 
    file: File | null, 
    tipoEntrada: 'audio_video' | 'texto'
  ) => {
    try {
      if (tipoEntrada === 'texto') {
        // Para texto, o conteúdo já é a transcrição final
        const transcricao = formData.conteudo_texto;
        
        // Criar registro de transcrição completa diretamente
        await supabase
          .from('transcricoes')
          .insert([
            {
              processo_id: processoId,
              conteudo: transcricao,
              status: 'concluido',
              tempo_processamento: 0,
            },
          ]);

        // Atualizar status para processado ANTES da análise com IA
        await supabase
          .from('processos')
          .update({ status: 'processado' })
          .eq('id', processoId);

        // Tentar gerar análise com IA (em background, não bloqueia o processo)
        try {
          const analysis = await transcriptionService.generateAnalysisFromTranscription(transcricao);
          
          // Salvar análise se bem-sucedida
          await supabase
            .from('analises')
            .insert([
              {
                processo_id: processoId,
                transcricao,
                ...analysis,
              },
            ]);
          
          console.log('✅ Processo de texto processado com sucesso (com análise IA)');
        } catch (analysisError) {
          console.warn('⚠️ Erro na análise com IA, mas processo já está concluído:', analysisError);
          
          // Criar análise básica em caso de erro
          await supabase
            .from('analises')
            .insert([
              {
                processo_id: processoId,
                transcricao,
                fluxo_original_json: {
                  nodes: [
                    { id: '1', type: 'input', position: { x: 50, y: 50 }, data: { label: 'Início' } },
                    { id: '2', position: { x: 50, y: 150 }, data: { label: 'Processo de Texto' } },
                    { id: '3', type: 'output', position: { x: 50, y: 250 }, data: { label: 'Fim' } },
                  ],
                  edges: [
                    { id: 'e1-2', source: '1', target: '2' },
                    { id: 'e2-3', source: '2', target: '3' },
                  ],
                },
                fluxo_melhorado_json: {
                  nodes: [
                    { id: '1', type: 'input', position: { x: 50, y: 50 }, data: { label: 'Início' } },
                    { id: '2', position: { x: 50, y: 150 }, data: { label: 'Processo Otimizado' } },
                    { id: '3', type: 'output', position: { x: 50, y: 250 }, data: { label: 'Fim' } },
                  ],
                  edges: [
                    { id: 'e1-2', source: '1', target: '2' },
                    { id: 'e2-3', source: '2', target: '3' },
                  ],
                },
                sugestoes: 'Análise com IA não disponível. Configure a chave da API OpenAI para obter sugestões detalhadas.',
              },
            ]);
          
          console.log('✅ Processo de texto processado com sucesso (análise básica)');
        }

      } else if (file && tipoEntrada === 'audio_video') {
        // Para áudio/vídeo, manter o fluxo original com API
        await supabase
          .from('processos')
          .update({ status: 'processando' })
          .eq('id', processoId);

        try {
          // Enviar arquivo para API externa e obter ID da transcrição
          const { transcriptionId } = await transcriptionService.transcribeFile(file, processoId);
          
          // O registro de transcrição já é criado pelo backend no endpoint /upload
          // Não precisamos criar um registro adicional aqui

          // Não aguardar conclusão aqui - o polling será feito na visualização
          console.log(`Transcrição iniciada com ID: ${transcriptionId}`);

        } catch (transcriptionError) {
          console.error('Erro ao iniciar transcrição:', transcriptionError);
          
          // Atualizar status da transcrição para erro
          await transcriptionService.updateTranscriptionStatus(processoId, 'erro', 
            transcriptionError instanceof Error ? transcriptionError.message : 'Erro desconhecido');

          // Mostrar erro específico baseado no tipo
          let errorMessage = 'Erro desconhecido na transcrição';
          if (transcriptionError instanceof Error) {
            if (transcriptionError.message.includes('não está disponível')) {
              errorMessage = 'Serviço de transcrição temporariamente indisponível. Tente novamente em alguns minutos.';
            } else if (transcriptionError.message.includes('fetch')) {
              errorMessage = 'Erro de conexão com o serviço de transcrição. Verifique sua internet.';
            } else {
              errorMessage = transcriptionError.message;
            }
          }
          
          toast.error(errorMessage);
          throw new Error(errorMessage);
        }
      }

    } catch (error) {
      console.error('Error in processing:', error);
      
      // Update status to error
      await supabase
        .from('processos')
        .update({ status: 'erro' })
        .eq('id', processoId);

      // Show error to user if they're still on the page
      toast.error(`Erro no processamento: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };



  const handleDeleteProcesso = () => {
    setShowDeleteModal(true);
  };

  const confirmDeleteProcesso = async () => {
    if (!processo) return;

    try {
      // Delete processo (cascade will handle related records)
      const { error } = await supabase
        .from('processos')
        .delete()
        .eq('id', processo.id);

      if (error) {
        throw error;
      }

      toast.success('Processo excluído com sucesso!');
      setShowDeleteModal(false);
      
      // Redirect back to cliente page
      navigate(`/cliente/${cliente_id}`);
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
        <div className="flex items-center space-x-4">
          <Link
            to={`/cliente/${cliente.id}`}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Voltar
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isNew ? 'Novo Processo' : processo?.nome}
            </h1>
            <p className="mt-1 text-gray-600">
              Cliente: {cliente.nome}
            </p>
          </div>
        </div>
        
        {/* Status e Ações - só exibe se não for novo processo */}
        {!isNew && processo && (
          <div className="flex items-center space-x-4">
            {/* Status do Processo */}
            <div className="flex items-center space-x-2">
              {(() => {
                switch (processo.status) {
                  case 'aguardando':
                    return <><Clock className="h-5 w-5 text-yellow-500" /><span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">Aguardando processamento</span></>;
                  case 'processando':
                    return <><AlertCircle className="h-5 w-5 text-blue-500 animate-spin" /><span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">Processando...</span></>;
                  case 'processado':
                    return <><CheckCircle className="h-5 w-5 text-green-500" /><span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Processado com sucesso</span></>;
                  case 'erro':
                    return <><XCircle className="h-5 w-5 text-red-500" /><span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Erro no processamento</span></>;
                  default:
                    return <><Clock className="h-5 w-5 text-gray-500" /><span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">{processo.status}</span></>;
                }
              })()}
            </div>
            
            {/* Botão Excluir */}
            <button
              onClick={handleDeleteProcesso}
              className="flex items-center space-x-2 px-3 py-2 text-sm text-red-600 border border-red-600 rounded-md hover:bg-red-50 transition-colors"
              title="Excluir processo"
            >
              <Trash2 className="h-4 w-4" />
              <span>Excluir</span>
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {isNew ? (
        /* Create Form */
        <div className="max-w-2xl">
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
            <div>
              <label htmlFor="nome" className="block text-sm font-medium text-gray-700 mb-2">
                Nome do Processo
              </label>
              <input
                type="text"
                id="nome"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Entrada
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="tipo_entrada"
                    value="audio_video"
                    checked={formData.tipo_entrada === 'audio_video'}
                    onChange={(e) => setFormData({ ...formData, tipo_entrada: e.target.value as 'audio_video' | 'texto' })}
                    className="mr-2"
                  />
                  <div className="flex items-center space-x-1 mr-2">
                    <Video className="h-4 w-4" />
                    <Music className="h-4 w-4" />
                  </div>
                  Áudio/Vídeo (.mp3, .wav, .mp4)
                  <span className="ml-2 text-xs text-gray-500">(vídeos são convertidos automaticamente)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="tipo_entrada"
                    value="texto"
                    checked={formData.tipo_entrada === 'texto'}
                    onChange={(e) => setFormData({ ...formData, tipo_entrada: e.target.value as 'audio_video' | 'texto' })}
                    className="mr-2"
                  />
                  <Type className="h-4 w-4 mr-2" />
                  Texto
                </label>
              </div>
            </div>



            {formData.tipo_entrada === 'texto' ? (
              <div>
                <label htmlFor="conteudo_texto" className="block text-sm font-medium text-gray-700 mb-2">
                  Conteúdo do Texto
                </label>
                <textarea
                  id="conteudo_texto"
                  rows={8}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={formData.conteudo_texto}
                  onChange={(e) => setFormData({ ...formData, conteudo_texto: e.target.value })}
                  placeholder="Digite ou cole seu texto aqui..."
                />
              </div>
            ) : (
              <div>
                <label htmlFor="arquivo" className="block text-sm font-medium text-gray-700 mb-2">
                  Selecionar Arquivo
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="mt-4">
                    <label htmlFor="arquivo" className="cursor-pointer">
                      <span className="mt-2 block text-sm font-medium text-gray-900">
                        {selectedFile ? selectedFile.name : 'Clique para selecionar ou arraste o arquivo'}
                      </span>
                      <input
                        id="arquivo"
                        type="file"
                        className="sr-only"
                        accept=".mp3,.wav,.mp4"
                        onChange={handleFileSelect}
                        required
                      />
                    </label>
                  </div>
                </div>


              </div>
            )}

            <div className="flex space-x-4">
              <Link
                to={`/cliente/${cliente.id}`}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-center"
              >
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={uploading}
                className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {uploading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Criar Processo</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* View Processo */
        processo && (
          <ProcessoVisualizacao 
            processo={processo} 
            analise={analise} 
            onStatusUpdate={loadData}
            onDelete={handleDeleteProcesso}
          />
        )
      )}

      {/* Modal de Confirmação de Exclusão */}
      {showDeleteModal && processo && (
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
                Tem certeza que deseja excluir o processo <strong>"{processo.nome}"</strong>?
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