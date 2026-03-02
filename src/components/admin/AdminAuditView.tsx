import React, { useState, useEffect } from 'react';
import { pb } from '../../lib/pocketbase';
import { CashSession, User, Workstation } from '../../types';
import { useAuthStore } from '../../store/auth.store';
import { ShieldCheck, CheckCircle2, AlertTriangle, Loader2, Info, X } from 'lucide-react';
import ModalAlert, { AlertType } from '../ui/ModalAlert';

// Extended type for joining relations
type AuditSession = CashSession & {
    expand?: {
        operator?: User;
        station?: Workstation;
        audited_by?: User;
    };
};

export const AdminAuditView: React.FC = () => {
    const { user } = useAuthStore();
    const [sessions, setSessions] = useState<AuditSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<'pending' | 'verified' | 'all'>('pending');

    // Modal & Verification state
    const [selectedSession, setSelectedSession] = useState<AuditSession | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; type: AlertType; title: string; message: string }>({
        isOpen: false, type: 'info', title: '', message: ''
    });

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

    const formatDate = (isoString?: string) => {
        if (!isoString) return '—';
        return new Intl.DateTimeFormat('es-MX', {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(new Date(isoString));
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
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                            <ShieldCheck className="w-12 h-12 opacity-20" />
                            <p>No se encontraron cortes de caja {filterStatus === 'pending' ? 'para revisar' : ''}</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {sessions.map(s => {
                                const difference = (s.reported_cash || 0) - ((s.opening_balance || 0) + (s.sales_total || 0));
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
                                                {formatDate(s.closed_at)}
                                            </p>
                                        </div>
                                        <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                            {s.expand?.operator?.name || 'Operador'}
                                        </div>
                                        <div className="text-right text-sm text-slate-500 dark:text-slate-400">
                                            {formatCurrency((s.opening_balance || 0) + (s.sales_total || 0))}
                                        </div>
                                        <div className="text-right text-sm font-bold text-slate-900 dark:text-white">
                                            {formatCurrency(s.reported_cash || 0)}
                                            {!isExact && (
                                                <div className={`text-[10px] ${difference < 0 ? 'text-red-500' : 'text-amber-500'}`}>
                                                    {difference > 0 ? '+' : ''}{formatCurrency(difference)}
                                                </div>
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

            {/* Verification Modal */}
            {selectedSession && (
                <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="relative w-full max-w-[600px] bg-white dark:bg-slate-900 rounded-[24px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between bg-slate-50/50 dark:bg-slate-800/50">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Revisión de Corte de Caja</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    Operador: <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedSession.expand?.operator?.name}</span> • {selectedSession.expand?.station?.name}
                                </p>
                            </div>
                            <button onClick={() => setSelectedSession(null)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto max-h-[60vh]">
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-white/5 relative">
                                    <p className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Fondo Inicial</p>
                                    <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(selectedSession.opening_balance || 0)}</p>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-white/5 relative">
                                    <p className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Ventas Totales</p>
                                    <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(selectedSession.sales_total || 0)}</p>
                                </div>
                            </div>

                            <div className="bg-blue-50 dark:bg-blue-900/10 p-5 rounded-2xl border border-blue-100 dark:border-blue-500/20 mb-6 flex justify-between items-center">
                                <div>
                                    <p className="text-sm text-blue-600 dark:text-blue-400 font-bold">Total Esperado (Sistema)</p>
                                    <p className="text-2xl font-black text-slate-900 dark:text-white">
                                        {formatCurrency((selectedSession.opening_balance || 0) + (selectedSession.sales_total || 0))}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-blue-600 dark:text-blue-400 font-bold">Total Reportado (Cajero)</p>
                                    <p className="text-2xl font-black text-slate-900 dark:text-white">
                                        {formatCurrency(selectedSession.reported_cash || 0)}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-white/5 relative">
                                    <p className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Dejado en Caja (Handover)</p>
                                    <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(selectedSession.cash_retained || 0)}</p>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-white/5 relative">
                                    <p className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Retirado para Entrega</p>
                                    <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(selectedSession.cash_withdrawn || 0)}</p>
                                </div>
                            </div>

                            {selectedSession.notes && (
                                <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-2xl border border-amber-200 dark:border-amber-500/20 mb-6">
                                    <p className="text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Info className="w-4 h-4" /> Justificación del cajero</p>
                                    <p className="text-sm text-amber-900 dark:text-amber-200">{selectedSession.notes}</p>
                                </div>
                            )}

                        </div>

                        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex gap-3">
                            <button
                                onClick={() => setSelectedSession(null)}
                                className="flex-1 h-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                            >
                                Cerrar Ventana
                            </button>
                            {selectedSession.audit_status === 'pending' && (
                                <button
                                    onClick={() => handleVerify(selectedSession)}
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
            )}

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
