/**
 * Sanitiza números de celular de Argentina para formatearlos de acuerdo
 * a los requerimientos de la API de WhatsApp (wa.me), asegurando el prefijo 549
 * y eliminando el 15 si se ingresó.
 */
export const cleanArgPhone = (phone: string): string => {
  if (!phone) return '';
  
  // 1. Limpiar todos los caracteres no numéricos
  let digits = phone.replace(/\D/g, '');
  
  if (!digits) return '';

  // 2. Extraer el número nacional sin código de país o cero inicial
  let national = digits;
  if (digits.startsWith('549')) {
    national = digits.substring(3);
  } else if (digits.startsWith('54')) {
    national = digits.substring(2);
  }
  
  if (national.startsWith('0')) {
    national = national.substring(1);
  }
  
  // 3. Manejar el "15" según la longitud y posición
  // Caso A: Empieza con 15 y tiene 8 o 9 dígitos (ej: 154123456 -> Neuquén/default 299)
  if (national.startsWith('15') && (national.length === 8 || national.length === 9)) {
    national = '299' + national.substring(2);
  }
  // Caso B: Área de 3 dígitos + 15 (ej: 299 15 1234567) -> longitud 12
  else if (national.length === 12 && national.substring(3, 5) === '15') {
    national = national.substring(0, 3) + national.substring(5);
  }
  // Caso C: Área de 2 dígitos + 15 (ej: 11 15 12345678) -> longitud 12
  else if (national.length === 12 && national.substring(2, 4) === '15') {
    national = national.substring(0, 2) + national.substring(4);
  }
  // Caso D: Área de 4 dígitos + 15 (ej: 2994 15 123456) -> longitud 12
  else if (national.length === 12 && national.substring(4, 6) === '15') {
    national = national.substring(0, 4) + national.substring(6);
  }
  
  // 4. Si el nacional resultante tiene 10 dígitos (estándar), añadir 549
  if (national.length === 10) {
    return '549' + national;
  }
  
  // Si el original ya tiene 549 y tenía longitud correcta de 13 dígitos
  if (digits.startsWith('549') && digits.length === 13) {
    return digits;
  }
  
  // Si el original tiene 10 dígitos (perfecto local)
  if (digits.length === 10) {
    return '549' + digits;
  }
  
  // Si tiene 12 dígitos y empieza con 54 (pero no 549), le inyectamos el 9 celular
  if (digits.startsWith('54') && digits.length === 12 && !digits.startsWith('549')) {
    return '549' + digits.substring(2);
  }

  if (digits.startsWith('549')) {
    return digits;
  }

  if (digits.startsWith('54')) {
    return '549' + digits.substring(2);
  }
  
  // Prefijo fallback para Argentina
  return '549' + digits;
};

/**
 * Extrae los dígitos nacionales de un número telefónico (área + abonado local),
 * eliminando códigos de país (+54, 549, 54), el cero (0) de larga distancia
 * y el prefijo de celular (15) en Argentina.
 */
export const extractNationalDigits = (phone?: string | null): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';

  let national = digits;
  if (digits.startsWith('549')) {
    national = digits.substring(3);
  } else if (digits.startsWith('54')) {
    national = digits.substring(2);
  }

  if (national.startsWith('0')) {
    national = national.substring(1);
  }

  // Manejo del prefijo 15 de celulares en Argentina
  if (national.length === 12 && national.substring(3, 5) === '15') {
    national = national.substring(0, 3) + national.substring(5);
  } else if (national.length === 12 && national.substring(2, 4) === '15') {
    national = national.substring(0, 2) + national.substring(4);
  } else if (national.length === 12 && national.substring(4, 6) === '15') {
    national = national.substring(0, 4) + national.substring(6);
  } else if (national.length === 11 && national.startsWith('15')) {
    national = national.substring(2);
  }

  return national;
};

/**
 * Determina de forma estricta si un número telefónico ingresado está COMPLETO.
 * Para Argentina (+54), un número celular completo consta obligatoriamente
 * de exactamente 10 dígitos nacionales (código de área + número de abonado).
 * Si tiene 3, 4, 6 u 8 dígitos, el número está INCOMPLETO y bajo ninguna
 * circunstancia debe consultar bases de datos ni activar descuentos.
 */
export const isCompletePhoneNumber = (phone?: string | null, prefix: string = '+54'): boolean => {
  if (!phone || typeof phone !== 'string') return false;
  const rawDigits = phone.replace(/\D/g, '');
  if (!rawDigits) return false;

  const isArgentina = prefix.includes('54') || phone.startsWith('+54') || phone.startsWith('54');

  if (isArgentina) {
    const national = extractNationalDigits(phone);
    return national.length === 10;
  }

  // Otros países
  if (prefix.includes('56') || prefix.includes('595') || prefix.includes('51')) {
    return rawDigits.length >= 9;
  }
  if (prefix.includes('598') || prefix.includes('591')) {
    return rawDigits.length >= 8;
  }
  if (prefix.includes('55')) {
    return rawDigits.length >= 10;
  }

  return rawDigits.length >= 8;
};

/**
 * Extrae los dígitos significativos finales para comparar si dos números
 * pertenecen a la misma persona en Argentina (área + abonado).
 */
export const getPhoneMatchKey = (phone?: string | null): string => {
  if (!phone) return '';
  const national = extractNationalDigits(phone);
  if (national && national.length === 10) {
    return national;
  }
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 8 ? digits.slice(-8) : digits;
};

/**
 * Comprueba si dos teléfonos corresponden a la misma persona física de forma exacta.
 * Exige que ambos números estén completos y coincidan en sus 10 dígitos nacionales
 * (área + abonado), evitando falsas coincidencias entre ciudades o números parciales.
 */
export const isSamePhone = (phoneA?: string | null, phoneB?: string | null): boolean => {
  if (!phoneA || !phoneB) return false;
  const natA = extractNationalDigits(phoneA);
  const natB = extractNationalDigits(phoneB);

  // Si alguno está incompleto (< 8 dígitos), no pueden coincidir
  if (natA.length < 8 || natB.length < 8) return false;

  // Si ambos tienen 10 dígitos (estándar argentino completo), deben ser idénticos
  if (natA.length === 10 && natB.length === 10) {
    return natA === natB;
  }

  const cleanA = cleanArgPhone(phoneA);
  const cleanB = cleanArgPhone(phoneB);
  if (cleanA && cleanB && cleanA === cleanB) return true;

  return natA === natB;
};

/**
 * Combina nombres de un mismo cliente asociados al mismo número telefónico.
 * Si el cliente se identificó como "Maxes" y en otro pedido como "Max",
 * el resultado será "Maxes / Max".
 * Evita duplicados insensibles a mayúsculas y filtra nombres genéricos.
 */
export const mergeClientNames = (...names: (string | null | undefined)[]): string => {
  const generic = new Set([
    'cliente frecuente',
    'sin nombre',
    'cliente',
    'consumidor final',
    'anónimo',
    'anonimo',
    'n/a',
    'desconocido',
    ''
  ]);

  const uniqueParts: string[] = [];
  const seen = new Set<string>();

  for (const raw of names) {
    if (!raw) continue;
    // Dividir si ya viene con barras ("Maxes / Max" o "Maxes/Max")
    const segments = raw.split('/').map(s => s.trim()).filter(Boolean);
    for (const seg of segments) {
      const norm = seg.toLowerCase();
      if (!generic.has(norm) && !seen.has(norm)) {
        seen.add(norm);
        uniqueParts.push(seg);
      }
    }
  }

  return uniqueParts.length > 0 ? uniqueParts.join(' / ') : 'Cliente Frecuente';
};
