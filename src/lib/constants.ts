
export const PRESET_IMAGES = [
    { url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3", label: "Burger" },
    { url: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3", label: "Burger Cheese" },
    { url: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3", label: "Burger Special" },
    { url: "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3", label: "Burger Combo" },
    { url: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3", label: "Pizza" },
    { url: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3", label: "Pizza Slice" },
    { url: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3", label: "Pizza Cheese" },
    { url: "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3", label: "Pizza Pepperoni" },
    { url: "https://images.unsplash.com/photo-1572449043416-55f4685c9bb7?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3", label: "Soda" },
    { url: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3", label: "Coke" },
    { url: "https://images.unsplash.com/photo-1581006852262-e4307cf6283a?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3", label: "Beer" },
    { url: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3", label: "Drink" },
];

export const NEON_ICONS = [
    { icon: '🍔', name: 'Hamburguesa' },
    { icon: '🌭', name: 'Pancho' },
    { icon: '🥤', name: 'Jugo' },
    { icon: '🍟', name: 'Papas (Cono)' },
    { icon: '🍱', name: 'Papas (Bandeja)' },
    { icon: '🥫', name: 'Lata' },
    { icon: '🍾', name: 'Botella' },
    { icon: '🍦', name: 'Helado' },
    { icon: '🏷️', name: 'Oferta' },
    { icon: '🍔🍟🥤', name: 'Combo' },
];

export const INITIAL_CATEGORIES = [
    { id: '1', name: 'Hamburguesas', icon: '🍔' },
    { id: '2', name: 'Panchos', icon: '🌭' },
    { id: '3', name: 'Combos', icon: '🍔🍟🥤' },
    { id: '4', name: 'Bebidas', icon: '🥤' }
];

export const INITIAL_INGREDIENTS = [
    { id: '1', name: 'Pan de Burger', stockLevel: 50, unit: 'uds', minStockAlert: 10, unitPrice: 150 },
    { id: '2', name: 'Carne Molida', stockLevel: 10, unit: 'kg', minStockAlert: 2, unitPrice: 3500 },
    { id: '3', name: 'Queso Cheddar', stockLevel: 5, unit: 'kg', minStockAlert: 1, unitPrice: 4200 },
    { id: '4', name: 'Lechuga', stockLevel: 3, unit: 'kg', minStockAlert: 0.5, unitPrice: 1000 },
    { id: '5', name: 'Tomate', stockLevel: 4, unit: 'kg', minStockAlert: 1, unitPrice: 1200 },
    { id: '6', name: 'Harina', stockLevel: 20, unit: 'kg', minStockAlert: 5, unitPrice: 800 },
    { id: '7', name: 'Coca Cola 1.5L', stockLevel: 24, unit: 'uds', minStockAlert: 6, unitPrice: 900 },
];

export const INITIAL_PRODUCTS = [
    {
        id: '1',
        name: 'Burger Clásica',
        price: 3500,
        categoryId: '1',
        description: 'Doble carne, queso cheddar, lechuga y tomate',
        imageUrl: PRESET_IMAGES[0].url,
        ingredients: [
            { ingredientId: '1', quantityUsed: 1 },
            { ingredientId: '2', quantityUsed: 0.150 },
            { ingredientId: '3', quantityUsed: 0.050 },
            { ingredientId: '4', quantityUsed: 0.020 },
        ]
    },
    {
        id: '2',
        name: 'Pizza Muzzarella',
        price: 4200,
        categoryId: '2',
        description: 'Salsa de tomate, muzzarella y orégano',
        imageUrl: PRESET_IMAGES[4].url,
        ingredients: [
            { ingredientId: '6', quantityUsed: 0.300 },
            { ingredientId: '3', quantityUsed: 0.250 },
        ]
    },
    {
        id: '3',
        name: 'Coca Cola 1.5L',
        price: 1500,
        categoryId: '3',
        description: 'Botella de 1.5 litros',
        imageUrl: PRESET_IMAGES[9].url,
        ingredients: [
            { ingredientId: '7', quantityUsed: 1 }
        ]
    }
];
