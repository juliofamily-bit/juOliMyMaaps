export type UserRole = 'admin' | 'staff' | 'kitchen';

export interface Profile {
    id: string;
    full_name: string | null;
    role: UserRole;
}

export interface Category {
    id: string;
    name: string;
    icon: string | null;
}

export interface Ingredient {
    id: string;
    name: string;
    stock_level: number;
    unit: string;
    min_stock_alert: number;
    unit_price: number;
}

export interface Product {
    id: string;
    name: string;
    description: string | null;
    price: number;
    image_url: string | null;
    category_id: string | null;
    category?: Category;
}

export interface ProductIngredient {
    id: string;
    product_id: string;
    ingredient_id: string;
    quantity_used: number;
    ingredient?: Ingredient;
}


export type OrderStatus = 'pending' | 'completed' | 'delivered';

export interface Order {
    id: string;
    client_name: string;
    phone_number: string;
    status: OrderStatus;
    total_price: number;
    created_at: string;
    order_number?: number;
    items?: OrderItem[];
}

export interface OrderItem {
    id: string;
    order_id: string;
    product_id: string | null;
    quantity: number;
    unit_price: number;
    product?: Product;
}

export interface Expense {
    id: string;
    description: string;
    amount: number;
    type: 'purchase' | 'salary' | 'service' | 'tax' | 'other';
    date: string;
}

export interface AppNotification {
    id: string;
    message: string;
    type: 'info' | 'alert' | 'success';
    target_roles: UserRole[];
    created_at: string;
}
