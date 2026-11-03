// Servicio de Envío de Correos Corporativos de Exclusividad Territorial vía Resend

interface SendAccessCodeParams {
  toEmail: string;
  restaurantName: string;
  ownerName?: string;
  city: string;
  province?: string;
  acceptanceCode: string;
}

export async function sendAccessCodeEmail({
  toEmail,
  restaurantName,
  ownerName,
  city,
  province,
  acceptanceCode,
}: SendAccessCodeParams) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn('⚠️ RESEND_API_KEY no encontrada en las variables de entorno. No se envió el correo.');
    return { success: false, error: 'API Key de Resend no configurada.' };
  }

  const destinationText = province ? `${city}, ${province}` : city;
  const greeting = ownerName ? `Hola ${ownerName},` : `Hola equipo de ${restaurantName},`;

  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tu Código de Exclusividad Territorial</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #050505; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #E2E8F0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #050505; padding: 40px 20px;">
      <tr>
        <td align="center">
          <table width="100%" style="max-width: 580px; background-color: #0B0F19; border: 1px solid rgba(255,255,255,0.08); border-radius: 28px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8);">
            
            <!-- Banner Superior Dorado -->
            <tr>
              <td style="background: linear-gradient(135deg, #F97316 0%, #D97706 50%, #B45309 100%); padding: 6px 0; text-align: center;">
                <span style="color: #FFFFFF; font-size: 10px; font-weight: 900; letter-spacing: 3px; text-transform: uppercase;">
                  VENTAJA COMPETITIVA EXCLUSIVA • MÁXIMO 5 LOCALES
                </span>
              </td>
            </tr>

            <!-- Header con Marca -->
            <tr>
              <td style="padding: 36px 36px 20px 36px; text-align: center;">
                <h2 style="color: #F97316; font-size: 26px; font-weight: 900; margin: 0; font-style: italic; letter-spacing: -0.5px;">
                  mmmTodoLoQueQuiero
                </h2>
                <p style="color: #64748B; font-size: 10px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin: 6px 0 0 0;">
                  PLATAFORMA SAAS GASTRONÓMICA
                </p>
              </td>
            </tr>

            <!-- Contenido Principal -->
            <tr>
              <td style="padding: 10px 36px 30px 36px;">
                <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 16px; padding: 12px 18px; margin-bottom: 24px; text-align: center;">
                  <span style="color: #F59E0B; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">
                    ⭐ 1 DE LOS 5 CUPOS ASIGNADO PARA: ${destinationText.toUpperCase()}
                  </span>
                </div>

                <p style="font-size: 15px; line-height: 1.6; color: #F1F5F9; margin: 0 0 16px 0;">
                  ${greeting}
                </p>
                <p style="font-size: 14px; line-height: 1.6; color: #94A3B8; margin: 0 0 20px 0;">
                  ¡Felicitaciones! Tu restaurante <strong style="color: #FFFFFF;">${restaurantName}</strong> ha calificado exitosamente para operar en <strong style="color: #F59E0B;">${destinationText}</strong>.
                </p>
                <p style="font-size: 13px; line-height: 1.6; color: #94A3B8; margin: 0 0 24px 0;">
                  Para proteger la rentabilidad y la ventaja competitiva de nuestros miembros, restringimos estrictamente el sistema a un máximo de 5 locales por ciudad. Tu plaza ha quedado temporalmente reservada.
                </p>

                <!-- Caja Gigante del Código de Activación -->
                <div style="background-color: #030712; border: 2px dashed #F59E0B; border-radius: 20px; padding: 26px; text-align: center; margin: 28px 0;">
                  <p style="color: #94A3B8; font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin: 0 0 10px 0;">
                    Tu Código de Aceptación y Activación:
                  </p>
                  <div style="color: #F59E0B; font-size: 40px; font-weight: 900; letter-spacing: 8px; margin: 0; font-family: 'Courier New', Courier, monospace; text-shadow: 0 0 25px rgba(245, 158, 11, 0.4);">
                    ${acceptanceCode}
                  </div>
                  <p style="color: #64748B; font-size: 11px; margin: 12px 0 0 0;">
                    Introduce este código en la pantalla de registro para desbloquear tu local.
                  </p>
                </div>

                <p style="font-size: 12px; line-height: 1.6; color: #64748B; margin: 20px 0 0 0; text-align: center;">
                  Si decides no activar tu local en las próximas 48 horas, el cupo quedará automáticamente disponible para el siguiente negocio en lista de espera.
                </p>
              </td>
            </tr>

            <!-- Footer Corporativo -->
            <tr>
              <td style="background-color: #070A12; border-top: 1px solid rgba(255,255,255,0.05); padding: 24px 36px; text-align: center;">
                <p style="color: #475569; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0;">
                  © 2026 mmmTodoLoQueQuiero Comer • Exclusividad Territorial Garantizada
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'Mmm TodoLoQueQuiero <onboarding@resend.dev>',
        to: [toEmail],
        subject: `🔑 Código de Activación (${acceptanceCode}) - Cupo Exclusivo en ${city}`,
        html: htmlContent,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('Error enviando email vía Resend:', data);
      return { success: false, error: data?.message || 'Error en Resend' };
    }

    return { success: true, id: data.id };
  } catch (err: any) {
    console.error('Fallo de conexión al enviar email:', err);
    return { success: false, error: err.message };
  }
}
