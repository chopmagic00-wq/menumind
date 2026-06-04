import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { GoogleGenAI } from "npm:@google/genai"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // 1. Gestione del Preflight CORS (obbligatorio per le chiamate fetch del browser)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Recupero della chiave Gemini dalle variabili d'ambiente di Supabase
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY")
    if (!geminiApiKey) {
      throw new Error("Chiave GEMINI_API_KEY mancante nel Vault di Supabase.")
    }

    // Inizializzazione dell'SDK ufficiale di Gemini
    const ai = new GoogleGenAI({ apiKey: geminiApiKey })

    // 3. Parsing del Payload inviato dal frontend
    const body = await req.json()
    const { modalita, listaPiattiMenu } = body

    // ==========================================
    // MODALITÀ A: GESTIONE CHATBOT
    // ==========================================
    if (modalita === "chat") {
      const { messaggioChat } = body
      
      const promptChat = `
        Sei l'assistente Chef AI di MenuMind, un software SaaS per la gestione dei ristoranti.
        Aiuta l'utente a ottimizzare i costi, le ricette o a fare analisi basandoti sui suoi piatti attuali.
        
        Ecco i piatti attualmente presenti nella sua tabella (con prezzi di vendita e costi della materia prima):
        ${JSON.stringify(listaPiattiMenu, null, 2)}
        
        Rispondi in modo professionale, conciso e focalizzato sul business della ristorazione.
        Domanda dello Chef: "${messaggioChat}"
      `

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: promptChat,
      })

      return new Response(
        JSON.stringify({ successo: true, risposta: response.text }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ==========================================
    // MODALITÀ B: ELABORAZIONE FATTURA
    // ==========================================
    if (modalita === "fattura") {
      const { fileData, fileType } = body

      if (!fileData) {
        throw new Error("Nessun dato file ricevuto.")
      }

      const promptFattura = `
        Analizza questa fattura o ricevuta di fornitura per ristorante.
        Il menu del ristorante contiene solo questi piatti: ${JSON.stringify(listaPiattiMenu)}.

        Estrai gli ingredienti acquistati e associali ESCLUSIVAMENTE a uno dei piatti del menu sopra elencati.
        Se un ingrediente non è associabile a nessun piatto, ignoralo.
        Calcola il prezzo unitario o l'impatto di quell'ingrediente sul costo totale del piatto.

        Devi rispondere RIGOROSAMENTE ed ESCLUSIVAMENTE con un oggetto JSON valido (senza markdown, senza tag \`\`\`json), strutturato in questo modo:
        {
          "ingredienti_estratti": [
            {
              "nome": "Nome ingrediente",
              "quantita": "es. 5kg o 2 casse",
              "piatto_associato": "Nome Esatto Del Piatto Del Menu",
              "prezzo_unitario": 4.50
            }
          ]
        }
      `

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            inlineData: {
              mimeType: fileType,
              data: fileData
            }
          },
          promptFattura
        ],
      })

      // Pulisce la risposta da eventuali blocchi di codice markdown inclusi per errore dall'IA
      let textResponse = response.text.trim()
      if (textResponse.startsWith("```json")) textResponse = textResponse.replace(/```json|```/g, "")
      if (textResponse.startsWith("```")) textResponse = textResponse.replace(/```/g, "")

      const datiEstratti = JSON.parse(textResponse.trim())

      return new Response(
        JSON.stringify({ successo: true, dati: datiEstratti }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    throw new Error("Modalità non valida. Scegli tra 'chat' o 'fattura'.")

  } catch (error) {
    return new Response(
      JSON.stringify({ successo: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})