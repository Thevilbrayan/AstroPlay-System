import React, { useState, useEffect } from 'react';
import { User, ShieldAlert, Phone, BarChart2, Bell, Play, Pause, Plus, Trash2, CheckSquare } from 'lucide-react';
import { Child, Session, Parent } from '../../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Card } from '../ui/card';
import { pb } from '../../lib/pocketbase';
import SessionActionBar from './SessionActionBar';
import AdminPinModal from './AdminPinModal';
import ModalAlert from '../ui/ModalAlert';
import { Button } from '../ui/button';
import OvertimeSettlementModal from './OvertimeSettlementModal';
import { useCartActionStore } from '../../store/cartAction.store';

export interface SessionTimerCardProps {
    child: Child;
    session: Session;
    parent: Parent;
    onPauseSession?: () => void;
    onAlertOvertime?: () => void;
    onExtend?: (minutes: number) => void;
    onCancel?: () => void;
}

const SessionTimerCard: React.FC<SessionTimerCardProps> = ({
    child,
    session,
    parent,
    onPauseSession,
    onAlertOvertime,
    onExtend,
    onCancel
}) => {
    const [timeLeft, setTimeLeft] = useState(session.remaining_seconds || 0);
    const [isPaused, setIsPaused] = useState(session.status === 'paused');
    const [showPhotoModal, setShowPhotoModal] = useState(false);
    const [showCancelPinModal, setShowCancelPinModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showFinishConfirm, setShowFinishConfirm] = useState(false);

    // Overtime Modal State
    const [showOvertimeModal, setShowOvertimeModal] = useState(false);
    const [exceededMins, setExceededMins] = useState(0);
    const [sessionBasePrice, setSessionBasePrice] = useState(100);

    // Touch handling for swipes (Logic only, no visual transform to prevent layout breaks)
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEndHandler = () => {
        if (!touchStart || !touchEnd) return;

        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe) {
            // Swipe Left to "Alert Overtime"
            onAlertOvertime?.();
        } else if (isRightSwipe) {
            // Swipe Right to "Pause Session"
            onPauseSession?.();
            setIsPaused(!isPaused);
        }
    };

    // Real-time countdown
    useEffect(() => {
        // If paused, we don't tick the clock locally.
        // We ensure we show the remaining_seconds from the DB if it exists.
        if (isPaused) {
            if (session.remaining_seconds !== undefined && session.remaining_seconds !== null) {
                setTimeLeft(session.remaining_seconds);
            }
            return;
        }

        if (!session.end_time) return;

        const updateClock = () => {
            const endMs = new Date(session.end_time!).getTime();
            const nowMs = Date.now();
            const diffSecs = Math.floor((endMs - nowMs) / 1000);
            setTimeLeft(diffSecs);
        };

        updateClock();
        const interval = setInterval(updateClock, 1000);
        return () => clearInterval(interval);
    }, [session.end_time, isPaused, session.remaining_seconds]);

    const formatTimeLeft = (secs: number) => {
        const isNeg = secs < 0;
        const absSecs = Math.abs(secs);
        const m = Math.floor(absSecs / 60);
        const s = absSecs % 60;
        const sign = isNeg ? '-' : '';
        return `${sign}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Card styling logic
    const isOvertime = timeLeft <= 0;
    const isWarning = !isOvertime && timeLeft <= 15 * 60; // <= 15 mins

    let statusBorderClass = "border-l-emerald-500 border-l-[12px]";
    let statusBgClass = "bg-white dark:bg-slate-900";
    let timerColorClass = "text-slate-900 dark:text-white";
    let timerIconColor = "text-emerald-500 opacity-0";

    if (isOvertime) {
        statusBorderClass = "border-l-red-500 border-l-[12px]";
        statusBgClass = "bg-red-50/50 dark:bg-red-950/20";
        timerColorClass = "text-red-500";
        timerIconColor = "text-red-400";
    } else if (isWarning) {
        statusBorderClass = "border-l-amber-400 border-l-[12px]";
        statusBgClass = "bg-orange-50/50 dark:bg-orange-950/20";
        timerColorClass = "text-amber-500";
        timerIconColor = "text-amber-400";
    } else if (isPaused) {
        // Paused specifically
        statusBorderClass = "border-l-slate-400 border-l-[12px]";
        timerColorClass = "text-slate-500";
        timerIconColor = "text-slate-400";
    }

    const handlePauseToggle = async () => {
        const willBePaused = !isPaused;
        setIsPaused(willBePaused);

        try {
            if (willBePaused) {
                // We are Pausing
                await pb.collection('sessions').update(session.id, {
                    status: 'paused',
                    paused_at: new Date().toISOString(),
                    remaining_seconds: timeLeft
                });
            } else {
                // We are Resuming
                const nowMs = Date.now();
                const newEndTime = new Date(nowMs + (timeLeft * 1000));
                await pb.collection('sessions').update(session.id, {
                    status: 'active',
                    paused_at: null,
                    remaining_seconds: null,
                    end_time: newEndTime.toISOString()
                });
            }
        } catch (error) {
            console.error("Error toggling pause state in DB:", error);
            alert("Error: No se pudo actualizar el estado de la base de datos. ¿Importaste el esquema de PocketBase con los nuevos campos?");
            // Revert optimistic UI on failure
            setIsPaused(!willBePaused);
        }

        onPauseSession?.();
    };

    const handleCancelSession = async () => {
        try {
            // For now just marking it finished with a cancel_reason.
            // A fully implemented refund would also hit the `sales` collection.
            await pb.collection('sessions').update(session.id, {
                status: 'finished',
                cancel_reason: 'Cancelado por Administrador'
            });
            alert("Sesión Cancelada Exitosamente.");
        } catch (error) {
            console.error("Error cancelling session:", error);
            alert("Error al intentar cancelar la sesión.");
        }
    };

    const handleFinishSession = async () => {
        const GRACE_PERIOD = 5;
        try {
            if (session.end_time) {
                const nowMs = Date.now();
                const endMs = new Date(session.end_time).getTime();
                const diffMins = Math.floor((nowMs - endMs) / 60000);

                if (diffMins > GRACE_PERIOD) {
                    // Try to fetch original price
                    let basePrice = 100; // default fallback amount
                    if (session.sale) {
                        try {
                            const saleItems = await pb.collection('sales_items').getFullList({
                                filter: `sale = '${session.sale}'`,
                                expand: 'product'
                            });
                            const serviceItems = saleItems.filter((i: any) => i.expand?.product?.category === 'service');
                            if (serviceItems.length > 0) {
                                const prices = serviceItems.map((item: any) => item.unit_price);
                                basePrice = Math.max(...prices);
                            } else if (saleItems.length > 0) {
                                const prices = saleItems.map((item: any) => item.unit_price);
                                basePrice = Math.max(...prices);
                            }
                        } catch (e) {
                            console.error("Error fetching base price", e);
                        }
                    }

                    setExceededMins(diffMins);
                    setSessionBasePrice(basePrice);
                    setShowDetailModal(false);
                    setShowFinishConfirm(false);
                    setShowOvertimeModal(true);
                    return; // intercept normal finish
                }
            }

            await pb.collection('sessions').update(session.id, {
                status: 'finished'
            });
            setShowDetailModal(false);
            setShowFinishConfirm(false);
        } catch (error) {
            console.error("Error finishing session:", error);
            alert("Error al finalizar la sesión.");
        }
    };

    const handleChargeOvertime = (child: Child, session: Session, basePrice: number) => {
        useCartActionStore.getState().setPendingAction({
            type: 'ADD_OVERTIME',
            session,
            child,
            basePrice
        });

        // Temporarily mark as pending settlement
        pb.collection('sessions').update(session.id, { status: 'pending_settlement' }).catch(console.error);

        setShowOvertimeModal(false);
        if (onExtend) onExtend(0); // This navigates back via TimeDashboard
    };

    const handleForgiveOvertime = async () => {
        try {
            await pb.collection('sessions').update(session.id, {
                status: 'finished'
            });
            setShowOvertimeModal(false);
            alert("Sesión perdonada y finalizada.");
        } catch (error) {
            console.error("Error", error);
            alert("Error al perdonar la sesión");
        }
    };

    const parentPhotoUrl = parent?.face_photo ? pb.files.getURL(parent as any, parent.face_photo) : null;

    return (
        <React.Fragment>
            <Card
                className={`w-full relative overflow-hidden transition-all duration-300 shadow-sm hover:shadow-md ${statusBorderClass} ${statusBgClass} rounded-2xl border-y border-r flex flex-col`}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEndHandler}
                onClick={() => setShowDetailModal(true)}
            >
                <div className="p-5 flex flex-col h-full cursor-pointer relative">

                    {/* Top Row: Name & ID */}
                    <div className="flex justify-between items-start mb-6">
                        <h3 className="font-ex font-black text-2xl text-slate-800 dark:text-white truncate pr-2 tracking-tight" title={child.name}>
                            {child.name.split(' ')[0]}
                        </h3>
                        <span className="font-mono text-xs font-bold px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-md shrink-0 tracking-wider">
                            #{session.sale?.slice(-4).toUpperCase() || session.id.slice(-4).toUpperCase()}
                        </span>
                    </div>

                    {/* Middle Row: Large Digital Countdown */}
                    <div className="py-2 mb-6 flex items-center min-w-0">
                        {/* Left decorative bars icon like the mockup */}
                        {(isWarning || isOvertime) && (
                            <BarChart2 className={`w-8 h-8 mr-2 shrink-0 ${timerIconColor}`} />
                        )}
                        <span className={`font-mono text-5xl sm:text-6xl font-black tracking-tighter truncate ${timerColorClass}`}>
                            {formatTimeLeft(timeLeft)}
                        </span>
                        {/* Right decorative bell icon like the mockup */}
                        {(isWarning || isOvertime) && (
                            <div className="ml-2 mt-auto pb-1 shrink-0 relative">
                                <Bell className={`w-6 h-6 ${timerIconColor}`} />
                                {isWarning && <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-amber-400 -rotate-45 transform origin-center"></div>}
                                {isOvertime && <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-400 -rotate-45 transform origin-center"></div>}
                            </div>
                        )}
                    </div>

                    {/* Bottom Row: Parent Info & Allergy */}
                    <div className="mt-auto flex justify-between items-end">
                        <div className="flex flex-col gap-1 overflow-hidden mb-2">
                            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                <User className="w-4 h-4 shrink-0" />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{parent?.name || 'Venta Directa'}</span>
                            </div>
                            {parent?.phone && (
                                <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 ml-6">
                                    <Phone className="w-3.5 h-3.5 shrink-0" />
                                    <span className="text-xs font-medium">{parent.phone}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-end w-full mb-2">
                            {child.allergies && child.allergies.trim() !== '' && (
                                <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded-full" title="Alergias registradas">
                                    <ShieldAlert className="w-5 h-5 text-red-500" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Action Bar */}
                    <SessionActionBar
                        session={session}
                        isPaused={isPaused}
                        onPauseToggle={handlePauseToggle}
                        onExtend={(minutes: number) => {
                            if (navigator.vibrate) navigator.vibrate(50);
                            // This routes to POS
                            if (onExtend) onExtend(minutes);
                        }}
                        onCancel={() => {
                            if (onCancel) onCancel();
                            setShowCancelPinModal(true);
                        }}
                        onFinish={() => setShowFinishConfirm(true)}
                    />
                </div>
            </Card>

            {/* ─── SESSION DETAIL MODAL ─── */}
            <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
                <DialogContent className="sm:max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-0 overflow-hidden shadow-2xl rounded-2xl">
                    {/* Header with Parent Photo */}
                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-black dark:to-slate-900 p-6 flex flex-col items-center text-center border-b border-slate-700">
                        <div className="w-24 h-24 rounded-[1.5rem] overflow-hidden bg-slate-700 mb-4 shadow-inner ring-4 ring-white/10 flex items-center justify-center">
                            {parentPhotoUrl ? (
                                <img src={parentPhotoUrl} alt="Foto Padre" className="w-full h-full object-cover" />
                            ) : (
                                <User className="w-12 h-12 text-slate-500" />
                            )}
                        </div>
                        <DialogTitle className="text-xl font-black text-white">
                            {child.name}
                        </DialogTitle>
                        <p className="text-slate-400 text-sm mt-1">
                            Responsable: <span className="text-white font-bold">{parent?.name || 'Venta Directa'}</span>
                        </p>
                        {parent?.phone && (
                            <a href={`tel:${parent.phone}`} className="mt-2 text-blue-400 text-sm font-medium hover:underline flex items-center gap-1">
                                <Phone className="w-3.5 h-3.5" /> {parent.phone}
                            </a>
                        )}
                    </div>

                    {/* Timer & Status */}
                    <div className="p-6 flex flex-col items-center">
                        <div className="flex items-center gap-3 mb-6">
                            <span className={`font-mono text-5xl font-black tracking-tighter ${timerColorClass}`}>
                                {formatTimeLeft(timeLeft)}
                            </span>
                            {isPaused && (
                                <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-full uppercase tracking-wide">
                                    Pausado
                                </span>
                            )}
                        </div>

                        {/* Allergy Warning */}
                        {child.allergies && child.allergies.trim() !== '' && (
                            <div className="w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 mb-4 flex items-center gap-3">
                                <ShieldAlert className="w-5 h-5 text-red-500 shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-red-600 dark:text-red-400">Alergias</p>
                                    <p className="text-sm text-red-700 dark:text-red-300">{child.allergies}</p>
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="w-full grid grid-cols-2 gap-3">
                            <Button
                                variant="outline"
                                className={`h-14 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-95 ${isPaused
                                    ? 'bg-amber-500 hover:bg-amber-600 text-white border-transparent'
                                    : 'border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-400 dark:hover:bg-amber-950/30'
                                    }`}
                                onClick={(e) => { e.stopPropagation(); handlePauseToggle(); }}
                            >
                                {isPaused ? <><Play className="w-5 h-5" /> Reanudar</> : <><Pause className="w-5 h-5" /> Pausar</>}
                            </Button>

                            <Button
                                variant="outline"
                                className="h-14 rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-900/50 dark:text-blue-400 dark:hover:bg-blue-950/30 font-bold text-base flex items-center justify-center gap-2 active:scale-95"
                                onClick={() => { if (onExtend) onExtend(15); setShowDetailModal(false); }}
                            >
                                <Plus className="w-5 h-5" /> Más Tiempo
                            </Button>

                            <Button
                                variant="outline"
                                className="h-14 rounded-xl border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30 font-bold text-base flex items-center justify-center gap-2 active:scale-95"
                                onClick={() => { setShowDetailModal(false); setShowCancelPinModal(true); }}
                            >
                                <Trash2 className="w-5 h-5" /> Cancelar
                            </Button>

                            <Button
                                className="h-14 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-base flex items-center justify-center gap-2 shadow-emerald-500/20 shadow-lg active:scale-95"
                                onClick={() => { setShowDetailModal(false); setShowFinishConfirm(true); }}
                            >
                                <CheckSquare className="w-5 h-5" /> Finalizar
                            </Button>
                        </div>

                        {/* View Security Photo */}
                        <button
                            className="mt-4 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-semibold underline underline-offset-4"
                            onClick={() => { setShowDetailModal(false); setShowPhotoModal(true); }}
                        >
                            Ver Foto de Seguridad
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Cancel Session PIN Modal */}
            <AdminPinModal
                isOpen={showCancelPinModal}
                onClose={() => setShowCancelPinModal(false)}
                onSuccess={handleCancelSession}
                actionDescription={`Autoriza la cancelación de la sesión de ${child.name}.`}
            />

            {/* Finish Session Confirmation */}
            <ModalAlert
                isOpen={showFinishConfirm}
                type="warning"
                title="¿Finalizar Sesión?"
                message={`Estás a punto de finalizar la sesión de ${child.name}. Esta acción cerrará el cronómetro y no se podrá revertir.`}
                confirmText="Sí, Finalizar"
                cancelText="No, Regresar"
                onClose={() => setShowFinishConfirm(false)}
                onConfirm={handleFinishSession}
            />

            {/* Security Photo Modal */}
            <Dialog open={showPhotoModal} onOpenChange={setShowPhotoModal}>
                <DialogContent className="sm:max-w-md text-center p-6 bg-white dark:bg-slate-900">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex flex-col items-center">
                            Verificación de Seguridad
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col items-center justify-center py-4">
                        <div className="w-48 h-48 rounded-[2rem] overflow-hidden bg-slate-100 dark:bg-slate-800 mb-6 shadow-inner ring-4 ring-slate-50 dark:ring-slate-900 flex items-center justify-center">
                            {parentPhotoUrl ? (
                                <img src={parentPhotoUrl} alt="Foto Padre" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800">
                                    <User className="w-20 h-20 mb-3 opacity-20" />
                                    <span className="text-sm font-medium">Sin foto registrada</span>
                                </div>
                            )}
                        </div>
                        <h4 className="text-2xl font-black text-slate-900 dark:text-white mb-1">{parent?.name || 'Venta Directa'}</h4>
                        <p className="text-slate-500 dark:text-slate-400 font-medium bg-slate-100 dark:bg-slate-800 px-4 py-1.5 rounded-full text-sm">
                            Responsable de: <span className="text-slate-700 dark:text-slate-300 font-bold">{child.name}</span>
                        </p>

                        {parent?.phone && (
                            <a href={`tel:${parent.phone}`} className="mt-6 w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors font-bold text-lg">
                                <Phone className="w-5 h-5" /> Llamar Padre: {parent.phone}
                            </a>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Overtime Modal */}
            <OvertimeSettlementModal
                isOpen={showOvertimeModal}
                onClose={() => setShowOvertimeModal(false)}
                session={session}
                child={child}
                exceededMins={exceededMins}
                basePrice={sessionBasePrice}
                onCharge={handleChargeOvertime}
                onForgive={handleForgiveOvertime}
            />
        </React.Fragment>
    );
};

export default SessionTimerCard;
