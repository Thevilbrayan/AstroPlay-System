import React, { useState, useEffect, useCallback } from 'react';
import { ShoppingBag, LayoutGrid, Plus } from 'lucide-react';
import { Product } from '../../types';
import { useAuthStore } from '../../store/auth.store';
import { pb } from '../../lib/pocketbase';
import POSView from './POSView';
import InventoryManagement from './InventoryManagement';
import ProductFormModal from './ProductFormModal';

type TabKey = 'pos' | 'inventory';

interface InventoryPOSProps {
    onNavigate?: (view: string) => void;
}

const InventoryPOS: React.FC<InventoryPOSProps> = ({ onNavigate }) => {
    const { user } = useAuthStore();
    const [products, setProducts] = useState<Product[]>([]);
    const [activeTab, setActiveTab] = useState<TabKey>('pos');

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
                imagen: record.imagen ? pb.files.getUrl(record, record.imagen) : ''
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

    const tabs: { key: TabKey; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
        { key: 'pos', label: 'Punto de Venta', icon: <ShoppingBag className="w-4 h-4" /> },
        { key: 'inventory', label: 'Gestión de Inventario', icon: <LayoutGrid className="w-4 h-4" />, adminOnly: true },
    ];

    const visibleTabs = tabs.filter(tab => !tab.adminOnly || isAdmin);

    return (
        <div className="flex flex-col h-full bg-slate-950 text-slate-200 font-sans">
            {/* Tab Bar — only shown if admin (multiple tabs) */}
            {visibleTabs.length > 1 && (
                <div className="flex items-center justify-between px-6 pt-4 pb-2">
                    <div className="flex p-1 bg-slate-900/60 rounded-xl border border-white/5 backdrop-blur-md">
                        {visibleTabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key
                                    ? 'bg-slate-800 text-white shadow-sm ring-1 ring-white/10'
                                    : 'text-slate-500 hover:text-slate-300'
                                    }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* New Product button (shown in inventory tab) */}
                    {activeTab === 'inventory' && isAdmin && (
                        <button
                            onClick={handleNewProduct}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:from-blue-500 hover:to-indigo-500 transition-all active:scale-95"
                        >
                            <Plus className="w-4 h-4" />
                            Nuevo Producto
                        </button>
                    )}
                </div>
            )}

            <div className="flex-1 overflow-hidden p-6 pt-2">
                {activeTab === 'pos' && (
                    <POSView
                        products={products}
                        formatCurrency={formatCurrency}
                        onSaleComplete={loadProducts}
                        onNavigate={onNavigate}
                    />
                )}

                {activeTab === 'inventory' && isAdmin && (
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
