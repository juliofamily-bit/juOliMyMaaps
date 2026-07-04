import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const planes = [
  {
    name: 'Plan Básico',
    price_ars: 29900,
    features: [
      { name: "Menú Digital (Delivery / Takeaway)", desc: "Tus clientes pueden ver tus productos, armar un carrito y hacer pedidos para envío a domicilio o retiro en el local desde su celular." },
      { name: "Control de Stock (Básico)", desc: "Evitá vender lo que no tenés. Marcá productos como agotados automáticamente cuando el stock llega a cero." },
      { name: "Landing Page del Local", desc: "Tu propia página web profesional con fotos, horarios, ubicación y enlace a tu menú." },
      { name: "Monitor de Cocina (KDS)", desc: "Una pantalla digital para que tus cocineros vean los pedidos entrantes sin usar papel." },
      { name: "Pasarela de Pago (Mercado Pago)", desc: "Cobrá los pedidos directamente a tu cuenta sin intermediarios ni comisiones extra." },
      { name: "Soporte Estándar", desc: "Ayuda por chat y correo electrónico." },
      { name: "Cuentas de Personal Base", desc: "Incluye acceso para 1 Administrador, Cajero, Cocina y Delivery." }
    ]
  },
  {
    name: 'Plan Intermedio',
    price_ars: 59900,
    features: [
      { name: "Menú Digital (Salón y Delivery)", desc: "Dos menús operando juntos. El de salón usa Códigos QR en cada mesa." },
      { name: "Gestión de Mesas y Roles (Hasta 6 cuentas)", desc: "Mapa de mesas libres/ocupadas. Podés crear hasta 6 cuentas separadas para tu personal además de tu Caja y Cocina." },
      { name: "Facturación AFIP", desc: "Emití facturas A, B y C legales de forma automática con cada pedido, sin salir de la plataforma." },
      { name: "Códigos de Descuento y Ofertas", desc: "Creá cupones o programá Happy Hours automáticos." },
      { name: "Balance Financiero y Contabilidad", desc: "Panel completo para ver tus ingresos, gastos, rentabilidad diaria y mensual." },
      { name: "Documentos Exportables", desc: "Descargá tus balances, ventas y listado de productos en Excel o PDF." },
      { name: "Reseñas de Clientes (Filtro Inteligente)", desc: "Recibí calificaciones de tus clientes. Quedate con las quejas en privado y enviá a los felices a Google Maps." }
    ]
  },
  {
    name: 'Plan Avanzado',
    price_ars: 90000,
    features: [
      { name: "División Inteligente de Comandas 🌟", desc: "El sistema separa automáticamente los pedidos. Las hamburguesas van a la pantalla de cocina y los tragos a la pantalla del bartender. Acceso habilitado al Rol de Barra.", isExclusive: true },
      { name: "Social Dining (Muro Interactivo Base) 🌟", desc: "Convierte tu local en una red social. Los clientes ven un muro en vivo donde pueden enviar mensajes de texto entre mesas.", isExclusive: true },
      { name: "Reservas de Mesas (con Seña) 🌟", desc: "Los clientes reservan pagando una seña. Se genera un cupón de descuento automático válido por esa seña.", isExclusive: true },
      { name: "Control de Productos Vencidos", desc: "Control estricto de fechas de caducidad. El sistema te avisa qué insumos están por vencer." },
      { name: "Soporte Prioritario", desc: "Fila rápida de atención por WhatsApp." },
      { name: "Más Cuentas de Personal", desc: "Ampliamos el límite de cuentas para staff." }
    ]
  },
  {
    name: 'Plan Pro',
    price_ars: 150000,
    features: [
      { name: "Multimedia y Regalos en Muro 🌟", desc: "Tus clientes pueden subir fotos, usar reacciones, e invitarse bebidas o postres de regalo entre mesas.", isExclusive: true },
      { name: "Programa de Fidelización (Puntos) 🌟", desc: "Tus clientes suman puntos con cada compra que luego pueden canjear por premios.", isExclusive: true },
      { name: "Portal de Franquicias (Multi-Sucursal) 🌟", desc: "Si tenés varias sucursales, controlá el stock, los balances y los menús de todas desde un solo panel maestro.", isExclusive: true },
      { name: "Cuentas Ilimitadas", desc: "Creá todos los usuarios de staff que necesites sin restricciones." },
      { name: "Soporte VIP 24/7", desc: "Asistencia directa las 24 horas del día con un gerente de cuenta asignado." }
    ]
  }
];

// Map old names to new ones to perform update.
const mapping = {
  'Básico': 'Plan Básico',
  'Avanzado': 'Plan Intermedio', // previous Avanzado is now Intermedio
  'Pro Ilimitado': 'Plan Avanzado',
  'Premium VIP': 'Plan Pro'
};

async function updateDB() {
  const { data: existing } = await supabase.from('saas_plans').select('*');
  for (const oldName of Object.keys(mapping)) {
    const newName = mapping[oldName];
    const planConfig = planes.find(p => p.name === newName);
    const dbPlan = existing.find(p => p.name === oldName);
    if (dbPlan) {
      console.log(`Updating ${oldName} to ${newName}`);
      await supabase.from('saas_plans').update({
        name: planConfig.name,
        price_ars: planConfig.price_ars,
        features: JSON.stringify(planConfig.features)
      }).eq('id', dbPlan.id);
    }
  }
  console.log("Done");
}

updateDB();
