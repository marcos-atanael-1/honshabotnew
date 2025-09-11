export interface ConversionProgress {
  stage: 'loading' | 'processing' | 'complete' | 'error';
  progress: number;
  message: string;
}

export class AudioConverter {
  private onProgress?: (progress: ConversionProgress) => void;

  constructor(onProgress?: (progress: ConversionProgress) => void) {
    this.onProgress = onProgress;
  }

  private updateProgress(stage: ConversionProgress['stage'], progress: number, message: string) {
    if (this.onProgress) {
      this.onProgress({ stage, progress, message });
    }
  }

  async convertVideoToAudio(videoFile: File, options: {
    format?: 'mp3' | 'wav',
    quality?: 'low' | 'medium' | 'high',
    maxSizeMB?: number
  } = {}): Promise<File> {
    const {
      format = 'mp3',
      quality = 'medium',
      maxSizeMB
    } = options;

    return new Promise((resolve, reject) => {
      try {
        this.updateProgress('loading', 0, 'Carregando vídeo...');

        const video = document.createElement('video') as HTMLVideoElement & { 
          captureStream?: () => MediaStream;
          mozCaptureStream?: () => MediaStream;
        };
        
        video.src = URL.createObjectURL(videoFile);
        video.crossOrigin = 'anonymous';
        video.muted = false; // Importante: não silenciar para capturar áudio
        video.volume = 1.0;

        video.onloadedmetadata = async () => {
          try {
            this.updateProgress('processing', 10, 'Processando áudio...');

            // Aguardar o vídeo estar pronto para reprodução
            await new Promise((resolve) => {
              video.oncanplaythrough = resolve;
              if (video.readyState >= 4) resolve(null);
            });

            // Criar stream de áudio usando captureStream
            let stream: MediaStream;
            
            if (video.captureStream) {
              stream = video.captureStream();
            } else if (video.mozCaptureStream) {
              stream = video.mozCaptureStream();
            } else {
              throw new Error('Captura de stream não suportada neste navegador');
            }

            // Filtrar apenas as faixas de áudio
            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length === 0) {
              throw new Error('Nenhuma faixa de áudio encontrada no vídeo');
            }

            // Criar novo stream apenas com áudio
            const audioStream = new MediaStream(audioTracks);

            // Configurar MediaRecorder com o stream de áudio
            const mimeType = this.getSupportedMimeType(format);
            const mediaRecorder = new MediaRecorder(audioStream, {
              mimeType,
              audioBitsPerSecond: quality === 'high' ? 320000 : quality === 'medium' ? 128000 : 64000
            });

            const chunks: Blob[] = [];

            mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0) {
                chunks.push(event.data);
              }
            };

            mediaRecorder.onstop = () => {
              this.updateProgress('processing', 80, 'Finalizando conversão...');

              const audioBlob = new Blob(chunks, { 
                type: mimeType
              });

              // Criar arquivo final
              const fileName = videoFile.name.replace(/\.[^/.]+$/, `.${format}`);
              const audioFile = new File([audioBlob], fileName, {
                type: audioBlob.type,
                lastModified: Date.now()
              });

              // Verificar tamanho se especificado
              if (maxSizeMB && audioFile.size > maxSizeMB * 1024 * 1024) {
                this.updateProgress('error', 0, `Arquivo ainda muito grande (${(audioFile.size / 1024 / 1024).toFixed(1)}MB). Tente qualidade menor.`);
                reject(new Error(`Arquivo convertido ainda excede ${maxSizeMB}MB`));
                return;
              }

              this.updateProgress('complete', 100, `Conversão concluída! Tamanho: ${(audioFile.size / 1024 / 1024).toFixed(1)}MB`);
              
              // Cleanup
              URL.revokeObjectURL(video.src);
              audioStream.getTracks().forEach(track => track.stop());
              
              resolve(audioFile);
            };

            mediaRecorder.onerror = () => {
              this.updateProgress('error', 0, 'Erro durante a conversão');
              reject(new Error('Erro na gravação do áudio'));
            };

            // Configurar progresso baseado na duração
            video.ontimeupdate = () => {
              if (video.duration) {
                const progress = Math.min(10 + (video.currentTime / video.duration) * 60, 70);
                this.updateProgress('processing', progress, 'Extraindo áudio...');
              }
            };

            // Iniciar gravação
            mediaRecorder.start(1000); // Capturar dados a cada 1 segundo

            // Reproduzir vídeo (necessário para capturar áudio)
            await video.play();

            // Parar quando o vídeo terminar
            video.onended = () => {
              mediaRecorder.stop();
            };

          } catch (error) {
            this.updateProgress('error', 0, 'Erro no processamento');
            reject(error);
          }
        };

        video.onerror = () => {
          this.updateProgress('error', 0, 'Erro ao carregar o vídeo');
          reject(new Error('Erro ao carregar o arquivo de vídeo'));
        };

      } catch (error) {
        this.updateProgress('error', 0, 'Erro na conversão');
        reject(error);
      }
    });
  }

  private getSupportedMimeType(format: 'mp3' | 'wav'): string {
    // Verificar suporte do navegador para o formato desejado
    const mimeTypes = {
      mp3: ['audio/mpeg', 'audio/mp3'],
      wav: ['audio/wav', 'audio/wave', 'audio/x-wav']
    };

    // Tentar o formato solicitado primeiro
    for (const mimeType of mimeTypes[format]) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }

    // Fallbacks em ordem de preferência
    const fallbacks = [
      'audio/webm;codecs=opus',
      'audio/ogg;codecs=opus', 
      'audio/mp4',
      'audio/webm'
    ];

    for (const mimeType of fallbacks) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }

    // Último recurso
    return 'audio/webm';
  }

  // Método estático para verificar se a conversão é suportada
  static isSupported(): boolean {
    return !!(window.MediaRecorder && window.AudioContext);
  }

  // Método para estimar redução de tamanho
  static estimateAudioSize(videoFile: File): { estimatedSizeMB: number, reductionPercent: number } {
    // Estimativa baseada em dados típicos
    // Vídeo: ~8-12 Mbps, Áudio: ~128-320 kbps
    const videoSizeMB = videoFile.size / (1024 * 1024);
    const estimatedAudioSizeMB = videoSizeMB * 0.1; // ~10% do tamanho original
    const reductionPercent = ((videoSizeMB - estimatedAudioSizeMB) / videoSizeMB) * 100;

    return {
      estimatedSizeMB: Math.max(estimatedAudioSizeMB, 0.5), // Mínimo 0.5MB
      reductionPercent: Math.min(reductionPercent, 95) // Máximo 95%
    };
  }
}

export const audioConverter = new AudioConverter(); 