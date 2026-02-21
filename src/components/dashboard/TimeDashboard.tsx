import React, { useState, useEffect, useMemo } from 'react';
import { Rocket, Filter, Clock, Users, ArrowUpRight, Flame, MapPin } from 'lucide-react';
import { Session, Child, Parent } from '../../types';
import { pb } from '../../lib/pocketbase';
import SessionTimerCard from './SessionTimerCard';

// Mock Extended Types for Dashboard Rendering
interface DashboardChild {
    child: Child;
    session: Session;
    parent: Parent;
    timeLeft: number;
}

const TimeDashboard: React.FC = () => {
    // We would normally fetch these from PocketBase real-time subscriptions, 
    // but for the UI layout we'll build the view and fetch static data for now.
    const [kids, setKids] = useState<DashboardChild[]>([]);
    const [loading, setLoading] = useState(true);
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

                    if (!parentData || childrenData.length === 0) continue;

                    // Calculate remaining time in seconds
                    const end = session.end_time ? new Date(session.end_time).getTime() : now + 3600000;
                    let timeLeftSeconds = Math.floor((end - now) / 1000);

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
            <div className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-xl shrink-0">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-100">
                            <Rocket className="w-6 h-6 text-blue-500" />
                            Time Dashboard <span className="text-blue-500 font-light">| Centro de Mando</span>
                        </h1>
                        <p className="text-sm text-slate-400 mt-1">Control de tiempo en parque interactivo en tiempo real</p>
                    </div>

                    {/* Capacity Header */}
                    <div className="flex items-center gap-4 bg-slate-950/50 p-3 rounded-xl border border-white/5 w-full md:w-[320px] shadow-inner">
                        <div className={`w-12 h-12 rounded-full ${capacityColor}/10 flex items-center justify-center border ${capacityColor.replace('bg-', 'border-')}/30 shadow-[0_0_15px_rgba(0,0,0,0.2)] shrink-0`}>
                            <Users className={`w-6 h-6 ${capacityColor.replace('bg-', 'text-')}`} />
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-end mb-1">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Aforo Total</span>
                                <span className="text-sm font-black text-slate-100">{totalKids}/{CAPACITY} <span className="text-xs font-semibold text-slate-500">[{fillPercentage}%]</span></span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${capacityColor} transition-all duration-1000`} style={{ width: `${Math.min(100, fillPercentage)}%` }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Quick Filters */}
            <div className="flex items-center gap-3 shrink-0 overflow-x-auto pb-2 scrollbar-hide">
                <button
                    onClick={() => setFilterBy('all')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${filterBy === 'all' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 border border-blue-500' : 'bg-slate-900/50 text-slate-400 border border-white/5 hover:bg-slate-800'}`}
                >
                    <Filter className="w-4 h-4" /> Todos Activos
                </button>
                <button
                    onClick={() => setFilterBy('ending')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${filterBy === 'ending' ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/25 border border-orange-500' : 'bg-slate-900/50 text-slate-400 border border-white/5 hover:bg-slate-800'}`}
                >
                    <Flame className="w-4 h-4" /> Por Agotarse ({activeAlerts})
                </button>
                <button
                    onClick={() => setFilterBy('recent')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${filterBy === 'recent' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 border border-emerald-500' : 'bg-slate-900/50 text-slate-400 border border-white/5 hover:bg-slate-800'}`}
                >
                    <ArrowUpRight className="w-4 h-4" /> Recién Ingresados
                </button>
                <button
                    onClick={() => setFilterBy('gokarts')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${filterBy === 'gokarts' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25 border border-purple-500' : 'bg-slate-900/50 text-slate-400 border border-white/5 hover:bg-slate-800'}`}
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
                    <div className="flex flex-col items-center justify-center h-full bg-slate-900/40 border border-white/5 rounded-2xl p-12">
                        <Clock className="w-16 h-16 text-slate-700 mb-4" />
                        <h3 className="text-xl font-bold text-slate-400">Sin niños en esta vista</h3>
                        <p className="text-slate-500 mt-2">No se encontraron sesiones activas que coincidan con el filtro.</p>
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

        </div>
    );
};

export default TimeDashboard;
