export interface User {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    role: 'admin' | 'operator';
}

export interface Parent {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    face_photo?: string;
    loyalty_points?: number;
    total_visits?: number;
    created?: string;
    updated?: string;
}

export interface Child {
    id: string;
    name: string;
    birth_date: string;
    parent: string; // foreign key to parent
    allergies?: string;
    created?: string;
    updated?: string;
}

export interface Session {
    id: string;
    parent: string; // foreign key to parent
    child: string[]; // array of foreign keys to children
    sale?: string; // foreign key to sale
    status: 'active' | 'finished' | 'overtime';
    operator?: string; // foreign key to users
    start_time: string;
    end_time?: string;
    created?: string;
    updated?: string;

    // UI Extended Fields (Not in DB by default, might be kept in separate state later or joined relations)
    bracelet_color?: string;
    is_gokart?: boolean;
}

export interface Product {
    id: string;
    name: string;
    type?: 'physical' | 'service_fixed' | 'service_open';
    price: number;
    cost?: number;
    stock?: number;
    min_stock?: number;
    imagen?: string;
    is_for_sale?: boolean;
    created?: string;
    updated?: string;
}

export interface Workstation {
    id: string;
    name: string;
    type?: 'FULL_SERVICE' | 'SNACK_ONLY' | 'TIME_ONLY';
    is_active?: boolean;
    created?: string;
    updated?: string;
}

export interface Sale {
    id: string;
    parent?: string; // foreign key to parents
    total_amount: number;
    payment_method?: 'cash' | 'card';
    operator?: string; // foreign key to users
    workstation?: string; // foreign key to workstation
    created?: string;
    updated?: string;
}

export interface SaleItem {
    id: string;
    sale?: string; // foreign key to sales
    product?: string; // foreign key to products
    quantity?: number;
    unit_price: number;
    created?: string;
    updated?: string;
}
