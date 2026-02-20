export interface User { id: string; email: string; name: string; role: 'admin' | 'operator'; }
export interface Parent { id: string; name: string; phone: string; photo: string; loyalty_points: number; }
export interface Child { id: string; name: string; parent: string; allergies?: string; }

export interface Product {
    id: string;
    name: string;
    price: number;
    stock: number;
    imagen: string; // Changed from image
    category: string;
    cost?: number;
    min_stock: number;
}
