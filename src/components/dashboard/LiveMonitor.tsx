import React, { useState, useEffect, useMemo } from 'react';
import {
    Activity, LayoutGrid, Car, Train, BarChart3, Users,
    Clock, Search, AlertTriangle, ShieldCheck, Cpu, Zap, Box
} from 'lucide-react';
import { Session, Child, Parent, Asset, Workstation } from '../../types';
import { pb } from '../../lib/pocketbase';
import SessionTimerCard from './SessionTimerCard';
import { useWorkstationStore } from '../../store/workstation.store';

// We reuse the DashboardChild interface structure from TimeDashboard for the grid
interface DashboardChild {
    child: Partial<Child> & { id: string; name: string };
    parent: Partial<Parent> & { name: string };
    session: Session;
    timeLeft: number;
}

interface LiveMonitorProps {
    onNavigate?: (view: string) => void;
}

export const LiveMonitor: React.FC<LiveMonitorProps> = ({ onNavigate }) => {
    const { workstationId } = useWorkstationStore();
    const [subView, setSubView] = useState<'playground' | 'gokarts' | 'train' | 'bi' | 'crm'>('playground');

    // Data State
    const [activeSessions, setActiveSessions] = useState<DashboardChild[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [workstations, setWorkstations] = useState<Workstation[]>([]);

    // Filtered lists for the active subviews
    const gokartSessions = useMemo(() => activeSessions.filter(s => s.session.is_gokart), [activeSessions]);
    const playgroundSessions = useMemo(() => activeSessions.filter(s => !s.session.is_gokart), [activeSessions]);

    // Data Loaders
    const loadMasterData = async () => {
        try {
            // 1. Fetch Sessions & Relationships
            const sessions = await pb.collection('sessions').getFullList<Session>({
                filter: 'status = "active" || status = "paused"',
                sort: 'start_time'
            });

            // We do a simplified mock assembly here for UI purposes,
            // in real scenario we fetch Parents/Children relations as well.
            const syntheticKids: DashboardChild[] = sessions.map(session => ({
                child: { id: `c-${session.id}`, name: session.child?.[0] ? 'Niño Registrado' : `Ticket #${session.sale?.slice(-4) || '----'}`.toUpperCase() },
                parent: { name: session.parent ? 'Familiar' : 'Venta Directa' },
                session,
                timeLeft: Math.max(0, Math.floor((new Date(session.end_time || '').getTime() - Date.now()) / 1000))
            }));

            // 2. Fetch Assets for Fleet state
            const assetRecords = await pb.collection('assets').getFullList<Asset>({
                filter: workstationId ? `workstation = "${workstationId}"` : ''
            });

            // 3. Fetch Workstations
            const wsRecords = await pb.collection('workstations').getFullList<Workstation>();

            setActiveSessions(syntheticKids);
            setAssets(assetRecords);
            setWorkstations(wsRecords);

        } catch (error: any) {
            if (!error.isAbort) console.error("Error loading master data", error);
        }
    };

    useEffect(() => {
        let isMounted = true;
        const wrappedLoad = () => { if (isMounted) loadMasterData(); };

        wrappedLoad();

        // Realtime subscription — reacts instantly to session changes across all terminals
        pb.collection('sessions').subscribe('*', wrappedLoad);

        // Fallback polling every 60s to recover from potential WebSocket disconnections
        const interval = setInterval(wrappedLoad, 60000);

        return () => {
            isMounted = false;
            clearInterval(interval);
            pb.collection('sessions').unsubscribe('*');
        };
    }, []);

    // Helper functions for UI
    const getCapacityMetrics = (category: string) => {
        const categoryAssets = assets.filter(a => a.type?.toLowerCase().includes(category.toLowerCase()) || a.name.toLowerCase().includes(category.toLowerCase()));
        if (categoryAssets.length === 0) return { total: 0, available: 0, maintenance: 0, inUse: 0 };

        const main = categoryAssets.filter(a => a.status === 'maintenance').length;
        // In-use logic is usually cross-referenced with active sessions, 
        // but if we enforce Asset statuses strictly in the DB we just map it.
        const inUse = categoryAssets.filter(a => a.status === 'in_use').length;
        const avail = categoryAssets.filter(a => a.status === 'available').length;

        return { total: categoryAssets.length, available: avail, maintenance: main, inUse };
    };

    const gokartMetrics = getCapacityMetrics('kart');

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-[#0a0f1a] text-slate-900 dark:text-slate-200 overflow-hidden font-sans">

            {/* TOP NAVIGATION BAR / COMMAND HEADER */}
            <div className="shrink-0 bg-white/80 dark:bg-slate-900/60 backdrop-blur-2xl border-b border-slate-200 dark:border-white/5 px-6 py-4 z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                        <Activity className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-wider uppercase">Live Monitor</h1>
                        <p className="text-xs text-blue-500 dark:text-blue-400 font-bold tracking-widest uppercase opacity-80">Supervisor Dashboard</p>
                    </div>
                </div>

                <div className="flex bg-slate-100/50 dark:bg-slate-950/50 p-1.5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-inner overflow-x-auto max-w-full hide-scrollbar">
                    <NavBtn active={subView === 'playground'} onClick={() => setSubView('playground')} icon={<LayoutGrid className="w-4 h-4" />} label="Playground" count={playgroundSessions.length} />
                    <NavBtn active={subView === 'gokarts'} onClick={() => setSubView('gokarts')} icon={<Car className="w-4 h-4" />} label="Go-Karts" count={gokartSessions.length} />
                    <NavBtn active={subView === 'train'} onClick={() => setSubView('train')} icon={<Train className="w-4 h-4" />} label="Tren / Dinos" />
                    <div className="w-px h-6 bg-slate-300 dark:bg-white/10 mx-2 self-center"></div>
                    <NavBtn active={subView === 'bi'} onClick={() => setSubView('bi')} icon={<BarChart3 className="w-4 h-4" />} label="BI & Reportes" />
                    <NavBtn active={subView === 'crm'} onClick={() => setSubView('crm')} icon={<Users className="w-4 h-4" />} label="CRM Clientes" />
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 overflow-auto p-6 scroll-smooth">
                {subView === 'playground' && (
                    <div className="flex flex-col xl:flex-row gap-6 h-full">
                        {/* Pilar A: Live View Grid */}
                        <div className="flex-1 flex flex-col min-w-0">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-bold flex items-center gap-2"><Clock className="w-5 h-5 text-blue-500" /> Cronómetros Activos</h2>
                                <div className="text-sm font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/50 px-4 py-2 rounded-lg border border-slate-200 dark:border-white/5">
                                    Mostrando {playgroundSessions.length} niños en parque
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6 pb-20">
                                {playgroundSessions.map(kid => (
                                    <div key={`${kid.session.id}-${kid.child.id}`} className="w-full">
                                        <SessionTimerCard
                                            child={kid.child as any}
                                            session={kid.session}
                                            parent={kid.parent as any}
                                            onPauseSession={() => { }}
                                            onAlertOvertime={() => { }}
                                            onExtend={(minutes: number) => {
                                                console.log(`Extend session by ${minutes} min`);
                                                onNavigate?.('pos');
                                            }}
                                        />
                                    </div>
                                ))}
                                {playgroundSessions.length === 0 && (
                                    <div className="col-span-full py-20 flex flex-col items-center justify-center opacity-30 border border-dashed border-slate-300 dark:border-slate-700 rounded-3xl">
                                        <LayoutGrid className="w-16 h-16 mb-4" />
                                        <p className="text-xl font-bold">Sin sesiones activas</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Pilar A/B: Widget Lateral (Capacidad y Flota resumida) */}
                        <div className="w-full xl:w-[380px] shrink-0 flex flex-col gap-6">
                            <CapacityWidget
                                title="Playground Aforo"
                                current={playgroundSessions.length}
                                max={80}
                                color="bg-emerald-500"
                            />

                            <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-white/5 rounded-3xl p-6 shadow-2xl">
                                <h3 className="font-bold flex items-center gap-2 mb-6"><Car className="w-5 h-5 text-fuchsia-500" /> Vistazo Flota (Go-Karts)</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <StatBox label="Activos" value={gokartMetrics.total} />
                                    <StatBox label="En Pista" value={gokartSessions.length} color="text-fuchsia-600 dark:text-fuchsia-400" />
                                    <StatBox label="Mantenimiento" value={gokartMetrics.maintenance} color="text-red-600 dark:text-red-400" />
                                    <StatBox label="Libres" value={Math.max(0, gokartMetrics.total - gokartSessions.length - gokartMetrics.maintenance)} color="text-emerald-600 dark:text-emerald-400" />
                                </div>
                            </div>

                            <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-white/5 rounded-3xl p-6 shadow-2xl flex-1">
                                <h3 className="font-bold flex items-center gap-2 mb-6"><Cpu className="w-5 h-5 text-blue-500" /> Terminales Online</h3>
                                <div className="space-y-4">
                                    {workstations.map(ws => (
                                        <div key={ws.id} className="flex justify-between items-center p-3 rounded-xl bg-slate-100/50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${ws.is_active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-red-500'}`}></div>
                                                <span className="font-semibold text-sm">{ws.name}</span>
                                            </div>
                                            <span className="text-xs uppercase font-bold text-slate-500">{ws.type}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* GOKARTS SPECIFIC VIEW */}
                {subView === 'gokarts' && (
                    <div className="flex flex-col gap-8">
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                            <div className="lg:col-span-3">
                                <h2 className="text-xl font-bold flex items-center gap-2 mb-6"><Car className="w-6 h-6 text-fuchsia-500" /> Parrilla de Salida (Go-Karts)</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {gokartSessions.map(kid => (
                                        <div key={kid.session.id} className="bg-white/80 dark:bg-slate-900/50 border border-fuchsia-100 dark:border-fuchsia-500/20 rounded-2xl p-5 shadow-[0_0_30px_rgba(217,70,239,0.05)] flex flex-col">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <span className="text-xs font-bold text-fuchsia-500 dark:text-fuchsia-400 uppercase tracking-wider bg-fuchsia-100 dark:bg-fuchsia-500/10 px-2 py-1 rounded-md mb-2 inline-block">Piloto</span>
                                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{kid.child.name}</h3>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">Pase: {kid.parent.name}</p>
                                                </div>
                                                <div className="animate-pulse bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-500/30 text-xs font-bold flex items-center gap-1">
                                                    <Zap className="w-3 h-3" /> En Pista
                                                </div>
                                            </div>

                                            <div className="mt-auto bg-slate-100 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-white/5 flex flex-col">
                                                <span className="text-[10px] text-slate-500 uppercase font-bold mb-1">Tiempo Restante</span>
                                                <div className="text-3xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                                                    {Math.floor(kid.timeLeft / 60).toString().padStart(2, '0')}:{(kid.timeLeft % 60).toString().padStart(2, '0')}
                                                </div>
                                                {/* Progress bar fake simulation */}
                                                <div className="h-1 bg-slate-300 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
                                                    <div className="h-full bg-fuchsia-500 rounded-full" style={{ width: `${Math.max(0, 100 - (kid.timeLeft / (60 * 15)) * 100)}%` }}></div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {gokartSessions.length === 0 && (
                                        <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-700/50 rounded-3xl bg-slate-100/50 dark:bg-slate-900/20">
                                            <Car className="w-12 h-12 mb-3 opacity-30" />
                                            <p className="font-medium">Pista libre. Esperando corredores.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white/60 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200 dark:border-white/5 rounded-3xl p-6 h-fit shrink-0">
                                <h3 className="font-bold flex items-center justify-between mb-6">
                                    <span className="flex items-center gap-2"><Box className="w-5 h-5 text-blue-500" /> Flota Asignada</span>
                                    <span className="text-xs bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-md">{gokartMetrics.total} Total</span>
                                </h3>

                                <div className="flex flex-col gap-3">
                                    {assets.filter(a => a.type?.toLowerCase().includes('kart') || a.name.toLowerCase().includes('kart')).map(asset => (
                                        <div key={asset.id} className={`p-4 rounded-xl border flex items-center justify-between ${asset.status === 'maintenance' ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-500/20' :
                                            asset.status === 'in_use' ? 'bg-fuchsia-50 dark:bg-fuchsia-950/20 border-fuchsia-200 dark:border-fuchsia-500/20' :
                                                'bg-emerald-50 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-500/20'
                                            }`}>
                                            <div>
                                                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">{asset.name}</h4>
                                                <span className={`text-[10px] font-bold uppercase tracking-wider ${asset.status === 'maintenance' ? 'text-red-500 dark:text-red-400' :
                                                    asset.status === 'in_use' ? 'text-fuchsia-600 dark:text-fuchsia-400' :
                                                        'text-emerald-600 dark:text-emerald-400'
                                                    }`}>
                                                    {asset.status === 'maintenance' ? 'Taller' : asset.status === 'in_use' ? 'Pista' : 'Boxes (Libre)'}
                                                </span>
                                            </div>
                                            {asset.status === 'maintenance' && <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />}
                                            {asset.status === 'in_use' && <Zap className="w-5 h-5 text-fuchsia-500 shrink-0" />}
                                            {asset.status === 'available' && <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />}
                                        </div>
                                    ))}
                                    {gokartMetrics.total === 0 && (
                                        <div className="text-center py-6 text-sm text-slate-500">No hay vehículos registrados para esta área.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* BI & REPORTS VIEW MOCKUP */}
                {subView === 'bi' && (
                    <div className="h-full flex flex-col items-center justify-center opacity-50">
                        <BarChart3 className="w-24 h-24 text-blue-500 mb-6 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                        <h2 className="text-3xl font-black uppercase tracking-widest text-slate-900 dark:text-white mb-2">Módulo BI en Desarrollo</h2>
                        <p className="text-slate-600 dark:text-slate-400 text-center max-w-md">Próximamente las gráficas en tiempo real y métricas financieras se visualizarán aquí con estilo neón corporativo.</p>
                    </div>
                )}

                {/* CRM PREVIEW */}
                {subView === 'crm' && (
                    <div className="h-full flex flex-col items-center justify-center opacity-50">
                        <Users className="w-24 h-24 text-fuchsia-500 mb-6 drop-shadow-[0_0_15px_rgba(217,70,239,0.5)]" />
                        <h2 className="text-3xl font-black uppercase tracking-widest text-slate-900 dark:text-white mb-2">CRM Padrón Global</h2>
                        <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-2 mt-6 flex items-center shadow-2xl">
                            <Search className="w-6 h-6 text-slate-500 mx-4" />
                            <input type="text" placeholder="Buscar familia, niño o teléfono..." className="w-full bg-transparent text-xl py-3 focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 text-slate-900 dark:text-white" disabled />
                        </div>
                    </div>
                )}

                {subView === 'train' && (
                    <div className="h-full flex flex-col items-center justify-center opacity-50">
                        <Train className="w-24 h-24 text-emerald-500 mb-6 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                        <h2 className="text-3xl font-black uppercase tracking-widest text-slate-900 dark:text-white mb-2">Estación de Tranvía</h2>
                        <p className="text-slate-600 dark:text-slate-400">Panel de control de trayectos del trencito y dinos.</p>
                    </div>
                )}

            </div>
        </div>
    );
};

// --- HELPER COMPONENTS ---

const NavBtn = ({ active, onClick, icon, label, count }: any) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${active
            ? 'bg-blue-100 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 shadow-[0_0_15px_rgba(37,99,235,0.15)]'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/5 border border-transparent'
            }`}
    >
        {icon} {label}
        {count !== undefined && count > 0 && (
            <span className={`ml-2 px-2 py-0.5 rounded-md text-[10px] bg-white dark:bg-slate-950 border ${active ? 'border-blue-200 dark:border-blue-500/50 text-blue-600 dark:text-blue-400' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}>
                {count}
            </span>
        )}
    </button>
);

const CapacityWidget = ({ title, current, max, color }: any) => {
    const pct = Math.min(100, Math.round((current / max) * 100));
    return (
        <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-white/5 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
            {/* Background Glow */}
            <div className={`absolute top-0 right-0 w-32 h-32 ${color} rounded-full blur-[80px] opacity-10 group-hover:opacity-20 transition-opacity`}></div>

            <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-4">{title}</h3>
            <div className="flex items-end justify-between mb-2">
                <div className="text-4xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">{current}<span className="text-xl text-slate-500 font-medium">/{max}</span></div>
                <div className={`font-bold text-sm ${pct >= 90 ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{pct}%</div>
            </div>
            <div className="h-2 w-full bg-slate-200 dark:bg-slate-950 rounded-full overflow-hidden border border-transparent dark:border-white/5">
                <div className={`h-full rounded-full transition-all duration-1000 ${pct >= 90 ? 'bg-gradient-to-r from-orange-500 to-red-500' : color.replace('bg-', 'bg-gradient-to-r from-blue-500 to-')}`} style={{ width: `${pct}%` }}></div>
            </div>
        </div>
    );
};

const StatBox = ({ label, value, color = "text-slate-900 dark:text-white" }: any) => (
    <div className="bg-slate-100/50 dark:bg-slate-950/50 p-4 rounded-2xl border border-slate-200 dark:border-white/5 flex flex-col items-center justify-center text-center">
        <span className={`text-2xl font-black ${color} tabular-nums leading-none mb-1`}>{value}</span>
        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider w-full truncate">{label}</span>
    </div>
);
