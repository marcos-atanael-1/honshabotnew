import { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  ConnectionMode,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Processo, Analise, supabase } from '../lib/supabase';
import { transcriptionService } from '../lib/transcription';
import { Clock, CheckCircle, XCircle, AlertCircle, Download, RefreshCw, Trash2, Square, Diamond, Circle, Save, Edit3, ChevronDown, FileImage, FileText, Zap, Maximize2, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import { nodeTypes } from './FlowNodes';
import { FullscreenFlowModal } from './FullscreenFlowModal';
import { UploadSection } from './UploadSection';

interface Transcricao {
  id: string;
  processo_id: string;
  conteudo: string;
  status: 'processando' | 'concluido' | 'erro' | 'Em Andamento';
  tempo_processamento?: number;
  external_id?: string;
  created_at: string;
  updated_at: string;
  dropbox_url?: string;
  order_id?: number;
  tipo_transcricao?: string;
  dropbox_filename?: string;
}

interface AnaliseFluxo {
  id: number;
  processo_id: string;
  transcricao_id: string;
  estado: string;
  seq: number;
  responsavel_area: string;
  etapa_descricao: string;
  desvios_variacoes: string[];
  problemas: string[];
  causas_possiveis: string[];
  kaizen_discutido: string;
  kaizen_alternativo_boas_praticas: string[];
  referencia_acordada: string;
  timestamp_inicio: string;
  timestamp_fim: string;
  evidencia_texto: string;
  created_at: string;
}

interface ProcessoVisualizacaoProps {
  processo: Processo;
  analise: Analise | null;
  onStatusUpdate: () => void;
  onDelete?: () => void;
}

export function ProcessoVisualizacao({ processo, analise, onStatusUpdate, onDelete }: ProcessoVisualizacaoProps) {
  const [activeTab, setActiveTab] = useState<'analise_inicial' | 'estado_atual' | 'estado_futuro'>('analise_inicial');
  const [activeSubTab, setActiveSubTab] = useState<'transcricao' | 'tabela'>('transcricao');
  const [transcricao, setTranscricao] = useState<Transcricao | null>(null);
  const [loadingTranscricao, setLoadingTranscricao] = useState(false);
  const [transcricaoEstadoAtual, setTranscricaoEstadoAtual] = useState<Transcricao | null>(null);
  const [loadingTranscricaoEstadoAtual, setLoadingTranscricaoEstadoAtual] = useState(false);
  const [transcricaoEstadoFuturo, setTranscricaoEstadoFuturo] = useState<Transcricao | null>(null);
  const [loadingTranscricaoEstadoFuturo, setLoadingTranscricaoEstadoFuturo] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [analiseFluxoData, setAnaliseFluxoData] = useState<AnaliseFluxo[]>([]);
  const [loadingAnaliseFluxo, setLoadingAnaliseFluxo] = useState(false);
  const [analiseFluxoEstadoAtualData, setAnaliseFluxoEstadoAtualData] = useState<AnaliseFluxo[]>([]);
  const [loadingAnaliseFluxoEstadoAtual, setLoadingAnaliseFluxoEstadoAtual] = useState(false);
  const [analiseFluxoEstadoFuturoData, setAnaliseFluxoEstadoFuturoData] = useState<AnaliseFluxo[]>([]);
  const [loadingAnaliseFluxoEstadoFuturo, setLoadingAnaliseFluxoEstadoFuturo] = useState(false);
  
  // Estado local para análise (permite atualizações sem depender do componente pai)
  const [localAnalise, setLocalAnalise] = useState<Analise | null>(analise);
  
  // Estados para edição de fluxos
  const [isEditingOriginal, setIsEditingOriginal] = useState(false);
  const [isEditingImproved, setIsEditingImproved] = useState(false);
  const [nodeIdCounter, setNodeIdCounter] = useState(1);
  const [saving, setSaving] = useState(false);
  
  // Estados para exportação
  const [showExportDropdown, setShowExportDropdown] = useState<'original' | 'improved' | 'sugestoes' | null>(null);
  const [exporting, setExporting] = useState(false);
  
  // Estado para geração de análise
  const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false);
  
  // Estados para modal de tela cheia
  const [fullscreenModal, setFullscreenModal] = useState<{
    isOpen: boolean;
    type: 'original' | 'improved';
  }>({ isOpen: false, type: 'original' });

  // Sincronizar análise local com prop
  useEffect(() => {
    setLocalAnalise(analise);
  }, [analise]);



  // Função para buscar dados da análise de fluxo
  const fetchAnaliseFluxo = async () => {
    console.log('🚀 fetchAnaliseFluxo INICIADA');
    console.log('  - Timestamp:', new Date().toISOString());
    console.log('  - processo.id:', processo.id);
    console.log('  - processo:', processo);
    console.log('  - transcricao:', transcricao);
    
    if (!transcricao) {
      console.log('❌ fetchAnaliseFluxo: Não há transcrição disponível');
      return;
    }
    
    setLoadingAnaliseFluxo(true);
    try {
      // Primeiro, vamos testar uma query simples para ver se a tabela existe
      console.log('🧪 Testando acesso à tabela analise_fluxo...');
      const { data: testData, error: testError } = await supabase
        .from('analise_fluxo')
        .select('id')
        .limit(1);
      
      console.log('🧪 Teste de acesso:', { testData, testError });
      
      if (testError) {
        console.error('❌ Erro ao acessar tabela analise_fluxo:', testError);
        toast.error('Erro ao acessar tabela de análise de fluxo');
        return;
      }
      
      // Agora vamos buscar todos os dados da tabela para debug
      console.log('📋 Buscando todos os dados da tabela...');
      const { data: allData, error: allError } = await supabase
        .from('analise_fluxo')
        .select('*');
      
      console.log('📋 Todos os dados:', allData);
      console.log('📋 Total de registros na tabela:', allData?.length || 0);
      
      // Buscar dados específicos do processo
      console.log('🎯 Buscando dados do processo_id:', processo.id);
      const { data: processoData, error: processoError } = await supabase
        .from('analise_fluxo')
        .select('*')
        .eq('processo_id', processo.id);
      
      console.log('🎯 Dados do processo:', processoData);
      console.log('🎯 Erro do processo:', processoError);
      
      // Query original com filtros
      console.log('🔍 Query original com filtros:');
      console.log('  - processo_id:', processo.id);
      console.log('  - transcricao_id:', transcricao.id);
      
      const { data, error } = await supabase
        .from('analise_fluxo')
        .select('*')
        .eq('processo_id', processo.id)
        .eq('transcricao_id', transcricao.id)
        .order('seq', { ascending: true });
      
      console.log('📊 Resultado da query filtrada:');
      console.log('  - data:', data);
      console.log('  - error:', error);
      console.log('  - data.length:', data?.length || 0);
      
      if (error) {
        console.error('❌ Erro ao buscar análise de fluxo:', error);
        toast.error('Erro ao carregar dados da análise de fluxo');
        return;
      }
      
      setAnaliseFluxoData(data || []);
      console.log('✅ fetchAnaliseFluxo: Dados carregados:', data?.length || 0, 'registros');
    } catch (error) {
      console.error('❌ Erro geral:', error);
      toast.error('Erro ao carregar dados da análise de fluxo');
    } finally {
      setLoadingAnaliseFluxo(false);
    }
  };

  // Função para buscar dados da análise de fluxo do Estado Atual
  const fetchAnaliseFluxoEstadoAtual = async () => {
    if (!transcricaoEstadoAtual) return;
    
    setLoadingAnaliseFluxoEstadoAtual(true);
    try {
      const { data, error } = await supabase
        .from('analise_fluxo')
        .select('*')
        .eq('processo_id', processo.id)
        .eq('transcricao_id', transcricaoEstadoAtual.id)
        .eq('estado', 'Estado Atual (AS IS)')
        .order('seq', { ascending: true });
      
      if (error) {
        console.error('Erro ao buscar análise de fluxo do Estado Atual:', error);
        toast.error('Erro ao carregar dados da análise de fluxo do Estado Atual');
        return;
      }
      
      setAnaliseFluxoEstadoAtualData(data || []);
    } catch (error) {
      console.error('Erro ao buscar análise de fluxo do Estado Atual:', error);
      toast.error('Erro ao carregar dados da análise de fluxo do Estado Atual');
    } finally {
      setLoadingAnaliseFluxoEstadoAtual(false);
    }
  };

  // Função para buscar dados da análise de fluxo do Estado Futuro
  const fetchAnaliseFluxoEstadoFuturo = async () => {
    if (!transcricaoEstadoFuturo) return;
    
    setLoadingAnaliseFluxoEstadoFuturo(true);
    try {
      const { data, error } = await supabase
        .from('analise_fluxo')
        .select('*')
        .eq('processo_id', processo.id)
        .eq('transcricao_id', transcricaoEstadoFuturo.id)
        .eq('estado', 'Estado Futuro (TO BE)')
        .order('seq', { ascending: true });
      
      if (error) {
        console.error('Erro ao buscar análise de fluxo do Estado Futuro:', error);
        toast.error('Erro ao carregar dados da análise de fluxo do Estado Futuro');
        return;
      }
      
      setAnaliseFluxoEstadoFuturoData(data || []);
    } catch (error) {
      console.error('Erro ao buscar análise de fluxo do Estado Futuro:', error);
      toast.error('Erro ao carregar dados da análise de fluxo do Estado Futuro');
    } finally {
      setLoadingAnaliseFluxoEstadoFuturo(false);
    }
  };

  // Função para exportar dados para Excel
  const exportToExcel = async () => {
    if (analiseFluxoData.length === 0) {
      toast.error('Não há dados da tabela para exportar');
      return;
    }
    
    setExporting(true);
    try {
      // Importar XLSX dinamicamente
      const XLSX = await import('xlsx');
      
      const workbook = XLSX.utils.book_new();
      
      // Cabeçalhos exatamente como na visualização web
      const headers = [
        'Sequência', 'Responsável/Área', 'Descrição do Subprocesso',
        'Referência Acordada', 'Tempo Transcrição', 'Desvios', 'Problemas', 'Kaizen Sugerido'
      ];

      // Função auxiliar para calcular tempo de transcrição
      const calcularTempoTranscricao = (timestampInicio: string, timestampFim: string) => {
        if (!timestampInicio || !timestampFim) return '-';
        
        try {
          const inicio = new Date(timestampInicio);
          const fim = new Date(timestampFim);
          const diffMs = fim.getTime() - inicio.getTime();
          
          if (diffMs < 0) return '-';
          
          const diffMinutes = Math.floor(diffMs / (1000 * 60));
          const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);
          
          if (diffMinutes > 0) {
            return `${diffMinutes}m ${diffSeconds}s`;
          } else {
            return `${diffSeconds}s`;
          }
        } catch (error) {
          return '-';
        }
      };

      // Função auxiliar para processar dados
      const processarDados = (dados: AnaliseFluxo[]) => {
        return dados.map(item => {
          const tempoTranscricao = calcularTempoTranscricao(item.timestamp_inicio, item.timestamp_fim);
          const desvios = Array.isArray(item.desvios_variacoes) && item.desvios_variacoes.length > 0 
            ? item.desvios_variacoes.join(', ') : '-';
          const problemas = Array.isArray(item.problemas) && item.problemas.length > 0 
            ? item.problemas.join(', ') : '-';
          const kaizenValue = item.kaizen_discutido || 
            (Array.isArray(item.kaizen_alternativo_boas_praticas) && item.kaizen_alternativo_boas_praticas.length > 0 
              ? item.kaizen_alternativo_boas_praticas.join(', ') 
              : '-');
          
          return [
            item.seq,
            item.responsavel_area || '-',
            item.etapa_descricao || '-',
            item.referencia_acordada || '-',
            tempoTranscricao,
            desvios,
            problemas,
            kaizenValue
          ];
        });
      };

      // Processar dados da Análise Inicial
      const dadosAnaliseInicial = processarDados(analiseFluxoData);
      const wsAnaliseInicial = XLSX.utils.aoa_to_sheet([headers, ...dadosAnaliseInicial]);
      XLSX.utils.book_append_sheet(workbook, wsAnaliseInicial, 'Análise Inicial');

      // Salvar arquivo
      const nomeArquivo = `analise_inicial_${processo.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, nomeArquivo);
      
      toast.success('Dados exportados com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast.error('Erro ao exportar dados');
    } finally {
      setExporting(false);
    }
  };

  // Função para exportar todos os dados em um único arquivo Excel
  const exportToExcelAll = async () => {
    setExporting(true);
    try {
      // Importar XLSX dinamicamente
      const XLSX = await import('xlsx');
      
      const workbook = XLSX.utils.book_new();
      
      // Cabeçalhos
      const headers = [
        'Sequência', 'Responsável/Área', 'Descrição do Subprocesso',
        'Referência Acordada', 'Tempo Transcrição', 'Desvios', 'Problemas', 'Kaizen Sugerido'
      ];

      // Função auxiliar para calcular tempo de transcrição
      const calcularTempoTranscricao = (timestampInicio: string, timestampFim: string) => {
        if (!timestampInicio || !timestampFim) return '-';
        
        try {
          const inicio = new Date(timestampInicio);
          const fim = new Date(timestampFim);
          const diffMs = fim.getTime() - inicio.getTime();
          
          if (diffMs < 0) return '-';
          
          const diffMinutes = Math.floor(diffMs / (1000 * 60));
          const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);
          
          if (diffMinutes > 0) {
            return `${diffMinutes}m ${diffSeconds}s`;
          } else {
            return `${diffSeconds}s`;
          }
        } catch (error) {
          return '-';
        }
      };

      // Função auxiliar para processar dados
      const processarDados = (dados: AnaliseFluxo[]) => {
        return dados.map(item => {
          const tempoTranscricao = calcularTempoTranscricao(item.timestamp_inicio, item.timestamp_fim);
          const desvios = Array.isArray(item.desvios_variacoes) && item.desvios_variacoes.length > 0 
            ? item.desvios_variacoes.join(', ') : '-';
          const problemas = Array.isArray(item.problemas) && item.problemas.length > 0 
            ? item.problemas.join(', ') : '-';
          const kaizenValue = item.kaizen_discutido || 
            (Array.isArray(item.kaizen_alternativo_boas_praticas) && item.kaizen_alternativo_boas_praticas.length > 0 
              ? item.kaizen_alternativo_boas_praticas.join(', ') 
              : '-');
          
          return [
            item.seq,
            item.responsavel_area || '-',
            item.etapa_descricao || '-',
            item.referencia_acordada || '-',
            tempoTranscricao,
            desvios,
            problemas,
            kaizenValue
          ];
        });
      };

      // Adicionar aba da Análise Inicial se houver dados
      if (analiseFluxoData.length > 0) {
        const dadosAnaliseInicial = processarDados(analiseFluxoData);
        const wsAnaliseInicial = XLSX.utils.aoa_to_sheet([headers, ...dadosAnaliseInicial]);
        XLSX.utils.book_append_sheet(workbook, wsAnaliseInicial, 'Análise Inicial');
      }

      // Adicionar aba do Estado Atual se houver dados
      if (analiseFluxoEstadoAtualData.length > 0) {
        const dadosEstadoAtual = processarDados(analiseFluxoEstadoAtualData);
        const wsEstadoAtual = XLSX.utils.aoa_to_sheet([headers, ...dadosEstadoAtual]);
        XLSX.utils.book_append_sheet(workbook, wsEstadoAtual, 'Estado Atual');
      }

      // Adicionar aba do Estado Futuro se houver dados
      if (analiseFluxoEstadoFuturoData.length > 0) {
        const dadosEstadoFuturo = processarDados(analiseFluxoEstadoFuturoData);
        const wsEstadoFuturo = XLSX.utils.aoa_to_sheet([headers, ...dadosEstadoFuturo]);
        XLSX.utils.book_append_sheet(workbook, wsEstadoFuturo, 'Estado Futuro');
      }

      // Verificar se há pelo menos uma aba com dados
      if (workbook.SheetNames.length === 0) {
        toast.error('Não há dados para exportar em nenhuma das abas');
        return;
      }

      // Salvar arquivo
      const nomeArquivo = `analise_completa_${processo.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, nomeArquivo);
      
      toast.success(`Dados exportados com sucesso! ${workbook.SheetNames.length} aba(s) incluída(s).`);
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast.error('Erro ao exportar dados');
    } finally {
      setExporting(false);
    }
  };

  // Função para exportar apenas a tabela da Análise Inicial
  const exportAnaliseInicialToExcel = async () => {
    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();

      const headers = [
        'Sequência', 'Responsável/Área', 'Descrição do Subprocesso',
        'Referência Acordada', 'Tempo Transcrição', 'Desvios', 'Problemas', 'Kaizen Sugerido'
      ];

      if (analiseFluxoData.length === 0) {
        toast.error('Não há dados da Análise Inicial para exportar');
        return;
      }

      // Função auxiliar para calcular tempo de transcrição
      const calcularTempoTranscricao = (timestampInicio: string, timestampFim: string) => {
        if (!timestampInicio || !timestampFim) return '-';
        
        try {
          const inicio = new Date(timestampInicio);
          const fim = new Date(timestampFim);
          const diffMs = fim.getTime() - inicio.getTime();
          
          if (diffMs < 0) return '-';
          
          const diffMinutes = Math.floor(diffMs / (1000 * 60));
          const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);
          
          if (diffMinutes > 0) {
            return `${diffMinutes}m ${diffSeconds}s`;
          } else {
            return `${diffSeconds}s`;
          }
        } catch (error) {
          return '-';
        }
      };

      // Função auxiliar para processar dados
      const processarDados = (dados: AnaliseFluxo[]) => {
        return dados.map(item => {
          const tempoTranscricao = calcularTempoTranscricao(item.timestamp_inicio, item.timestamp_fim);
          const desvios = Array.isArray(item.desvios_variacoes) && item.desvios_variacoes.length > 0 
            ? item.desvios_variacoes.join(', ') : '-';
          const problemas = Array.isArray(item.problemas) && item.problemas.length > 0 
            ? item.problemas.join(', ') : '-';
          const kaizenValue = item.kaizen_discutido || 
            (Array.isArray(item.kaizen_alternativo_boas_praticas) && item.kaizen_alternativo_boas_praticas.length > 0 
              ? item.kaizen_alternativo_boas_praticas.join(', ') 
              : '-');
          
          return [
            item.seq,
            item.responsavel_area || '-',
            item.etapa_descricao || '-',
            item.referencia_acordada || '-',
            tempoTranscricao,
            desvios,
            problemas,
            kaizenValue
          ];
        });
      };

      const dadosAnaliseInicial = processarDados(analiseFluxoData);
      const wsAnaliseInicial = XLSX.utils.aoa_to_sheet([headers, ...dadosAnaliseInicial]);
      XLSX.utils.book_append_sheet(workbook, wsAnaliseInicial, 'Análise Inicial');

      const nomeArquivo = `analise_inicial_${processo.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, nomeArquivo);
      
      toast.success('Tabela da Análise Inicial exportada com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast.error('Erro ao exportar dados');
    } finally {
      setExporting(false);
    }
  };

  // Função para exportar apenas a tabela do Estado Atual
  const exportEstadoAtualToExcel = async () => {
    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();

      const headers = [
        'Sequência', 'Responsável/Área', 'Descrição do Subprocesso',
        'Referência Acordada', 'Tempo Transcrição', 'Desvios', 'Problemas', 'Kaizen Sugerido'
      ];

      if (analiseFluxoEstadoAtualData.length === 0) {
        toast.error('Não há dados do Estado Atual para exportar');
        return;
      }

      // Função auxiliar para calcular tempo de transcrição
      const calcularTempoTranscricao = (timestampInicio: string, timestampFim: string) => {
        if (!timestampInicio || !timestampFim) return '-';
        
        try {
          const inicio = new Date(timestampInicio);
          const fim = new Date(timestampFim);
          const diffMs = fim.getTime() - inicio.getTime();
          
          if (diffMs < 0) return '-';
          
          const diffMinutes = Math.floor(diffMs / (1000 * 60));
          const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);
          
          if (diffMinutes > 0) {
            return `${diffMinutes}m ${diffSeconds}s`;
          } else {
            return `${diffSeconds}s`;
          }
        } catch (error) {
          return '-';
        }
      };

      // Função auxiliar para processar dados
      const processarDados = (dados: AnaliseFluxo[]) => {
        return dados.map(item => {
          const tempoTranscricao = calcularTempoTranscricao(item.timestamp_inicio, item.timestamp_fim);
          const desvios = Array.isArray(item.desvios_variacoes) && item.desvios_variacoes.length > 0 
            ? item.desvios_variacoes.join(', ') : '-';
          const problemas = Array.isArray(item.problemas) && item.problemas.length > 0 
            ? item.problemas.join(', ') : '-';
          const kaizenValue = item.kaizen_discutido || 
            (Array.isArray(item.kaizen_alternativo_boas_praticas) && item.kaizen_alternativo_boas_praticas.length > 0 
              ? item.kaizen_alternativo_boas_praticas.join(', ') 
              : '-');
          
          return [
            item.seq,
            item.responsavel_area || '-',
            item.etapa_descricao || '-',
            item.referencia_acordada || '-',
            tempoTranscricao,
            desvios,
            problemas,
            kaizenValue
          ];
        });
      };

      const dadosEstadoAtual = processarDados(analiseFluxoEstadoAtualData);
      const wsEstadoAtual = XLSX.utils.aoa_to_sheet([headers, ...dadosEstadoAtual]);
      XLSX.utils.book_append_sheet(workbook, wsEstadoAtual, 'Estado Atual');

      const nomeArquivo = `estado_atual_${processo.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, nomeArquivo);
      
      toast.success('Tabela do Estado Atual exportada com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast.error('Erro ao exportar dados');
    } finally {
      setExporting(false);
    }
  };

  // Função para exportar apenas a tabela do Estado Futuro
  const exportEstadoFuturoToExcel = async () => {
    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();

      const headers = [
        'Sequência', 'Responsável/Área', 'Descrição do Subprocesso',
        'Referência Acordada', 'Tempo Transcrição', 'Desvios', 'Problemas', 'Kaizen Sugerido'
      ];

      if (analiseFluxoEstadoFuturoData.length === 0) {
        toast.error('Não há dados do Estado Futuro para exportar');
        return;
      }

      // Função auxiliar para calcular tempo de transcrição
      const calcularTempoTranscricao = (timestampInicio: string, timestampFim: string) => {
        if (!timestampInicio || !timestampFim) return '-';
        
        try {
          const inicio = new Date(timestampInicio);
          const fim = new Date(timestampFim);
          const diffMs = fim.getTime() - inicio.getTime();
          
          if (diffMs < 0) return '-';
          
          const diffMinutes = Math.floor(diffMs / (1000 * 60));
          const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);
          
          if (diffMinutes > 0) {
            return `${diffMinutes}m ${diffSeconds}s`;
          } else {
            return `${diffSeconds}s`;
          }
        } catch (error) {
          return '-';
        }
      };

      // Função auxiliar para processar dados
      const processarDados = (dados: AnaliseFluxo[]) => {
        return dados.map(item => {
          const tempoTranscricao = calcularTempoTranscricao(item.timestamp_inicio, item.timestamp_fim);
          const desvios = Array.isArray(item.desvios_variacoes) && item.desvios_variacoes.length > 0 
            ? item.desvios_variacoes.join(', ') : '-';
          const problemas = Array.isArray(item.problemas) && item.problemas.length > 0 
            ? item.problemas.join(', ') : '-';
          const kaizenValue = item.kaizen_discutido || 
            (Array.isArray(item.kaizen_alternativo_boas_praticas) && item.kaizen_alternativo_boas_praticas.length > 0 
              ? item.kaizen_alternativo_boas_praticas.join(', ') 
              : '-');
          
          return [
            item.seq,
            item.responsavel_area || '-',
            item.etapa_descricao || '-',
            item.referencia_acordada || '-',
            tempoTranscricao,
            desvios,
            problemas,
            kaizenValue
          ];
        });
      };

      const dadosEstadoFuturo = processarDados(analiseFluxoEstadoFuturoData);
      const wsEstadoFuturo = XLSX.utils.aoa_to_sheet([headers, ...dadosEstadoFuturo]);
      XLSX.utils.book_append_sheet(workbook, wsEstadoFuturo, 'Estado Futuro');

      const nomeArquivo = `estado_futuro_${processo.nome.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, nomeArquivo);
      
      toast.success('Tabela do Estado Futuro exportada com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast.error('Erro ao exportar dados');
    } finally {
      setExporting(false);
    }
  };

  // Buscar transcrição quando componente monta ou processo muda
  useEffect(() => {
    const fetchTranscricao = async () => {
      setLoadingTranscricao(true);
      try {
        console.log('Tipo de entrada do processo:', processo.tipo_entrada);
        
        // Para processos de áudio/vídeo, buscar na tabela transcricoes
        if (processo.tipo_entrada === 'audio' || processo.tipo_entrada === 'video' || processo.tipo_entrada === 'audio_video') {
          // Filtrar por tipo_transcricao de acordo com a aba ativa
          let tipoTranscricao = 'Analise Inicial';
          if (activeTab === 'estado_atual') tipoTranscricao = 'Estado Atual';
          if (activeTab === 'estado_futuro') tipoTranscricao = 'Estado Futuro';
          
          // Buscando transcrição do tipo especificado
          
          const { data, error } = await supabase
            .from('transcricoes')
            .select('*')
            .eq('processo_id', processo.id)
            .eq('tipo_transcricao', tipoTranscricao)
            .single();

          // Query executada para buscar transcrição

          if (!error && data) {
            // Transcrição encontrada
            setTranscricao(data);
            setLastUpdate(new Date());
          } else {
            // Nenhuma transcrição encontrada para este tipo
            setTranscricao(null);
          }
        } else if (processo.tipo_entrada === 'texto') {
          console.log('Processo do tipo texto, usando conteudo_texto do processo');
          // Verificar se já existe transcrição para este processo de texto
          const { data: existingTranscricao } = await supabase
            .from('transcricoes')
            .select('*')
            .eq('processo_id', processo.id)
            .single();
          
          let textoTranscricao: Transcricao;
          
          if (existingTranscricao) {
            textoTranscricao = existingTranscricao;
          } else {
            // Criar transcrição no banco para processos de texto
            const { data: newTranscricao, error: transcricaoError } = await supabase
              .from('transcricoes')
              .insert([{
                processo_id: processo.id,
                conteudo: processo.conteudo_texto || '',
                status: 'concluido',
                tipo_transcricao: 'texto'
              }])
              .select()
              .single();
            
            if (!transcricaoError && newTranscricao) {
              textoTranscricao = newTranscricao;
            } else {
              // Fallback para objeto mock se houver erro
              textoTranscricao = {
                id: `texto-${processo.id}`,
                processo_id: processo.id,
                conteudo: processo.conteudo_texto || '',
                status: 'concluido',
                created_at: processo.created_at,
                updated_at: processo.updated_at
              };
            }
          }
          
          setTranscricao(textoTranscricao);
          setLastUpdate(new Date());
          
          // Para processos de texto, verificar se existe análise e criar se necessário
          if (processo.status === 'processado' && !localAnalise && processo.conteudo_texto) {
            try {
              console.log('Gerando análise para processo de texto...');
              const analysis = await transcriptionService.generateAnalysisFromTranscription(processo.conteudo_texto);
              
              const { data: newAnalise, error: analiseError } = await supabase
                .from('analise_fluxo')
                .insert([{
                  processo_id: processo.id,
                  transcricao: processo.conteudo_texto,
                  ...analysis,
                }])
                .select()
                .single();

              if (!analiseError && newAnalise) {
                setLocalAnalise(newAnalise);
                
                // Criar dados de exemplo na tabela analise_fluxo para processos de texto
                try {
                  const analiseFluxoData = [
                    {
                      processo_id: processo.id,
                      transcricao_id: textoTranscricao.id,
                      estado: 'Análise Inicial',
                      seq: 1,
                      responsavel_area: 'Área Responsável',
                      etapa_descricao: 'Etapa do processo identificada no texto',
                      desvios_variacoes: ['Desvio identificado no processo'],
                      problemas: ['Problema encontrado na análise'],
                      causas_possiveis: ['Possível causa do problema'],
                      kaizen_discutido: 'Melhoria sugerida baseada no texto',
                      kaizen_alternativo_boas_praticas: ['Boa prática recomendada'],
                      referencia_acordada: 'Referência padrão',
                      timestamp_inicio: '00:00:00',
                      timestamp_fim: '00:01:00',
                      evidencia_texto: processo.conteudo_texto?.substring(0, 500) || 'Texto do processo'
                    }
                  ];
                  
                  await supabase
                    .from('analise_fluxo')
                    .insert(analiseFluxoData);
                  
                  console.log('✅ Dados de exemplo criados na tabela analise_fluxo para processo de texto');
                } catch (fluxoError) {
                  console.warn('⚠️ Erro ao criar dados na analise_fluxo:', fluxoError);
                }
                
                onStatusUpdate(); // Atualizar o componente pai
                console.log('✅ Análise criada com sucesso para processo de texto');
              }
            } catch (analysisError) {
              console.warn('⚠️ Erro ao gerar análise para processo de texto:', analysisError);
              // Criar análise básica em caso de erro
              try {
                const { data: basicAnalise, error: basicError } = await supabase
                  .from('analise_fluxo')
                  .insert([{
                    processo_id: processo.id,
                    transcricao: processo.conteudo_texto,
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
                    sugestoes_melhoria: ['Análise básica criada automaticamente para processo de texto'],
                  }])
                  .select()
                  .single();

                if (!basicError && basicAnalise) {
                  setLocalAnalise(basicAnalise);
                  
                  // Criar dados de exemplo na tabela analise_fluxo para processos de texto
                  try {
                    const analiseFluxoData = [
                      {
                        processo_id: processo.id,
                        transcricao_id: textoTranscricao.id,
                        estado: 'Análise Inicial',
                        seq: 1,
                        responsavel_area: 'Área Responsável',
                        etapa_descricao: 'Etapa do processo identificada no texto',
                        desvios_variacoes: ['Desvio identificado no processo'],
                        problemas: ['Problema encontrado na análise'],
                        causas_possiveis: ['Possível causa do problema'],
                        kaizen_discutido: 'Melhoria sugerida baseada no texto',
                        kaizen_alternativo_boas_praticas: ['Boa prática recomendada'],
                        referencia_acordada: 'Referência padrão',
                        timestamp_inicio: '00:00:00',
                        timestamp_fim: '00:01:00',
                        evidencia_texto: processo.conteudo_texto?.substring(0, 500) || 'Texto do processo'
                      }
                    ];
                    
                    await supabase
                      .from('analise_fluxo')
                      .insert(analiseFluxoData);
                    
                    console.log('✅ Dados de exemplo criados na tabela analise_fluxo para processo de texto');
                  } catch (fluxoError) {
                    console.warn('⚠️ Erro ao criar dados na analise_fluxo:', fluxoError);
                  }
                  onStatusUpdate();
                  console.log('✅ Análise básica criada para processo de texto');
                }
              } catch (basicAnalysisError) {
                console.error('❌ Erro ao criar análise básica:', basicAnalysisError);
              }
            }
          }
        } else {
          console.log('Tipo de entrada desconhecido:', processo.tipo_entrada);
          setTranscricao(null);
        }
      } catch (error) {
        console.error('Erro ao buscar transcrição:', error);
        setTranscricao(null);
      } finally {
        setLoadingTranscricao(false);
      }
    };

    fetchTranscricao();
  }, [processo.id, processo.tipo_entrada, processo.conteudo_texto, processo.status, localAnalise, activeTab, onStatusUpdate]);

  // Buscar transcrição do Estado Atual
  useEffect(() => {
    const fetchTranscricaoEstadoAtual = async () => {
      setLoadingTranscricaoEstadoAtual(true);
      try {
        const { data, error } = await supabase
          .from('transcricoes')
          .select('*')
          .eq('processo_id', processo.id)
          .eq('tipo_transcricao', 'Estado Atual')
          .single();

        if (!error && data) {
          setTranscricaoEstadoAtual(data);
        } else {
          setTranscricaoEstadoAtual(null);
        }
      } catch (error) {
        console.error('Erro ao buscar transcrição do Estado Atual:', error);
        setTranscricaoEstadoAtual(null);
      } finally {
        setLoadingTranscricaoEstadoAtual(false);
      }
    };

    if (activeTab === 'estado_atual') {
      fetchTranscricaoEstadoAtual();
    }
  }, [processo.id, activeTab]);

  // Buscar transcrição do Estado Futuro
  useEffect(() => {
    const fetchTranscricaoEstadoFuturo = async () => {
      setLoadingTranscricaoEstadoFuturo(true);
      try {
        const { data, error } = await supabase
          .from('transcricoes')
          .select('*')
          .eq('processo_id', processo.id)
          .eq('tipo_transcricao', 'Estado Futuro')
          .single();

        if (!error && data) {
          setTranscricaoEstadoFuturo(data);
        } else {
          setTranscricaoEstadoFuturo(null);
        }
      } catch (error) {
        console.error('Erro ao buscar transcrição do Estado Futuro:', error);
        setTranscricaoEstadoFuturo(null);
      } finally {
        setLoadingTranscricaoEstadoFuturo(false);
      }
    };

    if (activeTab === 'estado_futuro') {
      fetchTranscricaoEstadoFuturo();
    }
  }, [processo.id, activeTab]);

  // Buscar dados da análise de fluxo quando transcrição mudar
  useEffect(() => {
    console.log('🔄 useEffect fetchAnaliseFluxo - Verificando condições:');
    console.log('  - transcricao:', !!transcricao, transcricao?.id);
    console.log('  - activeSubTab:', activeSubTab);
    console.log('  - activeTab:', activeTab);
    console.log('  - Condição atendida:', transcricao && activeSubTab === 'tabela' && activeTab === 'analise_inicial');
    
    if (transcricao && activeSubTab === 'tabela' && activeTab === 'analise_inicial') {
      console.log('✅ Chamando fetchAnaliseFluxo automaticamente');
      fetchAnaliseFluxo();
    }
  }, [transcricao, activeSubTab, activeTab]);

  // Buscar dados da análise de fluxo do Estado Atual quando transcrição mudar
  useEffect(() => {
    if (transcricaoEstadoAtual && activeSubTab === 'tabela' && activeTab === 'estado_atual') {
      fetchAnaliseFluxoEstadoAtual();
    }
  }, [transcricaoEstadoAtual, activeSubTab, activeTab]);

  // Buscar dados da análise de fluxo do Estado Futuro quando transcrição mudar
  useEffect(() => {
    if (transcricaoEstadoFuturo && activeSubTab === 'tabela' && activeTab === 'estado_futuro') {
      fetchAnaliseFluxoEstadoFuturo();
    }
  }, [transcricaoEstadoFuturo, activeSubTab, activeTab]);

  // Refresh automático a cada 2 minutos para dados das tabelas - Análise Inicial
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (activeTab === 'analise_inicial' && activeSubTab === 'tabela' && transcricao) {
      // Refresh a cada 2 minutos (120000ms)
      interval = setInterval(() => {
        fetchAnaliseFluxo();
      }, 120000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [activeTab, activeSubTab, transcricao?.id]);

  // Refresh automático a cada 2 minutos para dados das tabelas - Estado Atual
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (activeTab === 'estado_atual' && activeSubTab === 'tabela' && transcricaoEstadoAtual) {
      // Refresh a cada 2 minutos (120000ms)
      interval = setInterval(() => {
        fetchAnaliseFluxoEstadoAtual();
      }, 120000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [activeTab, activeSubTab, transcricaoEstadoAtual?.id]);

  // Refresh automático a cada 2 minutos para dados das tabelas - Estado Futuro
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (activeTab === 'estado_futuro' && activeSubTab === 'tabela' && transcricaoEstadoFuturo) {
      // Refresh a cada 2 minutos (120000ms)
      interval = setInterval(() => {
        fetchAnaliseFluxoEstadoFuturo();
      }, 120000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [activeTab, activeSubTab, transcricaoEstadoFuturo?.id]);

  // Refresh automático a cada 2 minutos para transcrições - Análise Inicial
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (activeTab === 'analise_inicial') {
      const refreshTranscricao = async () => {
        try {
          let tipoTranscricao = 'Analise Inicial';
          
          const { data: transcricaoData } = await supabase
            .from('transcricoes')
            .select('*')
            .eq('processo_id', processo.id)
            .eq('tipo_transcricao', tipoTranscricao)
            .single();

          if (transcricaoData) {
            const hasChanged = !transcricao || 
              transcricaoData.status !== transcricao.status ||
              transcricaoData.conteudo !== transcricao.conteudo ||
              transcricaoData.updated_at !== transcricao.updated_at;
            
            if (hasChanged) {
              setTranscricao(transcricaoData);
              setLastUpdate(new Date());
              
              // Se status mudou para concluído, gerar análise automaticamente
              if (transcricaoData.status === 'concluido' && transcricaoData.conteudo && !localAnalise) {
                try {
                  const analysis = await transcriptionService.generateAnalysisFromTranscription(transcricaoData.conteudo);
                  
                  const { data: newAnalise, error: analiseError } = await supabase
                    .from('analise_fluxo')
                    .insert([{
                      processo_id: processo.id,
                      transcricao: transcricaoData.conteudo,
                      ...analysis,
                    }])
                    .select()
                    .single();

                  if (!analiseError && newAnalise) {
                    setLocalAnalise(newAnalise);
                    toast.success('🎉 Transcrição e análise concluídas automaticamente!');
                  }
                  onStatusUpdate();
                } catch (analysisError) {
                  console.error('Erro ao gerar análise automática:', analysisError);
                }
              }
            }
          }
        } catch (error) {
          console.error('Erro no refresh da transcrição:', error);
        }
      };

      // Refresh a cada 2 minutos (120000ms)
      interval = setInterval(refreshTranscricao, 120000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [activeTab, processo.id, transcricao?.status, transcricao?.conteudo, transcricao?.updated_at, localAnalise, onStatusUpdate]);

  // Refresh automático a cada 2 minutos para transcrições - Estado Atual
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (activeTab === 'estado_atual') {
      const refreshTranscricaoEstadoAtual = async () => {
        try {
          const { data: transcricaoData } = await supabase
            .from('transcricoes')
            .select('*')
            .eq('processo_id', processo.id)
            .eq('tipo_transcricao', 'Estado Atual')
            .single();

          if (transcricaoData) {
            const hasChanged = !transcricaoEstadoAtual || 
              transcricaoData.status !== transcricaoEstadoAtual.status ||
              transcricaoData.conteudo !== transcricaoEstadoAtual.conteudo ||
              transcricaoData.updated_at !== transcricaoEstadoAtual.updated_at;
            
            if (hasChanged) {
              setTranscricaoEstadoAtual(transcricaoData);
              setLastUpdate(new Date());
            }
          }
        } catch (error) {
          console.error('Erro no refresh da transcrição Estado Atual:', error);
        }
      };

      // Refresh a cada 2 minutos (120000ms)
      interval = setInterval(refreshTranscricaoEstadoAtual, 120000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [activeTab, processo.id, transcricaoEstadoAtual?.status, transcricaoEstadoAtual?.conteudo, transcricaoEstadoAtual?.updated_at]);

  // Refresh automático a cada 2 minutos para transcrições - Estado Futuro
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (activeTab === 'estado_futuro') {
      const refreshTranscricaoEstadoFuturo = async () => {
        try {
          const { data: transcricaoData } = await supabase
            .from('transcricoes')
            .select('*')
            .eq('processo_id', processo.id)
            .eq('tipo_transcricao', 'Estado Futuro')
            .single();

          if (transcricaoData) {
            const hasChanged = !transcricaoEstadoFuturo || 
              transcricaoData.status !== transcricaoEstadoFuturo.status ||
              transcricaoData.conteudo !== transcricaoEstadoFuturo.conteudo ||
              transcricaoData.updated_at !== transcricaoEstadoFuturo.updated_at;
            
            if (hasChanged) {
              setTranscricaoEstadoFuturo(transcricaoData);
              setLastUpdate(new Date());
            }
          }
        } catch (error) {
          console.error('Erro no refresh da transcrição Estado Futuro:', error);
        }
      };

      // Refresh a cada 2 minutos (120000ms)
      interval = setInterval(refreshTranscricaoEstadoFuturo, 120000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [activeTab, processo.id, transcricaoEstadoFuturo?.status, transcricaoEstadoFuturo?.conteudo, transcricaoEstadoFuturo?.updated_at]);

  // Polling automático para processos em andamento (mantido para compatibilidade)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (processo.status === 'processando') {
      setIsPolling(true);
      
      const pollStatus = async () => {
        try {
          const { data: processoData } = await supabase
            .from('processos')
            .select('status')
            .eq('id', processo.id)
            .single();

          if (processoData && processoData.status !== processo.status) {
            onStatusUpdate();
          }

          if (processoData?.status === 'processado' || processoData?.status === 'erro') {
            setIsPolling(false);
          }
        } catch (error) {
          console.error('Erro no polling:', error);
        }
      };

      interval = setInterval(pollStatus, 30000);
      pollStatus();
    } else {
      setIsPolling(false);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [processo.status, processo.id, onStatusUpdate]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showExportDropdown && !(event.target as Element).closest('.relative')) {
        setShowExportDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportDropdown]);

  // Callbacks para recarregar transcrições após upload
  const handleEstadoAtualUploadSuccess = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('transcricoes')
        .select('*')
        .eq('processo_id', processo.id)
        .eq('tipo_transcricao', 'Estado Atual')
        .single();

      if (!error && data) {
        setTranscricaoEstadoAtual(data);
      }
    } catch (error) {
      console.error('Erro ao recarregar transcrição do Estado Atual:', error);
    }
  }, [processo.id]);

  const handleEstadoFuturoUploadSuccess = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('transcricoes')
        .select('*')
        .eq('processo_id', processo.id)
        .eq('tipo_transcricao', 'Estado Futuro')
        .single();

      if (!error && data) {
        setTranscricaoEstadoFuturo(data);
      }
    } catch (error) {
      console.error('Erro ao recarregar transcrição do Estado Futuro:', error);
    }
  }, [processo.id]);
  
  // React Flow state for original flow
  const [originalNodes, setOriginalNodes, onOriginalNodesChange] = useNodesState(
    (localAnalise?.fluxo_original_json?.nodes as Node[]) || []
  );
  const [originalEdges, setOriginalEdges, onOriginalEdgesChange] = useEdgesState(
    (localAnalise?.fluxo_original_json?.edges as Edge[]) || []
  );

  // React Flow state for improved flow
  const [improvedNodes, setImprovedNodes, onImprovedNodesChange] = useNodesState(
    (localAnalise?.fluxo_melhorado_json?.nodes as Node[]) || []
  );
  const [improvedEdges, setImprovedEdges, onImprovedEdgesChange] = useEdgesState(
    (localAnalise?.fluxo_melhorado_json?.edges as Edge[]) || []
  );

  const onOriginalConnect = useCallback(
    (params: Connection) => setOriginalEdges((eds) => addEdge(params, eds)),
    [setOriginalEdges]
  );

  const onImprovedConnect = useCallback(
    (params: Connection) => setImprovedEdges((eds) => addEdge(params, eds)),
    [setImprovedEdges]
  );

  // Atualizar React Flow quando análise local mudar
  useEffect(() => {
    if (localAnalise) {
      setOriginalNodes((localAnalise.fluxo_original_json?.nodes as Node[]) || []);
      setOriginalEdges((localAnalise.fluxo_original_json?.edges as Edge[]) || []);
      setImprovedNodes((localAnalise.fluxo_melhorado_json?.nodes as Node[]) || []);
      setImprovedEdges((localAnalise.fluxo_melhorado_json?.edges as Edge[]) || []);
    }
  }, [localAnalise, setOriginalNodes, setOriginalEdges, setImprovedNodes, setImprovedEdges]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'aguardando':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'processando':
      case 'Em Andamento':
        return <AlertCircle className="h-5 w-5 text-blue-500 animate-spin" />;
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
      case 'Em Andamento':
        return 'Em Andamento...';
      case 'processado':
        return 'Processado com sucesso';
      case 'erro':
        return 'Erro no processamento';
      default:
        return status;
    }
  };

  const exportToJSON = (data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToImage = async (elementId: string, filename: string) => {
    setExporting(true);
    try {
      const element = document.getElementById(elementId);
      if (!element) {
        throw new Error('Elemento não encontrado');
      }

      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality
        logging: false,
        useCORS: true,
      });

      const link = document.createElement('a');
      link.download = filename;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      toast.success('Imagem exportada com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar imagem:', error);
      toast.error('Erro ao exportar imagem');
    } finally {
      setExporting(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Transcrição copiada para a área de transferência!');
    } catch (error) {
      console.error('Erro ao copiar:', error);
      toast.error('Erro ao copiar transcrição');
    }
  };

  const exportToPDF = async (elementId: string, filename: string) => {
    setExporting(true);
    try {
      const element = document.getElementById(elementId);
      if (!element) {
        throw new Error('Elemento não encontrado');
      }

      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = (pdfHeight - imgHeight * ratio) / 2;

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      pdf.save(filename);
      
      toast.success('PDF exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast.error('Erro ao exportar PDF');
    } finally {
      setExporting(false);
    }
  };

  const handleExport = (type: 'json' | 'image' | 'pdf', isOriginal: boolean) => {
    const flowType = isOriginal ? 'original' : 'melhorado';
    const data = isOriginal ? analise?.fluxo_original_json : analise?.fluxo_melhorado_json;
    const elementId = isOriginal ? 'flow-original' : 'flow-improved';
    
    switch (type) {
      case 'json':
        exportToJSON(data, `fluxo_${flowType}.json`);
        break;
      case 'image':
        exportToImage(elementId, `fluxo_${flowType}.png`);
        break;
      case 'pdf':
        exportToPDF(elementId, `fluxo_${flowType}.pdf`);
        break;
    }
    
    setShowExportDropdown(null);
  };

  // Função para limpar HTML e extrair texto puro para exportação
  const cleanTextFromHTML = (htmlString: string): string => {
    return htmlString
      .replace(/<[^>]*>/g, '') // Remove tags HTML
      .replace(/&nbsp;/g, ' ') // Substitui &nbsp; por espaço
      .replace(/&amp;/g, '&') // Substitui &amp; por &
      .replace(/&lt;/g, '<') // Substitui &lt; por <
      .replace(/&gt;/g, '>') // Substitui &gt; por >
      .replace(/&quot;/g, '"') // Substitui &quot; por "
      .replace(/&#39;/g, "'") // Substitui &#39; por '
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove ** do negrito
      .replace(/\*(.*?)\*/g, '$1') // Remove * do itálico
      .replace(/^#+\s*/gm, '') // Remove # dos títulos markdown
      .trim();
  };

  // Função para limpar apenas # da visualização web (mantém *)
  const cleanHashFromText = (text: string): string => {
    return text.replace(/^#+\s*/gm, ''); // Remove apenas # dos títulos
  };

  // Função para exportar sugestões em diferentes formatos
  const handleExportSugestoes = async (type: 'json' | 'txt' | 'pdf' | 'docx') => {
    if (!localAnalise?.sugestoes) return;

    setExporting(true);
    const cleanText = cleanTextFromHTML(localAnalise.sugestoes);
    
    try {
      switch (type) {
        case 'json': {
          exportToJSON({ sugestoes: localAnalise.sugestoes }, 'sugestoes_melhoria.json');
          break;
        }
          
        case 'txt': {
          const blob = new Blob([cleanText], { type: 'text/plain;charset=utf-8' });
          saveAs(blob, 'sugestoes_melhoria.txt');
          toast.success('Arquivo TXT exportado com sucesso!');
          break;
        }
          
        case 'pdf': {
          const pdf = new jsPDF();
          const pageWidth = pdf.internal.pageSize.getWidth();
          const margin = 20;
          const maxWidth = pageWidth - 2 * margin;
          
          // Título
          pdf.setFontSize(16);
          pdf.setFont('helvetica', 'bold');
          pdf.text('Sugestões de Melhoria', margin, 30);
          
          // Conteúdo
          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'normal');
          
          const lines = pdf.splitTextToSize(cleanText, maxWidth);
          let yPosition = 50;
          
          lines.forEach((line: string) => {
            if (yPosition > pdf.internal.pageSize.getHeight() - 20) {
              pdf.addPage();
              yPosition = 20;
            }
            pdf.text(line, margin, yPosition);
            yPosition += 6;
          });
          
          pdf.save('sugestoes_melhoria.pdf');
          toast.success('PDF exportado com sucesso!');
          break;
        }
          
        case 'docx': {
          // Processar texto para criar parágrafos estruturados
          const paragraphs: Paragraph[] = [];
          
          // Título
          paragraphs.push(
            new Paragraph({
              text: 'Sugestões de Melhoria',
              heading: HeadingLevel.HEADING_1,
            })
          );
          
          // Dividir o texto em seções baseadas em números (1., 2., etc.)
          const sections = cleanText.split(/(?=\d+\.\s)/);
          
          sections.forEach((section) => {
            if (section.trim()) {
              const lines = section.split('\n').filter(line => line.trim());
              
              lines.forEach((line, index) => {
                if (index === 0 && /^\d+\.\s/.test(line)) {
                  // Título da seção
                  paragraphs.push(
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: line.trim(),
                          bold: true,
                          size: 24,
                        }),
                      ],
                      spacing: { before: 200, after: 100 },
                    })
                  );
                } else if (line.trim().startsWith('- ')) {
                  // Item de lista
                  paragraphs.push(
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: `• ${line.trim().substring(2)}`,
                          size: 22,
                        }),
                      ],
                      spacing: { before: 50 },
                    })
                  );
                } else if (line.trim()) {
                  // Parágrafo normal
                  paragraphs.push(
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: line.trim(),
                          size: 22,
                        }),
                      ],
                      spacing: { before: 50 },
                    })
                  );
                }
              });
            }
          });
          
          const doc = new Document({
            sections: [
              {
                children: paragraphs,
              },
            ],
          });
          
          const buffer = await Packer.toBlob(doc);
          saveAs(buffer, 'sugestoes_melhoria.docx');
          toast.success('Documento Word exportado com sucesso!');
          break;
        }
      }
    } catch (error) {
      console.error('Erro ao exportar sugestões:', error);
      toast.error(`Erro ao exportar em ${type.toUpperCase()}`);
    } finally {
      setExporting(false);
      setShowExportDropdown(null);
    }
  };

  // Funções de edição de fluxos
  const addNode = (type: 'default' | 'start' | 'end' | 'decision' | 'automated' | 'parallel' | 'problem', isOriginal: boolean) => {
    const newNode = {
      id: `node-${nodeIdCounter}`,
      type,
      position: { x: Math.random() * 400 + 200, y: Math.random() * 300 + 200 },
      data: { 
        label: type === 'start' ? 'Início' :
               type === 'end' ? 'Fim' :
               type === 'decision' ? 'Decisão?' :
               type === 'automated' ? 'Processo Automatizado' :
               type === 'parallel' ? 'Processo Paralelo' :
               type === 'problem' ? 'Problema/Gargalo' :
               'Novo Processo'
      },
    };

    if (isOriginal) {
      setOriginalNodes((nodes) => [...nodes, newNode]);
    } else {
      setImprovedNodes((nodes) => [...nodes, newNode]);
    }

    setNodeIdCounter(prev => prev + 1);
  };

  const saveFlowChanges = async (isOriginal: boolean) => {
    if (!analise) return;

    setSaving(true);
    try {
      const flowData = isOriginal 
        ? { nodes: originalNodes, edges: originalEdges }
        : { nodes: improvedNodes, edges: improvedEdges };

      const updateField = isOriginal 
        ? { fluxo_original_json: flowData }
        : { fluxo_melhorado_json: flowData };

      const { error } = await supabase
        .from('analise_fluxo')
        .update(updateField)
        .eq('id', analise.id);

      if (error) throw error;

      toast.success(`${isOriginal ? 'Fluxo original' : 'Fluxo melhorado'} salvo com sucesso!`);
      
      if (isOriginal) {
        setIsEditingOriginal(false);
      } else {
        setIsEditingImproved(false);
      }
    } catch (error) {
      console.error('Erro ao salvar fluxo:', error);
      toast.error('Erro ao salvar alterações');
    } finally {
      setSaving(false);
    }
  };

  // Funções de edição removidas - agora usamos edição inline e tecla Delete

  return (
    <div className="space-y-6">
      {/* Content */}
      {processo.status === 'processado' && localAnalise ? (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          {/* Main Tabs */}
          <div className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
            <nav className="flex justify-between items-center px-6 py-2">
              <div className="flex justify-center space-x-1 flex-1">
                {[
                  { id: 'analise_inicial', label: 'Análise Inicial', icon: FileText },
                  { id: 'estado_atual', label: 'Estado Atual', icon: Clock },
                  { id: 'estado_futuro', label: 'Estado Futuro', icon: Zap },
                ].map((tab) => {
                  const IconComponent = tab.icon;
                   return (
                   <button
                     key={tab.id}
                     onClick={() => setActiveTab(tab.id as 'analise_inicial' | 'estado_atual' | 'estado_futuro')}
                     className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-200 ${
                       activeTab === tab.id
                         ? 'bg-blue-500 text-white shadow-lg transform scale-105'
                         : 'bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-800 hover:shadow-md border border-gray-200'
                     }`}
                   >
                     <IconComponent className="h-4 w-4" />
                     {tab.label}
                   </button>
                   );
                })}
              </div>
              
              {/* Botão Exportar Todos */}
              <button
                onClick={exportToExcelAll}
                disabled={exporting}
                className="px-3 py-2 border-2 border-green-600 text-green-600 rounded-lg hover:border-green-700 hover:text-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors ml-4"
              >
                {exporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                    <span>Exportando...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Exportar</span>
                  </>
                )}
              </button>
            </nav>
          </div>

          {/* Sub Tabs */}
          <div className="bg-gray-100 border-b border-gray-200">
            <nav className="flex w-full">
              {[
                { id: 'transcricao', label: 'Transcrição', icon: FileText },
                { id: 'tabela', label: 'Tabela', icon: Square },
              ].map((subTab) => {
                const IconComponent = subTab.icon;
                return (
                  <button
                    key={subTab.id}
                    onClick={() => setActiveSubTab(subTab.id as 'transcricao' | 'tabela')}
                    className={`flex-1 flex items-center justify-center gap-2 py-4 px-6 font-medium text-sm transition-all duration-200 ${
                      activeSubTab === subTab.id
                        ? 'bg-white text-gray-800 border-b-2 border-gray-800 shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                    }`}
                  >
                    <IconComponent className="h-4 w-4" />
                    {subTab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Análise Inicial */}
            {activeTab === 'analise_inicial' && (
              <div className="space-y-4">
                {activeSubTab === 'transcricao' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">Transcrição - Análise Inicial</h3>
                      <div className="flex items-center space-x-2">
                        {(transcricao?.conteudo || analise?.transcricao) && (
                          <>
                            <button
                              onClick={() => copyToClipboard(transcricao?.conteudo || analise?.transcricao || '')}
                              className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                            >
                              <Copy className="h-4 w-4" />
                              <span>Copiar</span>
                            </button>
                            <button
                              onClick={() => exportToJSON({ 
                                transcricao: transcricao?.conteudo || analise?.transcricao,
                                tempo_processamento: transcricao?.tempo_processamento
                              }, 'analise_inicial_transcricao.json')}
                              className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                            >
                              <Download className="h-4 w-4" />
                              <span>Exportar</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {loadingTranscricao ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-gray-600">Carregando transcrição...</span>
                      </div>
                    ) : transcricao ? (
                      <div className="space-y-4">
                        {/* Status da transcrição */}
                        <div className="flex justify-center mb-6">
                          <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm ${
                            transcricao.status === 'concluido' ? 'bg-green-100 text-green-700' :
                            (transcricao.status === 'processando' || transcricao.status === 'Em Andamento') ? 'bg-blue-100 text-blue-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {transcricao.status === 'concluido' && <CheckCircle className="h-4 w-4" />}
                            {(transcricao.status === 'processando' || transcricao.status === 'Em Andamento') && <AlertCircle className="h-4 w-4 animate-spin" />}
                            {transcricao.status === 'erro' && <XCircle className="h-4 w-4" />}
                            <span>
                              {transcricao.status === 'concluido' ? 'Transcrição Concluída' : 
                               (transcricao.status === 'processando' || transcricao.status === 'Em Andamento') ? 'Em Andamento...' : 'Erro na Transcrição'}
                            </span>
                          </div>
                        </div>

                        {/* Conteúdo da transcrição */}
                        <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-6 border border-gray-200 shadow-sm">
                          <div className="prose prose-gray max-w-none">
                            <p className="text-gray-800 leading-relaxed whitespace-pre-wrap text-base">
                              {transcricao.conteudo || (
                                <span className="text-gray-500 italic">Processando transcrição...</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-6 border border-gray-200 shadow-sm">
                        <div className="prose prose-gray max-w-none">
                          <p className="text-gray-800 leading-relaxed whitespace-pre-wrap text-base">
                            {analise?.transcricao || (
                              <span className="text-gray-500 italic">Nenhuma transcrição disponível.</span>
                            )}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeSubTab === 'tabela' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">Tabela - Análise Inicial</h3>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={fetchAnaliseFluxo}
                          disabled={loadingAnaliseFluxo}
                          className="flex items-center space-x-2 px-3 py-2 text-sm text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50 transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className={`h-4 w-4 ${loadingAnaliseFluxo ? 'animate-spin' : ''}`} />
                          <span>Atualizar</span>
                        </button>
                        <button
                          onClick={exportAnaliseInicialToExcel}
                          disabled={exporting || analiseFluxoData.length === 0}
                          className="flex items-center space-x-2 px-3 py-2 text-sm text-green-600 border border-green-600 rounded-md hover:bg-green-50 transition-colors disabled:opacity-50"
                        >
                          <Download className="h-4 w-4" />
                          <span>{exporting ? 'Exportando...' : 'Excel'}</span>
                        </button>
                      </div>
                    </div>

                    {loadingAnaliseFluxo ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-gray-600">Carregando dados da análise...</span>
                      </div>
                    ) : (() => {
                      console.log('🔍 Verificando renderização da tabela:');
                      console.log('  - analiseFluxoData:', analiseFluxoData);
                      console.log('  - analiseFluxoData.length:', analiseFluxoData.length);
                      console.log('  - Array.isArray(analiseFluxoData):', Array.isArray(analiseFluxoData));
                      console.log('  - loadingAnaliseFluxo:', loadingAnaliseFluxo);
                      return analiseFluxoData.length > 0;
                    })() ? (
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                               <tr>
                                 <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sequência</th>
                                 <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Responsável/Área</th>
                                 <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição do Subprocesso</th>
                                 <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referência Acordada</th>
                                 <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tempo Transcrição</th>
                                 <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Desvios</th>
                                 <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Problemas</th>
                                 <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kaizen Sugerido</th>
                               </tr>
                             </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                               {analiseFluxoData.map((item) => {
                                 // Calcular tempo de transcrição
                                 const tempoTranscricao = (() => {
                                   if (item.timestamp_inicio && item.timestamp_fim) {
                                     return `${item.timestamp_inicio} - ${item.timestamp_fim}`;
                                   }
                                   return '-';
                                 })();

                                 return (
                                   <tr key={item.id} className="hover:bg-gray-50">
                                     <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                       {item.seq}
                                     </td>
                                     <td className="px-4 py-4 text-sm text-gray-900">
                                       {item.responsavel_area || '-'}
                                     </td>
                                     <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                                       <div className="truncate" title={item.etapa_descricao}>
                                         {item.etapa_descricao || '-'}
                                       </div>
                                     </td>
                                     <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                                       <div className="truncate" title={item.referencia_acordada}>
                                         {item.referencia_acordada || '-'}
                                       </div>
                                     </td>
                                     <td className="px-4 py-4 text-sm text-gray-900 whitespace-nowrap">
                                       <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-mono">
                                         {tempoTranscricao}
                                       </span>
                                     </td>
                                     <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                                       {Array.isArray(item.desvios_variacoes) && item.desvios_variacoes.length > 0 ? (
                                         <div className="space-y-1">
                                           {item.desvios_variacoes.map((desvio, index) => (
                                             <div key={index} className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                               {desvio}
                                             </div>
                                           ))}
                                         </div>
                                       ) : '-'}
                                     </td>
                                     <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                                       {Array.isArray(item.problemas) && item.problemas.length > 0 ? (
                                         <div className="space-y-1">
                                           {item.problemas.map((problema, index) => (
                                             <div key={index} className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                               {problema}
                                             </div>
                                           ))}
                                         </div>
                                       ) : '-'}
                                     </td>
                                     <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                                       {(() => {
                                         const kaizenValue = item.kaizen_discutido || 
                                           (Array.isArray(item.kaizen_alternativo_boas_praticas) && item.kaizen_alternativo_boas_praticas.length > 0 
                                             ? item.kaizen_alternativo_boas_praticas.join(', ') 
                                             : '-');
                                         return (
                                           <div className="truncate" title={kaizenValue}>
                                             {kaizenValue}
                                           </div>
                                         );
                                       })()} 
                                     </td>
                                   </tr>
                                 );
                               })}
                             </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl p-6 border border-blue-200 shadow-sm">
                        <div className="text-center">
                          <div className="text-blue-500 mb-4">
                            <FileText className="h-12 w-12 mx-auto" />
                          </div>
                          <p className="text-blue-600 font-medium mb-2">Nenhum dado de análise encontrado</p>
                          <p className="text-blue-500 text-sm">Os dados da análise de fluxo aparecerão aqui quando disponíveis</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Estado Atual */}
            {activeTab === 'estado_atual' && (
              <div className="space-y-4">
                {activeSubTab === 'transcricao' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">Transcrição - Estado Atual</h3>
                    {loadingTranscricaoEstadoAtual ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600"></div>
                        <span className="ml-2 text-gray-600">Carregando transcrição...</span>
                      </div>
                    ) : transcricaoEstadoAtual ? (
                      <div className="space-y-4">
                        {/* Status da transcrição */}
                        <div className="flex justify-center mb-6">
                          <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm ${
                            transcricaoEstadoAtual.status === 'concluido' ? 'bg-green-100 text-green-700' :
                            (transcricaoEstadoAtual.status === 'processando' || transcricaoEstadoAtual.status === 'Em Andamento') ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {transcricaoEstadoAtual.status === 'concluido' && <CheckCircle className="h-4 w-4" />}
                            {(transcricaoEstadoAtual.status === 'processando' || transcricaoEstadoAtual.status === 'Em Andamento') && <AlertCircle className="h-4 w-4 animate-spin" />}
                            {transcricaoEstadoAtual.status === 'erro' && <XCircle className="h-4 w-4" />}
                            <span>
                              {transcricaoEstadoAtual.status === 'concluido' ? 'Transcrição Concluída' : 
                               (transcricaoEstadoAtual.status === 'processando' || transcricaoEstadoAtual.status === 'Em Andamento') ? 'Em Andamento...' : 'Erro na Transcrição'}
                            </span>
                          </div>
                        </div>

                        {/* Conteúdo da transcrição */}
                        <div className="bg-gradient-to-br from-amber-50 to-white rounded-xl p-6 border border-amber-200 shadow-sm">
                          <div className="prose prose-gray max-w-none">
                            <p className="text-gray-800 leading-relaxed whitespace-pre-wrap text-base">
                              {transcricaoEstadoAtual.conteudo || (
                                <span className="text-gray-500 italic">Processando transcrição...</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <UploadSection 
                        processoId={processo.id}
                        tipoTranscricao="Estado Atual"
                        onUploadSuccess={handleEstadoAtualUploadSuccess}
                        colorScheme="amber"
                      />
                    )}
                  </div>
                )}

                {activeSubTab === 'tabela' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">Tabela - Estado Atual</h3>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={fetchAnaliseFluxoEstadoAtual}
                          disabled={loadingAnaliseFluxoEstadoAtual}
                          className="flex items-center space-x-2 px-3 py-2 text-sm text-amber-600 border border-amber-600 rounded-md hover:bg-amber-50 transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className={`h-4 w-4 ${loadingAnaliseFluxoEstadoAtual ? 'animate-spin' : ''}`} />
                          <span>Atualizar</span>
                        </button>
                        <button
                          onClick={exportEstadoAtualToExcel}
                          disabled={exporting || analiseFluxoEstadoAtualData.length === 0}
                          className="flex items-center space-x-2 px-3 py-2 text-sm text-green-600 border border-green-600 rounded-md hover:bg-green-50 transition-colors disabled:opacity-50"
                        >
                          <Download className="h-4 w-4" />
                          <span>{exporting ? 'Exportando...' : 'Excel'}</span>
                        </button>
                      </div>
                    </div>

                    {loadingAnaliseFluxoEstadoAtual ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600"></div>
                        <span className="ml-2 text-gray-600">Carregando dados da análise...</span>
                      </div>
                    ) : analiseFluxoEstadoAtualData.length > 0 ? (
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                               <tr>
                                 <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sequência</th>
                                 <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Responsável/Área</th>
                                 <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição do Subprocesso</th>
                                 <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referência Acordada</th>
                                 <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tempo Transcrição</th>
                                 <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Desvios</th>
                                 <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Problemas</th>
                                 <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kaizen Sugerido</th>
                               </tr>
                             </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                               {analiseFluxoEstadoAtualData.map((item) => {
                                 // Calcular tempo de transcrição
                                 const tempoTranscricao = (() => {
                                   if (item.timestamp_inicio && item.timestamp_fim) {
                                     return `${item.timestamp_inicio} - ${item.timestamp_fim}`;
                                   }
                                   return '-';
                                 })();

                                 return (
                                   <tr key={item.id} className="hover:bg-gray-50">
                                     <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                       {item.seq}
                                     </td>
                                     <td className="px-4 py-4 text-sm text-gray-900">
                                       {item.responsavel_area || '-'}
                                     </td>
                                     <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                                       <div className="truncate" title={item.etapa_descricao}>
                                         {item.etapa_descricao || '-'}
                                       </div>
                                     </td>
                                     <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                                       <div className="truncate" title={item.referencia_acordada}>
                                         {item.referencia_acordada || '-'}
                                       </div>
                                     </td>
                                     <td className="px-4 py-4 text-sm text-gray-900 whitespace-nowrap">
                                       <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded font-mono">
                                         {tempoTranscricao}
                                       </span>
                                     </td>
                                     <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                                       {Array.isArray(item.desvios_variacoes) && item.desvios_variacoes.length > 0 ? (
                                         <div className="space-y-1">
                                           {item.desvios_variacoes.map((desvio, index) => (
                                             <div key={index} className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                               {desvio}
                                             </div>
                                           ))}
                                         </div>
                                       ) : '-'}
                                     </td>
                                     <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                                       {Array.isArray(item.problemas) && item.problemas.length > 0 ? (
                                         <div className="space-y-1">
                                           {item.problemas.map((problema, index) => (
                                             <div key={index} className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                               {problema}
                                             </div>
                                           ))}
                                         </div>
                                       ) : '-'}
                                     </td>
                                     <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                                       {(() => {
                                         const kaizenValue = item.kaizen_discutido || 
                                           (Array.isArray(item.kaizen_alternativo_boas_praticas) && item.kaizen_alternativo_boas_praticas.length > 0 
                                             ? item.kaizen_alternativo_boas_praticas.join(', ') 
                                             : '-');
                                         return (
                                           <div className="truncate" title={kaizenValue}>
                                             {kaizenValue}
                                           </div>
                                         );
                                       })()} 
                                     </td>
                                   </tr>
                                 );
                               })}
                             </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gradient-to-br from-amber-50 to-white rounded-xl p-6 border border-amber-200 shadow-sm">
                        <div className="text-center">
                          <div className="text-amber-500 mb-4">
                            <FileText className="h-12 w-12 mx-auto" />
                          </div>
                          <p className="text-amber-600 font-medium mb-2">Nenhum dado de análise encontrado</p>
                          <p className="text-amber-500 text-sm">Os dados da análise de fluxo do Estado Atual aparecerão aqui quando disponíveis</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Estado Futuro */}
            {activeTab === 'estado_futuro' && (
              <div className="space-y-4">
                {activeSubTab === 'transcricao' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">Transcrição - Estado Futuro</h3>
                    {loadingTranscricaoEstadoFuturo ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600"></div>
                        <span className="ml-2 text-gray-600">Carregando transcrição...</span>
                      </div>
                    ) : transcricaoEstadoFuturo ? (
                      <div className="space-y-4">
                        {/* Status da transcrição */}
                        <div className="flex justify-center mb-6">
                          <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm ${
                            transcricaoEstadoFuturo.status === 'concluido' ? 'bg-green-100 text-green-700' :
                            (transcricaoEstadoFuturo.status === 'processando' || transcricaoEstadoFuturo.status === 'Em Andamento') ? 'bg-emerald-100 text-emerald-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {transcricaoEstadoFuturo.status === 'concluido' && <CheckCircle className="h-4 w-4" />}
                            {(transcricaoEstadoFuturo.status === 'processando' || transcricaoEstadoFuturo.status === 'Em Andamento') && <AlertCircle className="h-4 w-4 animate-spin" />}
                            {transcricaoEstadoFuturo.status === 'erro' && <XCircle className="h-4 w-4" />}
                            <span>
                              {transcricaoEstadoFuturo.status === 'concluido' ? 'Transcrição Concluída' : 
                               (transcricaoEstadoFuturo.status === 'processando' || transcricaoEstadoFuturo.status === 'Em Andamento') ? 'Em Andamento...' : 'Erro na Transcrição'}
                            </span>
                          </div>
                        </div>

                        {/* Conteúdo da transcrição */}
                        <div className="bg-gradient-to-br from-emerald-50 to-white rounded-xl p-6 border border-emerald-200 shadow-sm">
                          <div className="prose prose-gray max-w-none">
                            <p className="text-gray-800 leading-relaxed whitespace-pre-wrap text-base">
                              {transcricaoEstadoFuturo.conteudo || (
                                <span className="text-gray-500 italic">Processando transcrição...</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <UploadSection 
                        processoId={processo.id}
                        tipoTranscricao="Estado Futuro"
                        onUploadSuccess={handleEstadoFuturoUploadSuccess}
                        colorScheme="emerald"
                      />
                    )}
                  </div>
                )}

                {activeSubTab === 'tabela' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">Tabela - Estado Futuro</h3>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={fetchAnaliseFluxoEstadoFuturo}
                          disabled={loadingAnaliseFluxoEstadoFuturo}
                          className="flex items-center space-x-2 px-3 py-2 text-sm text-emerald-600 border border-emerald-600 rounded-md hover:bg-emerald-50 transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className={`h-4 w-4 ${loadingAnaliseFluxoEstadoFuturo ? 'animate-spin' : ''}`} />
                          <span>Atualizar</span>
                        </button>
                        <button
                          onClick={exportEstadoFuturoToExcel}
                          disabled={exporting || analiseFluxoEstadoFuturoData.length === 0}
                          className="flex items-center space-x-2 px-3 py-2 text-sm text-green-600 border border-green-600 rounded-md hover:bg-green-50 transition-colors disabled:opacity-50"
                        >
                          <Download className="h-4 w-4" />
                          <span>{exporting ? 'Exportando...' : 'Excel'}</span>
                        </button>
                      </div>
                    </div>

                    {loadingAnaliseFluxoEstadoFuturo ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600"></div>
                        <span className="ml-2 text-gray-600">Carregando dados da análise...</span>
                      </div>
                    ) : analiseFluxoEstadoFuturoData.length > 0 ? (
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                               <tr>
                                 <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sequência</th>
                                 <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Responsável/Área</th>
                                 <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição do Subprocesso</th>
                                 <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referência Acordada</th>
                                 <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tempo Transcrição</th>
                                 <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Desvios</th>
                                 <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Problemas</th>
                                 <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kaizen Sugerido</th>
                               </tr>
                             </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {analiseFluxoEstadoFuturoData.map((item) => {
                                  const tempoTranscricao = (() => {
                                    if (!item.timestamp_inicio || !item.timestamp_fim) return '-';
                                    
                                    try {
                                      const inicio = new Date(item.timestamp_inicio);
                                      const fim = new Date(item.timestamp_fim);
                                      const diffMs = fim.getTime() - inicio.getTime();
                                      
                                      if (diffMs < 0) return '-';
                                      
                                      const diffMinutes = Math.floor(diffMs / (1000 * 60));
                                      const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);
                                      
                                      if (diffMinutes > 0) {
                                        return `${diffMinutes}m ${diffSeconds}s`;
                                      } else {
                                        return `${diffSeconds}s`;
                                      }
                                    } catch (error) {
                                      return '-';
                                    }
                                  })();
                                  
                                  return (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                      <td className="px-4 py-4 text-sm font-medium text-gray-900">
                                        {item.seq}
                                      </td>
                                      <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                                        <div className="truncate" title={item.responsavel_area}>
                                          {item.responsavel_area || '-'}
                                        </div>
                                      </td>
                                      <td className="px-4 py-4 text-sm text-gray-900 max-w-md">
                                        <div className="truncate" title={item.etapa_descricao}>
                                          {item.etapa_descricao || '-'}
                                        </div>
                                      </td>
                                      <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                                        <div className="truncate" title={item.referencia_acordada}>
                                          {item.referencia_acordada || '-'}
                                        </div>
                                      </td>
                                      <td className="px-4 py-4 text-sm text-gray-900">
                                        {tempoTranscricao}
                                      </td>
                                      <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                                        {Array.isArray(item.desvios_variacoes) && item.desvios_variacoes.length > 0 ? (
                                          <div className="truncate" title={item.desvios_variacoes.join(', ')}>
                                            {item.desvios_variacoes.join(', ')}
                                          </div>
                                        ) : '-'}
                                      </td>
                                      <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                                        {Array.isArray(item.problemas) && item.problemas.length > 0 ? (
                                          <div className="truncate" title={item.problemas.join(', ')}>
                                            {item.problemas.join(', ')}
                                          </div>
                                        ) : '-'}
                                      </td>
                                      <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                                        {(() => {
                                          const kaizenValue = item.kaizen_discutido || 
                                            (Array.isArray(item.kaizen_alternativo_boas_praticas) && item.kaizen_alternativo_boas_praticas.length > 0 
                                              ? item.kaizen_alternativo_boas_praticas.join(', ') 
                                              : '-');
                                          return (
                                            <div className="truncate" title={kaizenValue}>
                                              {kaizenValue}
                                            </div>
                                          );
                                        })()} 
                                      </td>
                                    </tr>
                                  );
                                })}
                             </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gradient-to-br from-emerald-50 to-white rounded-xl p-6 border border-emerald-200 shadow-sm">
                        <div className="text-center">
                          <div className="text-emerald-500 mb-4">
                            <FileText className="h-12 w-12 mx-auto" />
                          </div>
                          <p className="text-emerald-600 font-medium mb-2">Nenhum dado de análise encontrado</p>
                          <p className="text-emerald-500 text-sm">Os dados da análise de fluxo do Estado Futuro aparecerão aqui quando disponíveis</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      ) : processo.status === 'processando' ? (
        <div className="flex items-center justify-center h-64">
          <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl p-8 border border-blue-200 shadow-sm">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-blue-700 font-medium">Processando análise...</p>
              <p className="text-blue-600 text-sm mt-2">Isso pode levar alguns minutos</p>
            </div>
          </div>
        </div>
      ) : processo.status === 'erro' ? (
        <div className="flex items-center justify-center h-64">
          <div className="bg-gradient-to-br from-red-50 to-white rounded-xl p-8 border border-red-200 shadow-sm">
            <div className="text-center">
              <div className="text-red-500 mb-4">
                <XCircle className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-red-600 font-medium">Erro no processamento</p>
              <p className="text-red-500 text-sm mt-2">Tente fazer o upload novamente</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-64">
          <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-8 border border-gray-200 shadow-sm">
            <div className="text-center">
              <Clock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 font-medium">Aguardando processamento...</p>
              <p className="text-gray-500 text-sm mt-2">O processo será iniciado em breve</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal de tela cheia */}
      <FullscreenFlowModal
        isOpen={fullscreenModal.isOpen}
        onClose={() => setFullscreenModal({ isOpen: false, type: null })}
        nodes={fullscreenModal.type === 'original' ? originalNodes : improvedNodes}
        edges={fullscreenModal.type === 'original' ? originalEdges : improvedEdges}
        onNodesChange={fullscreenModal.type === 'original' ? onOriginalNodesChange : onImprovedNodesChange}
        onEdgesChange={fullscreenModal.type === 'original' ? onOriginalEdgesChange : onImprovedEdgesChange}
        onConnect={fullscreenModal.type === 'original' ? onOriginalConnect : onImprovedConnect}
        isEditing={fullscreenModal.type === 'original' ? isEditingOriginal : isEditingImproved}
        exportFilename={`processo_${processo.id}_${fullscreenModal.type === 'original' ? 'original' : 'melhorado'}`}
      />
    </div>
  );
};

export default ProcessoVisualizacao;
