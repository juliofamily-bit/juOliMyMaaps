export interface HelpItem {
  id: string;
  title: string;
  badge: string;
  whatIs: string;
  mustDoSteps: {
    title: string;
    desc: string;
  }[];
  businessBenefit: string;
  tip?: string;
}

export const CONTEXTUAL_HELP_DATA: Record<string, HelpItem> = {
  // AJUSTES GENERALES
  'admin-settings-general': {
    id: 'admin-settings-general',
    title: 'Ajustes y Configuración del Negocio',
    badge: 'Ajustes Generales',
    whatIs: 'Este es el centro de control principal de tu restaurante. Desde aquí definís cómo se ve tu marca ante los clientes, tus canales de venta, métodos de cobro, horarios y datos fiscales.',
    mustDoSteps: [
      { title: '1. Identidad de Marca', desc: 'Cargá el nombre de tu local, tu logo en alta calidad y seleccioná tus colores corporativos en Personalización.' },
      { title: '2. Enlace de WhatsApp y Teléfono', desc: 'Ingresá tu número oficial de WhatsApp con código de área para recibir notificaciones y pedidos directos.' },
      { title: '3. Pasarela de Pago (Mercado Pago)', desc: 'Conectá tu cuenta de Mercado Pago para cobrar pedidos online automáticamente y recibir el dinero en tu cuenta al instante.' },
      { title: '4. Zonas de Envío y Horarios', desc: 'Establecé qué días y horarios abrís el salón y el delivery para que nadie pida fuera de tu horario de cocina.' }
    ],
    businessBenefit: 'Un local con sus ajustes 100% completos transmite profesionalismo, evita pedidos fuera de hora y reduce a cero las consultas repetitivas de los clientes.',
    tip: 'No olvides guardar los cambios al pie de la página después de modificar cualquier ajuste.'
  },

  'admin-settings-personalizacion': {
    id: 'admin-settings-personalizacion',
    title: 'Personalización del Local y Marca',
    badge: 'Diseño e Identidad',
    whatIs: 'Permite darle a tu menú digital la estética propia de tu restaurante: logo, colores, imagen de portada, enlaces a redes sociales y ficha de Google Reviews.',
    mustDoSteps: [
      { title: '1. Subir Logo y Portada', desc: 'Subí una imagen clara de tu logo y una foto atractiva de portada que despierte apetito al abrir el menú.' },
      { title: '2. Colores del Restaurante', desc: 'Elegí el color primario de tu marca para que todos los botones y destaques coincidan con tu imagen.' },
      { title: '3. Enlace a Google Reviews', desc: 'Pegá el link directo de reseñas de Google Maps. Cuando los clientes califiquen con 5 estrellas, el sistema los enviará automáticamente a Google para subir tu puntuación SEO.' }
    ],
    businessBenefit: 'Genera confianza inmediata, aumenta las conversiones del carrito y posiciona a tu restaurante en los primeros puestos de Google Maps.',
    tip: 'Las fotos luminosas y de platos reales aumentan las ventas hasta un 35% en comparación con imágenes genéricas.'
  },

  'admin-settings-personal': {
    id: 'admin-settings-personal',
    title: 'Gestión de Empleados y Roles',
    badge: 'Equipo y Seguridad',
    whatIs: 'Aquí creás los perfiles y PINes de acceso para cada uno de tus colaboradores: Mozos, Cocineros, Bartenders, Repartidores y Cajeros.',
    mustDoSteps: [
      { title: '1. Crear Empleado', desc: 'Ingresá el nombre completo del trabajador y asígnale su rol operativo (Ej: Mozo de Salón, Cocina, Repartidor).' },
      { title: '2. Asignar un PIN Numérico', desc: 'Definí un PIN de 4 dígitos fácil de recordar para que el empleado inicie sesión en su estación sin necesidad de contraseñas complejas.' },
      { title: '3. Activar o Desactivar', desc: 'Si un empleado ya no trabaja en el local, podés desactivarlo en 1 clic para bloquear su acceso sin borrar su historial de comandas.' }
    ],
    businessBenefit: 'Seguridad absoluta: cada empleado solo ve lo que le corresponde (Cocina ve platos, Repartidor ve direcciones y Caja ve dinero), impidiendo errores o fugas.',
    tip: 'Cada repartidor debe usar su propio PIN para que el sistema calcule exactamente cuánto dinero debe rendir al final de su turno.'
  },

  'admin-settings-envios': {
    id: 'admin-settings-envios',
    title: 'Zonas y Tarifas de Delivery',
    badge: 'Logística y Envíos',
    whatIs: 'Configurá hasta dónde llega tu servicio de reparto a domicilio y cuánto cobrás de costo de envío según la distancia o barrio. Además, al final de esta sección se encuentra la Liquidación a Repartidores, donde te saldrá exactamente lo que le tenés que pagar a cada uno de los repartidores según los viajes que hicieron.',
    mustDoSteps: [
      { title: '1. Activar Opción Delivery', desc: 'Asegurate de encender el interruptor "Ofrecer Envío a Domicilio".' },
      { title: '2. Crear Zonas de Envío', desc: 'Añadí cada zona o radio de entrega (Ej: "Zona Centro - $800", "Barrio Norte - $1.500", "Retiro en Local - $0").' },
      { title: '3. Envío Gratis por Monto Mínimo', desc: 'Podés configurar envío gratis si la compra supera determinado valor para incentivar pedidos más grandes.' },
      { title: '4. Liquidación a Repartidores (Al final de la sección)', desc: 'Al final de este apartado vas a encontrar la sección de liquidación a repartidores, donde te saldrá lo que le tenés que pagar a cada uno de los repartidores según los viajes que hicieron. Podés pagarles en 1 solo clic y el egreso se descuenta automáticamente de tu caja y se registra en el Balance.' }
    ],
    businessBenefit: 'Eliminás las discusiones por el precio del envío con los clientes y controlás con exactitud el pago a tus repartidores por cada viaje realizado, manteniendo la caja 100% cuadrada.',
    tip: 'Al final de la sección podés liquidar los viajes a cada repartidor individualmente o a todos juntos al terminar el turno.'
  },

  'admin-delivery-settlement': {
    id: 'admin-delivery-settlement',
    title: 'Liquidación a Repartidores',
    badge: 'Pagos y Cadetería',
    whatIs: 'Módulo para auditar y pagar los viajes a tus repartidores. Te muestra el total de pedidos entregados y cuánto le tenés que pagar a cada uno según sus viajes realizados.',
    mustDoSteps: [
      { title: '1. Auditar Viajes Realizados', desc: 'Consultá cuántos viajes completó cada repartidor durante la jornada.' },
      { title: '2. Ver Saldo a Pagar', desc: 'El sistema calcula automáticamente el monto exacto acumulado por repartidor según la tarifa de envío de cada viaje.' },
      { title: '3. Liquidar y Pagar', desc: 'Presioná el botón "Pagar" al repartidor (o "Pagar a Todos") para saldar la deuda. El pago se descuenta de tu caja y se registra como gasto en tu Balance.' }
    ],
    businessBenefit: 'Cuentas claras y rápidas con tu personal de reparto: sin discusiones, sin planillas manuales y con tu dinero siempre respaldado.',
    tip: 'Liquidá al finalizar cada turno para que tu arqueo de caja diario coincida a la perfección con el dinero físico.'
  },

  'admin-settings-mp': {
    id: 'admin-settings-mp',
    title: 'Cobros Automáticos con Mercado Pago',
    badge: 'Pagos Digitales',
    whatIs: 'Conectá tu cuenta de Mercado Pago para que los clientes puedan pagar sus pedidos online con Débito, Crédito o Dinero en Cuenta desde su celular antes de enviar la comanda.',
    mustDoSteps: [
      { title: '1. Obtener Access Token', desc: 'Ingresá a tu cuenta de Mercado Pago Developers, copiá tu "Access Token de Producción" y pegalo en este casillero.' },
      { title: '2. Activar Pagos Online', desc: 'Tildá la opción para permitir pagos digitales en el menú público y delivery.' },
      { title: '3. Probar una Transacción', desc: 'Hacé un pedido de prueba para verificar que el dinero impacte de inmediato en tu cuenta bancaria o billetera.' }
    ],
    businessBenefit: 'Cobro 100% garantizado: el pedido llega a cocina ya pagado, eliminando el riesgo de cancelaciones a último momento o falta de cambio.',
    tip: 'El dinero va directamente a tu cuenta de Mercado Pago; la plataforma no retiene comisiones adicionales sobre tus ventas.'
  },

  'admin-settings-fiscal': {
    id: 'admin-settings-fiscal',
    title: 'Facturación Electrónica AFIP',
    badge: 'Aspectos Fiscales',
    whatIs: 'Módulo de emisión automática de comprobantes fiscales (Factura B para Consumidor Final y Factura A para Responsables Inscriptos) conectado directamente con los servidores de AFIP.',
    mustDoSteps: [
      { title: '1. Cargar Certificado y Clave Privada', desc: 'Subí tu certificado digital (.crt) y tu clave privada (.key) tramitados en el portal de AFIP.' },
      { title: '2. Ingresar CUIT y Punto de Venta', desc: 'Colocá tu número de CUIT y el número de Punto de Venta habilitado para web services de factura electrónica.' },
      { title: '3. Facturar con 1 Clic', desc: 'Desde la comanda en Caja, presioná "Facturar AFIP" para emitir el CAE y generar el ticket oficial al instante.' }
    ],
    businessBenefit: 'Cumplimiento fiscal sin esfuerzo manual: emitís facturas válidas en 2 segundos sin entrar a la página lenta de AFIP ni usar controladores fiscales costosos.',
    tip: 'Si el cliente solicita Factura A, el sistema le exige obligatoriamente su CUIT antes de confirmar la compra para evitar errores tributarios.'
  },

  'admin-settings-tables': {
    id: 'admin-settings-tables',
    title: 'Mesas, Salón y Códigos QR',
    badge: 'Atención en Salón',
    whatIs: 'Administrá las mesas de tu salón físico y generá los códigos QR individuales para que los clientes sentados en la mesa vean la carta y pidan desde su teléfono.',
    mustDoSteps: [
      { title: '1. Crear las Mesas', desc: 'Ingresá el número o nombre de cada mesa que tenés en tu local (Ej: Mesa 1, Mesa 2, Barra 1, Terraza 4).' },
      { title: '2. Descargar e Imprimir QRs', desc: 'Presioná el botón para imprimir o descargar los códigos QR listos para colocar en las mesas o atriles.' },
      { title: '3. Servicio de Mesa (Cubierto)', desc: 'Si cobrás cubierto o servicio de mesa, definí el valor por persona para que se agregue automáticamente a la cuenta.' }
    ],
    businessBenefit: 'Agiliza la atención hasta un 60%: los clientes piden apenas se sientan sin esperar que el mozo les lleve la carta física, aumentando la rotación de mesas.',
    tip: 'Colocá los QRs en soportes acrílicos visibles en el centro de cada mesa para que los clientes lo escaneen apenas llegan.'
  },

  'admin-settings-loyalty': {
    id: 'admin-settings-loyalty',
    title: 'Club de Fidelización & Campañas WhatsApp',
    badge: 'Marketing y Retención',
    whatIs: 'Herramienta integral de fidelización, base de datos de clientes (CRM) y campañas de WhatsApp personalizadas. Premia a tus clientes con cashback en cada compra y reactiva comensales con mensajes preescritos automáticos.',
    mustDoSteps: [
      { title: '1. Sincronizar Clientes', desc: 'Tocá "⚡ Sincronizar Pedidos Anteriores" para traer automáticamente a todos los clientes que ya te compraron con su saldo y porcentaje acumulado.' },
      { title: '2. Configurar el Cashback', desc: 'Definí el porcentaje de cashback según los niveles (Bronce, Plata, Oro) para premiar a los comensales más recurrentes.' },
      { title: '3. Enviar Campaña WhatsApp', desc: 'Usá el Asistente de Difusión para mandar promociones preescritas con 1 solo clic por WhatsApp (incluye el nombre del cliente, su saldo exacto y el enlace a tu menú).' }
    ],
    businessBenefit: 'Multiplica tus ventas en días lentos sin gastar en publicidad ni pagar costosas APIs. Cada cliente siente que tiene plata esperándolo en tu local para pedir hoy.',
    tip: 'El mensaje preescrito ya incluye la cláusula amable "BAJA" para evitar que te reporten como spam, protegiendo tu número de WhatsApp al 100%.'
  },

  // MENÚ Y PRODUCTOS
  'admin-menu': {
    id: 'admin-menu',
    title: 'Menú y Carta Digital',
    badge: 'Productos y Categorías',
    whatIs: 'Acá gestionás toda tu oferta gastronómica: platos, bebidas, postres, combos, categorías, precios de venta y disponibilidad.',
    mustDoSteps: [
      { title: '1. Organizar Categorías', desc: 'Creá categorías claras y ordenadas (Ej: Hamburguesas, Pizzas, Bebidas, Postres).' },
      { title: '2. Cargar Platos con Fotos', desc: 'Subí fotos reales y agregá una descripción detallada que resalte los ingredientes principales.' },
      { title: '3. Pausar o Activar Platos', desc: 'Si te quedaste sin un ingrediente, podés pausar el plato en 1 segundo con el interruptor sin tener que borrarlo.' }
    ],
    businessBenefit: 'Cambiás precios o platos en tiempo real en todos los celulares de tus clientes y mesas sin gastar dinero en reimprimir cartas de papel.',
    tip: 'Usá la función de "Plato Destacado" para poner tus platos más rentables arriba de todo de la carta.'
  },

  'admin-menu-product-modal': {
    id: 'admin-menu-product-modal',
    title: 'Cómo Cargar o Editar un Producto',
    badge: 'Ficha de Producto',
    whatIs: 'Este formulario define todas las propiedades de un plato: precio al público, costo de elaboración, a qué estación de cocina viaja y sus opciones personalizadas.',
    mustDoSteps: [
      { title: '1. Nombre y Precio de Venta', desc: 'Colocá el nombre comercial del plato y el precio final que pagará el cliente.' },
      { title: '2. Precio de Costo (Insumos)', desc: 'Ingresá cuánto te cuesta a vos preparar este plato. Esto permite que el sistema calcule tus ganancias netas reales en el Balance.' },
      { title: '3. Estación de Destino', desc: 'Marcá si va a "Cocina" o "Barra" para que la comanda aparezca en la pantalla correcta.' },
      { title: '4. Pregunta o Personalización', desc: 'Si el plato requiere opciones (ej: Punto de cocción de la carne, sabor de gaseosa, aderezo), añadí la pregunta interactiva aquí.' }
    ],
    businessBenefit: 'Garantiza que la comanda llegue exacta al cocinero con las notas del cliente y que tengas un cálculo exacto de la rentabilidad de cada plato vendido.',
    tip: 'Cargar el precio de costo es fundamental para que el panel de Balance te muestre tu margen de ganancia neto real.'
  },

  // STOCK E INVENTARIO
  'admin-stock': {
    id: 'admin-stock',
    title: 'Control de Stock e Inventario',
    badge: 'Insumos y Márgenes',
    whatIs: 'Monitorea las existencias de tus materias primas y productos listos. Te avisa cuando te queda poco stock y calcula el costo de tu mercadería.',
    mustDoSteps: [
      { title: '1. Asignar Stock Inicial', desc: 'Fijá la cantidad de unidades o kilos que tenés disponibles de cada insumo o producto.' },
      { title: '2. Fijar Costo Unitario', desc: 'Colocá cuánto pagás por cada unidad para auditar el valor total de tu mercadería inmovilizada.' },
      { title: '3. Umbral de Alerta Mínima', desc: 'Definí un número mínimo (ej: 5 unidades) para que el sistema te alerte en amarillo antes de quedarte sin mercadería.' }
    ],
    businessBenefit: 'Evita quedarte sin productos en pleno servicio y te protege de compras de emergencia a sobreprecio.',
    tip: 'Revisá los insumos marcados en rojo al principio del día para hacer tus pedidos a proveedores a tiempo.'
  },

  // BALANCE Y FINANZAS
  'admin-balance': {
    id: 'admin-balance',
    title: 'Balance Financiero y Rentabilidad',
    badge: 'Finanzas y Caja',
    whatIs: 'Muestra los números reales de tu negocio mes a mes: Ingresos cobrados, Gastos operativos, Mermas registradas, Descuentos de fidelización y Rentabilidad Neta.',
    mustDoSteps: [
      { title: '1. Auditar Ingresos por Canal', desc: 'Consultá cuánto ingresó por Mostrador/Caja, Salón, Delivery y Aplicaciones.' },
      { title: '2. Cargar Gastos del Mes', desc: 'Registrá alquiler, servicios, sueldos y proveedores para tener el costo operativo total.' },
      { title: '3. Controlar Canjes de Promos', desc: 'Hacé clic en la tarjeta "Club / Promos" para auditar qué clientes canjearon puntos y el impacto en tus números.' }
    ],
    businessBenefit: 'Tenés claridad total de si tu negocio está ganando dinero real, cuál es tu margen neto y en qué se está yendo el presupuesto.',
    tip: 'Tocá cualquiera de las tarjetas del balance para ver el listado detallado de todas las órdenes asociadas.'
  },

  // CAJA Y TOMA DE PEDIDOS
  'orders-caja': {
    id: 'orders-caja',
    title: 'Panel de Caja y Comandas',
    badge: 'Operación de Caja',
    whatIs: 'La herramienta para el cajero del local: tomar pedidos por mostrador o teléfono, cobrar en efectivo/tarjeta, imprimir tickets y realizar el cierre de caja diario.',
    mustDoSteps: [
      { title: '1. Tomar Pedido en Mostrador', desc: 'Seleccioná los productos del menú rápido, ingresá el nombre del cliente y confirmá la comanda.' },
      { title: '2. Cobrar y Seleccionar Método', desc: 'Indicá si el pago fue en Efectivo, Débito, Crédito o Transferencia para que el arqueo de caja cuadre.' },
      { title: '3. Cierre de Caja Diario', desc: 'Al terminar la jornada, presioná "Cierre de Caja" para comparar lo cobrado contra el dinero físico y compartir el ticket por WhatsApp.' }
    ],
    businessBenefit: 'Caja rápida y sin descuadres. La comanda viaja a cocina en menos de 50 milisegundos y el ticket digital se genera de inmediato.',
    tip: 'Si un cliente viene con reserva previa, ingresá su código de reserva en el casillero para descontar la seña abonada.'
  },

  // COCINA
  'kitchen': {
    id: 'kitchen',
    title: 'Pantalla de Cocina (KDS)',
    badge: 'Producción Gastronómica',
    whatIs: 'Pantalla táctil para que los cocineros y el chef vean las órdenes que entran en tiempo real organizadas por orden de llegada con cronómetro de espera.',
    mustDoSteps: [
      { title: '1. Leer la Comanda', desc: 'Observá la mesa o cliente, la hora del pedido y las notas de preparación del cliente.' },
      { title: '2. Tildar Platos Preparados', desc: 'A medida que sacás un plato de la cocina, tocalo para marcarlo como listo. La pantalla del mozo se actualizará en 50 milisegundos.' },
      { title: '3. Despachar la Orden', desc: 'Al tildar el último plato, la comanda se archiva automáticamente en 0 segundos liberando la pantalla.' }
    ],
    businessBenefit: 'Cero papel en cocina: se acabaron los tickets perdidos, mojados o manchados de grasa, y los mozos saben cuándo el plato está caliente para servir.',
    tip: 'Si una comanda pasa de los 20 minutos, el borde se pondrá rojo alertando al equipo para priorizar su salida.'
  },

  // BARRA
  'bartender': {
    id: 'bartender',
    title: 'Pantalla de Barra y Bebidas',
    badge: 'Coctelería y Café',
    whatIs: 'Estación exclusiva para bartenders y baristas. Muestra únicamente las bebidas, tragos, cafés y postres asignados a la barra.',
    mustDoSteps: [
      { title: '1. Monitorear Tragos Pendientes', desc: 'Revisá los cócteles y bebidas que solicitan las mesas y el delivery.' },
      { title: '2. Tildar al Servir', desc: 'Marcá las copas o botellas listas para que el mozo las retire inmediatamente hacia la mesa.' }
    ],
    businessBenefit: 'Independiza la preparación de bebidas de la cocina caliente, haciendo que los comensales reciban sus bebidas en menos de 3 minutos de sentarse.',
    tip: 'Las bebidas se separan automáticamente de la comida para que el bartender no tenga que filtrar tickets largos de platos principales.'
  },

  // DESPACHO Y DELIVERY
  'delivery': {
    id: 'delivery',
    title: 'Pantalla de Despacho y Reparto',
    badge: 'Logística y Repartidores',
    whatIs: 'Diseñada especialmente para repartidores en moto/bici: ver pedidos asignados, abrir la ruta en Google Maps, avisar por WhatsApp con 1 clic y verificar cobros en puerta.',
    mustDoSteps: [
      { title: '1. Seleccionar Pedido (Llevar yo)', desc: 'Tomá el pedido que vas a repartir para asignarlo a tu hoja de ruta.' },
      { title: '2. Verificar si Debés Cobrar', desc: 'Prestá atención a la alerta roja: si dice "COBRAR EN PUERTA", debés exigir el dinero en efectivo al cliente antes de entregar. Si está en verde, ya fue pagado online.' },
      { title: '3. Avisar "En Camino" y "Llegué"', desc: 'Usá los botones de WhatsApp de 1 clic para avisarle al cliente que estás en la puerta sin escribir manualmente.' },
      { title: '4. Finalizar y Rendir', desc: 'Al entregar la comida, presioná "Finalizar Pedido" y rendí el dinero cobrado en la Caja del restaurante.' }
    ],
    businessBenefit: 'Evita pérdidas de dinero por repartidores que olvidan cobrar pedidos en efectivo y reduce los tiempos de entrega al automatizar la comunicación.',
    tip: 'El botón de Google Maps abre la ubicación exacta marcada por el cliente con GPS para no perder tiempo buscando direcciones complicadas.'
  },

  // MOZOS Y SALÓN
  'waiter': {
    id: 'waiter',
    title: 'Pantalla de Mozos y Salón',
    badge: 'Servicio en Mesas',
    whatIs: 'La aplicación móvil para los mozos en el salón: comandar mesas desde el celular, ver qué platos están listos en cocina, atender llamados de clientes y cerrar mesas.',
    mustDoSteps: [
      { title: '1. Abrir Mesa y Tomar Pedido', desc: 'Tocá la mesa que atendés, seleccioná los platos y envialos a cocina en el acto.' },
      { title: '2. Alerta de Platos Listos', desc: 'Cuando cocina o barra tildan un plato, tu celular te avisa con un distintivo verde para que vayas a retirarlo caliente.' },
      { title: '3. Cerrar Mesa y Solicitar Cuenta', desc: 'Consultá el total consumido, aplicá propina si corresponde y enviá la orden a Caja para el cobro final.' }
    ],
    businessBenefit: 'El mozo nunca abandona el salón para llevar comandas a mano, atendiendo a más clientes en menos tiempo con cero errores de letra o pedido.',
    tip: 'Podés filtrar por "Mis Mesas" para enfocarte únicamente en las mesas asignadas a tu sector.'
  }
};
