import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Webcam from 'react-webcam';
import {
    Search, Camera, User, Phone, Users, AlertCircle, Plus,
    CheckCircle2, Shield, ScanFace, Trash2, UserCheck, Check
} from 'lucide-react';
import { Parent, Child } from '../types';
import { pb } from '../lib/pocketbase';
import { useSessionStore } from '../store/session.store';
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

const fmtDate = (iso: string) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

/* ─── component ─── */
interface Props { onNavigate?: (view: 'dashboard' | 'checkin' | 'inventory') => void; }

const SecurityCheckIn: React.FC<Props> = ({ onNavigate }) => {
    const { setSession } = useSessionStore();

    /* search */
    const [sq, setSq] = useState('');
    const [searching, setSearching] = useState(false);
    const [results, setResults] = useState<Parent[]>([]);
    const [showDrop, setShowDrop] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const boxRef = useRef<HTMLDivElement>(null);
    const ddRef = useRef<HTMLDivElement>(null);
    const [ddPos, setDdPos] = useState({ top: 0, left: 0, width: 0 });

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

    /* new children */
    const [newChildren, setNewChildren] = useState<ChildEntry[]>([mkChild()]);

    /* submit */
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);

    /* ── search ── */
    const doSearch = useCallback(async (q: string) => {
        if (q.trim().length < 2) { setResults([]); setShowDrop(false); return; }
        setSearching(true);
        try {
            const r = await pb.collection('parents').getList(1, 10, { filter: `name ~ "${q}" || phone ~ "${q}"` });
            setResults(r.items as unknown as Parent[]);
            setShowDrop(r.items.length > 0);
        } catch { /* ignore */ } finally { setSearching(false); }
    }, []);

    const onSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
        setSq(v);
        if (selParent) { setSelParent(null); setExistingUrl(null); setExistingKids([]); setSelectedKidIds(new Set()); }
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => doSearch(v), 350);
    };

    const updDdPos = useCallback(() => {
        if (!boxRef.current) return;
        const r = boxRef.current.getBoundingClientRect();
        setDdPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }, []);

    useEffect(() => { if (showDrop) updDdPos(); }, [showDrop, updDdPos]);
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
        setSq('');
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

    /* ── validation helpers ── */
    const onPhone = (e: React.ChangeEvent<HTMLInputElement>) => setPPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
    const onName = (e: React.ChangeEvent<HTMLInputElement>) => setPName(e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, ''));
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
            for (const c of newChildren) {
                if (!c.name.trim() || !c.birth_date) continue;
                const rec = await pb.collection('children').create({ name: c.name, birth_date: c.birth_date, parent: pid, allergies: c.allergies || '' });
                allChildIds.push(rec.id);
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
                ...newChildren.filter(c => c.name.trim() && c.birth_date).map(c => ({
                    id: c.id, name: c.name, birth_date: c.birth_date, parent: pid!, allergies: c.allergies,
                })),
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
                if (onNavigate) onNavigate('inventory');
            }, 2500);
        } catch (err) { console.error('Reg:', err); } finally { setSubmitting(false); }
    };

    const reset = () => {
        setSq(''); setResults([]); setShowDrop(false); setSelParent(null);
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
        <div className="flex flex-col h-full gap-2.5 overflow-hidden">

            {success && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 flex items-center gap-2.5 shrink-0 animate-in fade-in">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span className="text-emerald-200 font-semibold text-sm">{success}</span>
                </div>
            )}

            {/* ═══ HEADER: Title + Search ═══ */}
            <div ref={boxRef} className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-2xl px-5 py-3 shrink-0 shadow-sm">
                <div className="flex items-center gap-4">
                    <Shield className="w-4 h-4 text-blue-400 shrink-0" />
                    <h2 className="text-sm font-bold text-slate-100 shrink-0">Check-In</h2>
                    <div className="flex-1 relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                        <input value={sq} onChange={onSearchInput}
                            placeholder="Buscar por nombre o teléfono..."
                            className="w-full h-10 rounded-xl border border-white/10 bg-slate-800/80 pl-10 pr-4 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-inner" />
                        {searching && <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />}
                    </div>
                    {selParent && (
                        <>
                            <div className="flex items-center gap-1.5 text-xs text-blue-300 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20 shrink-0">
                                <UserCheck className="w-3.5 h-3.5" />
                                <span className="font-semibold">{selParent.name}</span>
                                <span className="text-blue-400/60">·</span>
                                <span className="text-slate-400">Visita #{(selParent.total_visits || 0) + 1}</span>
                            </div>
                            <button onClick={reset} className="text-[10px] text-slate-500 hover:text-slate-300 px-2 py-1 rounded-md hover:bg-white/5 transition-colors shrink-0">✕</button>
                        </>
                    )}
                </div>
            </div>

            {/* Search dropdown (portal) */}
            {showDrop && results.length > 0 && createPortal(
                <div ref={ddRef} className="fixed z-[9999] bg-slate-900 border border-white/10 rounded-xl shadow-2xl shadow-black/70 max-h-[220px] overflow-y-auto"
                    style={{ top: ddPos.top, left: ddPos.left, width: ddPos.width }}>
                    <div className="px-3 py-1.5 text-[10px] text-slate-500 uppercase tracking-wider font-bold">{results.length} resultado(s)</div>
                    {results.map(p => (
                        <button key={p.id} onClick={() => pickParent(p)}
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-blue-500/10 transition-colors text-left">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-800 border border-white/10 shrink-0">
                                {p.face_photo
                                    ? <img src={pb.files.getURL(p as any, p.face_photo)} alt="" className="w-full h-full object-cover" />
                                    : <div className="w-full h-full flex items-center justify-center"><User className="w-3.5 h-3.5 text-slate-600" /></div>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-200 truncate">{p.name}</p>
                                <p className="text-[11px] text-slate-500">{p.phone}</p>
                            </div>
                            {p.total_visits && p.total_visits > 0 ? <span className="text-[10px] text-slate-500">Visita #{p.total_visits}</span> : null}
                        </button>
                    ))}
                </div>,
                document.body
            )}

            {/* ═══ BODY ═══ */}
            <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">

                {/* ── LEFT: Camera ── */}
                <div className="w-[280px] shrink-0 flex flex-col">
                    <div className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-2xl p-4 shrink-0 shadow-sm">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <ScanFace className="w-4 h-4 text-cyan-400" /> Captura Facial
                        </h3>
                        {/* Box constraints so it doesn't stretch infinitely. 3:4 portrait aspect ratio. */}
                        <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800/50 w-full aspect-[3/4] shadow-inner">
                            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400/50 rounded-tl z-10" />
                            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400/50 rounded-tr z-10" />
                            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400/50 rounded-bl z-10" />
                            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400/50 rounded-br z-10" />
                            {camOn && !photo && !existingUrl ? (
                                <Webcam audio={false} ref={wcRef} screenshotFormat="image/jpeg"
                                    videoConstraints={{ facingMode: 'user', width: 480, height: 640 }}
                                    className="absolute inset-0 w-full h-full object-cover" />
                            ) : photo ? (
                                <img src={photo} alt="" className="absolute inset-0 w-full h-full object-cover" />
                            ) : existingUrl ? (
                                <img src={existingUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center"><Camera className="w-10 h-10 text-slate-700" /></div>
                            )}
                        </div>
                        <div className="mt-4 shrink-0">
                            {camOn && !photo && !existingUrl
                                ? <Button onClick={capture} className="w-full h-10 text-sm font-semibold" icon={<Camera className="w-4 h-4" />}>Capturar</Button>
                                : <Button onClick={retake} variant="secondary" className="w-full h-10 text-sm font-semibold" icon={<Camera className="w-4 h-4" />}>Tomar Otra</Button>}
                        </div>
                    </div>
                </div>

                {/* ── RIGHT: Parent + Children ── */}
                <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-hidden">

                    {/* Parent form */}
                    <div className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5 shrink-0 shadow-sm">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <User className="w-4 h-4 text-blue-400" /> Responsable
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_200px_160px] gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-400">Nombre *</label>
                                <div className="relative">
                                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                    <input value={pName} onChange={onName} placeholder="Solo letras"
                                        className="w-full h-10 rounded-xl border border-white/10 bg-slate-800/80 pl-10 pr-4 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-inner" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-400 flex items-center justify-between">
                                    <span>Teléfono *</span>
                                    {pPhone.length > 0 && pPhone.length < 10 && <span className="text-orange-400 text-[10px]">{pPhone.length}/10</span>}
                                </label>
                                <div className="relative">
                                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                    <input value={pPhone} onChange={onPhone} placeholder="10 dígitos" type="tel"
                                        className="w-full h-10 rounded-xl border border-white/10 bg-slate-800/80 pl-10 pr-4 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-inner" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-400">Correo Electrónico</label>
                                <input value={pEmail} onChange={e => setPEmail(e.target.value)} placeholder="Opcional" type="email"
                                    className="w-full h-10 rounded-xl border border-white/10 bg-slate-800/80 px-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-inner" />
                            </div>
                        </div>
                    </div>

                    {/* Children section */}
                    <div className="flex-1 bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5 flex flex-col min-h-0 overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between mb-4 shrink-0">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <Users className="w-4 h-4 text-orange-400" /> Niños
                                <span className="ml-2 text-xs font-semibold bg-slate-800/80 px-2.5 py-1 rounded-full text-slate-300 shadow-inner">
                                    {totalKids} seleccionado(s)
                                </span>
                            </h3>
                            <button onClick={addNewChild} className="flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition-all shadow-sm">
                                <Plus className="w-3.5 h-3.5" /> Nuevo
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto min-h-0 space-y-3 pr-1">

                            {/* Existing children (selectable) */}
                            {existingKids.length > 0 && (
                                <div className="space-y-2 mb-4">
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Registrados</p>
                                    {existingKids.map(kid => (
                                        <button key={kid.id} onClick={() => toggleKid(kid.id)}
                                            className={`w-full flex items-center gap-3 rounded-xl p-3 transition-all text-left border ${selectedKidIds.has(kid.id)
                                                ? 'bg-emerald-500/10 border-emerald-500/30 shadow-sm shadow-emerald-500/5'
                                                : 'bg-slate-950/40 border-white/5 hover:border-white/10 hover:bg-slate-800/40'
                                                }`}>
                                            <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all shadow-inner ${selectedKidIds.has(kid.id)
                                                ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                                                : 'bg-slate-800 border border-white/10'
                                                }`}>
                                                {selectedKidIds.has(kid.id) && <Check className="w-3.5 h-3.5" />}
                                            </div>
                                            <span className="text-sm font-semibold text-slate-200 flex-1 truncate">{kid.name}</span>
                                            <span className="text-xs text-slate-400 font-medium">{fmtDate(kid.birth_date)}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* New children entries */}
                            {newChildren.length > 0 && (
                                <div className="space-y-2">
                                    {existingKids.length > 0 && (
                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Nuevos</p>
                                    )}
                                    {newChildren.map(child => (
                                        <div key={child.id} className="bg-slate-950/40 border border-white/5 rounded-xl p-4 relative group hover:border-white/10 transition-colors shadow-sm">
                                            {newChildren.length > 1 && (
                                                <button onClick={() => rmNewChild(child.id)}
                                                    className="absolute top-2 right-2 p-1.5 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all z-10 rounded-lg hover:bg-red-400/10">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                            <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-3 mb-3">
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-slate-400">Nombre *</label>
                                                    <input value={child.name} onChange={e => onChildName(child.id, e.target.value)} placeholder="Nombre del niño"
                                                        className="w-full h-9 rounded-lg border border-white/10 bg-slate-800/80 px-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all shadow-inner" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-xs font-medium text-slate-400">Nacimiento *</label>
                                                    <DatePicker value={child.birth_date} onChange={d => updNewChild(child.id, 'birth_date', d)} placeholder="dd/mm/aaaa" maxDate={TODAY} />
                                                </div>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <AlertCircle className="w-3.5 h-3.5 text-orange-400/70 shrink-0" />
                                                    <input value={child.allergies} onChange={e => updNewChild(child.id, 'allergies', e.target.value)} placeholder="Notas médicas o alergias (opcional)"
                                                        className="w-full h-8 rounded-lg border border-white/5 bg-slate-800/40 px-3 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-all shadow-inner" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ FOOTER ═══ */}
            <div className="shrink-0">
                <Button onClick={register} isLoading={submitting} disabled={!valid}
                    className="w-full h-10 text-sm font-bold uppercase tracking-wider" icon={<Shield className="w-4 h-4" />}>
                    Registrar Entrada ({totalKids} niño{totalKids !== 1 ? 's' : ''}) → Ir a POS
                </Button>
            </div>
        </div>
    );
};

export default SecurityCheckIn;
