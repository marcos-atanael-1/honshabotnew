import React, { useState, useRef } from 'react';
import { X, Upload, Video, Music, Type, Save, CheckCircle, FileText } from 'lucide-react';
import { supabase, Cliente } from '../lib/supabase';
import { transcriptionService } from '../lib/transcription';
import toast from 'react-hot-toast';

interface NovoProcessoModalProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: Cliente;
  onProcessoCreated: () => void;
}

export function NovoProcessoModal({ isOpen, onClose, cliente, onProcessoCreated }: NovoProcessoModalProps) {
  const [formData, setFormData] = useState({
    nome: '',
    tipo_entrada: 'audio_video' as 'audio_video' | 'documento' | 'texto',
    conteudo_texto: '',
    ai_model: 'openai' as 'openai' | 'groq',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setFormData({
      nome: '',
      tipo_entrada: 'audio_video',
      conteudo_texto: '',
      ai_model: 'openai',
    });
    setSelectedFile(null);
    setUploading(false);
    setShowSuccess(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        let isValidType = false;
        let typeMessage = '';

        if (formData.tipo_entrada === 'audio_video') {
          isValidType = file.type.startsWith('audio/') || file.type.startsWith('video/');
          typeMessage = 'Selecione um arquivo de áudio ou vídeo (.mp3, .wav, .mp4, etc.)';
        } else if (formData.tipo_entrada === 'documento') {
          isValidType = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                       file.type === 'application/msword' ||
                       file.type === 'application/pdf' ||
                       file.name.toLowerCase().endsWith('.docx') ||
                       file.name.toLowerCase().endsWith('.doc') ||
                       file.name.toLowerCase().endsWith('.pdf');
          typeMessage = 'Selecione um documento (.docx, .doc, .pdf)';
        }
        
        if (!isValidType) {
          toast.error(`Tipo de arquivo não suportado. ${typeMessage}`);
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

  const processFile = async (
    processoId: string, 
    file: File | null, 
    tipoEntrada: 'audio_video' | 'documento' | 'texto'
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
      } else if (tipoEntrada === 'documento') {
        if (!file) {
          throw new Error('Arquivo de documento é obrigatório');
        }

        // Upload do documento
        await uploadFile(file, processoId);
        
        // TODO: Implementar extração de texto do documento
        // Por enquanto, criar registro indicando que precisa de processamento manual
        await supabase
          .from('transcricoes')
          .insert([
            {
              processo_id: processoId,
              conteudo: 'Documento enviado. Extração de texto pendente.',
              status: 'aguardando',
              tempo_processamento: 0,
            },
          ]);

        // Atualizar status para processando (aguardando extração de texto)
        await supabase
          .from('processos')
          .update({ status: 'processando' })
          .eq('id', processoId);

        toast.success('Documento enviado! A extração de texto será implementada em breve.');

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    try {
      // Create processo
      const { data: processoData, error: processoError } = await supabase
        .from('processos')
        .insert([
          {
            nome: formData.nome,
            cliente_id: cliente.id,
            tipo_entrada: formData.tipo_entrada,
            conteudo_texto: formData.tipo_entrada === 'texto' ? formData.conteudo_texto : null,
            ai_model: formData.ai_model,
            status: 'aguardando',
          },
        ])
        .select()
        .single();

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

      // Mostrar sucesso e mudar para tela de confirmação
      setShowSuccess(true);
      onProcessoCreated(); // Atualizar lista de processos
      
    } catch (error) {
      toast.error('Erro ao criar processo');
      console.error(error);
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {showSuccess ? 'Arquivo Enviado' : 'Novo Processo'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
          {showSuccess ? (
            /* Success Screen */
            <div className="text-center py-8">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Processo criado com sucesso!
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                O processamento continuará em segundo plano. Você pode acompanhar o progresso na lista de processos.
              </p>
              <button
                onClick={handleClose}
                className="inline-flex items-center px-4 py-2 bg-[#00467F] text-white rounded-md hover:bg-[#00365c] transition-colors"
              >
                Fechar
              </button>
            </div>
          ) : (
            /* Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="nome" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nome do Processo
                </label>
                <input
                  type="text"
                  id="nome"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Processo de Vendas"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipo de Entrada
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className={`relative cursor-pointer border-2 rounded-lg p-3 transition-all ${
                    formData.tipo_entrada === 'audio_video' 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                      : 'border-gray-200 dark:border-gray-600 hover:border-blue-300'
                  }`}>
                    <input
                      type="radio"
                      name="tipo_entrada"
                      value="audio_video"
                      checked={formData.tipo_entrada === 'audio_video'}
                      onChange={(e) => setFormData({ ...formData, tipo_entrada: e.target.value as 'audio_video' | 'documento' | 'texto' })}
                      className="sr-only"
                    />
                    <div className="text-center">
                      <div className="flex justify-center space-x-1 mb-2">
                        <Video className="h-6 w-6 text-blue-600" />
                        <Music className="h-6 w-6 text-green-600" />
                      </div>
                      <div className="font-medium text-gray-900 dark:text-white mb-1 text-sm">Áudio/Vídeo</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        .mp3, .wav, .mp4
                      </div>
                    </div>
                    {formData.tipo_entrada === 'audio_video' && (
                      <div className="absolute top-2 right-2 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                    )}
                  </label>
                  
                  <label className={`relative cursor-pointer border-2 rounded-lg p-3 transition-all ${
                    formData.tipo_entrada === 'documento' 
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' 
                      : 'border-gray-200 dark:border-gray-600 hover:border-orange-300'
                  }`}>
                    <input
                      type="radio"
                      name="tipo_entrada"
                      value="documento"
                      checked={formData.tipo_entrada === 'documento'}
                      onChange={(e) => setFormData({ ...formData, tipo_entrada: e.target.value as 'audio_video' | 'documento' | 'texto' })}
                      className="sr-only"
                    />
                    <div className="text-center">
                      <div className="flex justify-center mb-2">
                        <FileText className="h-6 w-6 text-orange-600" />
                      </div>
                      <div className="font-medium text-gray-900 dark:text-white mb-1 text-sm">Documento</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        .docx, .doc, .pdf
                      </div>
                    </div>
                    {formData.tipo_entrada === 'documento' && (
                      <div className="absolute top-2 right-2 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                    )}
                  </label>
                  
                  <label className={`relative cursor-pointer border-2 rounded-lg p-3 transition-all ${
                    formData.tipo_entrada === 'texto' 
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' 
                      : 'border-gray-200 dark:border-gray-600 hover:border-purple-300'
                  }`}>
                    <input
                      type="radio"
                      name="tipo_entrada"
                      value="texto"
                      checked={formData.tipo_entrada === 'texto'}
                      onChange={(e) => setFormData({ ...formData, tipo_entrada: e.target.value as 'audio_video' | 'documento' | 'texto' })}
                      className="sr-only"
                    />
                    <div className="text-center">
                      <div className="flex justify-center mb-2">
                        <Type className="h-6 w-6 text-purple-600" />
                      </div>
                      <div className="font-medium text-gray-900 dark:text-white mb-1 text-sm">Texto</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Digite diretamente
                      </div>
                    </div>
                    {formData.tipo_entrada === 'texto' && (
                      <div className="absolute top-2 right-2 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {formData.tipo_entrada === 'texto' ? (
                <div>
                  <label htmlFor="conteudo_texto" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Conteúdo do Texto
                  </label>
                  <textarea
                    id="conteudo_texto"
                    rows={5}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    value={formData.conteudo_texto}
                    onChange={(e) => setFormData({ ...formData, conteudo_texto: e.target.value })}
                    placeholder="Digite ou cole seu texto aqui..."
                  />
                </div>
              ) : (
                <div>
                  <div className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Selecionar {formData.tipo_entrada === 'documento' ? 'Documento' : 'Arquivo de Áudio/Vídeo'}
                  </div>
                  <div onClick={() => fileInputRef.current?.click()} className={`relative border-2 border-dashed rounded-xl p-4 text-center transition-all duration-300 cursor-pointer group ${
                    selectedFile 
                      ? 'border-green-300 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20' 
                      : formData.tipo_entrada === 'documento'
                        ? 'border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 hover:border-orange-400 hover:shadow-lg'
                        : 'border-blue-300 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 hover:border-blue-400 hover:shadow-lg'
                  }`}>
                    <label htmlFor="arquivo" className="cursor-pointer block" onClick={() => fileInputRef.current?.click()}>
                      <div className={`mx-auto h-10 w-10 rounded-full flex items-center justify-center mb-3 transition-all duration-300 ${
                        selectedFile 
                          ? 'bg-green-100 dark:bg-green-800 group-hover:scale-110' 
                          : formData.tipo_entrada === 'documento'
                            ? 'bg-orange-100 dark:bg-orange-800 group-hover:scale-110'
                            : 'bg-blue-100 dark:bg-blue-800 group-hover:scale-110'
                      }`}>
                        {selectedFile ? (
                          <CheckCircle className={`h-5 w-5 ${
                            selectedFile ? 'text-green-600 dark:text-green-400' : ''
                          }`} />
                        ) : (
                          <Upload className={`h-5 w-5 ${
                            formData.tipo_entrada === 'documento'
                              ? 'text-orange-600 dark:text-orange-400'
                              : 'text-blue-600 dark:text-blue-400'
                          }`} />
                        )}
                      </div>
                      
                      <div className="space-y-1">
                        <p className={`text-sm font-semibold ${
                          selectedFile 
                            ? 'text-green-700 dark:text-green-300' 
                            : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          {selectedFile ? selectedFile.name : 'Clique para selecionar ou arraste o arquivo'}
                        </p>
                        
                        {!selectedFile && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formData.tipo_entrada === 'documento' 
                              ? 'Suporta arquivos .docx, .doc, .pdf'
                              : 'Suporta arquivos .mp3, .wav, .mp4, .avi, .mov'
                            }
                          </p>
                        )}
                        
                        {selectedFile && (
                          <div className="flex items-center justify-center space-x-2 text-xs text-green-600 dark:text-green-400">
                            <span>Arquivo selecionado</span>
                            <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div>
                            <span>{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</span>
                          </div>
                        )}
                      </div>
                      
                      <input
                        ref={fileInputRef}
                        id="arquivo"
                        type="file"
                        className="sr-only"
                        accept={formData.tipo_entrada === 'documento' ? '.docx,.doc,.pdf' : '.mp3,.wav,.mp4,.avi, .mov'}
                        onChange={handleFileSelect}
                        required
                      />
                    </label>
                    
                    {/* Efeito de hover animado */}
                    <div className={`absolute inset-0 rounded-xl transition-opacity duration-300 ${
                      selectedFile 
                        ? 'opacity-0' 
                        : 'opacity-0 group-hover:opacity-100 bg-gradient-to-r from-transparent via-white/10 to-transparent'
                    }`}></div>
                  </div>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-[#00467F] text-white rounded-md hover:bg-[#00365c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
          )}
          </div>
        </div>
      </div>
    </div>
  );
}