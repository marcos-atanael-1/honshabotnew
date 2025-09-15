#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Teste de Criação de Processo - Backend
Este script testa a criação de processos diretamente no backend,
simulando o upload de arquivos de áudio/vídeo.
"""

import os
import sys
import json
import requests
from datetime import datetime
from typing import Dict, Any, Optional

# Configurações - AJUSTE CONFORME SEU AMBIENTE
BACKEND_URL = "http://localhost:8000"  # URL do seu backend
SUPABASE_URL = "https://your-project.supabase.co"  # Sua URL do Supabase
SUPABASE_ANON_KEY = "your-anon-key"  # Sua chave anônima

class ProcessoTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.user_id = None
        
    def log(self, message: str, level: str = "INFO"):
        """Log com timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        prefix = {
            "INFO": "ℹ️",
            "SUCCESS": "✅", 
            "ERROR": "❌",
            "WARNING": "⚠️"
        }.get(level, "ℹ️")
        print(f"[{timestamp}] {prefix} {message}")
        
    def test_backend_health(self) -> bool:
        """Testa se o backend está rodando"""
        self.log("Testando conexão com o backend...")
        try:
            response = self.session.get(f"{BACKEND_URL}/health", timeout=5)
            if response.status_code == 200:
                self.log("Backend está rodando", "SUCCESS")
                return True
            else:
                self.log(f"Backend retornou status {response.status_code}", "ERROR")
                return False
        except requests.exceptions.RequestException as e:
            self.log(f"Erro ao conectar com backend: {e}", "ERROR")
            return False
            
    def simulate_auth(self) -> bool:
        """Simula autenticação (você pode implementar login real aqui)"""
        self.log("Simulando autenticação...")
        # Para teste, vamos usar um token fictício
        # Em produção, você faria login real aqui
        self.auth_token = "fake-jwt-token-for-testing"
        self.user_id = "fake-user-id"
        
        # Adicionar headers de autenticação
        self.session.headers.update({
            "Authorization": f"Bearer {self.auth_token}",
            "Content-Type": "application/json"
        })
        
        self.log("Autenticação simulada", "SUCCESS")
        return True
        
    def test_supabase_direct(self) -> Optional[Dict[str, Any]]:
        """Testa inserção direta no Supabase"""
        self.log("Testando inserção direta no Supabase...")
        
        # Primeiro, vamos buscar um cliente existente
        try:
            headers = {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
                "Content-Type": "application/json"
            }
            
            # Buscar clientes
            response = self.session.get(
                f"{SUPABASE_URL}/rest/v1/clientes?select=*&limit=1",
                headers=headers
            )
            
            if response.status_code != 200:
                self.log(f"Erro ao buscar clientes: {response.status_code} - {response.text}", "ERROR")
                return None
                
            clientes = response.json()
            if not clientes:
                self.log("Nenhum cliente encontrado. Crie um cliente primeiro.", "WARNING")
                return None
                
            cliente = clientes[0]
            self.log(f"Cliente encontrado: {cliente['nome']} (ID: {cliente['id']})", "SUCCESS")
            
            # Tentar criar processo
            processo_data = {
                "nome": f"Teste Backend - {datetime.now().isoformat()}",
                "cliente_id": cliente["id"],
                "tipo_entrada": "audio_video",
                "ai_model": "openai",
                "status": "aguardando"
            }
            
            self.log(f"Criando processo: {json.dumps(processo_data, indent=2)}")
            
            response = self.session.post(
                f"{SUPABASE_URL}/rest/v1/processos",
                headers={**headers, "Prefer": "return=representation"},
                json=processo_data
            )
            
            if response.status_code == 201:
                processo = response.json()[0]
                self.log(f"Processo criado com sucesso! ID: {processo['id']}", "SUCCESS")
                return processo
            else:
                self.log(f"Erro ao criar processo: {response.status_code}", "ERROR")
                self.log(f"Resposta: {response.text}", "ERROR")
                return None
                
        except Exception as e:
            self.log(f"Erro inesperado: {e}", "ERROR")
            return None
            
    def test_backend_endpoint(self) -> bool:
        """Testa endpoint do backend para criação de processo"""
        self.log("Testando endpoint do backend...")
        
        try:
            # Simular dados de um arquivo de áudio
            processo_data = {
                "nome": f"Teste Backend Endpoint - {datetime.now().isoformat()}",
                "cliente_id": 1,  # Assumindo que existe cliente com ID 1
                "tipo_entrada": "audio_video",
                "ai_model": "openai",
                "arquivo_nome": "teste_audio.mp3",
                "arquivo_tipo": "audio/mpeg"
            }
            
            response = self.session.post(
                f"{BACKEND_URL}/api/processos",
                json=processo_data
            )
            
            if response.status_code == 200 or response.status_code == 201:
                result = response.json()
                self.log(f"Processo criado via backend! Resposta: {json.dumps(result, indent=2)}", "SUCCESS")
                return True
            else:
                self.log(f"Erro no backend: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"Erro ao testar backend: {e}", "ERROR")
            return False
            
    def cleanup_test_processes(self):
        """Remove processos de teste criados"""
        self.log("Limpando processos de teste...")
        
        try:
            headers = {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
                "Content-Type": "application/json"
            }
            
            # Buscar processos de teste
            response = self.session.get(
                f"{SUPABASE_URL}/rest/v1/processos?nome=like.Teste*&select=id,nome",
                headers=headers
            )
            
            if response.status_code == 200:
                processos = response.json()
                for processo in processos:
                    delete_response = self.session.delete(
                        f"{SUPABASE_URL}/rest/v1/processos?id=eq.{processo['id']}",
                        headers=headers
                    )
                    if delete_response.status_code == 204:
                        self.log(f"Processo removido: {processo['nome']}", "SUCCESS")
                    else:
                        self.log(f"Erro ao remover processo {processo['id']}", "WARNING")
                        
        except Exception as e:
            self.log(f"Erro na limpeza: {e}", "WARNING")
            
    def run_all_tests(self):
        """Executa todos os testes"""
        self.log("=" * 50)
        self.log("INICIANDO TESTES DE CRIAÇÃO DE PROCESSO")
        self.log("=" * 50)
        
        # 1. Testar backend
        if not self.test_backend_health():
            self.log("Backend não está disponível. Alguns testes serão pulados.", "WARNING")
            
        # 2. Simular autenticação
        self.simulate_auth()
        
        # 3. Testar Supabase direto
        processo = self.test_supabase_direct()
        
        # 4. Testar endpoint do backend (se disponível)
        self.test_backend_endpoint()
        
        # 5. Limpeza
        self.cleanup_test_processes()
        
        self.log("=" * 50)
        self.log("TESTES CONCLUÍDOS")
        self.log("=" * 50)
        
if __name__ == "__main__":
    print("🔧 Teste de Criação de Processo - Backend")
    print("\n⚠️  IMPORTANTE: Ajuste as configurações no topo do arquivo:")
    print(f"   - BACKEND_URL: {BACKEND_URL}")
    print(f"   - SUPABASE_URL: {SUPABASE_URL}")
    print(f"   - SUPABASE_ANON_KEY: {SUPABASE_ANON_KEY[:20]}...")
    print("\n📋 Este script irá:")
    print("   1. Testar conexão com o backend")
    print("   2. Simular autenticação")
    print("   3. Testar criação direta no Supabase")
    print("   4. Testar endpoint do backend")
    print("   5. Limpar dados de teste")
    
    input("\nPressione Enter para continuar...")
    
    tester = ProcessoTester()
    tester.run_all_tests()