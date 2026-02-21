import React, { useState, useEffect } from 'react';
import { Play, Pause, BellOff, BellRing, User, Phone, LogOut, Plus, AlertTriangle } from 'lucide-react';
import { Child, Session } from '../../types';

interface SessionTimerCardProps {
    child: Child;
    session: Session;
    parentPhone?: string;
    onPlayPause?: () => void;
    onToggleAlert?: () => void;
    onExtend?: () => void;
    onCheckout?: () => void;
    totalMinutes?: number; // Total session duration, default 60
}

const SessionTimerCard: React.FC<SessionTimerCardProps> = ({
    child,
    session,
    parentPhone,
    onPlayPause,
    onToggleAlert,
    onExtend,
    onCheckout,
    totalMinutes = 60
}) => {
    const [timeLeft, setTimeLeft] = useState(0); // in seconds
    const [isPaused, setIsPaused] = useState(false);
    const [alertsMuted, setAlertsMuted] = useState(false);

    // Calculate age
    const calcAge = (birthDate: string) => {
        const diffMs = Date.now() - new Date(birthDate).getTime();
        const ageDt = new Date(diffMs);
        return Math.abs(ageDt.getUTCFullYear() - 1970);
    };

    // Real-time countdown
    useEffect(() => {
        if (!session.end_time || isPaused) return;

        const updateClock = () => {
            const endMs = new Date(session.end_time!).getTime();
            const nowMs = Date.now();
            const diffSecs = Math.floor((endMs - nowMs) / 1000);
            setTimeLeft(diffSecs);
        };

        updateClock();
        const interval = setInterval(updateClock, 1000);
        return () => clearInterval(interval);
    }, [session.end_time, isPaused]);

    const formatTimeLeft = (secs: number) => {
        const isNeg = secs < 0;
        const absSecs = Math.abs(secs);
        const m = Math.floor(absSecs / 60);
        const s = absSecs % 60;
        const sign = isNeg ? '-' : '';
        return `${sign}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Calculate progress (0 to 1) for the SVG Circle
    const totalSeconds = totalMinutes * 60;
    const elapsedSeconds = totalSeconds - timeLeft;
    const progressFull = Math.min(Math.max((elapsedSeconds / totalSeconds), 0), 1);
    const progressRemaining = 1 - progressFull; // We want the circle to deplete

    // Alert Logic & Dynamic Styling
    const isExceeded = timeLeft <= 0;
    const isWarning = !isExceeded && timeLeft < 600; // < 10 mins

    let stateTheme = {
        glow: "shadow-[0_0_30px_rgba(59,130,246,0.15)]",
        border: "border-white/10",
        textMain: "text-white",
        textNeon: "text-cyan-400",
        circleTrack: "stroke-slate-800/80",
        circleFill: "stroke-blue-500",
        circleGlow: "drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]",
        handleColor: "bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,1)]",
        buttonHover: "hover:border-blue-400 hover:text-blue-400 hover:shadow-[0_0_10px_rgba(96,165,250,0.5)]",
        pulse: "",
        badgeBg: "bg-slate-900/80",
        badgeText: "text-slate-300",
        avatarRing: "ring-blue-500/30"
    };

    if (isExceeded) {
        stateTheme = {
            glow: "shadow-[0_0_40px_rgba(239,68,68,0.25)]",
            border: "border-red-500/50",
            textMain: "text-red-500",
            textNeon: "text-red-400",
            circleTrack: "stroke-red-950/50",
            circleFill: "stroke-red-500",
            circleGlow: "drop-shadow-[0_0_12px_rgba(239,68,68,0.9)]",
            handleColor: "bg-red-300 shadow-[0_0_10px_rgba(252,165,165,1)]",
            buttonHover: "hover:border-red-400 hover:text-red-400 hover:shadow-[0_0_10px_rgba(248,113,113,0.5)]",
            pulse: "animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]",
            badgeBg: "bg-red-500/20",
            badgeText: "text-red-300",
            avatarRing: "ring-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.5)]"
        };
    } else if (isWarning) {
        stateTheme = {
            glow: "shadow-[0_0_30px_rgba(249,115,22,0.15)]",
            border: "border-orange-500/30",
            textMain: "text-orange-400",
            textNeon: "text-orange-400",
            circleTrack: "stroke-orange-950/50",
            circleFill: "stroke-orange-500",
            circleGlow: "drop-shadow-[0_0_10px_rgba(249,115,22,0.8)]",
            handleColor: "bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,1)]",
            buttonHover: "hover:border-orange-400 hover:text-orange-400 hover:shadow-[0_0_10px_rgba(251,146,60,0.5)]",
            pulse: "",
            badgeBg: "bg-orange-500/20",
            badgeText: "text-orange-300",
            avatarRing: "ring-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.3)]"
        };
    }

    // SVG Circle Math
    const circleRadius = 75;
    const circleCircumference = 2 * Math.PI * circleRadius;
    const circleDashoffset = circleCircumference * (1 - progressRemaining);

    return (
        <div className={`w-full max-w-[320px] min-w-[260px] bg-slate-950/70 backdrop-blur-xl border ${stateTheme.border} rounded-[32px] p-6 shadow-2xl ${stateTheme.glow} ${stateTheme.pulse} transition-all duration-500 relative flex flex-col font-sans`}>

            {/* Top Right Tag for Exceeded */}
            {isExceeded && (
                <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-bl-xl rounded-tr-[32px] shadow-lg shadow-red-500/50 flex items-center gap-1 z-10">
                    <AlertTriangle className="w-3 h-3" /> Tiempo Agotado
                </div>
            )}

            {/* Header: Child Info & Status */}
            <div className="flex justify-between items-start mb-6 w-full">
                <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center ring-2 ${stateTheme.avatarRing} shrink-0 overflow-hidden transition-all duration-300`}>
                        <User className="w-6 h-6 text-slate-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-100 text-base leading-tight truncate max-w-[140px]">{child.name}</h3>
                        <p className="text-xs text-slate-400">{calcAge(child.birth_date)} años</p>
                    </div>
                </div>
            </div>

            {/* Tags / Badges */}
            <div className="flex items-center gap-2 mb-4 justify-center">
                <div className={`px-2.5 py-1 ${stateTheme.badgeBg} ${stateTheme.border} border rounded-full text-[10px] font-bold ${stateTheme.badgeText} flex items-center gap-1.5 transition-colors`}>
                    <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: session.bracelet_color || '#3b82f6', boxShadow: `0 0 6px ${session.bracelet_color || '#3b82f6'}` }}
                    />
                    Pulsera
                </div>
                {session.is_gokart && (
                    <div className="px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-[10px] font-bold text-purple-300 shadow-inner tracking-wider uppercase">
                        Go-Karts
                    </div>
                )}
            </div>

            {/* Circular Timer Display */}
            <div className="flex flex-col items-center justify-center mb-8 relative">
                {/* SVG Ring Container */}
                <div className="relative flex items-center justify-center w-[180px] h-[180px]">
                    <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 180 180">
                        {/* Background Track */}
                        <circle
                            cx="90"
                            cy="90"
                            r={circleRadius}
                            className={`fill-none ${stateTheme.circleTrack}`}
                            strokeWidth="12"
                            strokeLinecap="round"
                        />
                        {/* Progress Fill */}
                        <circle
                            cx="90"
                            cy="90"
                            r={circleRadius}
                            className={`fill-none ${stateTheme.circleFill} ${stateTheme.circleGlow} transition-all duration-1000 ease-out`}
                            strokeWidth="12"
                            strokeLinecap="round"
                            strokeDasharray={circleCircumference}
                            strokeDashoffset={circleDashoffset}
                        />
                    </svg>

                    {/* Timer Text Inside Circle */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-[36px] font-mono font-bold leading-none tracking-tight ${stateTheme.textMain}`}>
                            {formatTimeLeft(timeLeft)}
                        </span>
                        <span className="text-xs text-slate-400 font-medium mt-1">
                            {totalMinutes} min
                        </span>
                    </div>
                </div>
            </div>

            {/* Footer Extended Controls */}
            <div className="grid grid-cols-4 gap-2 px-1">
                <button
                    onClick={() => { setIsPaused(!isPaused); onPlayPause?.(); }}
                    className={`w-12 h-12 rounded-full bg-slate-900 border border-transparent mx-auto flex items-center justify-center transition-all ${stateTheme.buttonHover}`}
                    title={isPaused ? "Reanudar" : "Pausar"}
                >
                    {isPaused ? <Play className="w-5 h-5" fill="currentColor" /> : <Pause className="w-5 h-5" fill="currentColor" />}
                </button>

                <button
                    onClick={onExtend}
                    className={`w-12 h-12 rounded-full bg-slate-900 border border-transparent mx-auto flex items-center justify-center transition-all ${stateTheme.buttonHover}`}
                    title="Añadir Tiempo"
                >
                    <Plus className="w-5 h-5" />
                </button>

                {parentPhone ? (
                    <button
                        className={`w-12 h-12 rounded-full bg-slate-900 border border-transparent mx-auto flex items-center justify-center transition-all ${stateTheme.buttonHover}`}
                        title="Llamar Padre"
                    >
                        <Phone className="w-5 h-5" />
                    </button>
                ) : (
                    <button
                        onClick={() => { setAlertsMuted(!alertsMuted); onToggleAlert?.(); }}
                        className={`w-12 h-12 rounded-full bg-slate-900 border border-transparent mx-auto flex items-center justify-center transition-all ${stateTheme.buttonHover} ${alertsMuted ? 'text-slate-600' : ''}`}
                        title={alertsMuted ? "Activar Alertas" : "Silenciar Alertas"}
                    >
                        {alertsMuted ? <BellOff className="w-5 h-5" /> : <BellRing className="w-5 h-5" />}
                    </button>
                )}

                <button
                    onClick={onCheckout}
                    className={`w-12 h-12 rounded-full bg-slate-900 border border-transparent mx-auto flex items-center justify-center transition-all hover:border-red-400 hover:text-red-400 hover:shadow-[0_0_10px_rgba(248,113,113,0.5)]`}
                    title="Registrar Salida"
                >
                    <LogOut className="w-5 h-5 ml-0.5" />
                </button>
            </div>
        </div>
    );
};

export default SessionTimerCard;
