import React, { useState, useMemo, useEffect } from 'react';
import {
    Search, Package, Zap, Plus, Minus, TrendingUp, AlertTriangle,
    DollarSign, Coffee, ChevronDown, ChevronUp, Edit3, Truck,
    Activity, Gauge, Boxes
} from 'lucide-react';
import { Product, Asset } from '../../types';
import { pb } from '../../lib/pocketbase';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

// ─── Category types for pill filter ───
type FilterCategory = 'all' | 'snack' | 'socks' | 'service' | 'asset';

interface InventoryManagementProps {
    products: Product[];
    formatCurrency: (amount: number) => string;
    onEditProduct: (product: Product) => void;
    onQuickStockAdjust: (productId: string, delta: number) => void;
    onBulkAdjust?: () => void;
}

const InventoryManagement: React.FC<InventoryManagementProps> = ({
    products,
    formatCurrency,
    onEditProduct,
    onQuickStockAdjust,
    onBulkAdjust,
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
    const [expandedSocks, setExpandedSocks] = useState<Record<string, boolean>>({});
    const [assets, setAssets] = useState<Asset[]>([]);

    // ─── Load assets for fleet status ───
    useEffect(() => {
        const loadAssets = async () => {
            try {
                const records = await pb.collection('assets').getFullList<Asset>({ sort: 'name' });
                setAssets(records);
            } catch (e) {
                // Assets collection may not exist yet
                console.warn('Could not load assets:', e);
            }
        };
        loadAssets();
    }, []);

    // ─── Resolve category ───
    const getCategory = (p: Product): string => {
        if (p.category) return p.category;
        if (p.name.toLowerCase().includes('calceta')) return 'socks';
        if (p.name.toLowerCase().match(/hora|minuto|tiempo|pase|servicio/)) return 'service';
        return 'snack';
    };

    // ─── Computed metrics ───
    const metrics = useMemo(() => {
        const physical = products.filter(p => {
            const cat = getCategory(p);
            return cat === 'snack' || cat === 'socks';
        });
        const inventoryValue = physical.reduce((sum, p) => sum + ((p.cost || 0) * (p.stock || 0)), 0);
        const lowStockCount = physical.filter(p =>
            (p.stock || 0) > 0 && p.min_stock && (p.stock || 0) <= p.min_stock
        ).length + physical.filter(p => (p.stock || 0) === 0).length;

        // Fleet status
        const totalAssets = assets.length;
        const operationalAssets = assets.filter(a => a.status === 'available' || a.status === 'in_use').length;
        const fleetPct = totalAssets > 0 ? Math.round((operationalAssets / totalAssets) * 100) : 100;

        // Top seller (by stock turnover — lowest stock relative to initial)
        const sortedBySales = [...physical].sort((a, b) => (a.stock || 0) - (b.stock || 0));
        const topSeller = sortedBySales.length > 0 ? sortedBySales[0].name : 'N/A';

        return { inventoryValue, lowStockCount, fleetPct, totalAssets, operationalAssets, topSeller };
    }, [products, assets]);

    // ─── Socks size grouping ───
    const socksGroups = useMemo(() => {
        const sockProducts = products.filter(p => getCategory(p) === 'socks');
        const byBaseName: Record<string, Product[]> = {};
        sockProducts.forEach(p => {
            const base = p.name.replace(/\s*\(.*\)\s*/g, '').replace(/\s*(S|M|L|G)$/i, '').trim();
            if (!byBaseName[base]) byBaseName[base] = [];
            byBaseName[base].push(p);
        });
        return byBaseName;
    }, [products]);

    // ─── Filter logic ───
    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
            if (!matchesSearch) return false;
            if (filterCategory === 'all') return true;
            return getCategory(product) === filterCategory;
        });
    }, [products, searchQuery, filterCategory]);

    // ─── Category display helpers ───
    const getCategoryLabel = (p: Product) => {
        const cat = getCategory(p);
        switch (cat) {
            case 'service': return 'Servicio';
            case 'snack': return p.subcategory || 'Snack';
            case 'socks': return 'Calceta';
            default: return 'Producto';
        }
    };

    const getCategoryBadgeClass = (p: Product) => {
        const cat = getCategory(p);
        switch (cat) {
            case 'service': return 'bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20';
            case 'socks': return 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20';
            default: return 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20';
        }
    };

    const getStockStatus = (p: Product) => {
        const cat = getCategory(p);
        if (cat === 'service') return { label: '∞', class: 'text-slate-400 dark:text-slate-600', bg: '' };
        const s = p.stock || 0;
        if (s === 0) return { label: 'Sin Stock', class: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/5' };
        if (p.min_stock && s <= p.min_stock) return { label: 'Stock Bajo', class: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/5' };
        return { label: 'Normal', class: 'text-green-600 dark:text-green-400', bg: '' };
    };

    const isLowStock = (p: Product) => {
        const cat = getCategory(p);
        if (cat === 'service') return false;
        const s = p.stock || 0;
        return s === 0 || (p.min_stock != null && s <= p.min_stock);
    };

    // ─── Pill filter config ───
    const pillFilters: { key: FilterCategory; label: string; icon: React.ReactNode }[] = [
        { key: 'all', label: 'Todos', icon: <Boxes className="w-3.5 h-3.5" /> },
        { key: 'snack', label: 'Snacks', icon: <Coffee className="w-3.5 h-3.5" /> },
        { key: 'socks', label: 'Calcetas', icon: <Package className="w-3.5 h-3.5" /> },
        { key: 'service', label: 'Servicios', icon: <Zap className="w-3.5 h-3.5" /> },
    ];

    // ─── KPI Card Config ───
    const kpiCards = [
        {
            label: 'Artículos Stock Bajo',
            value: metrics.lowStockCount.toString(),
            subtitle: 'Requieren atención',
            icon: AlertTriangle,
            color: metrics.lowStockCount > 0
                ? 'bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-xl shadow-orange-500/20'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5',
            textClass: metrics.lowStockCount > 0 ? 'text-white' : 'text-slate-900 dark:text-white',
            subClass: metrics.lowStockCount > 0 ? 'text-orange-100' : 'text-slate-500 dark:text-slate-400',
            iconBg: metrics.lowStockCount > 0 ? 'bg-white/20' : 'bg-orange-100 dark:bg-orange-500/10',
            iconColor: metrics.lowStockCount > 0 ? 'text-white' : 'text-orange-600 dark:text-orange-400',
        },
        {
            label: 'Valor Total Almacén',
            value: formatCurrency(metrics.inventoryValue),
            subtitle: 'Costo de inventario',
            icon: DollarSign,
            color: 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5',
            textClass: 'text-slate-900 dark:text-white',
            subClass: 'text-slate-500 dark:text-slate-400',
            iconBg: 'bg-blue-100 dark:bg-blue-500/10',
            iconColor: 'text-blue-600 dark:text-blue-400',
        },
        {
            label: 'Producto Más Rotación',
            value: metrics.topSeller,
            subtitle: 'Mayor demanda',
            icon: TrendingUp,
            color: 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5',
            textClass: 'text-slate-900 dark:text-white',
            subClass: 'text-slate-500 dark:text-slate-400',
            iconBg: 'bg-emerald-100 dark:bg-emerald-500/10',
            iconColor: 'text-emerald-600 dark:text-emerald-400',
        },
        {
            label: 'Flota Operativa',
            value: `${metrics.fleetPct}%`,
            subtitle: `${metrics.operationalAssets}/${metrics.totalAssets} activos`,
            icon: Activity,
            color: 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5',
            textClass: 'text-slate-900 dark:text-white',
            subClass: 'text-slate-500 dark:text-slate-400',
            iconBg: 'bg-purple-100 dark:bg-purple-500/10',
            iconColor: 'text-purple-600 dark:text-purple-400',
        },
    ];

    return (
        <div className="flex flex-col gap-6 h-full">
            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {kpiCards.map(card => (
                    <div key={card.label} className={`${card.color} rounded-2xl p-5 relative overflow-hidden group transition-all duration-300 hover:shadow-lg`}>
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-3">
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${card.subClass}`}>{card.label}</span>
                                <div className={`p-2 rounded-xl ${card.iconBg}`}>
                                    <card.icon className={`w-4 h-4 ${card.iconColor}`} />
                                </div>
                            </div>
                            <p className={`text-2xl font-bold ${card.textClass} truncate`}>{card.value}</p>
                            <p className={`text-xs mt-1 ${card.subClass}`}>{card.subtitle}</p>
                        </div>
                        <div className="absolute -right-4 -bottom-4 w-28 h-28 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                    </div>
                ))}
            </div>

            {/* ── Filters Row ── */}
            <div className="flex items-center gap-4 flex-wrap">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                        placeholder="Buscar producto..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 bg-white/80 dark:bg-slate-900/50 border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100"
                    />
                </div>

                {/* Pill Filters */}
                <div className="flex p-1 bg-slate-100 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-white/5">
                    {pillFilters.map(pf => (
                        <button
                            key={pf.key}
                            onClick={() => setFilterCategory(pf.key)}
                            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${filterCategory === pf.key
                                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-transparent'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                        >
                            {pf.icon}
                            {pf.label}
                        </button>
                    ))}
                </div>

                {/* Bulk Adjustment button */}
                {onBulkAdjust && (
                    <Button
                        onClick={onBulkAdjust}
                        className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all active:scale-95"
                    >
                        <Truck className="w-4 h-4" />
                        Ajuste de Inventario
                    </Button>
                )}
            </div>

            {/* ── Socks Size Monitor (only when socks filter active) ── */}
            {(filterCategory === 'socks' || filterCategory === 'all') && Object.keys(socksGroups).length > 0 && filterCategory === 'socks' && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl p-5 shadow-sm">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                        <Gauge className="w-4 h-4 text-amber-500" />
                        Monitor de Tallas — Calcetas
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {(['M', 'G', 'L'] as const).map(size => {
                            const sizeProducts = products.filter(p => getCategory(p) === 'socks' && p.size === size);
                            const totalStock = sizeProducts.reduce((s, p) => s + (p.stock || 0), 0);
                            const maxCapacity = 100; // Assumed max capacity per size
                            const pct = Math.min(100, (totalStock / maxCapacity) * 100);
                            const isAlert = totalStock < 20;

                            return (
                                <div key={size} className={`p-4 rounded-xl border transition-all ${isAlert
                                    ? 'bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20'
                                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-white/5'
                                    }`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Talla {size === 'G' ? 'Grande' : size === 'M' ? 'Mediana' : 'Large'}</span>
                                        <span className={`text-lg font-black ${isAlert ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                                            {totalStock}
                                        </span>
                                    </div>
                                    <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-700 ${isAlert ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gradient-to-r from-emerald-500 to-green-400'
                                                }`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                    {isAlert && (
                                        <div className="flex items-center gap-1.5 mt-2 text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
                                            <AlertTriangle className="w-3 h-3" />
                                            Reabastecer — Menos de 20 unidades
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Master Table ── */}
            <div className="flex-1 overflow-hidden min-h-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm">
                <div className="overflow-x-auto overflow-y-auto h-full">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-800/40 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider sticky top-0 z-10">
                            <tr>
                                <th className="px-5 py-3.5 border-b border-slate-200 dark:border-white/5">Producto</th>
                                <th className="px-5 py-3.5 border-b border-slate-200 dark:border-white/5">Categoría</th>
                                <th className="px-5 py-3.5 border-b border-slate-200 dark:border-white/5">Talla / Variante</th>
                                <th className="px-5 py-3.5 border-b border-slate-200 dark:border-white/5 text-center">Stock Actual</th>
                                <th className="px-5 py-3.5 border-b border-slate-200 dark:border-white/5 text-right">Costo</th>
                                <th className="px-5 py-3.5 border-b border-slate-200 dark:border-white/5 text-right">Precio Venta</th>
                                <th className="px-5 py-3.5 border-b border-slate-200 dark:border-white/5 text-center">Estado</th>
                                <th className="px-5 py-3.5 border-b border-slate-200 dark:border-white/5 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {filteredProducts.map(product => {
                                const cat = getCategory(product);
                                const isService = cat === 'service';
                                const status = getStockStatus(product);
                                const low = isLowStock(product);
                                const isSock = cat === 'socks';
                                const isExpanded = expandedSocks[product.id];

                                return (
                                    <React.Fragment key={product.id}>
                                        <tr
                                            className={`transition-colors group ${low
                                                ? 'bg-red-50/60 dark:bg-red-500/5 hover:bg-red-100/60 dark:hover:bg-red-500/10'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                                                }`}
                                        >
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    {product.imagen ? (
                                                        <img src={product.imagen} alt={product.name} className="w-9 h-9 rounded-lg object-cover ring-1 ring-slate-200 dark:ring-white/10" />
                                                    ) : (
                                                        <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                                            {cat === 'socks' ? <Package className="w-4 h-4 text-amber-500" /> : cat === 'service' ? <Zap className="w-4 h-4 text-purple-500" /> : <Coffee className="w-4 h-4 text-blue-500" />}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white">{product.name}</p>
                                                        {product.is_for_sale === false && <span className="text-[9px] font-bold text-slate-400 uppercase">Inactivo</span>}
                                                    </div>
                                                    {isSock && (
                                                        <button
                                                            onClick={() => setExpandedSocks(prev => ({ ...prev, [product.id]: !prev[product.id] }))}
                                                            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors"
                                                        >
                                                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${getCategoryBadgeClass(product)}`}>
                                                    {getCategoryLabel(product)}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-400">
                                                {product.size ? (
                                                    <span className="bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-md text-xs font-medium">{product.size}</span>
                                                ) : product.duration_min ? (
                                                    <span className="text-xs font-medium">{product.duration_min} min</span>
                                                ) : (
                                                    <span className="text-slate-300 dark:text-slate-700">—</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 text-center">
                                                {!isService ? (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => onQuickStockAdjust(product.id, -1)}
                                                            disabled={(product.stock || 0) <= 0}
                                                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-red-100 dark:hover:bg-red-500/10 text-slate-500 hover:text-red-600 transition-colors disabled:opacity-30 border border-slate-200 dark:border-white/5"
                                                        >
                                                            <Minus className="w-3 h-3" />
                                                        </button>
                                                        <span className={`font-mono text-sm font-bold min-w-[32px] text-center ${status.class}`}>
                                                            {product.stock || 0}
                                                        </span>
                                                        <button
                                                            onClick={() => onQuickStockAdjust(product.id, 1)}
                                                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-emerald-500/10 text-slate-500 hover:text-emerald-600 transition-colors border border-slate-200 dark:border-white/5"
                                                        >
                                                            <Plus className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 text-xs">∞</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 text-right text-sm font-mono text-slate-600 dark:text-slate-400">
                                                {product.cost ? formatCurrency(product.cost) : '—'}
                                            </td>
                                            <td className="px-5 py-3.5 text-right text-sm font-bold font-mono text-slate-900 dark:text-white">
                                                {product.price === 0 && isService ? 'Abierto' : formatCurrency(product.price)}
                                            </td>
                                            <td className="px-5 py-3.5 text-center">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${status.label === 'Sin Stock' ? 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20'
                                                    : status.label === 'Stock Bajo' ? 'bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-500/20'
                                                        : status.label === '∞' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500 border-slate-200 dark:border-white/5'
                                                            : 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                                                    }`}>
                                                    {status.label}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-center">
                                                <button
                                                    onClick={() => onEditProduct(product)}
                                                    className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 border border-blue-200 dark:border-blue-500/20 transition-all"
                                                    title="Editar"
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>

                                        {/* Socks Size Breakdown (expandable) */}
                                        {isSock && isExpanded && (
                                            <tr className="bg-amber-50/50 dark:bg-amber-500/5">
                                                <td colSpan={8} className="px-8 py-4">
                                                    <div className="grid grid-cols-3 gap-4">
                                                        {(['M', 'G', 'L'] as const).map(size => {
                                                            const sameNameProducts = products.filter(sp =>
                                                                getCategory(sp) === 'socks' && sp.size === size &&
                                                                sp.name.replace(/\s*(S|M|L|G)$/i, '').trim() === product.name.replace(/\s*(S|M|L|G)$/i, '').trim()
                                                            );
                                                            const stockForSize = sameNameProducts.reduce((s, sp) => s + (sp.stock || 0), 0);
                                                            const pct = Math.min(100, (stockForSize / 50) * 100);
                                                            return (
                                                                <div key={size} className="flex items-center gap-3">
                                                                    <span className="text-xs font-bold text-slate-500 w-6">Talla {size}</span>
                                                                    <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                                        <div className={`h-full rounded-full ${stockForSize < 10 ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
                                                                    </div>
                                                                    <span className={`text-xs font-bold ${stockForSize < 10 ? 'text-red-600' : 'text-slate-700 dark:text-slate-300'}`}>{stockForSize}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}

                            {filteredProducts.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-6 py-16 text-center">
                                        <Package className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                                        <p className="text-slate-500 dark:text-slate-400 font-medium">No se encontraron productos</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default InventoryManagement;
