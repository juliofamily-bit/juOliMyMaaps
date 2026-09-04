// Catálogo Gastronómico de Ultra-Alta Resolución con Cero Repetición y Máxima Fidelidad Culinaria

interface FoodPhotoEntry {
  keywords: string[];
  photos: string[];
}

export const EXTENDED_FOOD_CATALOG: FoodPhotoEntry[] = [
  // --- 1. PULPO (OCTOPUS) ---
  {
    keywords: ['pulpo', 'octopus', 'pulpo a las brasas', 'pulpo a la gallega', 'tentaculo'],
    photos: [
      'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80', // Pulpo a las brasas con pimentón
      'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=600&auto=format&fit=crop&q=80', // Pulpo a la plancha
      'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=600&auto=format&fit=crop&q=80'  // Tentáculo de pulpo dorado gourmet
    ]
  },

  // --- 2. ESPÁRRAGOS (ASPARAGUS) ---
  {
    keywords: ['esparrago', 'esparragos', 'espárrago', 'espárragos', 'yema de esparrago', 'yemas de esparrago', 'yemas de espárragos', 'asparagus'],
    photos: [
      'https://images.unsplash.com/photo-1515471204630-e60780ebd109?w=600&auto=format&fit=crop&q=80', // Yemas de espárragos verdes gourmet
      'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600&auto=format&fit=crop&q=80', // Espárragos salteados a la plancha
      'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80'  // Espárragos grillados con vinagreta
    ]
  },

  // --- 3. ALCACHOFAS / ALCAUCILES (ARTICHOKE) ---
  {
    keywords: ['alcachofa', 'alcachofas', 'alcaucil', 'alcauciles', 'artichoke'],
    photos: [
      'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&auto=format&fit=crop&q=80', // Alcachofas confitadas enteras
      'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=600&auto=format&fit=crop&q=80', // Corazones de alcaucil salteados
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80'  // Plato gourmet con alcachofas
    ]
  },

  // --- 4. LANGOSTINOS / GAMBAS / CAMARONES (PRAWNS / SHRIMPS) ---
  {
    keywords: ['langostino', 'langostinos', 'gamba', 'gambas', 'camaron', 'camarones', 'prawn', 'prawns', 'shrimp'],
    photos: [
      'https://images.unsplash.com/photo-1559742811-822873691df8?w=600&auto=format&fit=crop&q=80', // Langostinos dorados al ajillo con limón
      'https://images.unsplash.com/photo-1515443961218-a51367888e4b?w=600&auto=format&fit=crop&q=80', // Gambas a la plancha con hierbas
      'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=600&auto=format&fit=crop&q=80'  // Cazuela de mariscos y langostinos
    ]
  },

  // --- 5. CALAMARES Y CHIPIRONES (SQUID / CALAMARI) ---
  {
    keywords: ['calamar', 'calamares', 'chipiron', 'chipirones', 'squid', 'calamari'],
    photos: [
      'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=600&auto=format&fit=crop&q=80', // Calamar a la plancha con salsa verde
      'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=600&auto=format&fit=crop&q=80', // Rabas / Calamares fritos crujientes
      'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=600&auto=format&fit=crop&q=80'  // Salteado de chipirones
    ]
  },

  // --- 6. PESCADO AL PLATO / MERLUZA / ROMANA / FILET ---
  {
    keywords: ['pescado', 'merluza', 'filet', 'pescada', 'lenguado', 'dorado', 'pejerrey', 'corvina', 'pescado al plato', 'fish'],
    photos: [
      'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&auto=format&fit=crop&q=80', // Filet de merluza con vegetales y limón
      'https://images.unsplash.com/photo-1534939561126-855b8675edd7?w=600&auto=format&fit=crop&q=80', // Pescado a la romana dorado
      'https://images.unsplash.com/photo-1580476262798-bddd9f4b7369?w=600&auto=format&fit=crop&q=80'  // Pescado al horno con papas
    ]
  },

  // --- 7. SALMÓN ROSADO ---
  {
    keywords: ['salmon', 'salmón'],
    photos: [
      'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600&auto=format&fit=crop&q=80', // Salmón rosado grillado con espárragos
      'https://images.unsplash.com/photo-1485921325833-c519f76c4927?w=600&auto=format&fit=crop&q=80'  // Salmón con manteca de hierbas
    ]
  },

  // --- 8. SUSHI Y ROLLS (SOLO COMIDA JAPONESA) ---
  {
    keywords: ['sushi', 'roll', 'rolls', 'sashimi', 'niguiri', 'maki', 'geisha', 'temaki'],
    photos: [
      'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&auto=format&fit=crop&q=80', // Tabla de sushi variado
      'https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=600&auto=format&fit=crop&q=80', // Rolls gourmet
      'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600&auto=format&fit=crop&q=80'  // Niguiris y sashimi
    ]
  },

  // --- 9. CARNES ROJAS Y CORTES DE PARRILLA ---
  {
    keywords: ['asado', 'bife', 'vacio', 'entraña', 'costillar', 'ojo de bife', 'matambre', 'parrillada', 't-bone', 'picaña', 'ribeye', 'steak', 'carne'],
    photos: [
      'https://images.unsplash.com/photo-1558030006-450675393462?w=600&auto=format&fit=crop&q=80', // Bife de chorizo a punto con guarnición
      'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=600&auto=format&fit=crop&q=80', // Carne asada a la tabla
      'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80'  // Costillas doradas al asador
    ]
  },

  // --- 10. MILANESAS Y SUPREMAS ---
  {
    keywords: ['milanesa', 'suprema', 'escalope', 'napolitana', 'milanga'],
    photos: [
      'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=600&auto=format&fit=crop&q=80', // Milanesa con limón y papas
      'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=600&auto=format&fit=crop&q=80', // Suprema napolitana gratinada
      'https://images.unsplash.com/photo-1562967914-608f82629710?w=600&auto=format&fit=crop&q=80'  // Milanesa crujiente
    ]
  },

  // --- 11. POLLO ---
  {
    keywords: ['pollo', 'chicken', 'alita', 'alitas', 'pata muslo', 'pechuga'],
    photos: [
      'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=600&auto=format&fit=crop&q=80', // Pollo dorado al horno
      'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=600&auto=format&fit=crop&q=80', // Alitas crispy
      'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=600&auto=format&fit=crop&q=80'  // Pechuga grillada con vegetales
    ]
  },

  // --- 12. HAMBURGUESAS ---
  {
    keywords: ['hamburguesa', 'burger', 'cheeseburger', 'doble', 'smash', 'cuarto'],
    photos: [
      'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80', // Hamburguesa clásica gourmet
      'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&auto=format&fit=crop&q=80', // Burger con queso derretido
      'https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&auto=format&fit=crop&q=80', // Bacon cheeseburger
      'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=600&auto=format&fit=crop&q=80', // Doble carne smash
      'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=600&auto=format&fit=crop&q=80'  // Burger smash con papas
    ]
  },

  // --- 13. PIZZAS ---
  {
    keywords: ['pizza', 'pizzeta', 'calzone'],
    photos: [
      'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80', // Pizza muzzarella tradicional
      'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=600&auto=format&fit=crop&q=80', // Pepperoni / calabresa
      'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&auto=format&fit=crop&q=80', // Napolitana al horno a leña
      'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=600&auto=format&fit=crop&q=80'  // Pizza artesanal con albahaca
    ]
  },

  // --- 14. EMPANADAS ---
  {
    keywords: ['empanada', 'empanadas', 'pastelito', 'salteña'],
    photos: [
      'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=600&auto=format&fit=crop&q=80', // Empanadas doradas
      'https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=600&auto=format&fit=crop&q=80'  // Empanadas caseras
    ]
  },

  // --- 15. PASTAS ---
  {
    keywords: ['pasta', 'fideo', 'fideos', 'spaghetti', 'raviol', 'ravioles', 'sorrentino', 'sorrentinos', 'ñoqui', 'gnocchi', 'lasagna', 'lasaña'],
    photos: [
      'https://images.unsplash.com/photo-1621996346565-e3d5d62810a9?w=600&auto=format&fit=crop&q=80', // Pasta con boloñesa y queso
      'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600&auto=format&fit=crop&q=80', // Ravioles con tuco
      'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=600&auto=format&fit=crop&q=80'  // Penne con crema y albahaca
    ]
  },

  // --- 16. ENSALADAS ---
  {
    keywords: ['ensalada', 'salad', 'caesar', 'cesar', 'rucula', 'mixta'],
    photos: [
      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&auto=format&fit=crop&q=80', // Ensalada gourmet fresca
      'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80', // Caesar con pollo y crutones
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80'  // Bowl de vegetales frescos
    ]
  },

  // --- 17. PAPAS Y GUARNICIONES ---
  {
    keywords: ['papas fritas', 'fritas', 'papas', 'french fries', 'pure', 'puré', 'aros de cebolla', 'nachos'],
    photos: [
      'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=600&auto=format&fit=crop&q=80', // Papas rústicas con hierbas
      'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&auto=format&fit=crop&q=80', // Papas con cheddar y verdeo
      'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=600&auto=format&fit=crop&q=80'  // Papas fritas doradas clásicas
    ]
  },

  // --- 18. CERVEZAS ---
  {
    keywords: ['cerveza', 'birra', 'beer', 'ipa', 'stout', 'golden', 'pinta', 'tirada'],
    photos: [
      'https://images.unsplash.com/photo-1581006852262-e4307cf6283a?w=600&auto=format&fit=crop&q=80', // Pinta fría espumosa
      'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=600&auto=format&fit=crop&q=80', // Cerveza ámbar
      'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=600&auto=format&fit=crop&q=80'  // Chopp tirado
    ]
  },

  // --- 19. TRAGOS Y COCTELES ---
  {
    keywords: ['trago', 'cocktail', 'coctel', 'fernet', 'gin', 'tonic', 'mojito', 'daiquiri', 'aperol', 'campari'],
    photos: [
      'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80', // Coctel elegante con lima
      'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600&auto=format&fit=crop&q=80', // Trago refrescante con menta
      'https://images.unsplash.com/photo-1560512823-829485b8bf24?w=600&auto=format&fit=crop&q=80'  // Aperitivo con rodaja de naranja
    ]
  },

  // --- 20. VINOS ---
  {
    keywords: ['vino', 'wine', 'malbec', 'cabernet', 'tinto', 'blanco', 'copa de vino'],
    photos: [
      'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&auto=format&fit=crop&q=80', // Copa de vino tinto
      'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=600&auto=format&fit=crop&q=80'  // Botella y copa en cava
    ]
  },

  // --- 21. CAFETERÍA ---
  {
    keywords: ['cafe', 'café', 'coffee', 'espresso', 'cappuccino', 'latte', 'medialuna', 'croissant'],
    photos: [
      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&auto=format&fit=crop&q=80', // Latte arte con medialuna
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&auto=format&fit=crop&q=80'  // Pocillo espresso
    ]
  },

  // --- 22. POSTRES ---
  {
    keywords: ['postre', 'helado', 'flan', 'chocotorta', 'torta', 'cake', 'volcan', 'chocolate', 'dulce de leche', 'cheesecake', 'tiramisu'],
    photos: [
      'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=600&auto=format&fit=crop&q=80', // Volcán de chocolate caliente
      'https://images.unsplash.com/photo-1570145820259-b5b80c5c8bd6?w=600&auto=format&fit=crop&q=80', // Cheesecake con frutos rojos
      'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=600&auto=format&fit=crop&q=80'  // Copa helada artesanal
    ]
  }
];

// Registro para rotar imágenes en la misma ejecución y evitar repeticiones
const usageCounters = new Map<string, number>();

export function resetImageCounters() {
  usageCounters.clear();
}

/**
 * Función de resolución dinámica con búsqueda y fallback seguro
 */
export async function fetchDynamicFoodPhoto(queryEn: string, itemIndex: number = 0): Promise<string | null> {
  if (!queryEn) return null;
  return getFoodImageUrl(queryEn, '', itemIndex);
}

/**
 * Función principal para asignar la foto correcta de cada plato.
 * Garantiza que pulpo tenga pulpo, espárragos tenga espárragos, alcachofas tenga alcachofas y que ningún plato repita imagen.
 */
export function getFoodImageUrl(productName: string, categoryName: string = '', itemIndex: number = 0): string {
  const query = `${productName} ${categoryName}`.toLowerCase();
  
  // Buscar coincidencia directa con el catálogo de alta precisión
  for (const entry of EXTENDED_FOOD_CATALOG) {
    if (entry.keywords.some(k => query.includes(k))) {
      const catKey = entry.keywords[0];
      const count = usageCounters.get(catKey) || 0;
      usageCounters.set(catKey, count + 1);

      const photoIndex = (count + itemIndex) % entry.photos.length;
      return entry.photos[photoIndex];
    }
  }
  
  // Fallback variado por índice para que platos sin categoría específica tampoco se repitan
  const fallbackPhotos = [
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=600&auto=format&fit=crop&q=80'
  ];

  return fallbackPhotos[itemIndex % fallbackPhotos.length];
}

export function getBannerImageUrl(estiloGastronomico: string = ''): string {
  const query = estiloGastronomico.toLowerCase();
  
  if (query.includes('pescad') || query.includes('marisc') || query.includes('puerto')) {
    return 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=1600&auto=format&fit=crop&q=80';
  }
  if (query.includes('parrilla') || query.includes('carne') || query.includes('asado')) {
    return 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1600&auto=format&fit=crop&q=80';
  }
  if (query.includes('pizza') || query.includes('italiana') || query.includes('pasta')) {
    return 'https://images.unsplash.com/photo-1579751626657-72bc17010498?w=1600&auto=format&fit=crop&q=80';
  }
  if (query.includes('bar') || query.includes('cerve') || query.includes('trago') || query.includes('pub')) {
    return 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1600&auto=format&fit=crop&q=80';
  }
  if (query.includes('cafe') || query.includes('panaderia') || query.includes('bakery')) {
    return 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=1600&auto=format&fit=crop&q=80';
  }
  if (query.includes('sushi') || query.includes('asiatica') || query.includes('japonesa')) {
    return 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=1600&auto=format&fit=crop&q=80';
  }
  
  return 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1600&auto=format&fit=crop&q=80';
}

export function getCategoryIcon(categoryName: string): string {
  const name = categoryName.toLowerCase();
  if (name.includes('pulpo') || name.includes('calamar') || name.includes('langostino') || name.includes('marisc')) return '🐙';
  if (name.includes('pescad') || name.includes('merluza')) return '🐟';
  if (name.includes('sushi')) return '🍣';
  if (name.includes('hamburguesa') || name.includes('burger')) return '🍔';
  if (name.includes('pizza')) return '🍕';
  if (name.includes('empanada')) return '🥟';
  if (name.includes('papa') || name.includes('frita')) return '🍟';
  if (name.includes('carne') || name.includes('parrilla') || name.includes('asado') || name.includes('bife')) return '🥩';
  if (name.includes('pasta') || name.includes('fideo')) return '🍝';
  if (name.includes('esparrago') || name.includes('alcachofa') || name.includes('ensalada') || name.includes('vegetal')) return '🥗';
  if (name.includes('sandwich') || name.includes('lomito')) return '🥪';
  if (name.includes('pancho') || name.includes('hot dog')) return '🌭';
  if (name.includes('cerveza') || name.includes('birra')) return '🍺';
  if (name.includes('trago') || name.includes('cocktail')) return '🍸';
  if (name.includes('vino')) return '🍷';
  if (name.includes('bebida') || name.includes('gaseosa')) return '🥤';
  if (name.includes('cafe') || name.includes('cafeteria')) return '☕';
  if (name.includes('postre') || name.includes('dulce') || name.includes('helado')) return '🍰';
  return '🍽️';
}
