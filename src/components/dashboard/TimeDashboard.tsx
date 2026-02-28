import React, { useState, useEffect, useMemo } from 'react';
import { Rocket, Filter, Clock, Users, ArrowUpRight, Flame, MapPin, Box, AlertTriangle, CheckCircle, Wrench } from 'lucide-react';
import { Session, Child, Parent, Asset } from '../../types';
import { pb } from '../../lib/pocketbase';
import SessionTimerCard from './SessionTimerCard';
import { useWorkstationStore } from '../../store/workstation.store';
import Button from '../ui/Button';

// Mock Extended Types for Dashboard Rendering
interface DashboardChild {
    child: Child;
    session: Session;
    parent: Parent;
    timeLeft: number;
}

const TimeDashboard: React.FC = () => {
    const { workstationId } = useWorkstationStore();
    // Tab state
    const [activeTab, setActiveTab] = useState<'monitor' | 'assets'>('monitor');

    // We would normally fetch these from PocketBase real-time subscriptions, 
    // but for the UI layout we'll build the view and fetch static data for now.
    const [kids, setKids] = useState<DashboardChild[]>([]);
    const [loading, setLoading] = useState(true);

    // Assets state
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loadingAssets, setLoadingAssets] = useState(false);

    // Report Modal
    const [reportingAsset, setReportingAsset] = useState<Asset | null>(null);
    const [reportReason, setReportReason] = useState('');

    const [filterBy, setFilterBy] = useState<'all' | 'ending' | 'recent' | 'gokarts'>('all');

    useEffect(() => {
        let isMounted = true;

        const loadActiveSessions = async () => {
            try {
                // Fetch active sessions, expanding child array and parent record
                const records = await pb.collection('sessions').getFullList({
                    filter: `status = 'active'`,
                    expand: 'child,parent',
                    sort: '-created'
                });

                const now = Date.now();
                const activeKids: DashboardChild[] = [];

                for (const record of records) {
                    const session = record as unknown as Session;
                    const parentData = record.expand?.parent as unknown as Parent;
                    const childrenData = record.expand?.child as unknown as Child[] || [];

                    // Calculate remaining time in seconds
                    const end = session.end_time ? new Date(session.end_time).getTime() : now + 3600000;
                    let timeLeftSeconds = Math.floor((end - now) / 1000);

                    if (!parentData || childrenData.length === 0) {
                        // Anonymous Ticket (Express Mode)
                        activeKids.push({
                            child: {
                                id: `anon-${session.id}`,
                                name: `Ticket #${session.sale ? session.sale.slice(-4).toUpperCase() : session.id.slice(-4).toUpperCase()}`,
                                birth_date: new Date().toISOString(), // dummy date so age calc gives 0 or near 0
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

                    // Map each child to a separate card in the dashboard
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

        loadActiveSessions();

        // Polling every 30 seconds as a fallback, real-time subscription can be added later
        const interval = setInterval(loadActiveSessions, 30000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    // Load Assets
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
        if (activeTab === 'assets') {
            loadAssets();
        }
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
            alert('No se pudo reportar la falla.');
        }
    };

    const handleMarkAvailable = async (asset: Asset) => {
        try {
            await pb.collection('assets').update(asset.id, {
                status: 'available',
                last_report: '' // clear report when available again
            });
            await loadAssets();
        } catch (error) {
            console.error('Error marking asset available', error);
        }
    };

    // Filter and Sort Logic
    const displayedKids = useMemo(() => {
        let filtered = [...kids];

        switch (filterBy) {
            case 'ending':
                // Sort ascending by time left
                filtered.sort((a, b) => a.timeLeft - b.timeLeft);
                break;
            case 'recent':
                // Sort descending by start_time
                filtered.sort((a, b) => new Date(b.session.start_time || 0).getTime() - new Date(a.session.start_time || 0).getTime());
                break;
            case 'gokarts':
                // Filter only is_gokart
                filtered = filtered.filter(k => k.session.is_gokart);
                break;
            case 'all':
            default:
                // Default: Exceeded first, then ascending time left
                filtered.sort((a, b) => a.timeLeft - b.timeLeft);
                break;
        }
        return filtered;
    }, [kids, filterBy]);

    // Derived stats
    const totalKids = kids.length;
    const CAPACITY = 60; // Hardcoded park capacity for now
    const fillPercentage = Math.round((totalKids / CAPACITY) * 100);
    const capacityColor = fillPercentage > 90 ? 'bg-red-500' : fillPercentage > 75 ? 'bg-orange-500' : 'bg-emerald-500';
    const activeAlerts = kids.filter(k => k.timeLeft < 10 * 60).length;

    return (
        <div className="flex flex-col h-full gap-6">

            {/* 1. Header & Capacity Bar */}
            <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-2xl p-6 shadow-xl shrink-0">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-4">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                            <Rocket className="w-6 h-6 text-blue-600 dark:text-blue-500" />
                            Time Dashboard <span className="text-blue-600 dark:text-blue-500 font-light">| Centro de Mando</span>
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Control de tiempo e inventario en parque interactivo</p>
                    </div>

                    {/* Capacity Header */}
                    {activeTab === 'monitor' && (
                        <div className="flex items-center gap-4 bg-slate-100 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-200 dark:border-white/5 w-full md:w-[320px] shadow-inner">
                            <div className={`w-12 h-12 rounded-full ${capacityColor}/10 flex items-center justify-center border ${capacityColor.replace('bg-', 'border-')}/30 shadow-[0_0_15px_rgba(0,0,0,0.05)] dark:shadow-[0_0_15px_rgba(0,0,0,0.2)] shrink-0`}>
                                <Users className={`w-6 h-6 ${capacityColor.replace('bg-', 'text-')}`} />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Aforo Total</span>
                                    <span className="text-sm font-black text-slate-900 dark:text-slate-100">{totalKids}/{CAPACITY} <span className="text-xs font-semibold text-slate-500">[{fillPercentage}%]</span></span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-300 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${capacityColor} transition-all duration-1000`} style={{ width: `${Math.min(100, fillPercentage)}%` }} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Navigation Tabs */}
                <div className="flex items-center gap-2 mt-4">
                    <button
                        onClick={() => setActiveTab('monitor')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'monitor' ? 'bg-blue-100 dark:bg-blue-600 text-blue-700 dark:text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                    >
                        <Clock className="w-4 h-4 inline-block mr-2" /> Monitor de Tiempos
                    </button>
                    <button
                        onClick={() => setActiveTab('assets')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'assets' ? 'bg-blue-100 dark:bg-blue-600 text-blue-700 dark:text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                    >
                        <Box className="w-4 h-4 inline-block mr-2" /> Estado de Activos
                    </button>
                </div>
            </div>

            {activeTab === 'monitor' ? (
                <>
                    {/* 2. Quick Filters */}
                    <div className="flex items-center gap-3 shrink-0 overflow-x-auto pb-2 scrollbar-hide">
                        <button
                            onClick={() => setFilterBy('all')}
                            className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all border ${filterBy === 'all' ? 'bg-blue-100 dark:bg-blue-600 text-blue-700 dark:text-white shadow-lg shadow-blue-500/25 border-blue-300 dark:border-blue-500' : 'bg-white/80 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                            <Filter className="w-4 h-4" /> Todos Activos
                        </button>
                        <button
                            onClick={() => setFilterBy('ending')}
                            className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all border ${filterBy === 'ending' ? 'bg-orange-100 dark:bg-orange-600 text-orange-700 dark:text-white shadow-lg shadow-orange-500/25 border-orange-300 dark:border-orange-500' : 'bg-white/80 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                            <Flame className="w-4 h-4" /> Por Agotarse ({activeAlerts})
                        </button>
                        <button
                            onClick={() => setFilterBy('recent')}
                            className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all border ${filterBy === 'recent' ? 'bg-emerald-100 dark:bg-emerald-600 text-emerald-700 dark:text-white shadow-lg shadow-emerald-500/25 border-emerald-300 dark:border-emerald-500' : 'bg-white/80 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                            <ArrowUpRight className="w-4 h-4" /> Recién Ingresados
                        </button>
                        <button
                            onClick={() => setFilterBy('gokarts')}
                            className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all border ${filterBy === 'gokarts' ? 'bg-purple-100 dark:bg-purple-600 text-purple-700 dark:text-white shadow-lg shadow-purple-500/25 border-purple-300 dark:border-purple-500' : 'bg-white/80 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                            <MapPin className="w-4 h-4" /> En Go-Karts
                        </button>
                    </div>

                    {/* 3. Dynamic Grid */}
                    <div className="flex-1 overflow-y-auto pr-2 pb-6 min-h-0">
                        {loading ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : displayedKids.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full bg-white/60 dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 rounded-2xl p-12">
                                <Clock className="w-16 h-16 text-slate-300 dark:text-slate-700 mb-4" />
                                <h3 className="text-xl font-bold text-slate-500 dark:text-slate-400">Sin niños en esta vista</h3>
                                <p className="text-slate-400 dark:text-slate-500 mt-2">No se encontraron sesiones activas que coincidan con el filtro.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 place-items-center">
                                {displayedKids.map(dk => (
                                    <SessionTimerCard
                                        key={dk.child.id}
                                        child={dk.child}
                                        session={dk.session}
                                        parentPhone={dk.parent.phone}
                                        onExtend={() => console.log('Extend', dk.child.id)}
                                        onCheckout={() => console.log('Checkout', dk.child.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </>
            ) : (
                /* ASSETS VIEW */
                <div className="flex-1 overflow-y-auto pr-2 pb-6 min-h-0 bg-white/60 dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 rounded-2xl p-6">
                    {loadingAssets ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : assets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
                            <Box className="w-16 h-16 mb-4 opacity-30" />
                            <h3 className="text-xl font-bold text-slate-500 dark:text-slate-400">Sin activos asignados</h3>
                            <p className="mt-2 text-sm text-center max-w-sm">Esta estación no tiene carritos ni equipamiento asignado actualmente. El Administrador puede asignarlos desde Configuración de Hardware.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {assets.map(asset => (
                                <div key={asset.id} className={`p-5 rounded-2xl border flex flex-col gap-4 shadow-xl transition-all ${asset.status === 'maintenance' ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-500/30 shadow-red-500/10 hover:border-red-500/50' :
                                    asset.status === 'in_use' ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-500/30 shadow-blue-500/10 hover:border-blue-500/50' :
                                        'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-500/30 shadow-emerald-500/10 hover:border-emerald-500/50'
                                    }`}>
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl shadow-inner border border-slate-200 dark:border-transparent">
                                                {asset.status === 'maintenance' ? <Wrench className="w-6 h-6 text-red-500 dark:text-red-400" /> : <Rocket className={`w-6 h-6 ${asset.status === 'available' ? 'text-emerald-500 dark:text-emerald-400' : 'text-blue-500 dark:text-blue-400'}`} />}
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{asset.name}</h3>
                                                <span className={`text-xs font-semibold tracking-wider uppercase ${asset.status === 'maintenance' ? 'text-red-500 dark:text-red-400' :
                                                    asset.status === 'in_use' ? 'text-blue-500 dark:text-blue-400' : 'text-emerald-500 dark:text-emerald-400'
                                                    }`}>
                                                    {asset.status === 'maintenance' ? 'Mantenimiento' : asset.status === 'in_use' ? 'En Uso' : 'Disponible'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {asset.status === 'maintenance' && asset.last_report && (
                                        <div className="bg-red-100 dark:bg-red-500/10 p-3 rounded-lg border border-red-200 dark:border-red-500/20">
                                            <strong className="text-xs text-red-600 dark:text-red-300 block mb-1">Último Reporte:</strong>
                                            <p className="text-sm text-red-800 dark:text-red-200">{asset.last_report}</p>
                                        </div>
                                    )}

                                    <div className="mt-auto pt-4 border-t border-slate-200 dark:border-white/5 flex gap-2">
                                        {asset.status === 'maintenance' ? (
                                            <button
                                                onClick={() => handleMarkAvailable(asset)}
                                                className="flex-1 py-2 bg-emerald-100 dark:bg-emerald-500/20 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold rounded-lg border border-emerald-300 dark:border-emerald-500/30 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <CheckCircle className="w-4 h-4" /> Marcar Disponible
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => setReportingAsset(asset)}
                                                className="flex-1 py-2 bg-red-100 dark:bg-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/30 text-red-700 dark:text-red-300 font-semibold rounded-lg border border-red-300 dark:border-red-500/30 transition-colors flex items-center justify-center gap-2"
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
                        <p className="text-slate-600 dark:text-slate-300 mb-6">Estás a punto de enviar a mantenimiento el activo <strong className="text-slate-900 dark:text-white">{reportingAsset.name}</strong>. Esto causará que la capacidad disponible de la pista descuente 1 unidad inmediatamente.</p>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Descripción del problema (Requerido)</label>
                            <textarea
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-red-500 rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none min-h-[100px]"
                                placeholder="Ej: Falla en el motor trasero, Llanta ponchada..."
                                value={reportReason}
                                onChange={(e) => setReportReason(e.target.value)}
                            />
                        </div>

                        <div className="flex justify-end gap-3">
                            <Button variant="ghost" onClick={() => { setReportingAsset(null); setReportReason(''); }}>Cancelar</Button>
                            <Button variant="danger" disabled={!reportReason.trim()} onClick={handleReportFailure}>Reportar y Bloquear Activo</Button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default TimeDashboard;
