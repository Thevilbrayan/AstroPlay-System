import React, { useState, useMemo } from 'react';
import { Search, Package, Zap, Edit3, Edit, Plus, Minus, TrendingUp, AlertTriangle, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';
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
    const [filterType, setFilterType] = useState<'all' | 'physical' | 'service'>('all');

    // Computed metrics
    const metrics = useMemo(() => {
        const physicalProducts = products.filter(p => p.type === 'physical' || !p.type);
        const inventoryValue = physicalProducts.reduce((sum, p) => sum + ((p.cost || 0) * (p.stock || 0)), 0);
        const lowStockCount = physicalProducts.filter(p => (p.stock || 0) > 0 && p.min_stock && (p.stock || 0) <= p.min_stock).length;
        return { inventoryValue, lowStockCount };
    }, [products]);

    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
            let matchesType = true;
            if (filterType === 'physical') matchesType = product.type === 'physical' || !product.type;
            else if (filterType === 'service') matchesType = product.type === 'service_fixed' || product.type === 'service_open';
            return matchesSearch && matchesType;
        });
    }, [products, searchQuery, filterType]);

    const getTypeLabel = (type?: string) => {
        switch (type) {
            case 'service_fixed': return 'Serv. Fijo';
            case 'service_open': return 'Serv. Abierto';
            default: return 'Físico';
        }
    };

    const getTypeIcon = (type?: string) => {
        switch (type) {
            case 'service_fixed': return <Zap className="w-3.5 h-3.5" />;
            case 'service_open': return <Edit3 className="w-3.5 h-3.5" />;
            default: return <Package className="w-3.5 h-3.5" />;
        }
    };

    const getTypeBadgeClass = (type?: string) => {
        switch (type) {
            case 'service_fixed': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
            case 'service_open': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            default: return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        }
    };

    const getStockHealthClass = (product: Product) => {
        if (product.type && product.type !== 'physical') return 'text-slate-600';
        const s = product.stock || 0;
        if (s === 0) return 'text-red-400 font-bold';
        if (product.min_stock && s <= product.min_stock) return 'text-orange-400 font-bold';
        return 'text-green-400';
    };

    const metricCards = [
        {
            label: 'Valor Inventario (Costo)',
            value: formatCurrency(metrics.inventoryValue),
            icon: DollarSign,
            color: 'from-blue-600/20 to-indigo-600/20',
            iconColor: 'text-blue-400',
            borderColor: 'border-blue-500/20',
        },
        {
            label: 'Productos Stock Bajo',
            value: metrics.lowStockCount.toString(),
            icon: AlertTriangle,
            color: 'from-orange-600/20 to-amber-600/20',
            iconColor: 'text-orange-400',
            borderColor: 'border-orange-500/20',
        },
        {
            label: 'Ventas del Turno',
            value: formatCurrency(0),
            icon: TrendingUp,
            color: 'from-emerald-600/20 to-green-600/20',
            iconColor: 'text-emerald-400',
            borderColor: 'border-emerald-500/20',
        },
    ];

    return (
        <div className="flex flex-col gap-6 h-full">
            {/* Metric Cards */}
            <div className="grid grid-cols-3 gap-4">
                {metricCards.map(card => (
                    <div key={card.label} className={`bg-gradient-to-br ${card.color} backdrop-blur-xl border ${card.borderColor} rounded-2xl p-5 ring-1 ring-white/5`}>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{card.label}</span>
                            <div className={`p-2 rounded-lg bg-slate-900/50 ${card.iconColor}`}>
                                <card.icon className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-white">{card.value}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Input
                        icon={<Search className="w-5 h-5" />}
                        placeholder="Buscar en inventario..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-slate-900/50 border-white/10"
                    />
                </div>

                <div className="flex p-1 bg-slate-900/50 rounded-xl border border-white/5">
                    {[
                        { key: 'all' as const, label: 'Todos' },
                        { key: 'physical' as const, label: 'Físicos' },
                        { key: 'service' as const, label: 'Servicios' },
                    ].map(opt => (
                        <button
                            key={opt.key}
                            onClick={() => setFilterType(opt.key)}
                            className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${filterType === opt.key ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Data Table */}
            <div className="flex-1 overflow-hidden bg-slate-900/30 backdrop-blur-xl border border-white/5 rounded-2xl ring-1 ring-white/5">
                <div className="overflow-x-auto overflow-y-auto h-full">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-slate-900/90 backdrop-blur-md border-b border-white/5">
                                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Producto</th>
                                <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                                <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Costo</th>
                                <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Precio</th>
                                <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Margen</th>
                                <th className="text-center py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Stock</th>
                                <th className="text-center py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Min</th>
                                <th className="text-center py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredProducts.map(product => {
                                const margin = product.price - (product.cost || 0);
                                const marginPercent = product.cost ? ((margin / product.cost) * 100).toFixed(0) : '—';
                                const isPhysical = product.type === 'physical' || !product.type;

                                return (
                                    <tr key={product.id} className="hover:bg-white/[0.02] transition-colors group">
                                        {/* Product */}
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-3">
                                                {product.imagen ? (
                                                    <img src={product.imagen} alt="" className="w-9 h-9 rounded-lg object-cover bg-slate-800 ring-1 ring-white/10" />
                                                ) : (
                                                    <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-slate-600 ring-1 ring-white/10">
                                                        {getTypeIcon(product.type)}
                                                    </div>
                                                )}
                                                <span className="font-medium text-slate-200 truncate max-w-[180px]">{product.name}</span>
                                            </div>
                                        </td>
                                        {/* Type */}
                                        <td className="py-3 px-3">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getTypeBadgeClass(product.type)}`}>
                                                {getTypeIcon(product.type)}
                                                {getTypeLabel(product.type)}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 text-right text-slate-400 font-mono text-xs">
                                            {product.cost ? formatCurrency(product.cost) : '—'}
                                        </td>
                                        {/* Price */}
                                        <td className="py-3 px-3 text-right text-white font-mono text-xs font-semibold">
                                            {product.type === 'service_open' ? 'Variable' : formatCurrency(product.price)}
                                        </td>
                                        {/* Margin */}
                                        <td className="py-3 px-3 text-right">
                                            {product.cost ? (
                                                <div className="flex items-center justify-end gap-1">
                                                    {margin >= 0 ? (
                                                        <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                                                    ) : (
                                                        <ArrowDownRight className="w-3 h-3 text-red-400" />
                                                    )}
                                                    <span className={`font-mono text-xs font-semibold ${margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {formatCurrency(margin)}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500 ml-0.5">({marginPercent}%)</span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-600">—</span>
                                            )}
                                        </td>
                                        {/* Stock */}
                                        <td className="py-3 px-3 text-center">
                                            {isPhysical ? (
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => onQuickStockAdjust(product.id, -1)}
                                                        disabled={(product.stock || 0) <= 0}
                                                        className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-0"
                                                    >
                                                        <Minus className="w-3 h-3" />
                                                    </button>
                                                    <span className={`font-mono text-sm min-w-[28px] text-center ${getStockHealthClass(product)}`}>
                                                        {product.stock || 0}
                                                    </span>
                                                    <button
                                                        onClick={() => onQuickStockAdjust(product.id, 1)}
                                                        className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-slate-600">∞</span>
                                            )}
                                        </td>
                                        {/* Min Stock */}
                                        <td className="py-3 px-3 text-center text-slate-500 font-mono text-xs">
                                            {isPhysical ? product.min_stock : '—'}
                                        </td>
                                        {/* Actions */}
                                        <td className="py-3 px-3 text-center">
                                            <button
                                                onClick={() => onEditProduct(product)}
                                                className="p-2 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                                                title="Editar producto"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {filteredProducts.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                            <Package className="w-10 h-10 mb-3 opacity-20" />
                            <p className="text-sm">No se encontraron productos</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InventoryManagement;
