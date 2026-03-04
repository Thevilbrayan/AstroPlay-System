import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    Loader2, ArrowLeft, Printer, CheckCircle2, AlertTriangle,
    Info, PenTool, Lock, X, Plus, Minus
} from 'lucide-react';
import { pb } from '../../lib/pocketbase';
import { Sale } from '../../types';
import { useAuthStore } from '../../store/auth.store';
import { useWorkstationStore } from '../../store/workstation.store';
import { useCashSessionStore } from '../../store/cashSession.store';
import { closeCashSession } from '../../lib/cashSession';
import { useSettingsStore } from '../../store/settings.store';
import ModalAlert, { AlertType } from '../ui/ModalAlert';

// ─── Denomination config ───
const DENOMINATIONS = [
    { value: 500, label: '$500' },
    { value: 200, label: '$200' },
    { value: 100, label: '$100' },
    { value: 50, label: '$50' },
    { value: 20, label: '$20' },
    { value: 10, label: '$10' },
];

// ─── Signature Canvas ───
const SignatureCanvas: React.FC<{
    onSign: (dataUrl: string) => void;
    onClear: () => void;
    value?: string;
}> = ({ onSign, onClear, value }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);

    const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        isDrawing.current = true;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = ('touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left) * scaleX;
        const y = ('touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top) * scaleY;
        ctx.beginPath();
        ctx.moveTo(x, y);
    }, []);

    const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing.current) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = ('touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left) * scaleX;
        const y = ('touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top) * scaleY;
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineTo(x, y);
        ctx.stroke();
    }, []);

    const endDraw = useCallback(() => {
        isDrawing.current = false;
        const canvas = canvasRef.current;
        if (canvas) onSign(canvas.toDataURL());
    }, [onSign]);

    const clearCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
        onClear();
    }, [onClear]);

    return (
        <div className="relative w-full h-32 bg-slate-50 dark:bg-slate-800 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30 select-none z-0">
                <PenTool className="w-8 h-8 text-slate-400" />
            </div>
            <canvas
                ref={canvasRef}
                width={400}
                height={128}
                style={{ touchAction: 'none' }}
                className="w-full h-full cursor-crosshair relative z-10 bg-transparent"
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={endDraw}
            />
            {value && (
                <div className="absolute bottom-2 right-2 flex items-center gap-2 z-20">
                    <span className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[10px] px-2 py-1 rounded-full font-bold flex items-center gap-1 shadow-sm">
                        <CheckCircle2 className="w-3 h-3" /> Firmado
                    </span>
                    <button
                        onClick={clearCanvas}
                        className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm text-red-500 hover:text-red-700 text-[10px] px-2 py-1 rounded-full font-bold border border-red-200 dark:border-red-900 shadow-sm transition-all flex items-center gap-1"
                    >
                        <PenTool className="w-3 h-3" /> Borrar
                    </button>
                </div>
            )}
        </div>
    );

};

// ─── Main Component ───
const CashCloseView: React.FC = () => {
    const { user, logout } = useAuthStore();
    const isAdmin = user?.role === 'admin';
    const { workstationId, workstationName } = useWorkstationStore();
    const { activeSession, loadSession, clearSession: clearCashSession } = useCashSessionStore();
    const { settings } = useSettingsStore();
    const requireSignature = settings?.require_signature ?? true;

    // Data states
    const [denominations, setDenominations] = useState<Record<number, string>>({});
    const [coinTotal, setCoinTotal] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [sales, setSales] = useState<Sale[]>([]);
    const [signature, setSignature] = useState<string>('');
    const [justification, setJustification] = useState('');
    const [isClosing, setIsClosing] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    // Alert state
    const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; type: AlertType; title: string; message: string }>({
        isOpen: false, type: 'info', title: '', message: ''
    });

    // Formatting
    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

    // Load active session — prefer the session's own operator over the current user
    // so an admin can close an operator's session without losing context
    useEffect(() => {
        const operatorId = activeSession?.operator || user?.id;
        if (operatorId && workstationId) {
            loadSession(operatorId, workstationId);
        }
    }, [user?.id, workstationId]);

    // Load today's sales — re-runs whenever the active session changes
    useEffect(() => {
        const loadData = async () => {
            if (!activeSession?.id) {
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            try {
                const filter = `cash_session = "${activeSession.id}"`;
                const fetchedSales = await pb.collection('sales').getFullList<Sale>({ filter, sort: '-created' });
                setSales(fetchedSales);
            } catch (err) {
                console.error('Error loading cash close data:', err);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [activeSession?.id]);

    // ─── Computed ───
    const financials = useMemo(() => {
        const totalGross = sales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
        const totalCard = sales.filter(s => s.payment_method === 'card').reduce((sum, s) => sum + (s.total_amount || 0), 0);
        const totalCash = totalGross - totalCard;
        const openingBalance = activeSession?.opening_balance || 0;
        const expectedCashTotal = openingBalance + totalCash;

        // Calculate handover expectation based on logic: we expect them to leave the base amount
        const baseAmount = openingBalance > 0 ? openingBalance : 1000;
        // The expected amount they should physically HAND OVER to the admin is:
        const expectedHandoverCash = Math.max(0, expectedCashTotal - baseAmount);

        return { totalGross, totalCard, totalCash, openingBalance, expectedCashTotal, expectedHandoverCash, baseAmount };
    }, [sales, activeSession]);

    // Counted total from denomination inputs
    const totalCounted = useMemo(() => {
        const billsTotal = DENOMINATIONS.reduce((sum, d) => {
            const qty = parseInt(denominations[d.value] || '0') || 0;
            return sum + (d.value * qty);
        }, 0);
        const coins = parseFloat(coinTotal) || 0;
        return billsTotal + coins;
    }, [denominations, coinTotal]);

    const difference = totalCounted - financials.expectedCashTotal;
    const isExact = Math.abs(difference) < 0.01;
    const hasCount = true; // Allow closing with 0 count

    // Admins must justify any discrepancy (they see the expected total).
    // Operators do a blind count — they never see the expected total, so no justification needed.
    const canFinalize = sales.length > 0 && hasCount && (!requireSignature || !!signature) &&
        (!isAdmin || isExact || justification.trim().length > 0);

    // ─── Handlers ───

    const incrementDenom = (value: number) => {
        setDenominations(prev => {
            const current = parseInt(prev[value] || '0');
            if (current >= 999) return prev; // Limit to 999 to prevent overflow
            return { ...prev, [value]: (current + 1).toString() };
        });
    };

    const decrementDenom = (value: number) => {
        setDenominations(prev => {
            const current = parseInt(prev[value] || '0');
            if (current <= 0) return prev;
            return { ...prev, [value]: (current - 1).toString() };
        });
    };

    const handleFinalize = async () => {
        if (!canFinalize || !activeSession?.id) return;
        setIsClosing(true);
        try {
            // Calculate handover values dynamically:
            // The operator leaves at most the opening balance required (e.g. baseline or what they had),
            // or just whatever is counted if it's less than the base.
            const baseAmount = financials.openingBalance || 1000;
            const cashRetained = Math.min(totalCounted, baseAmount);
            const cashWithdrawn = Math.max(0, totalCounted - cashRetained);

            await closeCashSession(
                activeSession.id,
                totalCounted,
                financials.totalCash,
                justification || undefined,
                cashRetained,
                cashWithdrawn,
                signature || undefined
            );
            clearCashSession();
            setShowConfirmModal(false);
            setShowSuccessModal(true);
        } catch (err) {
            console.error('Error closing session:', err);
            setAlertConfig({
                isOpen: true,
                type: 'error',
                title: 'Error de Sistema',
                message: 'No se pudo cerrar la sesión. Verifica tu conexión e inténtalo de nuevo.'
            });
        } finally {
            setIsClosing(false);
        }
    };

    // ─── Loading ───
    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                    <span className="text-slate-600 dark:text-slate-300 font-semibold">Cargando datos del turno...</span>
                </div>
            </div>
        );
    }

    if (!activeSession) {
        return (
            <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center">
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 shadow-xl p-10 max-w-md w-full flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-blue-50 dark:bg-blue-500/10 rounded-full flex items-center justify-center mb-6 text-blue-600 dark:text-blue-400">
                        <Lock className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3">Sesión de Caja Cerrada</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8">
                        No tienes ninguna sesión de caja abierta actualmente en esta estación. Para realizar un corte de caja, primero debes abrir una sesión en el Punto de Venta.
                    </p>
                    <button
                        onClick={() => window.history.back()}
                        className="w-full flex items-center justify-center h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        Volver
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-8 lg:px-20 max-w-[1600px] mx-auto w-full transition-all duration-300">

            {/* ═══ HEADER ═══ */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                <div className="flex flex-col gap-2">
                    <button className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors w-fit">
                        <ArrowLeft className="w-4 h-4" />
                        Volver al Dashboard
                    </button>
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                        Corte de Caja
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-base">
                        {workstationName || 'Estación'} • Operador: {user?.name || '—'} • {new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center justify-center gap-2 px-4 h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm">
                        <Printer className="w-5 h-5" />
                        <span>Imprimir Resumen</span>
                    </button>
                    <button
                        onClick={() => canFinalize && setShowConfirmModal(true)}
                        disabled={!canFinalize}
                        className={`flex items-center justify-center gap-2 px-6 h-12 rounded-xl font-bold transition-all shadow-lg ${canFinalize
                            ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none'
                            }`}
                    >
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Finalizar y Cerrar</span>
                    </button>
                </div>
            </header>

            {/* ═══ GRID LAYOUT ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                {/* ─── LEFT: Blind Count ─── */}
                <section className="lg:col-span-7 flex flex-col gap-6">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100 dark:border-slate-800 relative overflow-hidden">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                                <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 p-2.5 rounded-xl">
                                    <Lock className="w-5 h-5" />
                                </span>
                                Conteo de Efectivo
                            </h2>
                        </div>

                        {/* Denomination Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                            {DENOMINATIONS.map(d => (
                                <div
                                    key={d.value}
                                    className="relative w-full rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-col p-4 hover:border-blue-500 transition-all group overflow-hidden shadow-sm hover:shadow-md"
                                >
                                    {/* Top Info: Denomination & Subtotal */}
                                    <div className="flex items-center justify-between gap-2 w-full mb-4">
                                        <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-bold text-sm shrink-0 border border-slate-200 dark:border-slate-700">
                                            {d.label}
                                        </span>
                                        <span className="text-lg font-black text-slate-900 dark:text-white">
                                            {formatCurrency(d.value * (parseInt(denominations[d.value] || '0')))}
                                        </span>
                                    </div>

                                    {/* Bottom Controls: Minus, Cant, Plus */}
                                    <div className="flex items-center justify-between gap-2 w-full bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-xl border border-slate-100 dark:border-slate-700/50">
                                        <button
                                            onClick={() => decrementDenom(d.value)}
                                            disabled={!denominations[d.value] || parseInt(denominations[d.value]) === 0}
                                            className="w-10 h-10 rounded-lg bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 hover:text-slate-900 dark:hover:bg-slate-600 dark:hover:text-white flex items-center justify-center transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0 border border-slate-200 dark:border-slate-600"
                                        >
                                            <Minus className="w-5 h-5" />
                                        </button>

                                        <div className="flex flex-col items-center justify-center flex-1">
                                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">CANT.</span>
                                            <span className="text-xl font-black text-blue-600 dark:text-blue-400 leading-none">{denominations[d.value] || '0'}</span>
                                        </div>

                                        <button
                                            onClick={() => incrementDenom(d.value)}
                                            className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 hover:text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 dark:hover:bg-blue-500/30 flex items-center justify-center transition-colors shadow-sm shrink-0 border border-blue-200 dark:border-blue-500/20"
                                        >
                                            <Plus className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Coins total */}
                        <div className="flex items-center gap-4 mt-6">
                            <div className="w-24 h-12 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center shrink-0">
                                <span className="text-xl">🪙</span>
                            </div>
                            <div className="flex-1 relative">
                                <label className="absolute -top-2.5 left-3 bg-white dark:bg-slate-900 px-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Monedas (Total)</label>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    pattern="[0-9.]*"
                                    value={coinTotal}
                                    onChange={(e) => {
                                        const v = e.target.value.replace(/[^0-9.]/g, '');
                                        setCoinTotal(v);
                                    }}
                                    placeholder="0.00"
                                    className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-right font-mono text-lg font-medium text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* Subtotal Display */}
                        <div className="mt-10 p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 border border-slate-100 dark:border-slate-700">
                            <div className="flex flex-col">
                                <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Subtotal Efectivo</span>
                                <span className="text-xs text-slate-400 dark:text-slate-500">Calculado en tiempo real</span>
                            </div>
                            <div className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter">
                                {formatCurrency(totalCounted)}
                            </div>
                        </div>
                    </div>

                    {/* Digital Signature — only shown when require_signature is enabled */}
                    {requireSignature && (
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <PenTool className="w-5 h-5 text-slate-400" />
                            Firma del Cajero
                        </h3>
                        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900 signature-container" style={{ touchAction: 'none' }}>
                            <SignatureCanvas
                                value={signature}
                                onSign={setSignature}
                                onClear={() => setSignature('')}
                            />
                        </div>
                        {!signature && (
                            <p className="text-slate-400 dark:text-slate-500 text-xs text-center mt-2 italic">Click o toca para firmar digitalmente</p>
                        )}
                    </div>
                    )}
                </section>

                {/* ─── RIGHT: Summary & Verification ─── */}
                <section className="lg:col-span-5 flex flex-col gap-6">

                    {/* Financial Summary */}
                    < div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800" >
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Resumen del Turno</h2>
                        <div className="space-y-0">
                            {isAdmin && (
                                <>
                                    <div className="flex justify-between items-center py-3.5 border-b border-slate-100 dark:border-slate-800">
                                        <span className="text-slate-500 dark:text-slate-400 font-medium">Saldo Inicial</span>
                                        <span className="text-slate-900 dark:text-white font-bold font-mono">{formatCurrency(financials.openingBalance)}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-3.5 border-b border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                            <span className="text-slate-500 dark:text-slate-400 font-medium">Ventas en Efectivo</span>
                                        </div>
                                        <span className="text-slate-900 dark:text-white font-bold font-mono">{formatCurrency(financials.totalCash)}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-3.5 border-b border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-purple-500" />
                                            <span className="text-slate-500 dark:text-slate-400 font-medium">Ventas Tarjeta</span>
                                        </div>
                                        <span className="text-slate-900 dark:text-white font-bold font-mono">{formatCurrency(financials.totalCard)}</span>
                                    </div>
                                </>
                            )}
                            <div className="flex justify-between items-center py-3.5 border-b border-slate-100 dark:border-slate-800">
                                <span className="text-slate-500 dark:text-slate-400 font-medium">Transacciones (Ticket)</span>
                                <span className="text-slate-900 dark:text-white font-bold font-mono">{sales.length}</span>
                            </div>

                            {/* Only show expected cash break downs to admin */}
                            {!isAdmin && (
                                <div className="flex flex-col items-center justify-center pt-6 pb-2">
                                    <Lock className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
                                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center">Ingresa los montos físicos contados. El cierre será auditado por un administrador.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Discrepancy Alert (conditional) - Only for admins, operators don't see it until audit */}
                    {
                        isAdmin && hasCount && !isExact && (
                            <div className="bg-red-50 dark:bg-red-900/20 rounded-3xl p-6 shadow-sm border-2 border-red-200 dark:border-red-800 transition-all duration-500 ease-in-out animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-start gap-4 mb-4">
                                    <div className="p-3 bg-red-100 dark:bg-red-800 rounded-full text-red-600 dark:text-red-200 shrink-0">
                                        <AlertTriangle className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-red-700 dark:text-red-300">Diferencia Detectada</h3>
                                        <p className="text-red-600 dark:text-red-400 text-sm mt-1">El monto contado difiere del esperado. Se requiere justificación.</p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-red-100 dark:border-red-900 mb-5">
                                    <span className="text-slate-500 dark:text-slate-400 font-medium">Diferencia</span>
                                    <span className={`font-black font-mono text-lg ${difference > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                                        {difference > 0 ? '+' : ''}{formatCurrency(difference)}
                                    </span>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-red-700 dark:text-red-300 mb-2">
                                        Notas de Desajuste <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        value={justification}
                                        onChange={(e) => setJustification(e.target.value)}
                                        className="w-full min-h-[100px] p-3 rounded-xl border border-red-200 dark:border-red-800 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none text-slate-800 dark:text-slate-200 text-sm outline-none"
                                        placeholder="Explique la razón de la diferencia (ej. error en cambio, devolución sin ticket...)"
                                    />
                                </div>
                            </div>
                        )
                    }

                    {/* Exact match card (conditional) - Only for admins */}
                    {
                        isAdmin && hasCount && isExact && (
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-3xl p-6 shadow-sm border-2 border-emerald-200 dark:border-emerald-800 transition-all duration-500 animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-emerald-100 dark:bg-emerald-800 rounded-full text-emerald-600 dark:text-emerald-200 shrink-0">
                                        <CheckCircle2 className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-emerald-700 dark:text-emerald-300">Cuadre Exacto</h3>
                                        <p className="text-emerald-600 dark:text-emerald-400 text-sm">El conteo coincide con el saldo esperado. ¡Todo en orden!</p>
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    {/* Info Banner */}
                    <div className="bg-blue-50 dark:bg-slate-800/50 rounded-2xl p-4 flex gap-3 border border-blue-100 dark:border-slate-700 mb-6">
                        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                            Al finalizar el cierre, se guardará el registro en el sistema y se enviará notificación al supervisor.{requireSignature ? ' Asegúrese de que la firma esté completa.' : ''}
                        </p>
                    </div>

                    <button
                        onClick={() => setShowConfirmModal(true)}
                        disabled={!canFinalize}
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold h-14 rounded-2xl transition-all shadow-lg shadow-blue-600/25 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                    >
                        Revisar y Continuar
                    </button>
                </section>
            </div>

            {/* ═══ CLOSE-OUT CONFIRMATION MODAL ═══ */}
            {
                showConfirmModal && (
                    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className="relative w-full max-w-[520px] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                            {/* Close button */}
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors z-10"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            {/* Header */}
                            <div className="flex flex-col items-center pt-10 pb-2 px-8 text-center">
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 ${isExact
                                    ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                    }`}>
                                    {isExact ? (
                                        <CheckCircle2 className="w-8 h-8" />
                                    ) : (
                                        <AlertTriangle className="w-8 h-8" />
                                    )}
                                </div>
                                <h3 className="text-slate-900 dark:text-white text-2xl font-bold leading-tight mb-2">
                                    Confirmación de Turno
                                </h3>
                                <p className="text-slate-500 dark:text-slate-400 text-base">
                                    Revisa el desglose antes de finalizar el turno de caja.
                                </p>
                            </div>

                            {/* Summary Cards */}
                            <div className="px-8 py-6 w-full">
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
                                    {/* Row 1: Breakdown */}
                                    <div className="flex flex-col border-b border-slate-200 dark:border-white/5">
                                        {isAdmin && (
                                            <>
                                                <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-white/5">
                                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Fondo con el que iniciaste</p>
                                                    <p className="text-base font-bold text-slate-900 dark:text-white">{formatCurrency(financials.openingBalance)}</p>
                                                </div>
                                                <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-white/5">
                                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Ventas de este turno</p>
                                                    <p className="text-base font-bold text-slate-900 dark:text-white">{formatCurrency(financials.totalCash)}</p>
                                                </div>
                                                <div className="flex justify-between items-center p-4 bg-slate-100 dark:bg-slate-800/50">
                                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Total que debería haber</p>
                                                    <p className="text-lg font-black text-slate-900 dark:text-white">{formatCurrency(financials.expectedCashTotal)}</p>
                                                </div>
                                            </>
                                        )}
                                        {!isAdmin && (
                                            <div className="p-4 bg-slate-100 dark:bg-slate-800/50 flex flex-col items-center justify-center text-center">
                                                <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Monto Físico a Entregar Confirmado:</p>
                                                <p className="text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(totalCounted)}</p>
                                            </div>
                                        )}
                                    </div>
                                    {/* Row 2: Difference (Only admin) */}
                                    {isAdmin && (
                                        <div className={`flex items-center justify-between p-5 ${isExact ? 'bg-emerald-50/50 dark:bg-emerald-500/5' : 'bg-red-50/50 dark:bg-red-500/5'}`}>
                                            <div className="flex items-center gap-2">
                                                {isExact ? (
                                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                                ) : (
                                                    <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                                                )}
                                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Total Declarado</p>
                                            </div>
                                            <p className={`text-xl font-bold ${isExact ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                                {formatCurrency(totalCounted)}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-3 px-8 pb-10">
                                <button
                                    onClick={handleFinalize}
                                    disabled={isClosing}
                                    className="group w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 rounded-full transition-all shadow-lg shadow-blue-600/25 disabled:opacity-50 disabled:cursor-wait"
                                >
                                    {isClosing ? (
                                        <><Loader2 className="w-5 h-5 animate-spin" /> Cerrando...</>
                                    ) : (
                                        <><CheckCircle2 className="w-5 h-5" /> Confirmar y Cerrar</>
                                    )}
                                </button>
                                <button
                                    onClick={() => setShowConfirmModal(false)}
                                    className="w-full flex items-center justify-center gap-2 bg-transparent hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 font-medium h-12 rounded-full transition-colors"
                                >
                                    Corregir Conteo
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ═══ HIGH-FIDELITY SUCCESS MODAL ═══ */}
            {
                showSuccessModal && (
                    <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
                        <div className="relative w-full max-w-[480px] bg-white dark:bg-slate-900 rounded-[24px] p-8 shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col items-center text-center animate-in zoom-in-95 duration-300">

                            {/* Animated Success Icon */}
                            <div className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mb-6 animate-pulse">
                                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                            </div>

                            {/* Title */}
                            <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Cierre de Turno Exitoso</h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-8">El efectivo ha sido contabilizado y la sesión auditada.</p>

                            {/* Summary Cards */}
                            <div className="w-full flex gap-4 mb-6">
                                <div className="flex-1 bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-white/5">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Sistema Esperaba</p>
                                    <p className="text-xl font-black text-slate-700 dark:text-slate-200">{formatCurrency(financials.expectedCashTotal)}</p>
                                </div>
                                <div className="flex-1 bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-white/5">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Reportado</p>
                                    <p className="text-xl font-black text-slate-900 dark:text-white">{formatCurrency(totalCounted)}</p>
                                </div>
                            </div>

                            {/* Difference Badge */}
                            <div className="w-full mb-8">
                                <div className={`mx-auto flex items-center justify-center gap-2 px-4 py-2 rounded-full w-fit ${isExact ? 'bg-emerald-100/50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-100/50 text-red-700 dark:bg-red-500/10 dark:text-red-400'}`}>
                                    <span className="text-sm font-bold">Diferencia:</span>
                                    <span className="text-base font-black">{formatCurrency(difference)}</span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="w-full flex flex-col gap-3">
                                <button className="w-full flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 h-14 rounded-full font-bold transition-all shadow-lg active:scale-[0.98]">
                                    <Printer className="w-5 h-5" />
                                    Imprimir Comprobante para Sobre
                                </button>
                                <button
                                    onClick={() => {
                                        setShowSuccessModal(false);
                                        logout();
                                    }}
                                    className="w-full flex items-center justify-center h-12 rounded-full font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                                >
                                    Finalizar y Salir
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Alert Modal */}
            <ModalAlert
                isOpen={alertConfig.isOpen}
                type={alertConfig.type}
                title={alertConfig.title}
                message={alertConfig.message}
                onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
                confirmText="Aceptar"
            />
        </div >
    );
};

export default CashCloseView;
