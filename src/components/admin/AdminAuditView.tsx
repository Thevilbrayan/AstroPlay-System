import React, { useState, useEffect } from 'react';
import { pb } from '../../lib/pocketbase';
import { CashSession, User, Workstation } from '../../types';
import { useAuthStore } from '../../store/auth.store';
import {
    ShieldCheck, CheckCircle2, AlertTriangle, Loader2, Info,
    X, TrendingDown, TrendingUp, Minus, PenTool, Calendar, Clock
} from 'lucide-react';
import ModalAlert, { AlertType } from '../ui/ModalAlert';

// Extended type for joining relations
type AuditSession = CashSession & {
    expand?: {
        operator?: User;
        station?: Workstation;
        audited_by?: User;
    };
};

// ─── Operator Avatar ───
const OperatorAvatar: React.FC<{ name?: string; size?: 'sm' | 'lg' }> = ({ name, size = 'sm' }) => {
    const initials = (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const sizeClass = size === 'lg' ? 'w-14 h-14 text-xl' : 'w-8 h-8 text-xs';
    return (
        <div className={`${sizeClass} rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-black text-white shadow-md flex-shrink-0`}>
            {initials}
        </div>
    );
};

export const AdminAuditView: React.FC = () => {
    const { user } = useAuthStore();
    const [sessions, setSessions] = useState<AuditSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<'pending' | 'verified' | 'all'>('pending');

    const [selectedSession, setSelectedSession] = useState<AuditSession | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; type: AlertType; title: string; message: string }>({
        isOpen: false, type: 'info', title: '', message: ''
    });

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

    const formatDate = (isoString?: string) => {
        if (!isoString) return '—';
        return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(isoString));
    };

    const formatTime = (isoString?: string) => {
        if (!isoString) return '—';
        return new Intl.DateTimeFormat('es-MX', { timeStyle: 'short' }).format(new Date(isoString));
    };

    const loadAudits = async () => {
        setIsLoading(true);
        try {
            let filterQuery = `status = "closed"`;
            if (filterStatus !== 'all') {
                filterQuery += ` && audit_status = "${filterStatus}"`;
            }
            const records = await pb.collection('cash_sessions').getFullList<AuditSession>({
                filter: filterQuery,
                sort: '-closed_at',
                expand: 'operator,station,audited_by'
            });
            setSessions(records);
        } catch (err) {
            console.error('Error fetching audits:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadAudits();
    }, [filterStatus]);

    const handleVerify = async (session: AuditSession) => {
        setIsVerifying(true);
        try {
            await pb.collection('cash_sessions').update(session.id, {
                audit_status: 'verified',
                audited_by: user?.id,
            });
            setAlertConfig({
                isOpen: true,
                type: 'success',
                title: 'Auditoría Completada',
                message: 'El corte de caja ha sido marcado como verificado correctamente.'
            });
            setSelectedSession(null);
            loadAudits();
        } catch (err) {
            console.error('Verify error:', err);
            setAlertConfig({
                isOpen: true,
                type: 'error',
                title: 'Error',
                message: 'No se pudo verificar el corte de caja.'
            });
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 p-6 md:p-8 max-w-[1200px] mx-auto w-full transition-colors duration-300">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                        <ShieldCheck className="w-8 h-8 text-blue-600 dark:text-blue-500" />
                        Auditoría de Cajas
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Revisa y aprueba los cortes de turno enviados por los operadores.
                    </p>
                </div>

                {/* Filters */}
                <div className="flex bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-xl shadow-inner border border-slate-200 dark:border-white/5">
                    {(['pending', 'verified', 'all'] as const).map(status => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${filterStatus === status
                                ? 'bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-blue-500/50'
                                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                }`}
                        >
                            {status === 'pending' ? 'Pendientes' : status === 'verified' ? 'Verificados' : 'Todos'}
                        </button>
                    ))}
                </div>
            </header>

            {/* List */}
            <div className="flex-1 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden flex flex-col">
                <div className="grid grid-cols-6 gap-4 p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <div className="col-span-2">Sesión y Estación</div>
                    <div>Operador</div>
                    <div className="text-right">Esperado</div>
                    <div className="text-right">Reportado</div>
                    <div className="text-right">Estado</div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="h-full flex items-center justify-center">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        </div>
                    ) : sessions.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 py-16">
                            <ShieldCheck className="w-12 h-12 opacity-20" />
                            <p>No se encontraron cortes de caja {filterStatus === 'pending' ? 'para revisar' : ''}</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {sessions.map(s => {
                                const expected = (s.opening_balance || 0) + (s.sales_total || 0);
                                const difference = (s.reported_cash || 0) - expected;
                                const isExact = Math.abs(difference) < 0.01;
                                const isPending = s.audit_status === 'pending';

                                return (
                                    <div
                                        key={s.id}
                                        onClick={() => setSelectedSession(s)}
                                        className="grid grid-cols-6 gap-4 p-4 items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                                    >
                                        <div className="col-span-2">
                                            <p className="font-bold text-slate-900 dark:text-white text-sm">
                                                {s.expand?.station?.name || 'Estación Desconocida'}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {formatDate(s.closed_at)} · {formatTime(s.closed_at)}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <OperatorAvatar name={s.expand?.operator?.name} />
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                                                {s.expand?.operator?.name || 'Operador'}
                                            </span>
                                        </div>
                                        <div className="text-right text-sm text-slate-500 dark:text-slate-400">
                                            {formatCurrency(expected)}
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                                                {formatCurrency(s.reported_cash || 0)}
                                            </p>
                                            {!isExact && (
                                                <p className={`text-[10px] font-bold ${difference < 0 ? 'text-red-500' : 'text-amber-500'}`}>
                                                    {difference > 0 ? '+' : ''}{formatCurrency(difference)}
                                                </p>
                                            )}
                                        </div>
                                        <div className="text-right flex justify-end">
                                            {isPending ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100/50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/20">
                                                    <AlertTriangle className="w-3.5 h-3.5" /> Revisar
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100/50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/20">
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Verificado
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Verification Modal ─── */}
            {selectedSession && (() => {
                const s = selectedSession;
                const expected = (s.opening_balance || 0) + (s.sales_total || 0);
                const difference = (s.reported_cash || 0) - expected;
                const isExact = Math.abs(difference) < 0.01;
                const isSurplus = difference > 0.01;
                const isDeficit = difference < -0.01;

                return (
                    <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                        <div className="relative w-full max-w-[640px] bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 max-h-[90vh]">

                            {/* ── Modal Header ── */}
                            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center">
                                        <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">Revisión de Corte de Caja</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{s.expand?.station?.name || 'Estación'}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedSession(null)}
                                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* ── Scrollable Body ── */}
                            <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-3">

                                {/* ── Operator Identity Card ── */}
                                <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/5">
                                    <OperatorAvatar name={s.expand?.operator?.name} size="lg" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cajero responsable</p>
                                        <p className="text-base font-black text-slate-900 dark:text-white truncate leading-tight">
                                            {s.expand?.operator?.name || 'Operador Desconocido'}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                            {s.expand?.operator?.email || ''}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0 text-xs text-slate-500 dark:text-slate-400">
                                        <div className="flex items-center gap-1 mb-0.5 justify-end">
                                            <Calendar className="w-3 h-3" />{formatDate(s.closed_at)}
                                        </div>
                                        <div className="flex items-center gap-1 justify-end">
                                            <Clock className="w-3 h-3" />{formatTime(s.closed_at)}
                                        </div>
                                    </div>
                                </div>

                                {/* ── Números en una sola fila compacta ── */}
                                <div className="grid grid-cols-4 gap-2">
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-white/5">
                                        <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Fondo Inicial</p>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(s.opening_balance || 0)}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-white/5">
                                        <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Ventas</p>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(s.sales_total || 0)}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-white/5">
                                        <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Dejado</p>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(s.cash_retained || 0)}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-white/5">
                                        <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Retirado</p>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(s.cash_withdrawn || 0)}</p>
                                    </div>
                                </div>

                                {/* ── Expected vs Reported + Difference ── */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/15 border border-blue-100 dark:border-blue-500/20">
                                        <p className="text-[9px] uppercase tracking-wider text-blue-500 dark:text-blue-400 font-bold mb-0.5">Esperado (Sistema)</p>
                                        <p className="text-lg font-black text-slate-900 dark:text-white">{formatCurrency(expected)}</p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5">
                                        <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Contado (Cajero)</p>
                                        <p className="text-lg font-black text-slate-900 dark:text-white">{formatCurrency(s.reported_cash || 0)}</p>
                                    </div>
                                </div>

                                {/* ── Difference Banner ── */}
                                <div className={`flex items-center gap-3 p-3 rounded-xl border ${
                                    isExact ? 'bg-emerald-50 dark:bg-emerald-900/15 border-emerald-200 dark:border-emerald-500/20'
                                        : isDeficit ? 'bg-red-50 dark:bg-red-900/15 border-red-200 dark:border-red-500/20'
                                            : 'bg-amber-50 dark:bg-amber-900/15 border-amber-200 dark:border-amber-500/20'
                                }`}>
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                        isExact ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                            : isDeficit ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                                                : 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                    }`}>
                                        {isExact ? <CheckCircle2 className="w-4 h-4" /> : isDeficit ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                                    </div>
                                    <div>
                                        <p className={`text-[9px] font-bold uppercase tracking-wider ${
                                            isExact ? 'text-emerald-600 dark:text-emerald-400' : isDeficit ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
                                        }`}>{isExact ? 'Cuadre Exacto' : isDeficit ? 'Faltante en Caja' : 'Sobrante en Caja'}</p>
                                        <p className={`text-xl font-black ${
                                            isExact ? 'text-emerald-700 dark:text-emerald-300' : isDeficit ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'
                                        }`}>{isExact ? 'Sin diferencia' : `${isSurplus ? '+' : ''}${formatCurrency(difference)}`}</p>
                                    </div>
                                </div>

                                {/* ── Firma del Cajero ── */}
                                {s.operator_signature ? (
                                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                                            <PenTool className="w-3.5 h-3.5 text-slate-500" />
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Firma del Cajero</p>
                                        </div>
                                        <div className="p-3 bg-white flex items-center justify-center h-[80px]">
                                            <img
                                                src={pb.files.getURL(s as any, s.operator_signature)}
                                                alt="Firma del operador"
                                                className="max-h-[72px] max-w-full object-contain"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center gap-2 text-slate-400">
                                        <PenTool className="w-4 h-4 shrink-0" />
                                        <p className="text-xs">Sin firma registrada en este corte.</p>
                                    </div>
                                )}

                                {/* ── Operator's Justification ── */}
                                {s.notes && s.notes.trim() && (
                                    <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-2xl border border-amber-200 dark:border-amber-500/20">
                                        <p className="text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                            <Info className="w-4 h-4" /> Justificación del cajero
                                        </p>
                                        <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">{s.notes}</p>
                                    </div>
                                )}

                                {/* ── Verified by ── */}
                                {s.audit_status === 'verified' && s.expand?.audited_by && (
                                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-500/20">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                        <p className="text-sm text-emerald-700 dark:text-emerald-300">
                                            Verificado por <span className="font-bold">{s.expand.audited_by.name}</span>
                                        </p>
                                    </div>
                                )}

                            </div>

                            {/* ── Footer ── */}
                            <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex gap-3 shrink-0">
                                <button
                                    onClick={() => setSelectedSession(null)}
                                    className="flex-1 h-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                                >
                                    Cerrar
                                </button>
                                {s.audit_status === 'pending' && (
                                    <button
                                        onClick={() => handleVerify(s)}
                                        disabled={isVerifying}
                                        className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {isVerifying ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                                        Aprobar Auditoría
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}

            <ModalAlert
                isOpen={alertConfig.isOpen}
                type={alertConfig.type}
                title={alertConfig.title}
                message={alertConfig.message}
                onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
};
