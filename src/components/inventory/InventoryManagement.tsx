import React, { useState, useMemo } from 'react';
import { Search, Package, Zap, Plus, Minus, TrendingUp, AlertTriangle, DollarSign, Coffee } from 'lucide-react';
import { Product } from '../../types';
import Input from '../ui/Input';

interface InventoryManagementProps {
    products: Product[];
    formatCurrency: (amount: number) => string;
    onEditProduct: (product: Product) => void;
    onQuickStockAdjust: (productId: string, delta: number) => void;
}

const InventoryManagement: React.FC<InventoryManagementProps> = ({
    products,
    formatCurrency,
    onEditProduct,
    onQuickStockAdjust,
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<'all' | 'service' | 'snack' | 'socks'>('all');

    // Computed metrics
    const metrics = useMemo(() => {
        const physicalProducts = products.filter(p => p.category === 'snack' || p.category === 'socks');
        const inventoryValue = physicalProducts.reduce((sum, p) => sum + ((p.cost || 0) * (p.stock || 0)), 0);
        const lowStockCount = physicalProducts.filter(p => (p.stock || 0) > 0 && p.min_stock && (p.stock || 0) <= p.min_stock).length;
        return { inventoryValue, lowStockCount };
    }, [products]);

    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
            let matchesCategory = true;
            if (filterCategory !== 'all') {
                // Fallback mapping for older db items without category set yet (using name as heuristic)
                const fallbackCat = product.name.toLowerCase().includes('calceta') ? 'socks'
                    : product.name.toLowerCase().match(/hora|minuto|tiempo|pase|servicio/) ? 'service'
                        : 'snack';
                const actualCat = product.category || fallbackCat;
                matchesCategory = actualCat === filterCategory;
            }
            return matchesSearch && matchesCategory;
        });
    }, [products, searchQuery, filterCategory]);

    const getCategoryLabel = (product: Product) => {
        const cat = product.category || (product.name.toLowerCase().includes('calceta') ? 'socks' : product.name.toLowerCase().match(/hora|minuto|tiempo|pase|servicio/) ? 'service' : 'snack');
        switch (cat) {
            case 'service': return 'Servicio';
            case 'snack': return 'Snack';
            case 'socks': return 'Calceta';
            default: return 'Producto';
        }
    };

    const getCategoryIcon = (product: Product) => {
        const cat = product.category || (product.name.toLowerCase().includes('calceta') ? 'socks' : product.name.toLowerCase().match(/hora|minuto|tiempo|pase|servicio/) ? 'service' : 'snack');
        switch (cat) {
            case 'service': return <Zap className="w-3.5 h-3.5" />;
            case 'snack': return <Coffee className="w-3.5 h-3.5" />;
            case 'socks': return <Package className="w-3.5 h-3.5" />;
            default: return <Package className="w-3.5 h-3.5" />;
        }
    };

    const getCategoryBadgeClass = (product: Product) => {
        const cat = product.category || (product.name.toLowerCase().includes('calceta') ? 'socks' : product.name.toLowerCase().match(/hora|minuto|tiempo|pase|servicio/) ? 'service' : 'snack');
        switch (cat) {
            case 'service': return 'bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20';
            case 'socks': return 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20';
            default: return 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20';
        }
    };

    const getStockHealthClass = (product: Product) => {
        const cat = product.category || (product.name.toLowerCase().match(/hora|minuto|tiempo|pase|servicio/) ? 'service' : 'snack');
        if (cat === 'service') return 'text-slate-500 dark:text-slate-600';
        const s = product.stock || 0;
        if (s === 0) return 'text-red-600 dark:text-red-400 font-bold';
        if (product.min_stock && s <= product.min_stock) return 'text-orange-600 dark:text-orange-400 font-bold';
        return 'text-green-600 dark:text-green-400';
    };

    const metricCards = [
        {
            label: 'Valor Inventario (Costo)',
            value: formatCurrency(metrics.inventoryValue),
            icon: DollarSign,
            color: 'from-blue-50 to-indigo-50 dark:from-blue-600/20 dark:to-indigo-600/20',
            iconColor: 'text-blue-600 dark:text-blue-400',
            iconBg: 'bg-blue-100 dark:bg-slate-900/50',
            borderColor: 'border-blue-200 dark:border-blue-500/20',
            textColor: 'text-slate-900 dark:text-white',
            labelColor: 'text-slate-500 dark:text-slate-400',
        },
        {
            label: 'Productos Stock Bajo',
            value: metrics.lowStockCount.toString(),
            icon: AlertTriangle,
            color: 'from-orange-50 to-amber-50 dark:from-orange-600/20 dark:to-amber-600/20',
            iconColor: 'text-orange-600 dark:text-orange-400',
            iconBg: 'bg-orange-100 dark:bg-slate-900/50',
            borderColor: 'border-orange-200 dark:border-orange-500/20',
            textColor: 'text-slate-900 dark:text-white',
            labelColor: 'text-slate-500 dark:text-slate-400',
        },
        {
            label: 'Ventas del Turno',
            value: formatCurrency(0),
            icon: TrendingUp,
            color: 'from-emerald-50 to-green-50 dark:from-emerald-600/20 dark:to-green-600/20',
            iconColor: 'text-emerald-600 dark:text-emerald-400',
            iconBg: 'bg-emerald-100 dark:bg-slate-900/50',
            borderColor: 'border-emerald-200 dark:border-emerald-500/20',
            textColor: 'text-slate-900 dark:text-white',
            labelColor: 'text-slate-500 dark:text-slate-400',
        },
    ];

    return (
        <div className="flex flex-col gap-6 h-full">
            {/* Metric Cards */}
            <div className="grid grid-cols-3 gap-4">
                {metricCards.map(card => (
                    <div key={card.label} className={`bg-gradient-to-br ${card.color} backdrop-blur-xl border ${card.borderColor} rounded-2xl p-5 ring-1 ring-black/5 dark:ring-white/5`}>
                        <div className="flex items-center justify-between mb-3">
                            <span className={`text-xs font-medium uppercase tracking-wider ${card.labelColor}`}>{card.label}</span>
                            <div className={`p-2 rounded-lg ${card.iconBg} ${card.iconColor}`}>
                                <card.icon className="w-4 h-4" />
                            </div>
                        </div>
                        <p className={`text-2xl font-bold ${card.textColor}`}>{card.value}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Input
                        icon={<Search className="w-5 h-5 text-slate-400" />}
                        placeholder="Buscar en inventario..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-white/80 dark:bg-slate-900/50 border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100"
                    />
                </div>

                <div className="flex p-1 bg-slate-100 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-white/5">
                    {[
                        { key: 'all' as const, label: 'Todos' },
                        { key: 'service' as const, label: 'Servicios' },
                        { key: 'snack' as const, label: 'Snacks' },
                        { key: 'socks' as const, label: 'Calcetas' },
                    ].map(opt => (
                        <button
                            key={opt.key}
                            onClick={() => setFilterCategory(opt.key)}
                            className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${filterCategory === opt.key ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-transparent' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Data Grid */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-1 pb-4">
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                    {filteredProducts.map(product => {
                        const cat = product.category || (product.name.toLowerCase().match(/hora|minuto|tiempo|pase|servicio/) ? 'service' : 'snack');
                        const isService = cat === 'service';

                        return (
                            <div key={product.id} className="group relative bg-white/80 dark:bg-slate-900/40 backdrop-blur-md border border-gray-200 dark:border-white/5 rounded-2xl overflow-hidden transition-all duration-200 hover:border-gray-300 dark:hover:border-white/10 hover:shadow-xl hover:shadow-blue-500/5 flex flex-col h-full">
                                {/* Image / Icon Area */}
                                <div className="aspect-video relative overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                                    {product.imagen ? (
                                        <img src={product.imagen} alt={product.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-600">
                                            {getCategoryIcon(product)}
                                        </div>
                                    )}
                                    <div className="absolute top-2 left-2">
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold border backdrop-blur-md shadow-sm ${getCategoryBadgeClass(product)}`}>
                                            {getCategoryIcon(product)}
                                            {getCategoryLabel(product)}
                                        </span>
                                    </div>
                                </div>

                                {/* Content Area */}
                                <div className="p-4 flex flex-col flex-1">
                                    <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm truncate mb-1">{product.name}</h3>

                                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100 dark:border-white/5">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-slate-500 font-medium tracking-wider uppercase">Costo</span>
                                            <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">{product.cost ? formatCurrency(product.cost) : '—'}</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-[10px] pr-1.5 text-slate-500 font-medium tracking-wider uppercase">Venta</span>
                                            <span className="text-sm font-bold text-slate-900 dark:text-white font-mono break-words">
                                                {product.price === 0 && isService ? 'Abierto' : formatCurrency(product.price)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Additional info dynamically rendered based on category */}
                                    <div className="-mt-1 mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                                        {cat === 'socks' && product.size && <span className="bg-slate-100 dark:bg-white/5 py-0.5 px-2 rounded-md">Talla: {product.size}</span>}
                                        {cat === 'snack' && product.subcategory && <span className="capitalize">{product.subcategory}</span>}
                                        {cat === 'service' && product.duration_min && product.duration_min > 0 && <span>{product.duration_min} min</span>}
                                    </div>

                                    {/* Action Row: Stock Controls & Edit */}
                                    <div className="mt-auto pt-3 border-t border-gray-100 dark:border-white/5 flex gap-2 h-12">
                                        {!isService ? (
                                            <>
                                                {/* Left: Stock Controls */}
                                                <div className="flex-1 flex items-center justify-between bg-slate-50 dark:bg-slate-950/50 rounded-xl p-1 border border-gray-200 dark:border-white/5 shadow-inner">
                                                    <button
                                                        onClick={() => onQuickStockAdjust(product.id, -1)}
                                                        disabled={(product.stock || 0) <= 0}
                                                        className="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent shadow-sm dark:shadow-none bg-white dark:bg-transparent border border-gray-100 dark:border-transparent"
                                                    >
                                                        <Minus className="w-4 h-4" />
                                                    </button>
                                                    <span className={`font-mono text-sm font-bold min-w-[32px] text-center ${getStockHealthClass(product)}`}>
                                                        {product.stock || 0}
                                                    </span>
                                                    <button
                                                        onClick={() => onQuickStockAdjust(product.id, 1)}
                                                        className="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors shadow-sm dark:shadow-none bg-white dark:bg-transparent border border-gray-100 dark:border-transparent"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                {/* Right: Edit Button */}
                                                <button
                                                    onClick={() => onEditProduct(product)}
                                                    className="w-12 flex items-center justify-center shrink-0 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 border border-blue-200 dark:border-blue-500/20 transition-all font-medium"
                                                    title="Editar producto"
                                                >
                                                    <span className="text-xs font-bold leading-none select-none">EDT</span>
                                                </button>
                                            </>
                                        ) : (
                                            /* Services: Edit Button filling width */
                                            <button
                                                onClick={() => onEditProduct(product)}
                                                className="w-full h-full flex items-center justify-center gap-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 border border-blue-200 dark:border-blue-500/20 transition-all font-medium text-sm"
                                            >
                                                <span>Editar Servicio</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {filteredProducts.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
                        <Package className="w-12 h-12 mb-4 opacity-20" />
                        <p className="text-base font-medium">No se encontraron productos</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InventoryManagement;
