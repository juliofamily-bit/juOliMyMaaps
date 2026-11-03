// Datos Geográficos y Normalización para Exclusividad Territorial

export const COUNTRIES = [
  { code: 'AR', name: 'Argentina' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'CL', name: 'Chile' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'BR', name: 'Brasil' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'PE', name: 'Perú' },
  { code: 'CO', name: 'Colombia' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'MX', name: 'México' },
  { code: 'ES', name: 'España' },
  { code: 'US', name: 'Estados Unidos' },
  { code: 'OT', name: 'Otro País' },
];

export const ARGENTINA_PROVINCES: { [key: string]: string[] } = {
  'Ciudad Autónoma de Buenos Aires': [
    'Palermo', 'Recoleta', 'Belgrano', 'Caballito', 'San Telmo', 'Puerto Madero', 
    'Almagro', 'Villa Urquiza', 'Villa Crespo', 'Flores', 'Colegiales', 'Microcentro'
  ],
  'Buenos Aires': [
    'La Plata', 'Mar del Plata', 'Bahía Blanca', 'Tandil', 'San Isidro', 'Vicente López',
    'Tigre', 'Quilmes', 'Lomas de Zamora', 'Morón', 'Lanús', 'San Martín', 'Pilar',
    'Campana', 'Zárate', 'San Nicolás', 'Pergamino', 'Olavarría', 'Junín', 'Necochea'
  ],
  'Córdoba': [
    'Córdoba Capital', 'Villa Carlos Paz', 'Río Cuarto', 'Villa María', 'Alta Gracia',
    'San Francisco', 'Bell Ville', 'Jesús María', 'Río Tercero', 'La Falda', 'Cosquín'
  ],
  'Santa Fe': [
    'Rosario', 'Santa Fe Capital', 'Rafaela', 'Venado Tuerto', 'Reconquista', 
    'Santo Tomé', 'Villa Gobernador Gálvez', 'Esperanza', 'San Lorenzo', 'Granadero Baigorria'
  ],
  'Mendoza': [
    'Mendoza Capital', 'Godoy Cruz', 'Guaymallén', 'Las Heras', 'San Rafael', 
    'Maipú', 'Luján de Cuyo', 'San Martín', 'Tunuyán', 'General Alvear'
  ],
  'Tucumán': [
    'San Miguel de Tucumán', 'Yerba Buena', 'Tafí Viejo', 'Concepción', 'Banda del Río Salí', 'Aguilares'
  ],
  'Salta': [
    'Salta Capital', 'San Ramón de la Nueva Orán', 'Tartagal', 'Cafayate', 'General Güemes', 'Rosario de la Frontera'
  ],
  'Entre Ríos': [
    'Paraná', 'Concordia', 'Gualeguaychú', 'Concepción del Uruguay', 'Colón', 'Gualeguay', 'Villaguay'
  ],
  'Misiones': [
    'Posadas', 'Puerto Iguazú', 'Oberá', 'Eldorado', 'Apóstoles', 'San Vicente'
  ],
  'Chaco': [
    'Resistencia', 'Presidencia Roque Sáenz Peña', 'Villa Ángela', 'Barranqueras', 'Fontana', 'Castelli'
  ],
  'Corrientes': [
    'Corrientes Capital', 'Goya', 'Paso de los Libres', 'Curuzú Cuatiá', 'Mercedes', 'Bella Vista'
  ],
  'Santiago del Estero': [
    'Santiago del Estero Capital', 'La Banda', 'Termas de Río Hondo', 'Frías', 'Añatuya'
  ],
  'San Juan': [
    'San Juan Capital', 'Rawson', 'Rivadavia', 'Chimbas', 'Santa Lucía', 'Pocito', 'Caucete'
  ],
  'Jujuy': [
    'San Salvador de Jujuy', 'San Pedro de Jujuy', 'Palpalá', 'Libertador General San Martín', 'Perico', 'Tilcara'
  ],
  'Río Negro': [
    'San Carlos de Bariloche', 'General Roca', 'Cipolletti', 'Viedma', 'Villa Regina', 'Las Grutas'
  ],
  'Neuquén': [
    'Neuquén Capital', 'San Martín de los Andes', 'Plottier', 'Cutral Có', 'Centenario', 'Villa La Angostura'
  ],
  'Formosa': [
    'Formosa Capital', 'Clorinda', 'Pirané', 'El Colorado', 'Las Lomitas'
  ],
  'Chubut': [
    'Comodoro Rivadavia', 'Trelew', 'Puerto Madryn', 'Esquel', 'Rawson', 'Rada Tilly'
  ],
  'San Luis': [
    'San Luis Capital', 'Villa Mercedes', 'Merlo', 'La Punta', 'Juana Koslay'
  ],
  'Catamarca': [
    'San Fernando del Valle de Catamarca', 'Valle Viejo', 'Andalgalá', 'Tinogasta', 'Belén', 'Santa María'
  ],
  'La Rioja': [
    'La Rioja Capital', 'Chilecito', 'Aimogasta', 'Chamical', 'Chepes'
  ],
  'La Pampa': [
    'Santa Rosa', 'General Pico', 'Toay', 'Eduardo Castex', 'Realicó'
  ],
  'Santa Cruz': [
    'Río Gallegos', 'Caleta Olivia', 'El Calafate', 'Pico Truncado', 'Puerto Deseado'
  ],
  'Tierra del Fuego': [
    'Ushuaia', 'Río Grande', 'Tolhuin'
  ]
};

/**
 * Normaliza cadenas de texto para comparar ciudades y provincias
 * Remueve tildes, espacios extra, puntuación y convierte a minúsculas
 */
export function normalizeLocation(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quita acentos
    .replace(/[^a-z0-9\s]/g, '')     // Quita caracteres especiales
    .replace(/\s+/g, ' ');           // Unifica espacios
}

/**
 * Genera un código de acceso/aceptación aleatorio único de 6 caracteres
 */
export function generateRandomAccessCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Sin 0, O, 1, I para evitar confusiones de lectura
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
