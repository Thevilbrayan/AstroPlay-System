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
    card_id?: string;
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
    parent?: string; // foreign key to parent, optional for express sales
    child?: string[]; // array of foreign keys to children, optional for express sales
    sale?: string; // foreign key to sale
    status: 'active' | 'finished' | 'overtime' | 'paused' | 'pending_settlement';
    operator?: string; // foreign key to users
    start_time: string;
    end_time?: string;
    is_paid?: boolean;
    created?: string;
    updated?: string;

    // UI Extended Fields
    bracelet_color?: string;
    is_gokart?: boolean;

    // Database Status Types
    paused_at?: string;
    remaining_seconds?: number;
    cancel_reason?: string;
}

export interface Product {
    id: string;
    name: string;
    category?: 'service' | 'snack' | 'socks';
    duration_min?: number;
    size?: 'M' | 'G' | 'L';
    subcategory?: 'Bebidas' | 'Snacks';
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
    printer_name?: string;
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
    cash_session?: string; // foreign key to cash_sessions
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

export interface Asset {
    id: string;
    name: string;
    type?: string;
    status: 'available' | 'in_use' | 'maintenance';
    workstation?: string;
    last_report?: string;
    created?: string;
    updated?: string;
}

export interface CashSession {
    id: string;
    operator: string; // relation to users
    opening_balance?: number;
    sales_total?: number;
    reported_cash?: number;
    difference?: number;
    status: 'open' | 'closed';
    opened_at?: string;
    closed_at?: string;
    station?: string; // relation to workstations
    notes?: string;

    // New Advanced Handover & Audit Fields
    audit_status?: 'pending' | 'verified' | 'disputed';
    audited_by?: string; // relation to users (admin)
    cash_retained?: number;
    cash_withdrawn?: number;

    created?: string;
    updated?: string;
}

export interface InventoryLog {
    id: string;
    product: string; // relation to products
    quantity: number;
    type: 'purchase' | 'sale' | 'adjustment' | 'waste';
    operator: string; // relation to users
    created?: string;
    updated?: string;
}
