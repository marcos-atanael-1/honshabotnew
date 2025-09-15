// Script para testar criação de processos após aplicar fix RLS
// Execute no console do navegador na página da aplicação

async function testProcessoCreation() {
  console.log('🔍 Testando criação de processo...');
  
  try {
    // 1. Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('❌ Usuário não autenticado:', authError);
      return;
    }
    console.log('✅ Usuário autenticado:', user.email);
    
    // 2. Verificar se existe pelo menos um cliente
    const { data: clientes, error: clientesError } = await supabase
      .from('clientes')
      .select('*')
      .limit(1);
      
    if (clientesError) {
      console.error('❌ Erro ao buscar clientes:', clientesError);
      return;
    }
    
    if (!clientes || clientes.length === 0) {
      console.error('❌ Nenhum cliente encontrado. Crie um cliente primeiro.');
      return;
    }
    
    const cliente = clientes[0];
    console.log('✅ Cliente encontrado:', cliente.nome);
    
    // 3. Tentar criar um processo de teste
    const processoTeste = {
      nome: `Teste RLS - ${new Date().toISOString()}`,
      cliente_id: cliente.id,
      tipo_entrada: 'audio_video',
      ai_model: 'openai',
      status: 'aguardando'
    };
    
    console.log('📝 Tentando criar processo:', processoTeste);
    
    const { data: processoData, error: processoError } = await supabase
      .from('processos')
      .insert([processoTeste])
      .select()
      .single();
      
    if (processoError) {
      console.error('❌ Erro ao criar processo:', processoError);
      console.error('Detalhes do erro:', {
        code: processoError.code,
        message: processoError.message,
        details: processoError.details,
        hint: processoError.hint
      });
      return;
    }
    
    console.log('✅ Processo criado com sucesso!', processoData);
    
    // 4. Verificar se consegue ler o processo criado
    const { data: processoLeitura, error: leituraError } = await supabase
      .from('processos')
      .select('*')
      .eq('id', processoData.id)
      .single();
      
    if (leituraError) {
      console.error('❌ Erro ao ler processo criado:', leituraError);
    } else {
      console.log('✅ Processo lido com sucesso:', processoLeitura);
    }
    
    // 5. Limpar - deletar o processo de teste
    const { error: deleteError } = await supabase
      .from('processos')
      .delete()
      .eq('id', processoData.id);
      
    if (deleteError) {
      console.warn('⚠️ Erro ao deletar processo de teste:', deleteError);
    } else {
      console.log('🧹 Processo de teste deletado com sucesso');
    }
    
    console.log('🎉 Teste concluído com sucesso! RLS está funcionando.');
    
  } catch (error) {
    console.error('💥 Erro inesperado no teste:', error);
  }
}

// Função para verificar políticas RLS atuais
async function checkRLSPolicies() {
  console.log('🔍 Verificando políticas RLS...');
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT 
          tablename,
          policyname,
          permissive,
          cmd,
          qual,
          with_check
        FROM pg_policies 
        WHERE schemaname = 'public'
        AND tablename IN ('processos', 'clientes', 'transcricoes', 'analises', 'arquivos')
        ORDER BY tablename, policyname;
      `
    });
    
    if (error) {
      console.error('❌ Erro ao verificar políticas:', error);
    } else {
      console.log('📋 Políticas RLS atuais:', data);
    }
  } catch (error) {
    console.log('ℹ️ Não foi possível verificar políticas via RPC. Isso é normal se a função não existir.');
  }
}

// Executar testes
console.log('🚀 Iniciando testes de RLS...');
checkRLSPolicies();
testProcessoCreation();