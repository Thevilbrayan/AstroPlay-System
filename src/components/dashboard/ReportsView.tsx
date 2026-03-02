import React, { useState, useEffect, useMemo } from 'react';
import {
    Calendar,
    Filter,
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
    Loader2,
    AlertCircle,
    FileText,
    Table2
} from 'lucide-react';
import { pb } from '../../lib/pocketbase';
import { Sale, Session, SaleItem, Product, Parent, Workstation } from '../../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { downloadPDF, downloadExcelJS } from '../../lib/download';
import DatePicker from '../ui/DatePicker';

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
    const [currentPage, setCurrentPage] = useState(1);
    const ROWS_PER_PAGE = 10;

    // Custom date range state
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [customApplied, setCustomApplied] = useState(false);

    // Data States
    const [sales, setSales] = useState<ExpandedSale[]>([]);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [salesItems, setSalesItems] = useState<ExpandedSaleItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
    const [workstations, setWorkstations] = useState<Workstation[]>([]);

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
                } else if (dateRange === 'Custom Range' && customStart && customEnd) {
                    // Custom date range from date inputs
                    startOfDay = new Date(customStart + 'T00:00:00');
                    endOfDay = new Date(customEnd + 'T23:59:59.999');
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
                    salesFilter += ` && workstation.name = "${station}"`;
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

        // For Custom Range, only fetch when customApplied is true
        if (dateRange === 'Custom Range' && !customApplied) return;
        if (dateRange === 'Custom Range') setCustomApplied(false); // reset trigger
        fetchReportData();
    }, [dateRange, station, customApplied]);

    // Fetch low-stock products
    useEffect(() => {
        const fetchLowStock = async () => {
            try {
                const prods = await pb.collection('products').getFullList<Product>({ sort: 'stock' });
                const lowStock = prods.filter(p =>
                    p.category !== 'service' &&
                    p.stock !== undefined &&
                    p.min_stock !== undefined &&
                    p.stock <= p.min_stock
                );
                setLowStockProducts(lowStock);
            } catch (err) {
                console.error('Error fetching low stock:', err);
            }
        };
        fetchLowStock();
    }, []);

    // Fetch workstations for the station filter dropdown
    useEffect(() => {
        const fetchWorkstations = async () => {
            try {
                const ws = await pb.collection('workstations').getFullList<Workstation>({ sort: 'name' });
                setWorkstations(ws);
            } catch (err) {
                console.error('Error fetching workstations:', err);
            }
        };
        fetchWorkstations();
    }, []);

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
            else services += amount;
        });

        // Use totalSales (from sale records) as the authoritative total
        // so the donut chart total always matches the KPI card
        const itemsTotal = services + snacks + socks;
        const authTotal = totalSales > 0 ? totalSales : itemsTotal;

        // Assign any difference (items not fetched/categorized) to services
        if (authTotal > itemsTotal) {
            services += (authTotal - itemsTotal);
        }

        return {
            services,
            snacks,
            socks,
            total: authTotal,
            servicesPct: authTotal > 0 ? (services / authTotal) * 100 : 0,
            snacksPct: authTotal > 0 ? (snacks / authTotal) * 100 : 0,
            socksPct: authTotal > 0 ? (socks / authTotal) * 100 : 0,
        };
    }, [salesItems, totalSales]);

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
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
    };

    // ─── Workstation Breakdown ───
    const workstationBreakdown = useMemo(() => {
        const map: Record<string, { name: string; total: number; count: number; cash: number; card: number }> = {};
        sales.forEach(s => {
            const wsName = s.expand?.workstation?.name || 'Sin Estación';
            if (!map[wsName]) map[wsName] = { name: wsName, total: 0, count: 0, cash: 0, card: 0 };
            map[wsName].total += s.total_amount || 0;
            map[wsName].count += 1;
            if (s.payment_method === 'card') map[wsName].card += s.total_amount || 0;
            else map[wsName].cash += s.total_amount || 0;
        });
        return Object.values(map).sort((a, b) => b.total - a.total);
    }, [sales]);


    const dateLabel = (() => {
        switch (dateRange) {
            case 'Today': return 'Hoy';
            case 'Yesterday': return 'Ayer';
            case 'Last 7 Days': return 'Últimos 7 Días';
            case 'Current Month': return 'Mes Actual';
            case 'Custom Range': {
                if (customStart && customEnd) {
                    const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
                    return `${fmtDate(customStart)} — ${fmtDate(customEnd)}`;
                }
                return 'Rango Personalizado';
            }
            default: return dateRange;
        }
    })();

    // ─── Export: PDF (Mirrors Dashboard) ───
    const exportPDF = async () => {
        try {
            const doc = new jsPDF();
            const pageW = doc.internal.pageSize.getWidth();
            const pageH = doc.internal.pageSize.getHeight();
            const now = new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });
            const ml = 12;
            const mr = 12;
            const cW = pageW - ml - mr; // content width

            // Dashboard Color Palette (matching the UI exactly)
            const CLR = {
                blue: [37, 99, 235] as [number, number, number],      // blue-600  (Venta Total)
                blueLight: [219, 234, 254] as [number, number, number],
                emerald: [16, 185, 129] as [number, number, number],   // emerald-500 (Afluencia)
                purple: [147, 51, 234] as [number, number, number],    // purple-600 (Ticket)
                amber: [245, 158, 11] as [number, number, number],     // amber-500 (Top)
                dark: [15, 23, 42] as [number, number, number],        // slate-900
                text: [30, 41, 59] as [number, number, number],        // slate-800
                muted: [100, 116, 139] as [number, number, number],    // slate-500
                border: [226, 232, 240] as [number, number, number],   // slate-200
                bg: [248, 250, 252] as [number, number, number],       // slate-50
                white: [255, 255, 255] as [number, number, number],
                red: [220, 38, 38] as [number, number, number],
            };

            // ═══ HEADER ═══
            doc.setFillColor(...CLR.dark);
            doc.rect(0, 0, pageW, 28, 'F');
            // Accent line
            doc.setFillColor(...CLR.blue);
            doc.rect(0, 28, pageW, 1.2, 'F');

            doc.setTextColor(...CLR.white);
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text('ASTROPLAY', ml, 13);
            doc.setFontSize(18);
            doc.setTextColor(147, 197, 253); // blue-300
            doc.text('OS', ml + doc.getTextWidth('ASTROPLAY') + 2, 13);

            doc.setTextColor(180, 190, 215);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text('Reports & Analytics — Central Business Intelligence', ml, 20);

            doc.setTextColor(...CLR.white);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text(`${dateLabel}`, pageW - mr, 12, { align: 'right' });
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(180, 190, 215);
            doc.text(`${now}  |  ${station}`, pageW - mr, 19, { align: 'right' });

            let y = 36;

            // ═══ 4 KPI CARDS ROW ═══
            const cardW = (cW - 9) / 4; // 4 cards with 3px gap
            const cardH = 28;
            const cards = [
                { label: 'Venta Total', value: formatCurrency(totalSales), color: CLR.blue, accent: [96, 165, 250] as [number, number, number] },
                { label: 'Afluencia Total', value: String(totalAttendance), color: CLR.emerald, accent: [110, 231, 183] as [number, number, number] },
                { label: 'Ticket Promedio', value: formatCurrency(averageTicket), color: CLR.purple, accent: [192, 132, 252] as [number, number, number] },
                { label: 'Producto Estrella', value: topProduct, color: CLR.amber, accent: [252, 211, 77] as [number, number, number] },
            ];

            cards.forEach((card, i) => {
                const cx = ml + i * (cardW + 3);
                // Card background
                if (i === 0) {
                    // First card is filled blue (like the dashboard)
                    doc.setFillColor(...card.color);
                    doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'F');
                    doc.setTextColor(...CLR.white);
                    doc.setFontSize(7);
                    doc.setFont('helvetica', 'normal');
                    doc.text(card.label, cx + 5, y + 9);
                    doc.setFontSize(13);
                    doc.setFont('helvetica', 'bold');
                    doc.text(card.value, cx + 5, y + 20);
                } else {
                    // Other cards: white bg with colored accent
                    doc.setFillColor(...CLR.white);
                    doc.setDrawColor(...CLR.border);
                    doc.setLineWidth(0.3);
                    doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'FD');
                    // Color indicator dot
                    doc.setFillColor(...card.color);
                    doc.circle(cx + 7, y + 8, 3, 'F');
                    // Label
                    doc.setTextColor(...CLR.muted);
                    doc.setFontSize(7);
                    doc.setFont('helvetica', 'normal');
                    doc.text(card.label, cx + 13, y + 9);
                    // Value
                    doc.setTextColor(...CLR.text);
                    doc.setFontSize(i === 3 ? 9 : 13);
                    doc.setFont('helvetica', 'bold');
                    const val = card.value.length > 18 ? card.value.substring(0, 18) + '...' : card.value;
                    doc.text(val, cx + 5, y + 21);
                }
            });

            y += cardH + 8;

            // ═══ CHARTS ROW: Donut + Workstation Bars ═══
            const chartBoxW = (cW - 4) / 2;
            const chartBoxH = 58;

            // --- Left Box: Donut Chart (Ventas por Categoría) ---
            doc.setFillColor(...CLR.white);
            doc.setDrawColor(...CLR.border);
            doc.setLineWidth(0.3);
            doc.roundedRect(ml, y, chartBoxW, chartBoxH, 2, 2, 'FD');

            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...CLR.text);
            doc.text('Ventas por Categoría', ml + 6, y + 8);

            // Donut
            const dcx = ml + 30;
            const dcy = y + 34;
            const dR = 16;
            const dInner = 10;

            const slices = [
                { label: 'Servicios', pct: categoryData.servicesPct, amt: categoryData.services, color: CLR.blue },
                { label: 'Snacks', pct: categoryData.snacksPct, amt: categoryData.snacks, color: CLR.emerald },
                { label: 'Calcetas', pct: categoryData.socksPct, amt: categoryData.socks, color: CLR.amber },
            ].filter(s => s.pct > 0);

            let angle = -Math.PI / 2;
            slices.forEach(s => {
                const sweep = (s.pct / 100) * 2 * Math.PI;
                const steps = Math.max(80, Math.ceil(sweep * 60));
                doc.setFillColor(...s.color);

                // Build a smooth polygon: outer arc → inner arc reversed
                const outerPts: [number, number][] = [];
                const innerPts: [number, number][] = [];
                for (let t = 0; t <= steps; t++) {
                    const a = angle + (sweep * t / steps);
                    outerPts.push([dcx + Math.cos(a) * dR, dcy + Math.sin(a) * dR]);
                    innerPts.push([dcx + Math.cos(a) * dInner, dcy + Math.sin(a) * dInner]);
                }
                // Combine: outer arc forward + inner arc reversed = closed annular sector
                const pts = [...outerPts, ...innerPts.reverse()];

                // Draw as a single filled polygon using lines
                if (pts.length > 2) {
                    doc.setDrawColor(...s.color);
                    doc.setLineWidth(0.01);
                    const [startX, startY] = pts[0];
                    // Use jsPDF lines to draw a filled polygon
                    const deltas = pts.slice(1).map((p, i) => {
                        const prev = pts[i];
                        return [p[0] - prev[0], p[1] - prev[1]];
                    });
                    doc.lines(deltas, startX, startY, [1, 1], 'F', true);
                }

                angle += sweep;
            });

            // Donut hole
            doc.setFillColor(...CLR.white);
            doc.circle(dcx, dcy, dInner, 'F');
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...CLR.text);
            doc.text(formatCurrency(categoryData.total).replace(/\.\d{2}/, ''), dcx, dcy, { align: 'center' });
            doc.setFontSize(5);
            doc.setTextColor(...CLR.muted);
            doc.text('TOTAL', dcx, dcy + 4, { align: 'center' });

            // Legend
            const lgX = ml + 55;
            slices.forEach((s, i) => {
                const ly = y + 20 + (i * 13);
                doc.setFillColor(...s.color);
                doc.circle(lgX, ly, 2, 'F');
                doc.setFontSize(8);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...CLR.text);
                doc.text(s.label, lgX + 5, ly + 1);

                doc.setFont('helvetica', 'normal');
                doc.setTextColor(...CLR.muted);
                doc.text(`${formatCurrency(s.amt)}  ${Math.round(s.pct)}%`, lgX + 5, ly + 6);
            });

            // --- Right Box: Workstation Performance Bars ---
            const rbX = ml + chartBoxW + 4;
            doc.setFillColor(...CLR.white);
            doc.setDrawColor(...CLR.border);
            doc.setLineWidth(0.3);
            doc.roundedRect(rbX, y, chartBoxW, chartBoxH, 2, 2, 'FD');

            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...CLR.text);
            doc.text('Rendimiento por Estación', rbX + 6, y + 8);

            if (workstationBreakdown.length > 0) {
                const maxVal = Math.max(...workstationBreakdown.map(w => w.total));
                const barStartX = rbX + 6;
                const barAreaW = chartBoxW - 16;
                const barItemH = Math.min(10, (chartBoxH - 16) / workstationBreakdown.length);

                workstationBreakdown.forEach((w, i) => {
                    const by = y + 14 + (i * barItemH);
                    const barW = maxVal > 0 ? (w.total / maxVal) * (barAreaW - 12) : 0;

                    doc.setFontSize(7);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(...CLR.text);
                    doc.text(w.name.substring(0, 18), barStartX, by + 3);

                    // Bar background
                    doc.setFillColor(...CLR.bg);
                    doc.roundedRect(barStartX, by + 5, barAreaW - 12, 4, 1, 1, 'F');
                    // Bar fill
                    doc.setFillColor(...CLR.blue);
                    if (barW > 2) doc.roundedRect(barStartX, by + 5, Math.max(2, barW), 4, 1, 1, 'F');

                    // Value below the bar, right-aligned
                    doc.setFontSize(6);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(...CLR.muted);
                    doc.text(formatCurrency(w.total), barStartX + barAreaW - 12, by + 4 + 6, { align: 'right' });
                });
            } else {
                doc.setFontSize(8);
                doc.setTextColor(...CLR.muted);
                doc.text('Sin datos de estaciones', rbX + chartBoxW / 2, y + 34, { align: 'center' });
            }

            y += chartBoxH + 6;

            // ═══ PAYMENT METHOD SPLIT ═══
            const cashCount = filteredSales.filter(s => s.payment_method !== 'card').length;
            const cardCount = filteredSales.filter(s => s.payment_method === 'card').length;
            const cashAmt = filteredSales.filter(s => s.payment_method !== 'card').reduce((a, s) => a + (s.total_amount || 0), 0);
            const cardAmt = filteredSales.filter(s => s.payment_method === 'card').reduce((a, s) => a + (s.total_amount || 0), 0);
            const paymentTotal = cashAmt + cardAmt;
            const cashPct = paymentTotal > 0 ? Math.round((cashAmt / paymentTotal) * 100) : 50;

            doc.setFillColor(...CLR.white);
            doc.setDrawColor(...CLR.border);
            doc.setLineWidth(0.3);
            doc.roundedRect(ml, y, cW, 16, 2, 2, 'FD');

            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...CLR.text);
            doc.text('Métodos de Pago', ml + 6, y + 6);

            // Stacked bar
            const sBarX = ml + 50;
            const sBarW = cW - 120;
            doc.setFillColor(...CLR.emerald);
            doc.roundedRect(sBarX, y + 3, sBarW, 5, 1.5, 1.5, 'F');
            if (cashPct < 100) {
                doc.setFillColor(...CLR.purple);
                const cardBarW2 = Math.max(2, (sBarW * (100 - cashPct)) / 100);
                doc.roundedRect(sBarX + sBarW - cardBarW2, y + 3, cardBarW2, 5, 1.5, 1.5, 'F');
            }

            // Labels
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...CLR.muted);
            doc.text(`Efectivo: ${cashCount} (${cashPct}%) — ${formatCurrency(cashAmt)}`, ml + 6, y + 13);
            doc.text(`Tarjeta: ${cardCount} (${100 - cashPct}%) — ${formatCurrency(cardAmt)}`, pageW - mr - 6, y + 13, { align: 'right' });

            y += 22;

            // ═══ TRANSACTIONS TABLE ═══
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...CLR.text);
            doc.text(`Transacciones Recientes (${filteredSales.length})`, ml, y);
            y += 2;

            autoTable(doc, {
                startY: y,
                head: [['Folio', 'Cliente', 'Estación', 'Método', 'Total']],
                body: filteredSales.map(s => [
                    `#AST-${s.id.slice(0, 4).toUpperCase()}`,
                    s.expand?.parent?.name || 'Venta Directa',
                    s.expand?.workstation?.name || 'General',
                    s.payment_method === 'card' ? 'Tarjeta' : 'Efectivo',
                    formatCurrency(s.total_amount),
                ]),
                theme: 'grid',
                styles: { fontSize: 7.5, cellPadding: 3 },
                headStyles: { fillColor: CLR.bg, textColor: CLR.muted, fontStyle: 'bold', fontSize: 6, cellPadding: 3, lineColor: CLR.border, lineWidth: 0.2 },
                bodyStyles: { textColor: CLR.text, lineColor: [241, 245, 249], lineWidth: 0.15 },
                columnStyles: {
                    0: { fontStyle: 'bold', textColor: CLR.blue, cellWidth: 22 },
                    4: { halign: 'right', fontStyle: 'bold', cellWidth: 24 },
                },
                margin: { left: ml, right: mr },
            });
            y = (doc as any).lastAutoTable?.finalY + 8 || y + 40;

            // ═══ INVENTORY ALERTS ═══
            if (lowStockProducts.length > 0) {
                if (y > 225) { doc.addPage(); y = 20; }

                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...CLR.red);
                doc.text(`Alertas de Inventario (${lowStockProducts.length})`, ml, y);
                y += 2;

                autoTable(doc, {
                    startY: y,
                    head: [['Producto', 'Categoría', 'Stock', 'Mínimo', 'Precio']],
                    body: lowStockProducts.map(p => [
                        p.name, p.category || '-', String(p.stock ?? 0), String(p.min_stock ?? 0), formatCurrency(p.price),
                    ]),
                    theme: 'grid',
                    styles: { fontSize: 7.5, cellPadding: 3 },
                    headStyles: { fillColor: CLR.red, textColor: CLR.white, fontStyle: 'bold', fontSize: 7, cellPadding: 3 },
                    bodyStyles: { textColor: CLR.text, lineColor: [241, 245, 249], lineWidth: 0.15 },
                    columnStyles: {
                        2: { halign: 'center', fontStyle: 'bold', textColor: CLR.red },
                        3: { halign: 'center' },
                        4: { halign: 'right' },
                    },
                    margin: { left: ml, right: mr },
                });
            }

            // ═══ FOOTER ═══
            const totalPages = doc.getNumberOfPages();
            for (let pg = 1; pg <= totalPages; pg++) {
                doc.setPage(pg);
                doc.setFillColor(...CLR.bg);
                doc.rect(0, pageH - 10, pageW, 10, 'F');
                doc.setDrawColor(...CLR.border);
                doc.setLineWidth(0.3);
                doc.line(ml, pageH - 10, pageW - mr, pageH - 10);
                doc.setFontSize(6.5);
                doc.setTextColor(...CLR.muted);
                doc.setFont('helvetica', 'normal');
                doc.text('AstroPlay OS — Documento Generado Automáticamente  |  Confidencial', ml, pageH - 4);
                doc.text(`Página ${pg} de ${totalPages}`, pageW - mr, pageH - 4, { align: 'right' });
            }

            await downloadPDF(doc, `AstroPlay_Reporte_${dateLabel.replace(/\s/g, '_')}.pdf`);
        } catch (err) {
            console.error('Error al exportar PDF:', err);
            alert('Error al exportar PDF. Revisa la consola para más detalles.');
        }
    };




    // ─── Export: Excel (ExcelJS — Branded) ───
    const exportExcel = async () => {
        const wb = new ExcelJS.Workbook();
        wb.creator = 'AstroPlay OS';
        wb.created = new Date();

        // ─── Brand Colors ───
        const brandIndigo = 'FF4F46E5';
        const brandDark = 'FF0F172A';
        const brandSlateLight = 'FFF1F5F9';
        const brandWhite = 'FFFFFFFF';
        const brandRed = 'FFEF4444';
        const brandRedLight = 'FFFEE2E2';
        const brandAmber = 'FFF59E0B';

        const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: brandWhite }, size: 11, name: 'Calibri' };
        const headerFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandIndigo } };
        const darkHeaderFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandDark } };
        const altRowFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandSlateLight } };
        const thinBorder: Partial<ExcelJS.Borders> = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
        const currencyFmt = '"$"#,##0.00';

        const applyHeaderRow = (ws: ExcelJS.Worksheet, row: number, fill = headerFill) => {
            const r = ws.getRow(row);
            r.font = headerFont;
            r.fill = fill;
            r.alignment = { vertical: 'middle', horizontal: 'center' };
            r.height = 28;
        };

        const applyAltRows = (ws: ExcelJS.Worksheet, startRow: number, endRow: number) => {
            for (let i = startRow; i <= endRow; i++) {
                const r = ws.getRow(i);
                r.border = thinBorder;
                if (i % 2 === 0) r.fill = altRowFill;
                r.alignment = { vertical: 'middle' };
                r.height = 22;
            }
        };

        // ═══ SHEET 1: RESUMEN ═══
        const wsResumen = wb.addWorksheet('Resumen', { properties: { tabColor: { argb: brandIndigo } } });
        wsResumen.columns = [
            { width: 32 }, { width: 22 }, { width: 22 },
        ];

        // Title row
        wsResumen.mergeCells('A1:C1');
        const titleCell = wsResumen.getCell('A1');
        titleCell.value = 'ASTROPLAY OS — REPORTE DE VENTAS';
        titleCell.font = { bold: true, size: 16, color: { argb: brandWhite }, name: 'Calibri' };
        titleCell.fill = darkHeaderFill;
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        wsResumen.getRow(1).height = 40;

        // Metadata row
        wsResumen.mergeCells('A2:C2');
        const metaCell = wsResumen.getCell('A2');
        metaCell.value = `Periodo: ${dateLabel}  |  Generado: ${new Date().toLocaleString('es-MX')}`;
        metaCell.font = { italic: true, size: 10, color: { argb: 'FF64748B' } };
        metaCell.alignment = { horizontal: 'center', vertical: 'middle' };
        wsResumen.getRow(2).height = 24;

        // KPI Header
        wsResumen.getCell('A4').value = 'INDICADOR';
        wsResumen.getCell('B4').value = 'VALOR';
        applyHeaderRow(wsResumen, 4);

        // KPI Data
        const kpiData = [
            ['Venta Total', totalSales],
            ['Transacciones', sales.length],
            ['Ticket Promedio', averageTicket],
            ['Afluencia (niños)', totalAttendance],
            ['Producto Estrella', topProduct],
        ];
        kpiData.forEach((row, i) => {
            const r = wsResumen.getRow(5 + i);
            r.getCell(1).value = row[0] as string;
            r.getCell(1).font = { bold: true, size: 11 };
            const valCell = r.getCell(2);
            valCell.value = row[1];
            if (typeof row[1] === 'number' && (i === 0 || i === 2)) {
                valCell.numFmt = currencyFmt;
            }
            valCell.font = { bold: true, size: 11 };
            valCell.alignment = { horizontal: 'right' };
        });
        applyAltRows(wsResumen, 5, 9);

        // Spacer
        // Category Header
        wsResumen.getCell('A11').value = 'CATEGORÍA';
        wsResumen.getCell('B11').value = 'MONTO';
        wsResumen.getCell('C11').value = 'PORCENTAJE';
        applyHeaderRow(wsResumen, 11, darkHeaderFill);

        const catData = [
            ['Servicios (Tiempo)', categoryData.services, categoryData.servicesPct],
            ['Snacks y Bebidas', categoryData.snacks, categoryData.snacksPct],
            ['Calcetas (Insumos)', categoryData.socks, categoryData.socksPct],
        ];
        catData.forEach((row, i) => {
            const r = wsResumen.getRow(12 + i);
            r.getCell(1).value = row[0] as string;
            r.getCell(1).font = { bold: true, size: 10 };
            r.getCell(2).value = row[1];
            r.getCell(2).numFmt = currencyFmt;
            r.getCell(2).alignment = { horizontal: 'right' };
            r.getCell(3).value = `${Math.round(row[2] as number)}%`;
            r.getCell(3).alignment = { horizontal: 'right' };
        });
        applyAltRows(wsResumen, 12, 14);

        // Totals row
        const totalRow = wsResumen.getRow(15);
        totalRow.getCell(1).value = 'TOTAL';
        totalRow.getCell(1).font = { bold: true, size: 11 };
        totalRow.getCell(2).value = categoryData.total;
        totalRow.getCell(2).numFmt = currencyFmt;
        totalRow.getCell(2).font = { bold: true, size: 11 };
        totalRow.getCell(2).alignment = { horizontal: 'right' };
        totalRow.getCell(3).value = '100%';
        totalRow.getCell(3).font = { bold: true, size: 11 };
        totalRow.getCell(3).alignment = { horizontal: 'right' };
        totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };

        // ═══ SHEET 2: TRANSACCIONES ═══
        const wsTx = wb.addWorksheet('Transacciones', { properties: { tabColor: { argb: 'FF3B82F6' } } });
        wsTx.columns = [
            { header: 'Folio', width: 16 },
            { header: 'Fecha', width: 24 },
            { header: 'Cliente', width: 28 },
            { header: 'Estación', width: 22 },
            { header: 'Método', width: 16 },
            { header: 'Total', width: 16 },
        ];
        applyHeaderRow(wsTx, 1);

        filteredSales.forEach((s, i) => {
            const r = wsTx.addRow([
                `#AST-${s.id.slice(0, 4).toUpperCase()}`,
                s.created ? new Date(s.created).toLocaleString('es-MX') : '-',
                s.expand?.parent?.name || 'Venta Directa',
                s.expand?.workstation?.name || '-',
                s.payment_method === 'card' ? 'Tarjeta' : 'Efectivo',
                s.total_amount,
            ]);
            r.getCell(1).font = { bold: true, color: { argb: brandIndigo } };
            r.getCell(6).numFmt = currencyFmt;
            r.getCell(6).font = { bold: true };
            r.getCell(6).alignment = { horizontal: 'right' };
        });
        applyAltRows(wsTx, 2, filteredSales.length + 1);

        // ═══ SHEET 3: POR ESTACIÓN ═══
        const wsStation = wb.addWorksheet('Por Estación', { properties: { tabColor: { argb: 'FF10B981' } } });
        wsStation.columns = [
            { header: 'Estación', width: 26 },
            { header: 'Nº Ventas', width: 14 },
            { header: 'Efectivo', width: 18 },
            { header: 'Tarjeta', width: 18 },
            { header: 'Total', width: 18 },
        ];
        applyHeaderRow(wsStation, 1, darkHeaderFill);

        workstationBreakdown.forEach(w => {
            const r = wsStation.addRow([w.name, w.count, w.cash, w.card, w.total]);
            r.getCell(1).font = { bold: true };
            r.getCell(2).alignment = { horizontal: 'center' };
            [3, 4, 5].forEach(c => {
                r.getCell(c).numFmt = currencyFmt;
                r.getCell(c).alignment = { horizontal: 'right' };
            });
            r.getCell(5).font = { bold: true };
        });
        applyAltRows(wsStation, 2, workstationBreakdown.length + 1);

        // ═══ SHEET 4: ALERTAS INVENTARIO ═══
        if (lowStockProducts.length > 0) {
            const wsInv = wb.addWorksheet('Alertas Inventario', { properties: { tabColor: { argb: brandRed } } });
            wsInv.columns = [
                { header: 'Producto', width: 30 },
                { header: 'Categoría', width: 16 },
                { header: 'Stock Actual', width: 16 },
                { header: 'Stock Mínimo', width: 16 },
                { header: 'Precio', width: 14 },
            ];
            // Red header
            const invHeaderRow = wsInv.getRow(1);
            invHeaderRow.font = { bold: true, color: { argb: brandWhite }, size: 11 };
            invHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandRed } };
            invHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };
            invHeaderRow.height = 28;

            lowStockProducts.forEach(p => {
                const r = wsInv.addRow([
                    p.name,
                    p.category || '-',
                    p.stock ?? 0,
                    p.min_stock ?? 0,
                    p.price,
                ]);
                r.getCell(1).font = { bold: true };
                r.getCell(3).alignment = { horizontal: 'center' };
                r.getCell(3).font = { bold: true, color: { argb: brandRed } };
                r.getCell(4).alignment = { horizontal: 'center' };
                r.getCell(5).numFmt = currencyFmt;
                r.getCell(5).alignment = { horizontal: 'right' };
                // Light red fill for critical rows
                if ((p.stock ?? 0) === 0) {
                    r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: brandRedLight } };
                }
            });
            applyAltRows(wsInv, 2, lowStockProducts.length + 1);
        }

        await downloadExcelJS(wb, `AstroPlay_Reporte_${dateLabel.replace(/\s/g, '_')}.xlsx`);
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
                            onChange={(e) => {
                                setDateRange(e.target.value);
                                if (e.target.value !== 'Custom Range') {
                                    setCustomStart('');
                                    setCustomEnd('');
                                }
                            }}
                            className="bg-transparent border-none focus:ring-0 text-sm font-medium cursor-pointer py-0 text-slate-800 dark:text-slate-200 outline-none"
                        >
                            <option value="Today">Hoy</option>
                            <option value="Yesterday">Ayer</option>
                            <option value="Last 7 Days">Últimos 7 Días</option>
                            <option value="Current Month">Mes Actual</option>
                            <option value="Custom Range">Personalizado</option>
                        </select>
                    </div>

                    {/* Station Filter */}
                    <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 shadow-sm">
                        <Filter className="text-slate-400 mr-2 w-5 h-5 shrink-0" />
                        <select
                            value={station}
                            onChange={(e) => { setStation(e.target.value); setCurrentPage(1); }}
                            className="bg-transparent border-none focus:ring-0 text-sm font-medium cursor-pointer py-0 text-slate-800 dark:text-slate-200 outline-none"
                        >
                            <option value="All Stations">Todas</option>
                            {workstations.map(ws => (
                                <option key={ws.id} value={ws.name}>{ws.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={exportPDF} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shadow-md shadow-blue-600/20 active:scale-95">
                            <FileText className="w-5 h-5 shrink-0" />
                            <span>Exportar PDF</span>
                        </button>
                        <button onClick={exportExcel} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shadow-md shadow-green-600/20 active:scale-95 hidden sm:flex">
                            <Table2 className="w-5 h-5 shrink-0" />
                            <span>Exportar Excel</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Custom Date Range Picker */}
            {dateRange === 'Custom Range' && (
                <div className="mb-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm">
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="flex-1 min-w-[180px]">
                            <DatePicker
                                label="Fecha Inicio"
                                value={customStart}
                                onChange={setCustomStart}
                                maxDate={customEnd || new Date().toISOString().split('T')[0]}
                                placeholder="Seleccionar inicio"
                            />
                        </div>
                        <div className="flex-1 min-w-[180px]">
                            <DatePicker
                                label="Fecha Fin"
                                value={customEnd}
                                onChange={setCustomEnd}
                                minDate={customStart}
                                maxDate={new Date().toISOString().split('T')[0]}
                                placeholder="Seleccionar fin"
                            />
                        </div>
                        <button
                            onClick={() => {
                                if (customStart && customEnd) {
                                    setCustomApplied(true);
                                }
                            }}
                            disabled={!customStart || !customEnd}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shadow-md shadow-blue-600/20 active:scale-95 disabled:shadow-none disabled:cursor-not-allowed h-11"
                        >
                            <Search className="w-4 h-4" />
                            Aplicar
                        </button>
                    </div>
                </div>
            )}

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
                    </div>

                    <div className="flex-1 flex flex-col justify-center gap-5 py-2">
                        {workstationBreakdown.length > 0 ? (() => {
                            const maxVal = Math.max(...workstationBreakdown.map(w => w.total));
                            return workstationBreakdown.map(w => (
                                <div key={w.name} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{w.name}</span>
                                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{formatCurrency(w.total)}</span>
                                    </div>
                                    <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-700 ease-out shadow-sm"
                                            style={{ width: `${maxVal > 0 ? Math.max(4, (w.total / maxVal) * 100) : 0}%` }}
                                        />
                                    </div>
                                    <div className="flex gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                                        <span>{w.count} ventas</span>
                                        <span>Efectivo: {formatCurrency(w.cash)}</span>
                                        <span>Tarjeta: {formatCurrency(w.card)}</span>
                                    </div>
                                </div>
                            ));
                        })() : (
                            <div className="flex items-center justify-center text-sm text-slate-400 italic h-40">
                                Sin datos de estaciones para este periodo.
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Payment Method Split */}
            <section className="mb-8">
                <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                    <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-6">Distribución por Método de Pago</h4>
                    {(() => {
                        const cashAmt = sales.filter(s => s.payment_method !== 'card').reduce((a, s) => a + (s.total_amount || 0), 0);
                        const cardAmt = sales.filter(s => s.payment_method === 'card').reduce((a, s) => a + (s.total_amount || 0), 0);
                        const total = cashAmt + cardAmt;
                        const cashPct = total > 0 ? (cashAmt / total) * 100 : 50;
                        const cardPct = total > 0 ? (cardAmt / total) * 100 : 50;
                        const cashCount = sales.filter(s => s.payment_method !== 'card').length;
                        const cardCount = sales.filter(s => s.payment_method === 'card').length;

                        return (
                            <div className="space-y-6">
                                {/* Stacked Bar */}
                                <div className="w-full h-6 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800 shadow-inner">
                                    <div
                                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-700 ease-out flex items-center justify-center"
                                        style={{ width: `${cashPct}%` }}
                                    >
                                        {cashPct > 15 && <span className="text-[10px] font-bold text-white drop-shadow">{Math.round(cashPct)}%</span>}
                                    </div>
                                    <div
                                        className="h-full bg-gradient-to-r from-violet-400 to-violet-500 transition-all duration-700 ease-out flex items-center justify-center"
                                        style={{ width: `${cardPct}%` }}
                                    >
                                        {cardPct > 15 && <span className="text-[10px] font-bold text-white drop-shadow">{Math.round(cardPct)}%</span>}
                                    </div>
                                </div>

                                {/* Stats Row */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/10 rounded-xl p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Banknote className="w-5 h-5 text-emerald-500" />
                                            <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Efectivo</span>
                                        </div>
                                        <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{formatCurrency(cashAmt)}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{cashCount} transacciones · {Math.round(cashPct)}%</p>
                                    </div>
                                    <div className="bg-violet-50 dark:bg-violet-500/5 border border-violet-200 dark:border-violet-500/10 rounded-xl p-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <CreditCard className="w-5 h-5 text-violet-500" />
                                            <span className="text-sm font-semibold text-violet-700 dark:text-violet-400">Tarjeta</span>
                                        </div>
                                        <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{formatCurrency(cardAmt)}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{cardCount} transacciones · {Math.round(cardPct)}%</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
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
                                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all dark:text-white"
                                placeholder="Buscar folio, cliente..."
                                type="text"
                            />
                        </div>
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
                            {(() => {
                                const totalPages = Math.ceil(filteredSales.length / ROWS_PER_PAGE);
                                const safePage = Math.min(currentPage, totalPages || 1);
                                const start = (safePage - 1) * ROWS_PER_PAGE;
                                const paginatedSales = filteredSales.slice(start, start + ROWS_PER_PAGE);
                                return paginatedSales.map((sale) => (
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
                                ));
                            })()}
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
                {(() => {
                    const totalPages = Math.ceil(filteredSales.length / ROWS_PER_PAGE);
                    if (totalPages <= 1) {
                        return (
                            <div className="p-4 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-transparent">
                                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Mostrando {filteredSales.length} transacciones</span>
                            </div>
                        );
                    }
                    const safePage = Math.min(currentPage, totalPages);
                    const start = (safePage - 1) * ROWS_PER_PAGE + 1;
                    const end = Math.min(safePage * ROWS_PER_PAGE, filteredSales.length);

                    // Build page numbers to show
                    const pages: (number | '...')[] = [];
                    if (totalPages <= 5) {
                        for (let p = 1; p <= totalPages; p++) pages.push(p);
                    } else {
                        pages.push(1);
                        if (safePage > 3) pages.push('...');
                        for (let p = Math.max(2, safePage - 1); p <= Math.min(totalPages - 1, safePage + 1); p++) pages.push(p);
                        if (safePage < totalPages - 2) pages.push('...');
                        pages.push(totalPages);
                    }

                    return (
                        <div className="p-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-transparent">
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                {start}–{end} de {filteredSales.length} transacciones
                            </span>
                            <div className="flex gap-1.5">
                                <button
                                    onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
                                    disabled={safePage <= 1}
                                    className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-slate-400 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                {pages.map((p, i) =>
                                    p === '...' ? (
                                        <span key={`dots-${i}`} className="flex items-center justify-center w-8 h-8 text-slate-400 text-xs">...</span>
                                    ) : (
                                        <button
                                            key={p}
                                            onClick={() => setCurrentPage(p)}
                                            className={p === safePage
                                                ? 'w-8 h-8 flex items-center justify-center bg-blue-600 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-500/20'
                                                : 'w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold shadow-sm transition-all'
                                            }
                                        >
                                            {p}
                                        </button>
                                    )
                                )}
                                <button
                                    onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
                                    disabled={safePage >= totalPages}
                                    className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-slate-400 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    );
                })()}
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

            {/* ═══ WORKSTATION BREAKDOWN ═══ */}
            {workstationBreakdown.length > 0 && (
                <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden mb-8">
                    <div className="p-5 border-b border-slate-100 dark:border-white/5">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Sliders className="w-4 h-4 text-blue-500" /> Desglose por Estación
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/50">
                                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Estación</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Ventas</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Efectivo</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Tarjeta</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {workstationBreakdown.map(w => (
                                    <tr key={w.name} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                                        <td className="px-6 py-4 text-sm font-bold text-slate-800 dark:text-slate-200">{w.name}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 text-right">{w.count}</td>
                                        <td className="px-6 py-4 text-sm text-emerald-600 dark:text-emerald-400 font-semibold text-right">{formatCurrency(w.cash)}</td>
                                        <td className="px-6 py-4 text-sm text-purple-600 dark:text-purple-400 font-semibold text-right">{formatCurrency(w.card)}</td>
                                        <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white text-right">{formatCurrency(w.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* ═══ INVENTORY ALERTS ═══ */}
            {lowStockProducts.length > 0 && (
                <section className="bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-500/20 shadow-sm overflow-hidden mb-8">
                    <div className="p-5 border-b border-red-100 dark:border-red-500/10 bg-red-50/50 dark:bg-red-500/5">
                        <h3 className="text-base font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5" /> Alertas de Inventario
                            <span className="ml-2 text-xs font-black bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-300 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-500/30">{lowStockProducts.length}</span>
                        </h3>
                        <p className="text-xs text-red-500/70 dark:text-red-400/60 mt-1">Productos con stock igual o menor al mínimo configurado</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-red-50/30 dark:bg-red-500/5">
                                    <th className="px-6 py-3 text-[10px] font-bold text-red-500/70 dark:text-red-400/60 uppercase tracking-wider">Producto</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-red-500/70 dark:text-red-400/60 uppercase tracking-wider">Categoría</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-red-500/70 dark:text-red-400/60 uppercase tracking-wider text-center">Stock</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-red-500/70 dark:text-red-400/60 uppercase tracking-wider text-center">Mínimo</th>
                                    <th className="px-6 py-3 text-[10px] font-bold text-red-500/70 dark:text-red-400/60 uppercase tracking-wider text-right">Precio</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-red-100 dark:divide-red-500/10">
                                {lowStockProducts.map(p => (
                                    <tr key={p.id} className="hover:bg-red-50/50 dark:hover:bg-red-500/5 transition-colors">
                                        <td className="px-6 py-3.5">
                                            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{p.name}</span>
                                        </td>
                                        <td className="px-6 py-3.5">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${p.category === 'snack' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                                                : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'
                                                }`}>{p.category || 'otro'}</span>
                                        </td>
                                        <td className="px-6 py-3.5 text-center">
                                            <span className={`text-sm font-black ${(p.stock || 0) === 0 ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'
                                                }`}>{p.stock ?? 0}</span>
                                        </td>
                                        <td className="px-6 py-3.5 text-center text-sm text-slate-500 dark:text-slate-400">{p.min_stock ?? '-'}</td>
                                        <td className="px-6 py-3.5 text-right text-sm font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(p.price)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
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
