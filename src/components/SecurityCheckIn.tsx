import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import {
    Shield, SwitchCamera, Camera, Scan, Search,
    CheckCircle2, Plus, User, Smile, Trash2,
    Watch, Baby, ShieldCheck, Printer, Activity, X, RefreshCw
} from 'lucide-react';
import { Parent, Child } from '../types';
import { useSessionStore } from '../store/session.store';
import { pb } from '../lib/pocketbase';
import DatePicker from './ui/DatePicker';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface ChildEntry { id: string; name: string; birth_date: string; allergies: string; saved?: boolean; }

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

    /* new children */
    const [newChildren, setNewChildren] = useState<ChildEntry[]>([]);

    /* data fetch */
    const [activeKidsCount, setActiveKidsCount] = useState<number>(0);

    /* submit */
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        pb.collection('sessions').getFullList({ filter: 'status="active"' })
            .then(sessions => {
                let count = 0;
                sessions.forEach(s => count += (s.child?.length || 0));
                setActiveKidsCount(count);
            })
            .catch(() => { });
    }, []);

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
            setSelectedKidIds(new Set(kids.map(k => k.id)));
        } catch { setExistingKids([]); }

        setNewChildren([]);
    };

    /* Scanner listener */
    useEffect(() => {
        let barcodeText = '';
        let lastKeyTime = Date.now();

        const handleKeyPress = async (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            const currentTime = Date.now();
            if (currentTime - lastKeyTime > 50) barcodeText = '';

            if (e.key === 'Enter') {
                if (barcodeText.length > 3) {
                    const scannedCard = barcodeText;
                    barcodeText = '';
                    try {
                        const records = await pb.collection('parents').getList(1, 1, { filter: `card_id="${scannedCard}"` });
                        if (records.items.length > 0) {
                            pickParent(records.items[0] as unknown as Parent);
                            setSuccess(`Tarjeta leída exitosamente.`);
                            setTimeout(() => setSuccess(null), 2500);
                        } else {
                            setSuccess(`Tarjeta no encontrada: ${scannedCard}`);
                            setTimeout(() => setSuccess(null), 2500);
                        }
                    } catch (err) { }
                }
            } else {
                barcodeText += e.key;
            }
            lastKeyTime = currentTime;
        };

        window.addEventListener('keypress', handleKeyPress);
        return () => window.removeEventListener('keypress', handleKeyPress);
    }, []);

    const onPhone = (e: React.ChangeEvent<HTMLInputElement>) => setPPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
    const onName = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
        setPName(v);
        if (selParent) { setSelParent(null); setExistingUrl(null); setExistingKids([]); setSelectedKidIds(new Set()); }
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => doSearch(v), 350);
    };
    const onChildName = (id: string, v: string) => updNewChild(id, 'name', v.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, ''));

    const capture = useCallback(() => {
        const s = wcRef.current?.getScreenshot();
        if (s) { setPhoto(s); setExistingUrl(null); setCamOn(false); }
    }, []);
    const retake = () => { setPhoto(null); setExistingUrl(null); setCamOn(true); };

    const toggleKid = (id: string) => {
        setSelectedKidIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const addNewChild = () => {
        setNewChildren(prev => [...prev, mkChild()]);
    };
    const rmNewChild = (id: string) => setNewChildren(prev => prev.filter(c => c.id !== id));
    const updNewChild = (id: string, f: keyof Omit<ChildEntry, 'id'>, v: any) =>
        setNewChildren(prev => prev.map(c => c.id === id ? { ...c, [f]: v } : c));

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
                if (photo) {
                    const fdUpdate = new FormData();
                    fdUpdate.append('face_photo', b64toFile(photo, `face_${Date.now()}.jpg`));
                    await pb.collection('parents').update(pid, fdUpdate);
                }
            } else {
                fd.append('loyalty_points', '0');
                fd.append('total_visits', '0');
                pid = (await pb.collection('parents').create(fd)).id;
            }

            const allChildIds: string[] = [...selectedKidIds];
            const createdChildrenObjects = [];

            for (const c of newChildren) {
                if (!c.name.trim() || !c.birth_date) continue;
                const rec = await pb.collection('children').create({ name: c.name, birth_date: c.birth_date, parent: pid, allergies: c.allergies || '' });
                allChildIds.push(rec.id);
                createdChildrenObjects.push({
                    id: rec.id,
                    name: c.name,
                    birth_date: c.birth_date,
                    parent: pid!,
                    allergies: c.allergies
                });
            }

            const fullParent: Parent = {
                id: pid!, name: pName, phone: pPhone, email: pEmail,
                face_photo: selParent?.face_photo || '', loyalty_points: selParent?.loyalty_points || 0,
                total_visits: selParent?.total_visits || 0,
            };

            const allChildObjs: Child[] = [
                ...existingKids.filter(k => selectedKidIds.has(k.id)),
                ...createdChildrenObjects as Child[],
            ];

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
        setNewChildren([]);
    };

    const hasPhoto = photo !== null || existingUrl !== null;
    const validNewChildren = newChildren.filter(c => c.name.trim());
    const totalKids = selectedKidIds.size + validNewChildren.filter(c => c.name.trim().length >= 2 && c.birth_date).length;

    const valid =
        pName.trim().length >= 2 && pPhone.length === 10 && hasPhoto && totalKids > 0 &&
        validNewChildren.every(c => !c.name.trim() || (c.name.trim().length >= 2 && c.birth_date !== ''));

    return (
        <div className="bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 flex flex-col overflow-hidden h-full rounded-2xl relative shadow-sm border border-slate-200 dark:border-slate-800">
            {/* Header */}
            <header className="flex-none flex items-center justify-between bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 z-20">
                <div className="flex items-center gap-4 text-slate-900 dark:text-white">
                    <div className="size-8 rounded-lg bg-blue-600/10 flex items-center justify-center text-blue-600">
                        <Shield className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-bold tracking-tight">AstroPlay Security Check-In</h2>
                </div>
                <div className="flex items-center gap-6">
                    <div className="hidden md:flex flex-col items-end">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Terminal Principal</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">ID: #492-AX</span>
                    </div>
                    {/* Active park state */}
                    <div className="flex items-center gap-2 bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 px-3 py-1.5 rounded-lg border border-orange-200 dark:border-orange-500/30">
                        <Activity className="w-4 h-4" />
                        <span className="text-sm font-bold">{activeKidsCount} Niños en parque</span>
                    </div>
                </div>
            </header>

            {/* Main Content Grid */}
            <main className="flex-1 min-h-0 bg-slate-50 dark:bg-slate-950 relative flex flex-col">
                {success && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 border border-emerald-400 text-white rounded-xl px-4 py-3 flex items-center gap-2.5 shadow-xl animate-in fade-in slide-in-from-top-4">
                        <CheckCircle2 className="w-5 h-5 shrink-0" />
                        <span className="font-semibold text-sm">{success}</span>
                    </div>
                )}
                <div className="flex-1 w-full p-4 md:p-6 overflow-y-auto lg:overflow-hidden">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-auto lg:h-full max-w-[1600px] mx-auto min-h-0">

                        {/* Col 1: Biometric Capture */}
                        <div className="lg:col-span-3 flex flex-col gap-4 min-h-[500px] lg:min-h-0">
                            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-5 flex-1 flex flex-col items-center min-h-0 overflow-y-auto custom-scrollbar">
                                <div className="w-full flex justify-between items-center mb-6 shrink-0">
                                    <h3 className="text-lg font-bold">Biometría</h3>
                                    <span className={`px-2 py-1 text-xs font-bold rounded uppercase tracking-wider ${camOn ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                                        {camOn ? 'Activo' : 'Pausado'}
                                    </span>
                                </div>
                                <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden bg-slate-900 mb-6 group ring-4 ring-slate-100 dark:ring-slate-800">
                                    {camOn && !photo && !existingUrl ? (
                                        <Webcam audio={false} ref={wcRef} screenshotFormat="image/jpeg"
                                            videoConstraints={{ facingMode: 'user' }}
                                            className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />
                                    ) : photo ? (
                                        <img src={photo} alt="" className="absolute inset-0 w-full h-full object-cover" />
                                    ) : existingUrl ? (
                                        <img src={existingUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center"><Camera className="w-10 h-10 text-slate-700" /></div>
                                    )}

                                    {/* Scanner Overlay */}
                                    {camOn && !photo && !existingUrl && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className="w-[80%] h-[60%] border-2 border-white/50 rounded-[3rem] relative overflow-hidden">
                                                <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500/80 shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-[scan_2s_ease-in-out_infinite]"></div>
                                                <div className="absolute inset-0 border-[20px] border-slate-900/40 rounded-[3rem]"></div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                                        <button className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 transition-all shrink-0">
                                            <SwitchCamera className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-auto w-full space-y-3 shrink-0">
                                    <div className="text-center text-slate-500 text-sm mb-4">Alinee el rostro con el marco para validación.</div>
                                    {camOn && !photo && !existingUrl ? (
                                        <Button onClick={capture} className="w-full h-12 rounded-xl text-base font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2">
                                            <Camera className="w-5 h-5" /> Capturar Foto
                                        </Button>
                                    ) : (
                                        <Button variant="secondary" onClick={retake} className="w-full h-12 rounded-xl font-semibold transition-all flex items-center justify-center gap-2">
                                            <RefreshCw className="w-4 h-4" /> Reintentar
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Col 2: Tutor Information */}
                        <div className="lg:col-span-5 flex flex-col gap-4 min-h-[500px] lg:min-h-0">
                            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 flex-1 flex flex-col gap-6 min-h-0">
                                <div className="flex justify-between items-start shrink-0">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Responsable</h3>
                                        <p className="text-slate-500 text-sm">Datos del adulto a cargo</p>
                                    </div>
                                    {selParent && (
                                        <div className="flex flex-col items-end">
                                            {selParent.total_visits && selParent.total_visits > 5 ? (
                                                <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-3 py-1 rounded-lg text-xs font-bold uppercase mb-1 border border-amber-200 dark:border-amber-700/50">VIP Member</div>
                                            ) : (
                                                <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-lg text-xs font-bold uppercase mb-1 border border-emerald-200 dark:border-emerald-700/50">Astro Client</div>
                                            )}
                                            <div className="flex items-center gap-1.5 text-slate-900 dark:text-white">
                                                <span className="text-2xl font-black">{(selParent.total_visits || 0) + 1}</span>
                                                <span className="text-xs font-medium text-slate-500 uppercase leading-none">Visitas<br />Totales</span>
                                            </div>
                                            <button onClick={reset} className="text-[10px] text-red-500 uppercase font-bold mt-2 hover:underline flex items-center gap-1 bg-red-50 dark:bg-red-950 px-2 py-1 rounded">
                                                <X className="w-3 h-3" /> Cambiar
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* AstroCard Search */}
                                {!selParent && (
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 relative z-30" ref={boxRef}>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Búsqueda / Teléfono / Nombre</label>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <Input value={pName} onChange={onName} placeholder="Buscar cliente..." type="text"
                                                    className="w-full h-12 pl-11 pr-4 rounded-xl border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 font-medium shadow-sm transition-colors" />
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                                    <Search className="w-5 h-5" />
                                                </div>
                                                {searching && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
                                            </div>
                                            <Button size="icon" className="h-12 w-12 rounded-xl shadow-md transition-colors shrink-0">
                                                <Scan className="w-5 h-5" />
                                            </Button>
                                        </div>
                                        {/* Dropdown */}
                                        {showDrop && results.length > 0 && (
                                            <div ref={ddRef} className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-[250px] overflow-y-auto z-40">
                                                {results.map(p => (
                                                    <button key={p.id} onClick={() => pickParent(p)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left border-b border-slate-100 dark:border-slate-700 last:border-0">
                                                        <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shrink-0">
                                                            {p.face_photo ? <img src={pb.files.getURL(p as any, p.face_photo)} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><User className="w-5 h-5 text-slate-400" /></div>}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{p.name}</p>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">{p.phone}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Form Fields */}
                                <div className="space-y-4 flex-1 overflow-y-auto pr-1 custom-scrollbar pb-2 min-h-0">
                                    <div className="group">
                                        <Label className="mb-1.5 text-slate-700 dark:text-slate-300">Nombre Completo *</Label>
                                        <div className="relative">
                                            <Input value={pName} onChange={e => { setPName(e.target.value); if (selParent) { setSelParent({ ...selParent, name: e.target.value }); } }}
                                                className="w-full h-12 md:h-14 pl-4 pr-11 rounded-lg bg-slate-50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 transition-all text-base md:text-lg font-semibold text-slate-900 dark:text-white" />
                                            {pName.length >= 2 && (
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500">
                                                    <CheckCircle2 className="w-5 h-5" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="group">
                                        <Label className="mb-1.5 text-slate-700 dark:text-slate-300">Teléfono Móvil (10 dígitos) *</Label>
                                        <div className="relative">
                                            <Input value={pPhone} onChange={e => { onPhone(e); if (selParent) setSelParent({ ...selParent, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }) }} type="tel"
                                                className="w-full h-12 md:h-14 pl-4 pr-11 rounded-lg bg-slate-50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 transition-all text-base md:text-lg font-semibold text-slate-900 dark:text-white" />
                                            {pPhone.length === 10 && (
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500">
                                                    <CheckCircle2 className="w-5 h-5" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="group">
                                        <Label className="mb-1.5 text-slate-700 dark:text-slate-300">Correo Electrónico</Label>
                                        <div className="relative">
                                            <Input value={pEmail} onChange={e => { setPEmail(e.target.value); if (selParent) setSelParent({ ...selParent, email: e.target.value }) }} type="email"
                                                className="w-full h-12 md:h-14 pl-4 pr-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 transition-all text-base md:text-lg font-semibold text-slate-900 dark:text-white" />
                                        </div>
                                    </div>

                                    {!selParent && (
                                        <div className="pt-4 border-t border-slate-100 dark:border-slate-700 mt-2">
                                            <div className="flex items-start gap-3">
                                                <input defaultChecked className="mt-1 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-600 cursor-pointer" type="checkbox" />
                                                <span className="text-sm text-slate-600 dark:text-slate-400">Acepto los términos de responsabilidad civil y cuidado de menores.</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Col 3: Children & Bracelets */}
                        <div className="lg:col-span-4 flex flex-col gap-4 min-h-[500px] lg:min-h-0">
                            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 flex-1 flex flex-col min-h-0">
                                <div className="flex justify-between items-center mb-6 shrink-0">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Niños</h3>
                                        <p className="text-slate-500 text-sm">Asignación de perfiles</p>
                                    </div>
                                    <Button variant="outline" onClick={addNewChild} className="px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors text-blue-600 border-blue-200 hover:bg-blue-50">
                                        <Plus className="w-4 h-4" /> Registrar Niño
                                    </Button>
                                </div>

                                {/* Child List */}
                                <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-4 custom-scrollbar min-h-0">

                                    {/* Existing Kids */}
                                    {existingKids.map((kid, idx) => {
                                        const isSelected = selectedKidIds.has(kid.id);
                                        const themeColors = idx % 2 === 0 ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400';

                                        return (
                                            <div key={kid.id} className={`rounded-xl border p-4 transition-all relative overflow-hidden group cursor-pointer ${isSelected ? 'bg-white dark:bg-slate-800 border-blue-500 shadow-sm ring-1 ring-blue-500' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 opacity-70 hover:opacity-100'}`} onClick={() => toggleKid(kid.id)}>
                                                <div className="flex gap-4 items-start pointer-events-none">
                                                    <div className={`size-14 rounded-full flex items-center justify-center flex-shrink-0 ${themeColors}`}>
                                                        {idx % 2 === 0 ? <User className="w-8 h-8" /> : <Smile className="w-8 h-8" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start">
                                                            <input
                                                                className="font-bold text-slate-900 dark:text-white bg-transparent border-none focus:outline-none focus:ring-0 p-0 m-0 w-full truncate pointer-events-auto"
                                                                value={kid.name}
                                                                onChange={e => {
                                                                    const val = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
                                                                    setExistingKids(prev => prev.map(k => k.id === kid.id ? { ...k, name: val } : k));
                                                                }}
                                                            />
                                                            <div className="pointer-events-auto ml-2 shrink-0">
                                                                {isSelected ? <CheckCircle2 className="w-5 h-5 text-blue-600" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600"></div>}
                                                            </div>
                                                        </div>
                                                        <p className="text-sm text-slate-500 mb-2">Registrado</p>
                                                        <div className="relative mt-2 pointer-events-auto">
                                                            <input
                                                                className="text-xs font-medium text-slate-600 dark:text-slate-400 bg-transparent border-none focus:outline-none focus:ring-0 p-0 m-0 w-full"
                                                                placeholder="Alergias o notas médicas"
                                                                value={kid.allergies || ''}
                                                                onChange={e => setExistingKids(prev => prev.map(k => k.id === kid.id ? { ...k, allergies: e.target.value } : k))}
                                                            />
                                                        </div>
                                                        {isSelected && (
                                                            <div className="relative mt-3 pointer-events-auto" onClick={e => e.stopPropagation()}>
                                                                <label className="text-[10px] uppercase font-bold text-slate-400 absolute -top-2 left-2 bg-white dark:bg-slate-800 px-1">ID Pulsera (Opcional)</label>
                                                                <div className="flex items-center border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden h-10 group-focus-within:border-blue-600 transition-colors bg-white dark:bg-slate-900">
                                                                    <div className="bg-slate-50 dark:bg-slate-800 h-full px-2 flex items-center justify-center text-slate-400">
                                                                        <Watch className="w-4 h-4" />
                                                                    </div>
                                                                    <input className="w-full h-full border-0 focus:ring-0 text-sm font-bold pl-2 bg-transparent text-slate-900 dark:text-white" placeholder="Escanear..." type="text" />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}

                                    {/* New Kids Form Cards */}
                                    {newChildren.map((nc, idx) => {
                                        const globalIdx = existingKids.length + idx;
                                        const themeColors = globalIdx % 2 === 0 ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400';

                                        return (
                                            <div key={nc.id} className="rounded-xl border p-4 transition-all relative overflow-hidden group bg-white dark:bg-slate-800 border-blue-500 shadow-sm ring-1 ring-blue-500">
                                                <div className="flex gap-4 items-start">
                                                    <div className={`size-14 rounded-full flex items-center justify-center flex-shrink-0 ${themeColors}`}>
                                                        {globalIdx % 2 === 0 ? <User className="w-8 h-8" /> : <Smile className="w-8 h-8" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start">
                                                            <input
                                                                className="font-bold text-slate-900 dark:text-white bg-transparent border-none focus:outline-none focus:ring-0 p-0 m-0 w-full truncate placeholder-slate-400 dark:placeholder-slate-500"
                                                                placeholder="Nombre completo *"
                                                                value={nc.name}
                                                                onChange={e => onChildName(nc.id, e.target.value)}
                                                            />
                                                            <div className="ml-2 shrink-0">
                                                                <button onClick={() => rmNewChild(nc.id)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 -m-1.5 rounded-lg transition-colors">
                                                                    <Trash2 className="w-5 h-5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2">Nuevo Registro</p>

                                                        <div className="mt-3 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 space-y-3">
                                                            <div>
                                                                <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1 block">Nacimiento *</label>
                                                                <div className="relative z-50">
                                                                    <DatePicker value={nc.birth_date} onChange={d => updNewChild(nc.id, 'birth_date', d)} maxDate={TODAY} />
                                                                </div>
                                                            </div>
                                                            <div className="relative mt-2">
                                                                <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-0.5 block">Alergias o notas médicas</label>
                                                                <input
                                                                    className="text-xs font-medium text-slate-600 dark:text-slate-400 bg-transparent border-none focus:outline-none focus:ring-0 p-0 m-0 w-full placeholder-slate-400 dark:placeholder-slate-500"
                                                                    placeholder="Especifique si tiene"
                                                                    value={nc.allergies || ''}
                                                                    onChange={e => updNewChild(nc.id, 'allergies', e.target.value)}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}

                                    {totalKids === 0 && newChildren.length === 0 && (
                                        <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col items-center justify-center text-center py-8 opacity-70">
                                            <Baby className="w-10 h-10 text-slate-400 mb-2" />
                                            <p className="text-sm text-slate-500 font-medium">No hay niños seleccionados.<br />Escanee para cargar perfiles o añada manualmente.</p>
                                        </div>
                                    )}

                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </main>

            {/* Fixed Footer Action Bar */}
            <footer className="flex-none bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 z-30 rounded-b-2xl">
                <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-6 px-2">
                    <div className="hidden md:flex items-center gap-4 opacity-50">
                        <div className="flex flex-col">
                            <span className="text-xs text-slate-500 font-bold uppercase">Total Estimado</span>
                            <span className="text-xl font-black text-slate-900 dark:text-white">--</span>
                        </div>
                        <div className="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>
                        <div className="flex flex-col">
                            <span className="text-xs text-slate-500 font-bold uppercase">Paquete</span>
                            <span className="text-sm font-bold">Selección en POS</span>
                        </div>
                    </div>
                    <Button onClick={register} disabled={!valid || submitting} className="flex-1 md:flex-none md:w-[600px] h-14 rounded-2xl font-black text-sm md:text-lg tracking-wide uppercase transition-all transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-3 shadow-sm">
                        <ShieldCheck className="w-5 h-5 md:w-6 md:h-6" />
                        {submitting ? 'Procesando...' : 'Guardar y Continuar a POS'}
                    </Button>

                    <div className="hidden md:flex items-center gap-2 text-slate-400">
                        <Printer className="w-4 h-4" />
                        <span className="text-xs font-medium">Brazaletes auto-impresos en POS</span>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default SecurityCheckIn;
