import React, { useState, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { Product } from '../../types';
import { useAuthStore } from '../../store/auth.store';
import { useWorkstationStore } from '../../store/workstation.store';
import { pb } from '../../lib/pocketbase';
import POSView from './POSView';
import InventoryManagement from './InventoryManagement';
import ProductFormModal from './ProductFormModal';

type TabKey = 'pos' | 'inventory';

interface InventoryPOSProps {
    view: TabKey;
    onNavigate?: (view: string) => void;
}

const InventoryPOS: React.FC<InventoryPOSProps> = ({ view, onNavigate }) => {
    const { user } = useAuthStore();
    const { workstationType } = useWorkstationStore();
    const [products, setProducts] = useState<Product[]>([]);

    // Modal state (shared between views)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    const isAdmin = user?.role === 'admin';

    // Load products
    const loadProducts = useCallback(async () => {
        try {
            const records = await pb.collection('products').getList<Product>(1, 200, {
                sort: '-created',
            });
            const productsWithImages = records.items.map(record => ({
                ...record,
                imagen: record.imagen ? pb.files.getURL(record, record.imagen) : ''
            }));
            setProducts(productsWithImages);
        } catch (error) {
            console.error("Error loading products:", error);
        }
    }, []);

    useEffect(() => {
        loadProducts();
    }, [loadProducts]);

    // Format currency
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
    };

    // Handlers for ProductFormModal
    const handleEditProduct = (product: Product) => {
        setEditingProduct(product);
        setIsModalOpen(true);
    };

    const handleNewProduct = () => {
        setEditingProduct(null);
        setIsModalOpen(true);
    };

    const handleQuickStockAdjust = async (productId: string, delta: number) => {
        const product = products.find(p => p.id === productId);
        if (!product) return;
        const currentStock = product.stock || 0;
        const newStock = Math.max(0, currentStock + delta);
        try {
            await pb.collection('products').update(productId, { stock: newStock });
            setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock: newStock } : p));
        } catch (error) {
            console.error('Error adjusting stock:', error);
        }
    };

    const posProducts = products.filter(p => {
        if (workstationType === 'SNACK_ONLY') return p.category !== 'service';
        if (workstationType === 'TIME_ONLY') return p.category === 'service';
        return true;
    });

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 font-sans">
            {/* Action Bar for Inventory (Admin Only) */}
            {view === 'inventory' && isAdmin && (
                <div className="flex flex-row-reverse px-6 pt-4 pb-2">
                    <button
                        onClick={handleNewProduct}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:from-blue-500 hover:to-indigo-500 transition-all active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        Nuevo Producto
                    </button>
                </div>
            )}

            <div className={`flex-1 overflow-hidden p-6 ${view === 'inventory' && isAdmin ? 'pt-0' : 'pt-2'}`}>
                {view === 'pos' && (
                    <POSView
                        products={posProducts}
                        formatCurrency={formatCurrency}
                        onSaleComplete={loadProducts}
                        onNavigate={onNavigate}
                    />
                )}

                {view === 'inventory' && isAdmin && (
                    <InventoryManagement
                        products={products}
                        formatCurrency={formatCurrency}
                        onEditProduct={handleEditProduct}
                        onQuickStockAdjust={handleQuickStockAdjust}
                    />
                )}
            </div>

            {/* Product Form Modal — shared */}
            <ProductFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                editingProduct={editingProduct}
                onSaved={loadProducts}
            />
        </div>
    );
};

export default InventoryPOS;
