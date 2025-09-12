// Edge Function para fazer requisições HTTP para webhooks N8N
// Arquivo: supabase/functions/webhook-caller/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

interface WebhookRequest {
  webhook_url: string;
  payload: any;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body
    const { webhook_url, payload }: WebhookRequest = await req.json()

    if (!webhook_url) {
      return new Response(
        JSON.stringify({ error: 'webhook_url is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Calling webhook:', webhook_url)
    console.log('Payload size:', JSON.stringify(payload).length, 'characters')

    // Make HTTP request to N8N webhook
    const response = await fetch(webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    })

    const responseText = await response.text()
    
    console.log('Webhook response status:', response.status)
    console.log('Webhook response:', responseText)

    // Return success/failure based on response status
    const success = response.status >= 200 && response.status < 300
    
    return new Response(
      JSON.stringify({
        success,
        status: response.status,
        response: responseText,
        webhook_url,
        timestamp: new Date().toISOString()
      }),
      { 
        status: success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error calling webhook:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})