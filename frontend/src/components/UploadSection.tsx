import React, { useState, useRef } from 'react';
import { Upload, Video, Music, Type, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { transcriptionService } from '../lib/transcription';
import toast from 'react-hot-toast';

interface UploadSectionProps {
  processoId: string;
  tipoTranscricao: string;
  onUploadSuccess: () => void;
  colorScheme: 'amber' | 'emerald';
}

export function UploadSection({ processoId, tipoTranscricao, onUploadSuccess, colorScheme }: UploadSectionProps) {
  const [entryType, setEntryType] = useState<'audio_video' | 'document' | 'text'>('audio_video');
  const [textContent, setTextContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getColorClasses = () => {
    if (colorScheme === 'amber') {
      return {
        bg: 'from-amber-50 to-white',
        border: 'border-amber-200',
        text: 'text-amber-600',
        button: 'bg-amber-100 text-amber-700 hover:bg-amber-200',
        activeButton: 'bg-amber-500 text-white',
        uploadArea: 'border-amber-300 hover:border-amber-400'
      };
    } else {
      return {
        bg: 'from-emerald-50 to-white',
        border: 'border-emerald-200',
        text: 'text-emerald-600',
        button: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
        activeButton: 'bg-emerald-500 text-white',
        uploadArea: 'border-emerald-300 hover:border-emerald-400'
      };
    }
  };

  const colors = getColorClasses();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const uploadFile = async (file: File, processoId: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${processoId}/${fileName}`;

    // Upload file to storage
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
    
    if (entryType === 'text' && !textContent.trim()) {
      toast.error('Por favor, insira o conteúdo do texto.');
      return;
    }
    
    if ((entryType === 'audio_video' || entryType === 'document') && !selectedFile) {
      toast.error('Por favor, selecione um arquivo.');
      return;
    }

    setUploading(true);
    
    try {
      let transcricaoId: string;
      
      if (entryType === 'text') {
        // Create transcription record directly for text
        const { data: transcricaoData, error: transcricaoError } = await supabase
          .from('transcricoes')
          .insert([
            {
              processo_id: processoId,
              conteudo: textContent,
              status: 'Em Andamento',
              tipo_transcricao: tipoTranscricao,
            },
          ])
          .select()
          .single();

        if (transcricaoError) throw transcricaoError;
        transcricaoId = transcricaoData.id;
      } else {
        // Upload file and start transcription process
        const filePath = await uploadFile(selectedFile!, processoId);
        
        // Start transcription process - backend will create the transcription record
        try {
          const orderId = await transcriptionService.startTranscription(selectedFile!, processoId, tipoTranscricao);
          console.log('Transcrição iniciada com order_id:', orderId);
        } catch (error) {
          console.error('Erro ao iniciar transcrição:', error);
          throw error;
        }
      }

      toast.success(`${tipoTranscricao} ${entryType === 'text' ? 'criado' : 'enviado'} com sucesso!`);
      
      // Reset form
      setTextContent('');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Call success callback
      onUploadSuccess();
      
    } catch (error) {
      console.error('Erro ao processar:', error);
      toast.error('Erro ao processar. Tente novamente.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`bg-gradient-to-br ${colors.bg} rounded-xl p-6 border ${colors.border} shadow-sm`}>
      <div className="space-y-6">
        <div className="text-center">
          <h4 className={`text-lg font-semibold ${colors.text} mb-2`}>
            Adicionar {tipoTranscricao}
          </h4>
          <p className="text-gray-600 text-sm">
            Escolha como deseja adicionar o conteúdo para {tipoTranscricao.toLowerCase()}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Entry Type Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Tipo de Entrada
            </label>
            <div className="grid grid-cols-3 gap-3">
              <label className="cursor-pointer">
                <input
                  type="radio"
                  name="entryType"
                  value="audio_video"
                  checked={entryType === 'audio_video'}
                  onChange={(e) => setEntryType(e.target.value as 'audio_video')}
                  className="sr-only"
                />
                <div className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
                  entryType === 'audio_video'
                    ? `${colors.activeButton} border-transparent`
                    : `bg-white ${colors.button} border-gray-200 hover:border-gray-300`
                }`}>
                  <Video className="h-6 w-6 mb-2" />
                  <span className="text-sm font-medium">Áudio/Vídeo</span>
                </div>
              </label>

              <label className="cursor-pointer">
                <input
                  type="radio"
                  name="entryType"
                  value="document"
                  checked={entryType === 'document'}
                  onChange={(e) => setEntryType(e.target.value as 'document')}
                  className="sr-only"
                />
                <div className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
                  entryType === 'document'
                    ? `${colors.activeButton} border-transparent`
                    : `bg-white ${colors.button} border-gray-200 hover:border-gray-300`
                }`}>
                  <FileText className="h-6 w-6 mb-2" />
                  <span className="text-sm font-medium">Documento</span>
                </div>
              </label>

              <label className="cursor-pointer">
                <input
                  type="radio"
                  name="entryType"
                  value="text"
                  checked={entryType === 'text'}
                  onChange={(e) => setEntryType(e.target.value as 'text')}
                  className="sr-only"
                />
                <div className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
                  entryType === 'text'
                    ? `${colors.activeButton} border-transparent`
                    : `bg-white ${colors.button} border-gray-200 hover:border-gray-300`
                }`}>
                  <Type className="h-6 w-6 mb-2" />
                  <span className="text-sm font-medium">Texto</span>
                </div>
              </label>
            </div>
          </div>

          {/* Text Input */}
          {entryType === 'text' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Conteúdo do Texto
              </label>
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Digite ou cole o conteúdo aqui..."
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>
          )}

          {/* File Upload */}
          {(entryType === 'audio_video' || entryType === 'document') && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {entryType === 'audio_video' ? 'Arquivo de Áudio/Vídeo' : 'Documento'}
              </label>
              <div className={`border-2 border-dashed ${colors.uploadArea} rounded-lg p-6 text-center transition-colors`}>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  accept={entryType === 'audio_video' ? 'audio/*,video/*' : '.pdf,.doc,.docx,.txt'}
                  className="sr-only"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <div className="space-y-2">
                    <Upload className={`h-8 w-8 mx-auto ${colors.text}`} />
                    <div>
                      <span className={`text-sm font-medium ${colors.text}`}>
                        {selectedFile ? selectedFile.name : 'Clique para selecionar arquivo'}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        {entryType === 'audio_video' 
                          ? 'Formatos suportados: MP3, MP4, WAV, MOV, AVI'
                          : 'Formatos suportados: PDF, DOC, DOCX, TXT'
                        }
                      </p>
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={uploading}
              className="px-6 py-2 bg-[#00467F] text-white rounded-md hover:bg-[#00365c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {uploading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Upload className="h-4 w-4" />
              )}
              <span>
                {uploading 
                  ? 'Processando...' 
                  : entryType === 'text' 
                    ? 'Salvar Texto' 
                    : 'Enviar Arquivo'
                }
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}