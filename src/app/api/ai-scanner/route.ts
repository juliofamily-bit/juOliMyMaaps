import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getFoodImageUrl, getBannerImageUrl, resetImageCounters } from '@/lib/foodImages';

// Permitir hasta 60 segundos de ejecución (evita timeout 504 en Vercel/Next.js)
export const maxDuration = 60;

// Initialize the Google Generative AI SDK
// The API key is securely stored in .env.local
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Configuración de Gemini no encontrada' }, { status: 500 });
    }

    const formData = await request.formData();
    const image = formData.get('image') as File | null;

    if (!image) {
      return NextResponse.json({ error: 'No se envió ninguna imagen' }, { status: 400 });
    }

    // Convert file to base64
    const arrayBuffer = await image.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');
    
    const prompt = `
      Eres un Diseñador de Marca Gastronómica, Sommelier y Chef Ejecutivo de máximo nivel.
      Analiza minuciosamente el archivo adjunto (foto de menú, carta física o PDF) y devuelve UNICAMENTE un objeto JSON con la siguiente estructura estricta. No agregues texto fuera del JSON.
      
      {
        "identidad": {
          "nombre_sugerido": "string (El nombre del local, deducido de la foto)",
          "descripcion_corta": "string (Un slogan atractivo y apetitoso)",
          "estilo_gastronomico": "string (ej. Marisquería & Pescados, Hamburguesería Gourmet, Pizzería Artesanal, Parrilla Tradicional, Cafetería, Cervecería)",
          "colores_sugeridos": { 
            "primario": "string (Hex code vibrante del color principal de la marca o carta: ej. naranja, rojo, verde oliva, dorado, etc.)", 
            "secundario": "string (Hex code del color de fondo o secundario de la carta)",
            "mode": "string ('dark' si el fondo de la carta es oscuro/negro, o 'light' si el fondo de la carta es blanco/claro)"
          },
          "tiene_logo_claro": "boolean"
        },
        "menu": [
          {
            "nombre_categoria": "string (ej. Pescados y Mariscos, Hamburguesas, Pizzas, Guarniciones, Bebidas, Postres)",
            "tipo_sector": "string ('cocina' o 'barra')",
            "productos": [
              {
                "nombre": "string (Nombre completo del plato tal cual figura en la carta)",
                "descripcion_atractiva": "string (Describe el plato con sus ingredientes principales, método de cocción y su guarnición exacta si la tiene: ej. 'Filet de merluza dorado al limón acompañado de papas fritas crocantes')",
                "precio": "number (sólo el número, sin el símbolo de moneda)",
                "guarnicion": "string (ej. papas fritas, puré de papas, ensalada mixta, arroz, o ninguna)",
                "palabra_clave_visual_en": "string (1 o 2 palabras en INGLÉS súper específicas del ingrediente o plato para buscar su foto gastronómica real: ej. 'octopus', 'artichoke', 'asparagus', 'prawns', 'calamari', 'ribeye', 'cheeseburger', 'salmon', 'tacos', 'salad', 'pizza', 'pasta')",
                "tiene_foto_en_menu": "boolean (true si la foto o documento del menú muestra una imagen real de este plato)",
                "descripcion_foto_menu": "string (si tiene foto en la carta, describe brevemente su presentación, ej: 'pulpo a las brasas sobre puré')",
                "ingredientes_base": [
                   { 
                     "nombre": "string (ej. Filet de Merluza, Papas, Aceite, Limón)", 
                     "unidad": "string ('gramo' | 'unidad' | 'ml')", 
                     "cantidad_estimada": "number" 
                   }
                ]
              }
            ]
          }
        ]
      }
      
      Reglas Críticas:
      1. EXACTITUD GASTRONÓMICA: Si el plato es pescado o marisco cocido (ej. pulpo, calamares, langostinos, merluza, filet), NUNCA lo clasifiques ni describas como sushi. Asigna 'palabra_clave_visual_en' fiel (ej. 'octopus' para pulpo, 'artichoke' para alcachofas, 'asparagus' para espárragos, 'prawns' para langostinos, 'calamari' para calamar). Reserva la palabra sushi SOLO si la carta vende rolls o comida japonesa.
      2. GUARNICIONES: Presta suma atención a si el plato incluye "con papas fritas", "con puré", "con ensalada", "al roquefort", etc., e incorpóralo siempre en el nombre y en la 'descripcion_atractiva'.
      3. FOTOS EN LA CARTA: Si el menú que estás leyendo ya tiene fotos impresas de los platos, pon 'tiene_foto_en_menu': true y describe en 'descripcion_foto_menu' cómo está presentado el plato para que la app lo replique fielmente con la máxima calidad estética.
      4. COLORES DE IDENTIDAD: Observa con mucha atención el diseño de la carta. Extrae el color representativo principal en formato hexadecimal (ej. #e11d48, #ea580c, #16a34a, #d97706, #2563eb). Si la carta es de fondo oscuro, pon mode 'dark'. Si la carta es clara o blanca, pon mode 'light'.
      5. CLASIFICACIÓN: Divide exactamente si la categoría va a "cocina" (platos de comida) o "barra" (tragos, cervezas, cafés, gaseosas).
      6. STOCK: Deduce ingredientes lógicos para cada plato.
      7. JSON válido y parseable directamente.
    `;

    // CASCADA DE INTELIGENCIA ARTIFICIAL:
    // Lista de modelos a intentar en orden. Si uno falla por alta demanda, pasa al siguiente.
    const fallbackModels = [
      'gemini-3.8-flash',
      'gemini-3.7-flash', 
      'gemini-2.5-flash',
      'gemini-pro-latest'
    ];

    let result = null;
    let errorDetalle = null;

    for (const modelName of fallbackModels) {
      try {
        console.log('Intentando escanear menú con el modelo: ' + modelName + '...');
        const model = genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: {
            responseMimeType: 'application/json',
          }
        });

        const imagePart = {
          inlineData: {
            data: base64Data,
            mimeType: image.type
          }
        };

        const response = await model.generateContent([
          prompt,
          imagePart
        ]);

        result = response;
        break; // Éxito, salimos del bucle
      } catch (err: any) {
        console.warn('[Cascada AI] El modelo ' + modelName + ' falló:', err.message);
        errorDetalle = err.message;
        // Continúa con el siguiente modelo en el bucle
      }
    }

    if (!result) {
      throw new Error('Todos los modelos de IA están sobrecargados. Último error: ' + errorDetalle);
    }
    let responseText = result.response.text();
    
    // Limpiar posibles bloques de markdown de la IA
    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // Verificar que sea un JSON válido antes de enviarlo al cliente
    let jsonResult: any;
    try {
      jsonResult = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Gemini no devolvió un JSON válido:', responseText);
      return NextResponse.json({ error: 'La IA no pudo estructurar correctamente el menú. Intenta con otra foto.' }, { status: 500 });
    }

    // Reiniciar contadores para rotación anti-repetición de imágenes en este menú
    resetImageCounters();

    // Inyectar banner temático basado en el estilo gastronómico
    const estilo = jsonResult.identidad?.estilo_gastronomico || '';
    if (jsonResult.identidad) {
      jsonResult.identidad.banner_url = getBannerImageUrl(estilo);
      if (!jsonResult.identidad.colores_sugeridos?.primario) {
        jsonResult.identidad.colores_sugeridos = {
          primario: '#f97316',
          secundario: '#1e293b',
          mode: 'dark'
        };
      }
    }

    // Asignación de Fotos Gastronómicas de Ultra-Alta Resolución con Cero Repetición
    if (Array.isArray(jsonResult.menu)) {
      let productIndexGlobal = 0;
      jsonResult.menu.forEach((cat: any) => {
        if (Array.isArray(cat.productos)) {
          cat.productos.forEach((prod: any) => {
            const queryName = `${prod.nombre} ${prod.guarnicion || ''} ${prod.palabra_clave_visual_en || ''}`.trim();
            prod.image_url = getFoodImageUrl(queryName, cat.nombre_categoria, productIndexGlobal);
            productIndexGlobal++;
          });
        }
      });
    }
    
    return NextResponse.json(jsonResult, { status: 200 });
    
  } catch (error: any) {
    console.error('Error in AI Scanner Route:', error);
    return NextResponse.json({ error: error.message || 'Hubo un error al procesar el menú con IA.' }, { status: 500 });
  }
}
