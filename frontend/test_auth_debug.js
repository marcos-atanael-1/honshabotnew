// Script de teste para verificar autenticação no console do navegador
// Cole este código no console do DevTools quando estiver na aplicação

(async function testAuth() {
  console.log('🔍 Iniciando teste de autenticação...');
  
  try {
    // 1. Verificar se o Supabase está configurado
    console.log('📋 Configuração do Supabase:');
    console.log('URL:', import.meta.env?.VITE_SUPABASE_URL || 'Não encontrada');
    console.log('Anon Key:', import.meta.env?.VITE_SUPABASE_ANON_KEY ? 'Configurada' : 'Não encontrada');
    
    // 2. Verificar sessão atual
    const { data: session, error: sessionError } = await supabase.auth.getSession();
    console.log('🔐 Sessão atual:', session);
    if (sessionError) console.error('❌ Erro na sessão:', sessionError);
    
    // 3. Verificar usuário atual
    const { data: user, error: userError } = await supabase.auth.getUser();
    console.log('👤 Usuário atual:', user);
    if (userError) console.error('❌ Erro no usuário:', userError);
    
    // 4. Verificar se o token JWT está válido
    if (session?.session?.access_token) {
      console.log('🎫 Token JWT presente:', session.session.access_token.substring(0, 50) + '...');
      
      // Decodificar JWT para ver o conteúdo
      try {
        const payload = JSON.parse(atob(session.session.access_token.split('.')[1]));
        console.log('📄 Payload do JWT:', payload);
        console.log('⏰ Token expira em:', new Date(payload.exp * 1000));
        console.log('🕐 Agora:', new Date());
        console.log('✅ Token válido:', payload.exp * 1000 > Date.now());
      } catch (e) {
        console.error('❌ Erro decodificando JWT:', e);
      }
    } else {
      console.warn('⚠️ Nenhum token JWT encontrado!');
    }
    
    // 5. Testar uma query simples
    console.log('🧪 Testando query simples...');
    const { data: testData, error: testError } = await supabase
      .from('users')
      .select('id, email')
      .limit(1);
    
    if (testError) {
      console.error('❌ Erro na query de teste:', testError);
    } else {
      console.log('✅ Query de teste bem-sucedida:', testData);
    }
    
    // 6. Testar inserção na tabela processos (simulação)
    console.log('🧪 Testando inserção na tabela processos...');
    const testProcesso = {
      nome: 'Teste Debug ' + Date.now(),
      cliente_id: 'test-client-id',
      tipo_entrada: 'texto',
      status: 'aguardando',
      conteudo_texto: 'Teste de conteúdo'
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('processos')
      .insert(testProcesso)
      .select();
    
    if (insertError) {
      console.error('❌ Erro na inserção de teste:', insertError);
      console.log('📋 Detalhes do erro:', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint
      });
    } else {
      console.log('✅ Inserção de teste bem-sucedida:', insertData);
      
      // Limpar o teste
      await supabase
        .from('processos')
        .delete()
        .eq('id', insertData[0].id);
      console.log('🧹 Registro de teste removido');
    }
    
  } catch (error) {
    console.error('💥 Erro geral no teste:', error);
  }
  
  console.log('🏁 Teste de autenticação concluído!');
})();

// Instruções:
// 1. Abra o DevTools (F12)
// 2. Vá para a aba Console
// 3. Cole este código e pressione Enter
// 4. Analise os resultados para identificar o problema