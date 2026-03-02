import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Users, History, Box, AlertTriangle, CheckCircle, Wrench, Rocket } from 'lucide-react';
import { Session, Child, Parent, Asset } from '../../types';
import { pb } from '../../lib/pocketbase';
import SessionTimerCard from './SessionTimerCard';
import { useWorkstationStore } from '../../store/workstation.store';
import { useSettingsStore } from '../../store/settings.store';
import { Button } from '../ui/button';

interface DashboardChild {
    child: Child;
    session: Session;
    parent: Parent;
    timeLeft: number;
}

interface RecentSession {
    id: string;
    childName: string;
    parentName: string;
    endTime: string;
    duration: string;
}

interface TimeDashboardProps {
    onNavigate?: (view: string) => void;
}

const TimeDashboard: React.FC<TimeDashboardProps> = ({ onNavigate }) => {
    const { workstationId, workstationName } = useWorkstationStore();
    const { settings } = useSettingsStore();

    const [kids, setKids] = useState<DashboardChild[]>([]);
    const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
    const [loading, setLoading] = useState(true);

    // Assets state
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loadingAssets, setLoadingAssets] = useState(false);
    const [reportingAsset, setReportingAsset] = useState<Asset | null>(null);
    const [reportReason, setReportReason] = useState('');
    const [activeTab, setActiveTab] = useState<'monitor' | 'assets'>('monitor');

    useEffect(() => {
        let isMounted = true;

        const loadActiveSessions = async () => {
            try {
                // Build filter: active or paused sessions for this workstation
                let filter = `status = 'active' || status = 'paused'`;

                const records = await pb.collection('sessions').getFullList({
                    filter,
                    expand: 'child,parent',
                    sort: '-created',
                    requestKey: 'active-sessions'
                });

                const now = Date.now();
                const activeKids: DashboardChild[] = [];

                for (const record of records) {
                    const session = record as unknown as Session;
                    const parentData = record.expand?.parent as unknown as Parent;

                    // Normalize child to array
                    let rawChildren = record.expand?.child;
                    let childrenData: Child[] = [];
                    if (rawChildren) {
                        childrenData = Array.isArray(rawChildren)
                            ? (rawChildren as unknown as Child[])
                            : [rawChildren as unknown as Child];
                    }

                    const end = session.end_time ? new Date(session.end_time).getTime() : now + 3600000;
                    let timeLeftSeconds = Math.floor((end - now) / 1000);

                    if (!parentData || childrenData.length === 0) {
                        activeKids.push({
                            child: {
                                id: `anon-${session.id}`,
                                name: `Ticket #${session.sale ? session.sale.slice(-4).toUpperCase() : session.id.slice(-4).toUpperCase()}`,
                                birth_date: new Date().toISOString(),
                                parent: 'anon'
                            },
                            parent: {
                                id: 'anon',
                                name: 'Venta Directa'
                            },
                            session,
                            timeLeft: timeLeftSeconds
                        });
                        continue;
                    }

                    for (const child of childrenData) {
                        activeKids.push({
                            child,
                            parent: parentData,
                            session,
                            timeLeft: timeLeftSeconds
                        });
                    }
                }

                if (isMounted) {
                    setKids(activeKids);
                }
            } catch (error: any) {
                if (!error.isAbort) {
                    console.error('Error fetching active sessions:', error);
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        const loadRecentSessions = async () => {
            try {
                const records = await pb.collection('sessions').getList(1, 8, {
                    filter: `status = 'finished'`,
                    expand: 'child,parent',
                    sort: '-updated',
                    requestKey: 'recent-sessions'
                });

                const recent: RecentSession[] = records.items.map(record => {
                    const rawChild = record.expand?.child;
                    const child = rawChild
                        ? (Array.isArray(rawChild) ? rawChild[0] : rawChild)
                        : null;
                    const parent = record.expand?.parent as any;

                    const start = new Date(record.start_time || record.created || '').getTime();
                    const end = new Date(record.end_time || record.updated || '').getTime();
                    const durationMin = Math.max(0, Math.round((end - start) / 60000));

                    return {
                        id: record.id,
                        childName: child?.name || `Ticket #${record.id.slice(-4).toUpperCase()}`,
                        parentName: parent?.name || 'Venta Directa',
                        endTime: new Date(record.updated || '').toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
                        duration: `${durationMin} min`
                    };
                });

                if (isMounted) setRecentSessions(recent);
            } catch (error: any) {
                if (!error.isAbort) console.error('Error fetching recent sessions:', error);
            }
        };

        loadActiveSessions();
        loadRecentSessions();

        const interval = setInterval(() => {
            loadActiveSessions();
            loadRecentSessions();
        }, 30000);

        pb.collection('sessions').subscribe('*', function (_e) {
            if (isMounted) {
                loadActiveSessions();
                loadRecentSessions();
            }
        });

        return () => {
            isMounted = false;
            clearInterval(interval);
            pb.collection('sessions').unsubscribe('*');
        };
    }, []);

    // Assets
    const loadAssets = async () => {
        if (!workstationId) return;
        setLoadingAssets(true);
        try {
            const records = await pb.collection('assets').getFullList<Asset>({
                filter: `workstation = '${workstationId}'`,
                sort: 'name'
            });
            setAssets(records);
        } catch (error: any) {
            if (!error.isAbort) console.error('Error fetching assets:', error);
        } finally {
            setLoadingAssets(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'assets') loadAssets();
    }, [activeTab, workstationId]);

    const handleReportFailure = async () => {
        if (!reportingAsset || !reportReason.trim()) return;
        try {
            await pb.collection('assets').update(reportingAsset.id, {
                status: 'maintenance',
                last_report: reportReason
            });
            setReportingAsset(null);
            setReportReason('');
            await loadAssets();
        } catch (error) {
            console.error('Error reporting asset failure', error);
        }
    };

    const handleMarkAvailable = async (asset: Asset) => {
        try {
            await pb.collection('assets').update(asset.id, { status: 'available', last_report: '' });
            await loadAssets();
        } catch (error) {
            console.error('Error marking asset available', error);
        }
    };

    // Sort: overtime first, then ascending time
    const displayedKids = useMemo(() => {
        return [...kids].sort((a, b) => a.timeLeft - b.timeLeft);
    }, [kids]);

    const totalActive = kids.length;
    const warningCount = kids.filter(k => k.timeLeft < 10 * 60 && k.timeLeft > 0).length;
    const overtimeCount = kids.filter(k => k.timeLeft <= 0).length;

    return (
        <div className="flex flex-col h-full gap-4 overflow-hidden">

            {/* ── COMPACT HEADER ── */}
            <div className="shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-2xl px-5 py-4 shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.3)]">
                        <Clock className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                            Monitor de Sesiones
                        </h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {workstationName || 'AstroPlay General'}
                        </p>
                    </div>
                </div>

                {/* Stats Pills */}
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-full">
                        <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span className="text-xs font-bold text-blue-700 dark:text-blue-300">{totalActive} / {settings?.max_capacity || 0} activos</span>
                    </div>
                    {warningCount > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-full animate-pulse">
                            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span className="text-xs font-bold text-amber-700 dark:text-amber-300">{warningCount} por vencer</span>
                        </div>
                    )}
                    {overtimeCount > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-full animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                            <span className="text-xs font-bold text-red-700 dark:text-red-300">{overtimeCount} excedidos</span>
                        </div>
                    )}

                    {/* Tab Toggle */}
                    <div className="ml-2 flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                        <button
                            onClick={() => setActiveTab('monitor')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'monitor' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                        >
                            <Clock className="w-3.5 h-3.5 inline mr-1" />Sesiones
                        </button>
                        <button
                            onClick={() => setActiveTab('assets')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'assets' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                        >
                            <Box className="w-3.5 h-3.5 inline mr-1" />Activos
                        </button>
                    </div>
                </div>
            </div>

            {activeTab === 'monitor' ? (
                <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden min-h-0">

                    {/* ── ACTIVE SESSIONS GRID ── */}
                    <div className="flex-1 overflow-y-auto pr-1 min-h-0">
                        {loading ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : displayedKids.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full bg-slate-50/50 dark:bg-slate-900/20 border border-dashed border-slate-300 dark:border-slate-700/50 rounded-2xl p-12">
                                <Clock className="w-14 h-14 text-slate-300 dark:text-slate-600 mb-3" />
                                <h3 className="text-lg font-bold text-slate-500 dark:text-slate-400">Sin sesiones activas</h3>
                                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Registra un ingreso desde el Check-In para comenzar.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 pb-4">
                                {displayedKids.map(dk => (
                                    <div key={dk.child.id} className="animate-in fade-in zoom-in duration-300 w-full">
                                        <SessionTimerCard
                                            child={dk.child}
                                            session={dk.session}
                                            parent={dk.parent}
                                            onPauseSession={() => { }}
                                            onAlertOvertime={() => { }}
                                            onExtend={(minutes: number) => {
                                                console.log(`Extend session ${dk.session.id} by ${minutes} min`);
                                                onNavigate?.('pos');
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ── RECENT HISTORY SIDEBAR ── */}
                    <div className="w-full lg:w-[280px] shrink-0 bg-white/80 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-2xl p-4 shadow-lg flex flex-col overflow-hidden">
                        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                            <History className="w-4 h-4 text-slate-500" />
                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Recientes</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-1.5">
                            {recentSessions.length === 0 ? (
                                <p className="text-xs text-slate-400 text-center py-8">Sin historial reciente</p>
                            ) : (
                                recentSessions.map(rs => (
                                    <div key={rs.id} className="flex items-center justify-between px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate leading-tight">{rs.childName}</p>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{rs.parentName}</p>
                                        </div>
                                        <div className="text-right shrink-0 ml-2">
                                            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{rs.endTime}</p>
                                            <p className="text-[11px] text-slate-400">{rs.duration}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                /* ASSETS VIEW */
                <div className="flex-1 overflow-y-auto pr-2 pb-6 min-h-0 bg-slate-50/50 dark:bg-slate-900/20 border border-slate-200 dark:border-white/5 rounded-2xl p-6">
                    {loadingAssets ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : assets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
                            <Box className="w-16 h-16 mb-4 opacity-30" />
                            <h3 className="text-xl font-bold text-slate-500 dark:text-slate-400">Sin activos asignados</h3>
                            <p className="mt-2 text-sm text-center max-w-sm">Esta estación no tiene equipamiento asignado.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {assets.map(asset => (
                                <div key={asset.id} className={`p-5 rounded-2xl border flex flex-col gap-4 shadow-xl transition-all ${asset.status === 'maintenance' ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-500/30 shadow-red-500/10' :
                                    asset.status === 'in_use' ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-500/30 shadow-blue-500/10' :
                                        'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-500/30 shadow-emerald-500/10'
                                    }`}>
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl shadow-inner border border-slate-200 dark:border-transparent">
                                                {asset.status === 'maintenance' ? <Wrench className="w-6 h-6 text-red-500" /> : <Rocket className={`w-6 h-6 ${asset.status === 'available' ? 'text-emerald-500' : 'text-blue-500'}`} />}
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{asset.name}</h3>
                                                <span className={`text-xs font-semibold tracking-wider uppercase ${asset.status === 'maintenance' ? 'text-red-500' :
                                                    asset.status === 'in_use' ? 'text-blue-500' : 'text-emerald-500'
                                                    }`}>
                                                    {asset.status === 'maintenance' ? 'Mantenimiento' : asset.status === 'in_use' ? 'En Uso' : 'Disponible'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {asset.status === 'maintenance' && asset.last_report && (
                                        <div className="bg-red-100 dark:bg-red-500/10 p-3 rounded-lg border border-red-200 dark:border-red-500/20">
                                            <strong className="text-xs text-red-600 dark:text-red-300 block mb-1">Reporte:</strong>
                                            <p className="text-sm text-red-800 dark:text-red-200">{asset.last_report}</p>
                                        </div>
                                    )}

                                    <div className="mt-auto pt-4 border-t border-slate-200 dark:border-white/5 flex gap-2">
                                        {asset.status === 'maintenance' ? (
                                            <button
                                                onClick={() => handleMarkAvailable(asset)}
                                                className="flex-1 py-2 bg-emerald-100 dark:bg-emerald-500/20 hover:bg-emerald-200 text-emerald-700 dark:text-emerald-300 font-semibold rounded-lg border border-emerald-300 dark:border-emerald-500/30 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <CheckCircle className="w-4 h-4" /> Marcar Disponible
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => setReportingAsset(asset)}
                                                className="flex-1 py-2 bg-red-100 dark:bg-red-500/20 hover:bg-red-200 text-red-700 dark:text-red-300 font-semibold rounded-lg border border-red-300 dark:border-red-500/30 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <AlertTriangle className="w-4 h-4" /> Reportar Falla
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Reporting Modal */}
            {reportingAsset && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl border border-red-200 dark:border-red-500/30 shadow-2xl shadow-red-500/20 p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-4 text-red-600 dark:text-red-400">
                            <AlertTriangle className="w-8 h-8" />
                            <h2 className="text-xl font-bold">Reportar Falla</h2>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 mb-6">Enviar a mantenimiento <strong className="text-slate-900 dark:text-white">{reportingAsset.name}</strong>.</p>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Descripción del problema</label>
                            <textarea
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-red-500 rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none min-h-[100px]"
                                placeholder="Ej: Falla en el motor, Llanta ponchada..."
                                value={reportReason}
                                onChange={(e) => setReportReason(e.target.value)}
                            />
                        </div>

                        <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={() => { setReportingAsset(null); setReportReason(''); }}>Cancelar</Button>
                            <Button variant="destructive" disabled={!reportReason.trim()} onClick={handleReportFailure}>Reportar</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimeDashboard;
