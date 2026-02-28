import React, { useState, useRef, useCallback, useEffect } from 'react';

import Webcam from 'react-webcam';
import {
    Search, Camera, User, Phone, Users, AlertCircle, Plus,
    CheckCircle2, Shield, ScanFace, Trash2, UserCheck, Check,
    UserPlus, CreditCard, ChevronLeft, Activity
} from 'lucide-react';
import { Parent, Child } from '../types';
import { useSessionStore } from '../store/session.store';
import { pb } from '../lib/pocketbase';
import Button from './ui/Button';
import DatePicker from './ui/DatePicker';
/* ─── helpers ─── */
interface ChildEntry { id: string; name: string; birth_date: string; allergies: string; }


const TODAY = new Date().toISOString().split('T')[0];

let _cid = 0;
const mkChild = (): ChildEntry => ({ id: `c${++_cid}_${Date.now()}`, name: '', birth_date: '', allergies: '' });

function b64toFile(b64: string, name: string): File {
    const [h, d] = b64.split(',');
    const mime = h.match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bin = atob(d);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new File([u8], name, { type: mime });
}



/* ─── component ─── */
interface Props { onNavigate?: (view: 'dashboard' | 'checkin' | 'pos' | 'inventory') => void; }

const SecurityCheckIn: React.FC<Props> = ({ onNavigate }) => {
    const { setSession } = useSessionStore();

    /* search */
    const [searching, setSearching] = useState(false);
    const [results, setResults] = useState<Parent[]>([]);
    const [showDrop, setShowDrop] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const boxRef = useRef<HTMLDivElement>(null);
    const ddRef = useRef<HTMLDivElement>(null);


    /* parent */
    const [selParent, setSelParent] = useState<Parent | null>(null);
    const [pName, setPName] = useState('');
    const [pPhone, setPPhone] = useState('');
    const [pEmail, setPEmail] = useState('');

    /* camera */
    const wcRef = useRef<Webcam>(null);
    const [photo, setPhoto] = useState<string | null>(null);
    const [existingUrl, setExistingUrl] = useState<string | null>(null);
    const [camOn, setCamOn] = useState(true);

    /* existing children (for selection) */
    const [existingKids, setExistingKids] = useState<Child[]>([]);
    const [selectedKidIds, setSelectedKidIds] = useState<Set<string>>(new Set());
    const [showNewChildForm, setShowNewChildForm] = useState(false);

    /* new children */
    const [newChildren, setNewChildren] = useState<ChildEntry[]>([mkChild()]);

    /* redesign Step 1 */
    const [showNewParentForm, setShowNewParentForm] = useState(false);
    const [recentParents, setRecentParents] = useState<Parent[]>([]);
    const [activeKidsCount, setActiveKidsCount] = useState<number>(0);

    /* data fetch */
    useEffect(() => {
        pb.collection('parents').getList(1, 3, { sort: '-created' })
            .then(r => setRecentParents(r.items as unknown as Parent[]))
            .catch(() => { });

        pb.collection('sessions').getFullList({ filter: 'status="active"' })
            .then(sessions => {
                let count = 0;
                sessions.forEach(s => count += (s.child?.length || 0));
                setActiveKidsCount(count);
            })
            .catch(() => { });
    }, []);

    /* submit */
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);

    const doSearch = useCallback(async (q: string) => {
        if (q.trim().length < 2) { setResults([]); setShowDrop(false); return; }
        setSearching(true);
        try {
            const r = await pb.collection('parents').getList(1, 10, { filter: `name ~ "${q}" || phone ~ "${q}"` });
            setResults(r.items as unknown as Parent[]);
            setShowDrop(r.items.length > 0);
        } catch { /* ignore */ } finally { setSearching(false); }
    }, []);


    useEffect(() => {
        if (!showDrop) return;
        const h = (e: MouseEvent) => {
            const t = e.target as Node;
            if (boxRef.current?.contains(t) || ddRef.current?.contains(t)) return;
            setShowDrop(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [showDrop]);
    useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

    /* ── select parent ── */
    const pickParent = async (p: Parent) => {
        setSelParent(p);
        setShowDrop(false);
        setPName(p.name);
        setPPhone(p.phone || '');
        setPEmail(p.email || '');

        if (p.face_photo) {
            setExistingUrl(pb.files.getURL(p as any, p.face_photo));
            setPhoto(null); setCamOn(false);
        } else { setExistingUrl(null); setPhoto(null); setCamOn(true); }

        try {
            const cr = await pb.collection('children').getList(1, 50, { filter: `parent = "${p.id}"` });
            const kids = cr.items as unknown as Child[];
            setExistingKids(kids);
            // Auto-select all existing children
            setSelectedKidIds(new Set(kids.map(k => k.id)));
        } catch { setExistingKids([]); }

        setNewChildren([mkChild()]);
    };

    /* ── scanner listener ── */
    useEffect(() => {
        let barcodeText = '';
        let lastKeyTime = Date.now();

        const handleKeyPress = async (e: KeyboardEvent) => {
            // Only listen if not typing in inputs directly
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            const currentTime = Date.now();

            // Scanner threshold usually < 30ms between strokes
            if (currentTime - lastKeyTime > 50) {
                barcodeText = '';
            }

            if (e.key === 'Enter') {
                if (barcodeText.length > 3) {
                    const scannedCard = barcodeText;
                    barcodeText = '';

                    try {
                        const records = await pb.collection('parents').getList(1, 1, { filter: `card_id="${scannedCard}"` });
                        if (records.items.length > 0) {
                            pickParent(records.items[0] as unknown as Parent);
                            setSuccess(`Tarjeta leída exitosamente. Buscando familia...`);
                            setTimeout(() => setSuccess(null), 2500);
                        } else {
                            console.warn(`Card scan failure: ${scannedCard} not found`);
                            // We can use the success block temporarily to show error
                            setSuccess(`Tarjeta no encontrada: ${scannedCard}`);
                            setTimeout(() => setSuccess(null), 2500);
                        }
                    } catch (err) {
                        console.error('Scan lookup error', err);
                    }
                }
            } else {
                barcodeText += e.key;
            }
            lastKeyTime = currentTime;
        };

        window.addEventListener('keypress', handleKeyPress);
        return () => window.removeEventListener('keypress', handleKeyPress);
    }, []);

    /* ── validation helpers ── */
    const onPhone = (e: React.ChangeEvent<HTMLInputElement>) => setPPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
    const onName = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
        setPName(v);
        if (selParent) { setSelParent(null); setExistingUrl(null); setExistingKids([]); setSelectedKidIds(new Set()); }
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => doSearch(v), 350);
    };
    const onChildName = (id: string, v: string) => updNewChild(id, 'name', v.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, ''));

    /* ── camera ── */
    const capture = useCallback(() => {
        const s = wcRef.current?.getScreenshot();
        if (s) { setPhoto(s); setExistingUrl(null); setCamOn(false); }
    }, []);
    const retake = () => { setPhoto(null); setExistingUrl(null); setCamOn(true); };

    /* ── child toggle ── */
    const toggleKid = (id: string) => {
        setSelectedKidIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    /* ── new children ops ── */
    const addNewChild = () => setNewChildren(prev => [...prev, mkChild()]);
    const rmNewChild = (id: string) => setNewChildren(prev => prev.length > 1 ? prev.filter(c => c.id !== id) : prev);
    const updNewChild = (id: string, f: keyof Omit<ChildEntry, 'id'>, v: string) =>
        setNewChildren(prev => prev.map(c => c.id === id ? { ...c, [f]: v } : c));

    /* ── submit ── */
    const register = async () => {
        if (!valid) return;
        setSubmitting(true);
        try {
            let pid = selParent?.id;
            const firstVisit = !pid;
            const fd = new FormData();
            fd.append('name', pName);
            fd.append('phone', pPhone);
            if (photo) fd.append('face_photo', b64toFile(photo, `face_${Date.now()}.jpg`));

            if (pid) {
                // If there's a new photo for returning parent, update it. Otherwise do nothing.
                if (photo) {
                    const fdUpdate = new FormData();
                    fdUpdate.append('face_photo', b64toFile(photo, `face_${Date.now()}.jpg`));
                    await pb.collection('parents').update(pid, fdUpdate);
                }
            } else {
                // New parent basic registration. Visits will be incremented at checkout.
                fd.append('loyalty_points', '0');
                fd.append('total_visits', '0');
                pid = (await pb.collection('parents').create(fd)).id;
            }

            // Create new children in PocketBase
            const allChildIds: string[] = [...selectedKidIds]; // existing selected
            const createdChildrenObjects = [];

            for (const c of newChildren) {
                if (!c.name.trim() || !c.birth_date) continue;
                const rec = await pb.collection('children').create({ name: c.name, birth_date: c.birth_date, parent: pid, allergies: c.allergies || '' });
                allChildIds.push(rec.id);
                // Store the REAL database record to pass to the POS context
                createdChildrenObjects.push({
                    id: rec.id,
                    name: c.name,
                    birth_date: c.birth_date,
                    parent: pid!,
                    allergies: c.allergies
                });
            }

            // Session will be created atomically during checkout at the POS!

            // Build full parent object for the session store
            const fullParent: Parent = {
                id: pid!, name: pName, phone: pPhone, email: pEmail,
                face_photo: selParent?.face_photo || '', loyalty_points: selParent?.loyalty_points || 0,
                total_visits: selParent?.total_visits || 0,
            };

            // Build selected children list (existing + newly created)
            const allChildObjs: Child[] = [
                ...existingKids.filter(k => selectedKidIds.has(k.id)),
                ...createdChildrenObjects as Child[],
            ];

            // Save to session store → POS will read this and create the checkout
            setSession(fullParent, allChildObjs, null, firstVisit);

            const visitMsg = firstVisit
                ? `🎉 ¡Bienvenido a AstroPlay, ${pName}!`
                : `👋 ¡Bienvenido de nuevo, ${pName}! Visita #${(selParent?.total_visits || 0) + 1}`;
            setSuccess(`${visitMsg} — ${allChildIds.length} niño(s) registrados`);

            setTimeout(() => {
                setSuccess(null);
                reset();
                if (onNavigate) onNavigate('pos');
            }, 2500);
        } catch (err) { console.error('Reg:', err); } finally { setSubmitting(false); }
    };

    const reset = () => {
        setResults([]); setShowDrop(false); setSelParent(null);
        setPName(''); setPPhone(''); setPEmail('');
        setPhoto(null); setExistingUrl(null); setCamOn(true);
        setExistingKids([]); setSelectedKidIds(new Set());
        setNewChildren([mkChild()]);
    };

    const hasPhoto = photo !== null || existingUrl !== null;
    const validNewChildren = newChildren.filter(c => c.name.trim());
    const totalKids = selectedKidIds.size + validNewChildren.filter(c => c.name.trim().length >= 2 && c.birth_date).length;
    const valid =
        pName.trim().length >= 2 && pPhone.length === 10 && hasPhoto && totalKids > 0 &&
        validNewChildren.every(c => !c.name.trim() || (c.name.trim().length >= 2 && c.birth_date !== ''));

    /* ── render ── */
    return (
        <div className="flex flex-col h-full gap-4 overflow-y-auto pb-6 pr-2">
            {success && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 flex items-center gap-2.5 shrink-0 animate-in fade-in">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span className="text-emerald-200 font-semibold text-sm">{success}</span>
                </div>
            )}

            {/* ═══ HEADER ═══ */}
            <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-2xl px-5 py-3 shrink-0 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 shrink-0">ASTROPLAY OS | Check-In de Entrada</h2>
                </div>
                {selParent && (
                    <button onClick={reset} className="text-xs font-bold text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 border border-transparent dark:hover:border-white/10 transition-colors shrink-0 flex items-center gap-2">
                        <Trash2 className="w-3.5 h-3.5" /> Cancelar Check-In
                    </button>
                )}
            </div>

            {/* ═══ PANEL 1: CLIENTE RESPONSABLE ═══ */}
            <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                        <User className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Paso 1: Cliente Responsable
                    </h3>
                    {showNewParentForm && !selParent && (
                        <button onClick={() => { setShowNewParentForm(false); setPName(''); setPPhone(''); setPEmail(''); }} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors bg-slate-100 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/5">
                            <ChevronLeft className="w-4 h-4" /> Volver a Búsqueda
                        </button>
                    )}
                </div>

                {!selParent ? (
                    <div className="max-w-3xl">
                        {!showNewParentForm && (
                            <div className="space-y-1.5 relative mb-6 z-20" ref={boxRef}>
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Buscar por teléfono o nombre</label>
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500/50 pointer-events-none" />
                                    <input value={pName} onChange={onName} placeholder="Ej. 5512345678 o Juan Pérez"
                                        className="w-full h-12 rounded-xl border border-slate-200 dark:border-blue-500/30 bg-slate-50 dark:bg-blue-950/20 pl-12 pr-4 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-inner" />
                                    {searching && <div className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />}
                                </div>

                                {/* Search dropdown (inline) */}
                                {showDrop && results.length > 0 && (
                                    <div className="absolute z-50 mt-2 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl shadow-blue-500/10 dark:shadow-black max-h-[220px] overflow-y-auto">
                                        <div className="px-3 py-2 text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold bg-slate-50 dark:bg-slate-900/50">{results.length} resultado(s) encontrados</div>
                                        {results.map(p => (
                                            <button key={p.id} onClick={() => pickParent(p)}
                                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-blue-500/20 transition-colors text-left border-b border-slate-100 dark:border-white/5 last:border-0">
                                                <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-white/10 shrink-0">
                                                    {p.face_photo
                                                        ? <img src={pb.files.getURL(p as any, p.face_photo)} alt="" className="w-full h-full object-cover" />
                                                        : <div className="w-full h-full flex items-center justify-center"><User className="w-5 h-5 text-slate-400 dark:text-slate-500" /></div>}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-base font-bold text-slate-900 dark:text-slate-200 truncate">{p.name}</p>
                                                    <p className="text-sm text-blue-600 dark:text-blue-400">{p.phone}</p>
                                                </div>
                                                {p.total_visits !== undefined && p.total_visits >= 0 ?
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">Visita #{p.total_visits + 1}</span>
                                                    </div>
                                                    : null}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Two Columns Dashboard (when not searching and not form) */}
                        {!showNewParentForm && pName.length < 2 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in zoom-in-95 duration-300 mb-6">
                                <div className="flex flex-col gap-3">
                                    <Button
                                        onClick={() => setShowNewParentForm(true)}
                                        variant="primary"
                                        className="h-16 justify-start px-5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-lg shadow-blue-500/25 border-t border-white/20 rounded-xl"
                                        icon={<UserPlus className="w-6 h-6 mr-2 opacity-90" />}
                                    >
                                        <span className="text-base font-bold">Registrar Nuevo Cliente</span>
                                    </Button>
                                    <Button
                                        onClick={() => { }}
                                        variant="secondary"
                                        className="h-16 justify-start px-5 border-2 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl shadow-sm"
                                        icon={<CreditCard className="w-6 h-6 mr-2 text-blue-500 dark:text-blue-400" />}
                                    >
                                        <span className="text-base font-bold">Escanear AstroCard</span>
                                    </Button>
                                </div>

                                <div className="bg-slate-50/80 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-white/5 p-4 flex flex-col shadow-inner">
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Estado Actual</span>
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 text-xs font-black border border-orange-200 dark:border-orange-500/30">
                                            <Activity className="w-3.5 h-3.5" />
                                            {activeKidsCount} Niños en parque
                                        </div>
                                    </div>

                                    <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-1">
                                        {recentParents.map(rp => (
                                            <button key={rp.id} onClick={() => pickParent(rp)} className="flex items-center gap-3 p-2.5 rounded-lg bg-white dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left group shadow-sm border border-slate-100 dark:border-white/5 min-h-[52px]">
                                                <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200 dark:border-white/5 overflow-hidden">
                                                    {rp.face_photo ? (
                                                        <img src={pb.files.getURL(rp as any, rp.face_photo)} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <User className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">{rp.name}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{rp.phone}</p>
                                                </div>
                                                <ChevronLeft className="w-4 h-4 text-slate-300 dark:text-slate-600 rotate-180 group-hover:text-blue-500 transition-colors" />
                                            </button>
                                        ))}
                                        {recentParents.length === 0 && (
                                            <p className="text-xs text-slate-400 text-center py-4">No hay registros recientes</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Formulario Integrado (shows if selected or if not found) */}
                        {(showNewParentForm || (pName.length >= 2 && !showDrop)) && (
                            <div className="p-6 border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/30 rounded-2xl shadow-inner animate-in slide-in-from-bottom-2 duration-300 relative z-10">
                                <p className="text-sm text-blue-600 dark:text-blue-400 font-bold mb-5 flex items-center gap-2">
                                    <UserPlus className="w-5 h-5" /> Registro de Nuevo Cliente
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-bold text-slate-600 dark:text-slate-400">Teléfono (10 dígitos) *</label>
                                        <div className="relative">
                                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500 pointer-events-none" />
                                            <input value={pPhone} onChange={onPhone} placeholder="Ej. 5512345678" type="tel"
                                                className="w-full h-12 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 pl-11 pr-4 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm" />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-bold text-slate-600 dark:text-slate-400">Nombre Completo *</label>
                                        <div className="relative">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500 pointer-events-none" />
                                            <input value={pName} onChange={onName} placeholder="Ej. Juan Pérez" type="text"
                                                className="w-full h-12 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 pl-11 pr-4 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm" />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-bold text-slate-600 dark:text-slate-400">Correo Electrónico (Opcional)</label>
                                        <input value={pEmail} onChange={e => setPEmail(e.target.value)} placeholder="cliente@correo.com" type="email"
                                            className="w-full h-12 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-4 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Tarjeta de Cliente Seleccionado */
                    <div className="flex items-center gap-5 p-4 rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20 max-w-2xl">
                        <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 border-2 border-blue-400/50 shrink-0 shadow-lg shadow-blue-500/10">
                            {existingUrl ? (
                                <img src={existingUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center"><User className="w-8 h-8 text-blue-400/50" /></div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">{selParent.name}</h4>
                            <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mt-1">
                                <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {selParent.phone}</span>
                                {selParent.email && <span className="flex items-center gap-1.5 opacity-60">· {selParent.email}</span>}
                            </div>
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-2">
                            <div className="flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-500/20">
                                <UserCheck className="w-4 h-4" />
                                <span className="font-bold uppercase tracking-wide">Visita #{(selParent.total_visits || 0) + 1}</span>
                            </div>
                            <button onClick={() => { setSelParent(null); setExistingUrl(null); setPhoto(null); setPName(''); }} className="text-xs text-slate-500 hover:text-blue-600 dark:hover:text-white underline decoration-dotted underline-offset-4">Cambiar cliente</button>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ PANEL 2: NIÑOS ASOCIADOS ═══ */}
            {/* Solo se muestra si hay un padre seleccionado O si se están escribiendo datos de uno nuevo válidos */}
            {(selParent || (pName.length >= 2 && pPhone.length === 10)) && (
                <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-2xl p-6 shadow-sm flex flex-col gap-4 animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-500 ease-out">
                    <div className="flex justify-between items-center">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                            <Users className="w-4 h-4 text-orange-500 dark:text-orange-400" /> Paso 2: Niños a Ingresar
                            <span className="ml-2 bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30 px-2 py-0.5 rounded-full text-xs font-black">{totalKids}</span>
                        </h3>
                        <button onClick={() => setShowNewChildForm(!showNewChildForm)}
                            className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-lg transition-all ${showNewChildForm ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/25'}`}>
                            {showNewChildForm ? 'Cerrar Formulario' : <><Plus className="w-4 h-4" /> Registrar Nuevo Niño</>}
                        </button>
                    </div>

                    {/* Formulario Nuevo Niño (Colapsable) */}
                    {showNewChildForm && (
                        <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/10 rounded-xl p-5 animate-in slide-in-from-top-2">
                            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-white/5 pb-2">Registrando Nuevo(s) Niño(s)</h4>
                            <div className="space-y-4">
                                {newChildren.map((child) => (
                                    <div key={child.id} className="grid grid-cols-1 lg:grid-cols-[1fr_200px_1fr_auto] gap-4 items-start">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Nombre del niño *</label>
                                            <input value={child.name} onChange={e => onChildName(child.id, e.target.value)} placeholder="Ej. Mateo Pérez"
                                                className="w-full h-10 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/80 px-4 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Fecha de Nacimiento *</label>
                                            <DatePicker value={child.birth_date} onChange={d => updNewChild(child.id, 'birth_date', d)} placeholder="dd/mm/aaaa" maxDate={TODAY} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Notas Médicas / Alergias</label>
                                            <div className="relative">
                                                <AlertCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-500/50 dark:text-orange-400/50" />
                                                <input value={child.allergies} onChange={e => updNewChild(child.id, 'allergies', e.target.value)} placeholder="Opcional"
                                                    className="w-full h-10 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/80 pl-9 pr-4 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30" />
                                            </div>
                                        </div>
                                        {newChildren.length > 1 && (
                                            <div className="pt-6">
                                                <button onClick={() => rmNewChild(child.id)} className="p-2 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-400/10 rounded-lg transition-colors">
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <div className="border-t border-slate-200 dark:border-white/5 pt-3 mt-4">
                                    <button onClick={addNewChild} className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/5 transition-colors">
                                        <Plus className="w-3.5 h-3.5" /> Agregar otro niño al formulario
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Grid de Niños Existentes */}
                    {existingKids.length > 0 && (
                        <div className="mt-2">
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-3">Selecciona a los niños para ingresar:</p>
                            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                                {existingKids.map(kid => {
                                    const isSelected = selectedKidIds.has(kid.id);
                                    let ageStr = "Edad desc.";
                                    if (kid.birth_date) {
                                        const birth = new Date(kid.birth_date);
                                        const ageDifMs = Date.now() - birth.getTime();
                                        const ageDate = new Date(ageDifMs);
                                        ageStr = `${Math.abs(ageDate.getUTCFullYear() - 1970)} años`;
                                    }

                                    return (
                                        <button key={kid.id} onClick={() => toggleKid(kid.id)}
                                            className={`relative flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-left overflow-hidden ${isSelected
                                                ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-500 shadow-md shadow-blue-500/20'
                                                : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-white/5 hover:border-blue-300 dark:hover:border-white/10 hover:shadow-sm'
                                                }`}>

                                            {/* Checkbox Icon */}
                                            <div className="absolute top-3 right-3 shrink-0">
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${isSelected ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600'
                                                    }`}>
                                                    {isSelected ? <Check className="w-4 h-4" /> : null}
                                                </div>
                                            </div>

                                            {/* Avatar mock */}
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg shrink-0 ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                                }`}>
                                                {kid.name.charAt(0).toUpperCase()}
                                            </div>

                                            <div className="flex-1 min-w-0 pr-6">
                                                <p className={`font-bold text-base truncate ${isSelected ? 'text-blue-800 dark:text-blue-100' : 'text-slate-800 dark:text-slate-300'}`}>{kid.name}</p>
                                                <p className={`text-sm ${isSelected ? 'text-blue-600 dark:text-blue-300/80' : 'text-slate-500'}`}>{ageStr}</p>
                                                {kid.allergies && (
                                                    <p className="text-[10px] text-orange-500 dark:text-orange-400 truncate mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Info médica</p>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {existingKids.length === 0 && !showNewChildForm && pName.length > 2 && (
                        <div className="text-center py-6 border border-dashed border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/20 rounded-xl mt-2">
                            <Users className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
                            <p className="text-slate-600 dark:text-slate-400 text-sm">No hay niños registrados.</p>
                            <p className="text-slate-500 text-xs mt-1">Haz clic en "Registrar Nuevo Niño" arriba para comenzar.</p>
                        </div>
                    )}
                </div>
            )}

            {/* ═══ PANEL 3: VERIFICACIÓN FACIAL ═══ */}
            {totalKids > 0 && (
                <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-2xl p-6 shadow-sm flex flex-col gap-4 animate-in slide-in-from-top-4">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-2">
                        <ScanFace className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /> Paso 3: Verificación Facial
                    </h3>

                    <div className="flex flex-col md:flex-row gap-8 items-center md:items-stretch">

                        {/* Camera Box */}
                        <div className="w-full max-w-[240px] shrink-0">
                            <div className="relative rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-800 w-full aspect-[3/4] shadow-xl dark:shadow-2xl">
                                <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-cyan-500/70 dark:border-cyan-400/70 rounded-tl z-10" />
                                <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-cyan-400/70 rounded-tr z-10" />
                                <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-cyan-400/70 rounded-bl z-10" />
                                <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-cyan-400/70 rounded-br z-10" />

                                {camOn && !photo && !existingUrl ? (
                                    <Webcam audio={false} ref={wcRef} screenshotFormat="image/jpeg"
                                        videoConstraints={{ facingMode: 'user', width: 480, height: 640 }}
                                        className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />
                                ) : photo ? (
                                    <img src={photo} alt="" className="absolute inset-0 w-full h-full object-cover" />
                                ) : existingUrl ? (
                                    <img src={existingUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center"><Camera className="w-10 h-10 text-slate-400 dark:text-slate-700" /></div>
                                )}
                            </div>
                            <div className="mt-3 flex flex-col gap-2">
                                {camOn && !photo && !existingUrl
                                    ? <Button onClick={capture} variant="secondary" className="w-full text-sm font-bold bg-white hover:bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white dark:border-slate-700 shadow-sm py-3" icon={<Camera className="w-4 h-4" />}>Capturar Rostro</Button>
                                    : <Button onClick={retake} variant="ghost" className="w-full text-sm font-bold border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 py-3" icon={<ScanFace className="w-4 h-4" />}>Tomar Otra Foto</Button>}
                            </div>
                        </div>

                        {/* Summary & Final Action */}
                        <div className="flex-1 flex flex-col justify-center bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200 dark:border-white/5 rounded-2xl p-6">
                            <div className="mb-6 space-y-3">
                                <h4 className="text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs font-bold">Resumen de Ingreso</h4>
                                <p className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                                    <User className="w-6 h-6 text-blue-600 dark:text-blue-400" /> {pName || "Cliente No Definido"}
                                </p>
                                <p className="text-xl font-bold text-slate-700 dark:text-slate-200 flex items-center gap-3">
                                    <Users className="w-6 h-6 text-orange-500 dark:text-orange-400" /> {totalKids} Niño{totalKids !== 1 ? 's' : ''} seleccionado{totalKids !== 1 ? 's' : ''}
                                </p>
                                {!hasPhoto && (
                                    <p className="text-sm text-red-400 font-bold flex items-center gap-1.5 mt-2 bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20 w-fit">
                                        <AlertCircle className="w-4 h-4" /> Fotografía facial obligatoria para el responsable.
                                    </p>
                                )}
                            </div>

                            <Button
                                onClick={register}
                                isLoading={submitting}
                                disabled={!valid}
                                className={`w-full py-4 text-base font-bold transition-all duration-300 rounded-xl ${valid ? '!bg-emerald-600 hover:!bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-white/5'
                                    }`}
                                icon={<Shield className="w-5 h-5" />}
                            >
                                Finalizar Entrada → POS
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SecurityCheckIn;
