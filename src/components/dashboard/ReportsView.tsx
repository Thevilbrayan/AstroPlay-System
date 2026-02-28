import React, { useState, useEffect, useMemo } from 'react';
import {
    Calendar,
    Filter,
    Download,
    Banknote,
    Users,
    Ticket,
    Star,
    MoreHorizontal,
    Search,
    Sliders,
    CreditCard,
    ChevronLeft,
    ChevronRight,
    Loader2
} from 'lucide-react';
import { pb } from '../../lib/pocketbase';
import { Sale, Session, SaleItem, Product, Parent, Workstation } from '../../types';

// Extended interfaces for PocketBase expands
interface ExpandedSale extends Sale {
    expand?: {
        parent?: Parent;
        workstation?: Workstation;
    }
}

interface ExpandedSaleItem extends SaleItem {
    expand?: {
        product?: Product;
        sale?: ExpandedSale;
    }
}

export const ReportsView: React.FC = () => {
    // Basic state for the UI
    const [dateRange, setDateRange] = useState('Today');
    const [station, setStation] = useState('All Stations');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSale, setSelectedSale] = useState<ExpandedSale | null>(null);

    // Data States
    const [sales, setSales] = useState<ExpandedSale[]>([]);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [salesItems, setSalesItems] = useState<ExpandedSaleItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch Data Effect
    useEffect(() => {
        const fetchReportData = async () => {
            setIsLoading(true);
            try {
                // Calculate date filter based on selected range
                const now = new Date();

                // Opción: Si son antes de las 5 AM, operacionalmente sigue siendo el "día de negocio" anterior
                const cutoffHour = 5;
                const businessNow = new Date(now);
                if (businessNow.getHours() < cutoffHour) {
                    businessNow.setDate(businessNow.getDate() - 1);
                }

                let startOfDay = new Date(businessNow);
                let endOfDay = new Date(businessNow);

                if (dateRange === 'Today') {
                    startOfDay.setHours(cutoffHour, 0, 0, 0);
                    endOfDay.setDate(startOfDay.getDate() + 1);
                    endOfDay.setHours(cutoffHour - 1, 59, 59, 999);
                } else if (dateRange === 'Yesterday') {
                    startOfDay.setDate(startOfDay.getDate() - 1);
                    startOfDay.setHours(cutoffHour, 0, 0, 0);
                    endOfDay.setDate(startOfDay.getDate() + 1);
                    endOfDay.setHours(cutoffHour - 1, 59, 59, 999);
                } else if (dateRange === 'Last 7 Days') {
                    startOfDay.setDate(startOfDay.getDate() - 7);
                    startOfDay.setHours(cutoffHour, 0, 0, 0);
                    endOfDay.setDate(businessNow.getDate() + 1);
                    endOfDay.setHours(cutoffHour - 1, 59, 59, 999);
                } else if (dateRange === 'Current Month') {
                    startOfDay.setDate(1);
                    startOfDay.setHours(cutoffHour, 0, 0, 0);

                    // Fin del mes operativo
                    endOfDay = new Date(startOfDay);
                    endOfDay.setMonth(startOfDay.getMonth() + 1);
                    endOfDay.setDate(1);
                    endOfDay.setHours(cutoffHour - 1, 59, 59, 999);
                } else {
                    // Default to today safely
                    startOfDay.setHours(cutoffHour, 0, 0, 0);
                    endOfDay.setDate(startOfDay.getDate() + 1);
                    endOfDay.setHours(cutoffHour - 1, 59, 59, 999);
                }

                // PocketBase format expected by SQLite strings: YYYY-MM-DD HH:mm:ss.000Z
                const startStr = startOfDay.toISOString().replace('T', ' ');
                const endStr = endOfDay.toISOString().replace('T', ' ');

                // Build queries
                let salesFilter = `created >= "${startStr}" && created <= "${endStr}"`;
                let sessionsFilter = `created >= "${startStr}" && created <= "${endStr}"`;

                if (station !== 'All Stations') {
                    // Requires resolving workstation ID from name, for now simulating simple text filter on station string if matching UI text
                    // E.g. in real world: salesFilter += ` && workstation.name = "${station}"`;
                }

                // Fetch Sales
                const fetchedSales = await pb.collection('sales').getFullList<ExpandedSale>({
                    filter: salesFilter,
                    expand: 'parent,workstation',
                    sort: '-created'
                });

                // Fetch Sessions (for Attendance)
                const fetchedSessions = await pb.collection('sessions').getFullList<Session>({
                    filter: sessionsFilter,
                    sort: '-created'
                });

                // Fetch Sales Items (for Categories and Top Seller)
                const saleIds = fetchedSales.map(s => s.id);
                let fetchedItems: ExpandedSaleItem[] = [];

                if (saleIds.length > 0) {
                    const chunkSize = 100; // PocketBase URL constraint limit safety
                    const firstChunk = saleIds.slice(0, chunkSize);
                    const itemsFilter = firstChunk.map(id => `sale="${id}"`).join('||');
                    fetchedItems = await pb.collection('sales_items').getFullList<ExpandedSaleItem>({
                        filter: itemsFilter,
                        expand: 'product,sale.workstation'
                    });
                }

                setSales(fetchedSales);
                setSessions(fetchedSessions);
                setSalesItems(fetchedItems);

            } catch (error) {
                console.error("Error fetching report data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchReportData();
    }, [dateRange, station]);

    // Derived State Calculators

    // 1. Venta Total
    const totalSales = useMemo(() => {
        return sales.reduce((acc, sale) => acc + (sale.total_amount || 0), 0);
    }, [sales]);

    // 2. Afluencia (Total children across sessions)
    const totalAttendance = useMemo(() => {
        return sessions.reduce((acc, session) => acc + (session.child?.length || 0), 0);
    }, [sessions]);

    // 3. Ticket Promedio
    const averageTicket = useMemo(() => {
        if (sales.length === 0) return 0;
        return totalSales / sales.length;
    }, [totalSales, sales]);

    // 4. Producto Estrella
    const topProduct = useMemo(() => {
        if (salesItems.length === 0) return "N/A";

        const countMap: Record<string, { name: string, count: number }> = {};

        salesItems.forEach(item => {
            if (item.expand?.product) {
                const pId = item.expand.product.id;
                if (!countMap[pId]) {
                    countMap[pId] = { name: item.expand.product.name, count: 0 };
                }
                countMap[pId].count += (item.quantity || 1);
            }
        });

        let top = { name: "N/A", count: 0 };
        for (const key in countMap) {
            if (countMap[key].count > top.count) {
                top = countMap[key];
            }
        }

        return top.name;
    }, [salesItems]);

    // 5. Categorized Sales Data
    const categoryData = useMemo(() => {
        let services = 0;
        let snacks = 0;
        let socks = 0;

        salesItems.forEach(item => {
            const cat = item.expand?.product?.category;
            const amount = (item.quantity || 1) * (item.unit_price || 0);

            if (cat === 'snack') snacks += amount;
            else if (cat === 'socks') socks += amount;
            else services += amount; // Fallback to service if uncategorized so total is 100% matched
        });

        const total = services + snacks + socks;
        return {
            services,
            snacks,
            socks,
            total,
            servicesPct: total > 0 ? (services / total) * 100 : 0,
            snacksPct: total > 0 ? (snacks / total) * 100 : 0,
            socksPct: total > 0 ? (socks / total) * 100 : 0,
        };
    }, [salesItems]);

    // Derived Sales Filter
    const filteredSales = useMemo(() => {
        if (!searchQuery.trim()) return sales;
        const lowerQ = searchQuery.toLowerCase();
        return sales.filter(sale => {
            const folio = `#AST-${sale.id.slice(0, 4)}`.toLowerCase();
            const parentName = sale.expand?.parent?.name?.toLowerCase() || 'venta rápida';
            return folio.includes(lowerQ) || parentName.includes(lowerQ);
        });
    }, [sales, searchQuery]);

    // Data Formatter
    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-8 transition-all duration-300 relative">
            {isLoading && (
                <div className="absolute inset-0 z-50 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                        <span className="text-slate-600 dark:text-slate-300 font-semibold">Cargando métricas...</span>
                    </div>
                </div>
            )}
            {/* Header */}
            <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Reports & Analytics</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">AstroPlay OS Central Business Intelligence</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Date Range Picker */}
                    <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 shadow-sm">
                        <Calendar className="text-slate-400 mr-2 w-5 h-5 shrink-0" />
                        <select
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value)}
                            className="bg-transparent border-none focus:ring-0 text-sm font-medium cursor-pointer py-0 text-slate-800 dark:text-slate-200 outline-none"
                        >
                            <option value="Today">Today</option>
                            <option value="Yesterday">Yesterday</option>
                            <option value="Last 7 Days">Last 7 Days</option>
                            <option value="Current Month">Current Month</option>
                            <option value="Custom Range">Custom</option>
                        </select>
                    </div>

                    {/* Station Filter */}
                    <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 shadow-sm">
                        <Filter className="text-slate-400 mr-2 w-5 h-5 shrink-0" />
                        <select
                            value={station}
                            onChange={(e) => setStation(e.target.value)}
                            className="bg-transparent border-none focus:ring-0 text-sm font-medium cursor-pointer py-0 text-slate-800 dark:text-slate-200 outline-none"
                        >
                            <option value="All Stations">Todas</option>
                            <option value="AstroPlay Principal">AstroPlay Principal</option>
                            <option value="Go-Karts">Go-Karts</option>
                            <option value="Tren/Dinos">Tren/Dinos</option>
                        </select>
                    </div>

                    <div className="flex gap-2">
                        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shadow-md shadow-blue-600/20 active:scale-95">
                            <Download className="w-5 h-5 shrink-0" />
                            <span>Exportar PDF</span>
                        </button>
                        <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shadow-md shadow-green-600/20 active:scale-95 hidden sm:flex">
                            <Download className="w-5 h-5 shrink-0" />
                            <span>Exportar Excel</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* KPI Cards */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* Total Sales */}
                <div className="bg-blue-600 p-6 rounded-2xl text-white shadow-xl shadow-blue-600/20 relative overflow-hidden group">
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                                <Banknote className="w-6 h-6" />
                            </div>
                        </div>
                        <p className="text-blue-100 text-sm font-medium">Venta Total</p>
                        <h3 className="text-3xl font-bold mt-1 tracking-tight">{formatCurrency(totalSales)}</h3>
                    </div>
                    <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                </div>

                {/* Total Attendance */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm relative overflow-hidden group">
                    <div className="flex items-center justify-between mb-4">
                        <div className="bg-emerald-100 dark:bg-emerald-500/10 p-2 rounded-xl">
                            <Users className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                        </div>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Afluencia Total</p>
                    <h3 className="text-3xl font-bold mt-1 text-slate-800 dark:text-slate-100 tracking-tight">{totalAttendance}</h3>
                    <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                </div>

                {/* Average Ticket */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm relative overflow-hidden group">
                    <div className="flex items-center justify-between mb-4">
                        <div className="bg-purple-100 dark:bg-purple-500/10 p-2 rounded-xl">
                            <Ticket className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                        </div>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Ticket Promedio</p>
                    <h3 className="text-3xl font-bold mt-1 text-slate-800 dark:text-slate-100 tracking-tight">{formatCurrency(averageTicket)}</h3>
                    <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                </div>

                {/* Top Seller */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm relative overflow-hidden group">
                    <div className="flex items-center justify-between mb-4">
                        <div className="bg-amber-100 dark:bg-amber-500/10 p-2 rounded-xl">
                            <Star className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                        </div>
                        <span className="bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">Top Seller</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Producto Estrella</p>
                    <h3 className="text-xl font-bold mt-1 text-slate-800 dark:text-slate-100 tracking-tight truncate">{topProduct}</h3>
                    <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                </div>
            </section>

            {/* Charts Section */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Donut Chart - Ventas por Categoria */}
                <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100">Ventas por Categoría</h4>
                        <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1"><MoreHorizontal className="w-6 h-6" /></button>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-8 py-4 flex-1 justify-center">
                        <div className="relative w-48 h-48 shrink-0 drop-shadow-sm">
                            <svg className="w-full h-full transform -rotate-90">
                                {/* Base Circle */}
                                <circle className="text-slate-100 dark:text-slate-800" cx="96" cy="96" fill="transparent" r="76" stroke="currentColor" strokeWidth="32" pathLength="100"></circle>

                                {/* Socks Circle (Longest, drawn first) */}
                                <circle className="text-amber-500 drop-shadow-md" cx="96" cy="96" fill="transparent" r="76" stroke="currentColor"
                                    strokeDasharray="100"
                                    strokeDashoffset={100 - (categoryData.servicesPct + categoryData.snacksPct + categoryData.socksPct)}
                                    strokeWidth="32" pathLength="100" style={{ transition: 'stroke-dashoffset 1s ease-out' }}></circle>

                                {/* Snacks Circle */}
                                <circle className="text-emerald-500 drop-shadow-md" cx="96" cy="96" fill="transparent" r="76" stroke="currentColor"
                                    strokeDasharray="100"
                                    strokeDashoffset={100 - (categoryData.servicesPct + categoryData.snacksPct)}
                                    strokeWidth="32" pathLength="100" style={{ transition: 'stroke-dashoffset 1s ease-out' }}></circle>

                                {/* Services Circle (Shortest, drawn last on top) */}
                                <circle className="text-blue-500 drop-shadow-md" cx="96" cy="96" fill="transparent" r="76" stroke="currentColor"
                                    strokeDasharray="100"
                                    strokeDashoffset={100 - categoryData.servicesPct}
                                    strokeWidth="32" pathLength="100" style={{ transition: 'stroke-dashoffset 1s ease-out' }}></circle>
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{formatCurrency(categoryData.total).replace(/\.\d{2}/, '')}</span>
                                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-1">Total</span>
                            </div>
                        </div>

                        <div className="w-full sm:flex-1 space-y-5">
                            <div className="flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <div className="w-4 h-4 rounded-full bg-blue-500 shadow-sm border border-white dark:border-slate-800"></div>
                                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Servicios</span>
                                </div>
                                <span className="text-sm font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-white/5 px-2.5 py-1 rounded-lg">{formatCurrency(categoryData.services)} <span className="text-slate-400 font-normal ml-1">{Math.round(categoryData.servicesPct)}%</span></span>
                            </div>
                            <div className="flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <div className="w-4 h-4 rounded-full bg-emerald-500 shadow-sm border border-white dark:border-slate-800"></div>
                                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Snacks</span>
                                </div>
                                <span className="text-sm font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-white/5 px-2.5 py-1 rounded-lg">{formatCurrency(categoryData.snacks)} <span className="text-slate-400 font-normal ml-1">{Math.round(categoryData.snacksPct)}%</span></span>
                            </div>
                            <div className="flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <div className="w-4 h-4 rounded-full bg-amber-500 shadow-sm border border-white dark:border-slate-800"></div>
                                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Calcetas (Insumos)</span>
                                </div>
                                <span className="text-sm font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-white/5 px-2.5 py-1 rounded-lg">{formatCurrency(categoryData.socks)} <span className="text-slate-400 font-normal ml-1">{Math.round(categoryData.socksPct)}%</span></span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bar Chart - Ventas por Estacion */}
                <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100">Rendimiento por Estación</h4>
                        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/5">
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-blue-500/30"></div> Semana Pasada
                            </span>
                            <span className="text-slate-300 dark:text-slate-600">|</span>
                            <span className="text-xs text-slate-800 dark:text-slate-200 font-bold flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div> Actual
                            </span>
                        </div>
                    </div>

                    <div className="flex-1 h-64 flex items-end gap-2 sm:gap-6 pb-2 border-b border-slate-100 dark:border-white/5 mt-4">
                        {/* Removed static bars to keep simplicity for now, would be dynamically mapped by workstation similar to categoryData */}
                        <div className="w-full flex items-center justify-center text-sm text-slate-500 font-medium italic h-full">
                            El gráfico de barras se actualiza con datos.
                        </div>
                    </div>
                </div>
            </section>

            {/* Transactions Data Table */}
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50 dark:bg-transparent">
                    <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100">Transacciones Recientes</h4>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all dark:text-white"
                                placeholder="Buscar folio, cliente..."
                                type="text"
                            />
                        </div>
                        <button className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 p-2.5 rounded-xl text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-all shadow-sm shrink-0">
                            <Sliders className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-800/40 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                            <tr>
                                <th className="px-6 py-4 border-b border-slate-200 dark:border-white/5">Folio</th>
                                <th className="px-6 py-4 border-b border-slate-200 dark:border-white/5">Cliente (Padre)</th>
                                <th className="px-6 py-4 border-b border-slate-200 dark:border-white/5 hidden sm:table-cell">Estación</th>
                                <th className="px-6 py-4 border-b border-slate-200 dark:border-white/5 hidden md:table-cell">Categoría</th>
                                <th className="px-6 py-4 border-b border-slate-200 dark:border-white/5 text-right">Total</th>
                                <th className="px-6 py-4 border-b border-slate-200 dark:border-white/5 text-right hidden lg:table-cell">Método de Pago</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {filteredSales.map((sale) => (
                                <tr
                                    key={sale.id}
                                    onClick={() => setSelectedSale(sale)}
                                    className="hover:bg-blue-50/50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer"
                                >
                                    <td className="px-6 py-4 font-bold text-sm text-blue-600 dark:text-blue-400">#AST-{sale.id.slice(0, 4).toUpperCase()}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold text-xs ring-2 ring-white dark:ring-slate-900 shadow-sm">
                                                {sale.expand?.parent?.name ? sale.expand.parent.name.substring(0, 2).toUpperCase() : 'NA'}
                                            </div>
                                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                                                {sale.expand?.parent?.name || 'Venta Rápida'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 font-medium hidden sm:table-cell">
                                        {sale.expand?.workstation?.name || 'General'}
                                    </td>
                                    <td className="px-6 py-4 hidden md:table-cell">
                                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                            Venta
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-slate-100 text-right">
                                        {formatCurrency(sale.total_amount)}
                                    </td>
                                    <td className="px-6 py-4 text-right hidden lg:table-cell">
                                        <div className="flex justify-end">
                                            <span className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/5 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 w-fit shadow-sm">
                                                {sale.payment_method === 'card' ? <CreditCard className="w-4 h-4 text-slate-400" /> : <Banknote className="w-4 h-4 text-emerald-500" />}
                                                <span className="capitalize">{sale.payment_method || 'Efectivo'}</span>
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredSales.length === 0 && !isLoading && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                                        No hay transacciones registradas para este periodo.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                <div className="p-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-transparent">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Mostrando {filteredSales.length} transacciones</span>
                    <div className="flex gap-1.5">
                        <button className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-slate-400 transition-all shadow-sm">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button className="w-8 h-8 flex items-center justify-center bg-blue-600 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-500/20">1</button>
                        <button className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold shadow-sm transition-all">2</button>
                        <button className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold shadow-sm transition-all hidden sm:flex">3</button>
                        <span className="flex items-center justify-center w-8 h-8 text-slate-400 text-xs hidden sm:flex">...</span>
                        <button className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-slate-400 transition-all shadow-sm">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </section>

            {/* Transaction Detail Modal */}
            {selectedSale && (
                <TransactionDetailModal
                    sale={selectedSale}
                    salesItems={salesItems}
                    onClose={() => setSelectedSale(null)}
                    formatCurrency={formatCurrency}
                />
            )}
        </div>
    );
};

// Internal component for the Transaction Detail Modal
const TransactionDetailModal: React.FC<{
    sale: ExpandedSale;
    salesItems: ExpandedSaleItem[];
    onClose: () => void;
    formatCurrency: (val: number) => string;
}> = ({ sale, salesItems, onClose, formatCurrency }) => {

    // Filter items belonging to this sale only
    // Note: since PocketBase might not have all sales items fetched if there's >100, 
    // real implementation might need to fetch them directly on click, but we'll use local for now.
    const items = salesItems.filter(item => item.sale === sale.id);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-slate-900/80 backdrop-blur-sm">
            <div
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-4 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-transparent">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>Desglose de Venta</span>
                            <span className="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 px-2 py-0.5 rounded text-xs">#AST-{sale.id.slice(0, 4).toUpperCase()}</span>
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                            {sale.created ? new Date(sale.created).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' }) : 'Fecha no disponible'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors shadow-sm border border-slate-200 dark:border-white/10"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                {/* Details Meta */}
                <div className="p-6 pb-2 grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-white/5">
                        <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Cliente</span>
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                                {sale.expand?.parent?.name ? sale.expand.parent.name.substring(0, 2).toUpperCase() : 'NA'}
                            </div>
                            <span className="text-sm font-bold text-slate-800 dark:text-white truncate">
                                {sale.expand?.parent?.name || 'Venta Rápida'}
                            </span>
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-white/5 flex flex-col justify-center">
                        <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Estación</span>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                            {sale.expand?.workstation?.name || 'General'}
                        </span>
                    </div>
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto p-6 pt-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Artículos del Ticket ({items.length})</h4>
                    <div className="space-y-3">
                        {items.length > 0 ? items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/5 flex items-center justify-center text-slate-500 dark:text-slate-400">
                                        <span className="text-[10px] font-bold">{item.quantity}x</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{item.expand?.product?.name || 'Producto Desconocido'}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{formatCurrency(item.unit_price || 0)} c/u</p>
                                    </div>
                                </div>
                                <span className="text-sm font-bold text-slate-900 dark:text-white">
                                    {formatCurrency((item.quantity || 1) * (item.unit_price || 0))}
                                </span>
                            </div>
                        )) : (
                            <div className="py-6 text-center text-slate-500 text-sm italic">
                                Este ticket no tiene artículos registrados o no están adjuntos en la base local temporal.
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Totals */}
                <div className="p-6 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-white/5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-wide">Método de Pago</span>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 capitalize flex items-center gap-1.5">
                            {sale.payment_method === 'card' ? <CreditCard className="w-4 h-4 text-slate-400" /> : <Banknote className="w-4 h-4 text-emerald-500" />} {sale.payment_method || 'Efectivo'}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-base font-bold text-slate-800 dark:text-slate-200">Total Pagado</span>
                        <span className="text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tight">{formatCurrency(sale.total_amount)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportsView;
