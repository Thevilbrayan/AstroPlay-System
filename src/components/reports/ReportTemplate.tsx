import React from 'react';

/**
 * Props for the hidden report template.
 * This component renders a print-ready layout that html2canvas captures.
 */
interface ReportTemplateProps {
    dateLabel: string;
    station: string;
    totalSales: number;
    salesCount: number;
    averageTicket: number;
    totalAttendance: number;
    topProduct: string;
    categoryData: {
        services: number;
        snacks: number;
        socks: number;
        total: number;
        servicesPct: number;
        snacksPct: number;
        socksPct: number;
    };
    workstationBreakdown: { name: string; total: number; count: number; cash: number; card: number }[];
    transactions: {
        id: string;
        parentName: string;
        workstationName: string;
        paymentMethod: string;
        total: number;
        date: string;
    }[];
    lowStockProducts: { name: string; category: string; stock: number; minStock: number; price: number }[];
}

const formatMXN = (val: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

const ReportTemplate = React.forwardRef<HTMLDivElement, ReportTemplateProps>((props, ref) => {
    const {
        dateLabel, station, totalSales, salesCount, averageTicket, totalAttendance,
        topProduct, categoryData, workstationBreakdown, transactions, lowStockProducts,
    } = props;

    const now = new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });

    return (
        <div
            ref={ref}
            style={{
                width: '794px', // A4 at 96 DPI
                fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
                background: '#fff',
                color: '#0f172a',
                fontSize: '11px',
                lineHeight: '1.5',
            }}
        >
            {/* ═══ HEADER BANNER ═══ */}
            <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                padding: '28px 32px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '3px solid #4f46e5',
            }}>
                <div>
                    <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px' }}>
                        <span style={{ color: '#fff' }}>ASTROPLAY </span>
                        <span style={{ color: '#818cf8' }}>OS</span>
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '4px' }}>
                        Reporte de Ventas y Operaciones
                    </div>
                </div>
                <div style={{ textAlign: 'right', color: '#94a3b8', fontSize: '10px', lineHeight: '1.8' }}>
                    <div style={{ color: '#e2e8f0', fontWeight: 700 }}>Periodo: {dateLabel}</div>
                    <div>Generado: {now}</div>
                    <div>Estación: {station}</div>
                </div>
            </div>

            <div style={{ padding: '24px 32px' }}>
                {/* ═══ KPI CARDS ═══ */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                    {/* Total Sales */}
                    <div style={{
                        flex: 1, background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                        borderRadius: '12px', padding: '16px 20px', color: '#fff',
                    }}>
                        <div style={{ fontSize: '10px', opacity: 0.8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Venta Total</div>
                        <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '4px' }}>{formatMXN(totalSales)}</div>
                    </div>
                    {/* Transactions */}
                    <div style={{
                        flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0',
                        borderRadius: '12px', padding: '16px 20px',
                    }}>
                        <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Transacciones</div>
                        <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '4px' }}>{salesCount}</div>
                    </div>
                    {/* Average Ticket */}
                    <div style={{
                        flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0',
                        borderRadius: '12px', padding: '16px 20px',
                    }}>
                        <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Ticket Promedio</div>
                        <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '4px' }}>{formatMXN(averageTicket)}</div>
                    </div>
                    {/* Attendance */}
                    <div style={{
                        flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0',
                        borderRadius: '12px', padding: '16px 20px',
                    }}>
                        <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Afluencia</div>
                        <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '4px' }}>{totalAttendance} <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 400 }}>niños</span></div>
                    </div>
                </div>

                {/* ═══ CATEGORIES + TOP PRODUCT ═══ */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                    {/* Categories */}
                    <div style={{ flex: 2, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px' }}>
                        <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '12px', color: '#0f172a' }}>Ventas por Categoría</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#0f172a', color: '#fff' }}>
                                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 700, borderRadius: '6px 0 0 0' }}>Categoría</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '10px', fontWeight: 700 }}>Monto</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '10px', fontWeight: 700, borderRadius: '0 6px 0 0' }}>%</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { name: 'Servicios (Tiempo)', amount: categoryData.services, pct: categoryData.servicesPct, color: '#4f46e5' },
                                    { name: 'Snacks y Bebidas', amount: categoryData.snacks, pct: categoryData.snacksPct, color: '#10b981' },
                                    { name: 'Calcetas (Insumos)', amount: categoryData.socks, pct: categoryData.socksPct, color: '#f59e0b' },
                                ].map((cat, i) => (
                                    <tr key={cat.name} style={{ background: i % 2 === 0 ? '#fff' : '#f1f5f9' }}>
                                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                                            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: cat.color, marginRight: '8px' }} />
                                            {cat.name}
                                        </td>
                                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>{formatMXN(cat.amount)}</td>
                                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>{Math.round(cat.pct)}%</td>
                                    </tr>
                                ))}
                                <tr style={{ background: '#e0e7ff', fontWeight: 700 }}>
                                    <td style={{ padding: '8px 12px' }}>TOTAL</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{formatMXN(categoryData.total)}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>100%</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    {/* Top Product */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{
                            flex: 1, background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
                            borderRadius: '12px', padding: '16px 20px', color: '#fff',
                        }}>
                            <div style={{ fontSize: '10px', opacity: 0.9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>⭐ Producto Estrella</div>
                            <div style={{ fontSize: '16px', fontWeight: 800, marginTop: '8px' }}>{topProduct}</div>
                        </div>
                        {/* Donut mini */}
                        <div style={{
                            flex: 1, background: '#fff', border: '1px solid #e2e8f0',
                            borderRadius: '12px', padding: '16px 20px', textAlign: 'center',
                        }}>
                            <svg width="80" height="80" viewBox="0 0 80 80" style={{ margin: '0 auto' }}>
                                <circle cx="40" cy="40" r="30" fill="none" stroke="#e2e8f0" strokeWidth="12" />
                                <circle cx="40" cy="40" r="30" fill="none" stroke="#4f46e5" strokeWidth="12"
                                    strokeDasharray={`${categoryData.servicesPct * 1.885} ${188.5 - categoryData.servicesPct * 1.885}`}
                                    strokeDashoffset="47.1" />
                                <circle cx="40" cy="40" r="30" fill="none" stroke="#10b981" strokeWidth="12"
                                    strokeDasharray={`${categoryData.snacksPct * 1.885} ${188.5 - categoryData.snacksPct * 1.885}`}
                                    strokeDashoffset={`${47.1 - categoryData.servicesPct * 1.885}`} />
                                <circle cx="40" cy="40" r="30" fill="none" stroke="#f59e0b" strokeWidth="12"
                                    strokeDasharray={`${categoryData.socksPct * 1.885} ${188.5 - categoryData.socksPct * 1.885}`}
                                    strokeDashoffset={`${47.1 - (categoryData.servicesPct + categoryData.snacksPct) * 1.885}`} />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* ═══ WORKSTATION BREAKDOWN ═══ */}
                {workstationBreakdown.length > 0 && (
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>Rendimiento por Estación</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#0f172a', color: '#fff' }}>
                                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 700, borderRadius: '6px 0 0 0' }}>Estación</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '10px', fontWeight: 700 }}>Ventas</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '10px', fontWeight: 700 }}>Efectivo</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '10px', fontWeight: 700 }}>Tarjeta</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '10px', fontWeight: 700, borderRadius: '0 6px 0 0' }}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {workstationBreakdown.map((w, i) => (
                                    <tr key={w.name} style={{ background: i % 2 === 0 ? '#fff' : '#f1f5f9' }}>
                                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>{w.name}</td>
                                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>{w.count}</td>
                                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#10b981', fontWeight: 600 }}>{formatMXN(w.cash)}</td>
                                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#7c3aed', fontWeight: 600 }}>{formatMXN(w.card)}</td>
                                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800 }}>{formatMXN(w.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ═══ TRANSACTIONS ═══ */}
                <div style={{ marginBottom: '24px' }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>
                        Detalle de Transacciones ({transactions.length})
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#4f46e5', color: '#fff' }}>
                                <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: '9px', fontWeight: 700, borderRadius: '6px 0 0 0' }}>Folio</th>
                                <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: '9px', fontWeight: 700 }}>Fecha</th>
                                <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: '9px', fontWeight: 700 }}>Cliente</th>
                                <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: '9px', fontWeight: 700 }}>Estación</th>
                                <th style={{ padding: '7px 10px', textAlign: 'center', fontSize: '9px', fontWeight: 700 }}>Método</th>
                                <th style={{ padding: '7px 10px', textAlign: 'right', fontSize: '9px', fontWeight: 700, borderRadius: '0 6px 0 0' }}>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map((tx, i) => (
                                <tr key={tx.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '6px 10px', fontWeight: 700, color: '#4f46e5', fontSize: '10px' }}>
                                        #AST-{tx.id.slice(0, 4).toUpperCase()}
                                    </td>
                                    <td style={{ padding: '6px 10px', fontSize: '10px', color: '#64748b' }}>{tx.date}</td>
                                    <td style={{ padding: '6px 10px', fontSize: '10px', fontWeight: 600 }}>{tx.parentName}</td>
                                    <td style={{ padding: '6px 10px', fontSize: '10px', color: '#64748b' }}>{tx.workstationName}</td>
                                    <td style={{ padding: '6px 10px', fontSize: '10px', textAlign: 'center' }}>
                                        <span style={{
                                            background: tx.paymentMethod === 'card' ? '#ede9fe' : '#ecfdf5',
                                            color: tx.paymentMethod === 'card' ? '#7c3aed' : '#059669',
                                            padding: '2px 8px', borderRadius: '9999px', fontWeight: 700, fontSize: '9px',
                                        }}>
                                            {tx.paymentMethod === 'card' ? '💳 Tarjeta' : '💵 Efectivo'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, fontSize: '10px' }}>{formatMXN(tx.total)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* ═══ INVENTORY ALERTS ═══ */}
                {lowStockProducts.length > 0 && (
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '8px', color: '#ef4444' }}>
                            ⚠ Alertas de Inventario ({lowStockProducts.length})
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#ef4444', color: '#fff' }}>
                                    <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: '9px', fontWeight: 700, borderRadius: '6px 0 0 0' }}>Producto</th>
                                    <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: '9px', fontWeight: 700 }}>Categoría</th>
                                    <th style={{ padding: '7px 10px', textAlign: 'center', fontSize: '9px', fontWeight: 700 }}>Stock</th>
                                    <th style={{ padding: '7px 10px', textAlign: 'center', fontSize: '9px', fontWeight: 700 }}>Mínimo</th>
                                    <th style={{ padding: '7px 10px', textAlign: 'right', fontSize: '9px', fontWeight: 700, borderRadius: '0 6px 0 0' }}>Precio</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lowStockProducts.map((p, i) => (
                                    <tr key={p.name + i} style={{ background: p.stock === 0 ? '#fef2f2' : (i % 2 === 0 ? '#fff' : '#fef2f2') }}>
                                        <td style={{ padding: '6px 10px', fontWeight: 700, fontSize: '10px' }}>{p.name}</td>
                                        <td style={{ padding: '6px 10px', fontSize: '10px', color: '#64748b' }}>{p.category}</td>
                                        <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 800, color: p.stock === 0 ? '#ef4444' : '#f59e0b', fontSize: '10px' }}>{p.stock}</td>
                                        <td style={{ padding: '6px 10px', textAlign: 'center', fontSize: '10px', color: '#64748b' }}>{p.minStock}</td>
                                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, fontSize: '10px' }}>{formatMXN(p.price)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ═══ FOOTER ═══ */}
            <div style={{
                background: '#f1f5f9', padding: '10px 32px',
                display: 'flex', justifyContent: 'space-between',
                fontSize: '8px', color: '#94a3b8', borderTop: '1px solid #e2e8f0',
            }}>
                <span>AstroPlay OS — Documento Generado Automáticamente | Confidencial</span>
                <span>astroplay.com.mx</span>
            </div>
        </div>
    );
});

ReportTemplate.displayName = 'ReportTemplate';
export default ReportTemplate;
