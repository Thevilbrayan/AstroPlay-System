import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DatePickerProps {
    label?: string;
    value: string;
    onChange: (date: string) => void;
    placeholder?: string;
    error?: string;
    className?: string;
    maxDate?: string;
    minDate?: string;
}

const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

const DatePicker: React.FC<DatePickerProps> = ({
    label,
    value,
    onChange,
    placeholder = 'Seleccionar fecha',
    error,
    className,
    maxDate,
    minDate,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [showYearMonth, setShowYearMonth] = useState(false);
    // Always start at current date when opening — NOT the previously selected one
    const [viewDate, setViewDate] = useState(() => new Date());
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

    const updatePosition = useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const dropdownH = showYearMonth ? 340 : 320;
        const spaceBelow = window.innerHeight - rect.bottom;
        setDropdownPos({
            top: spaceBelow > dropdownH ? rect.bottom + 4 : rect.top - dropdownH - 4,
            left: Math.min(rect.left, window.innerWidth - 300),
        });
    }, [showYearMonth]);

    useEffect(() => { if (isOpen) updatePosition(); }, [isOpen, updatePosition]);

    // Reset viewDate to today every time we open
    useEffect(() => {
        if (isOpen) {
            setViewDate(new Date());
            setShowYearMonth(false);
        }
    }, [isOpen]);

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            const t = e.target as Node;
            if (triggerRef.current?.contains(t) || dropdownRef.current?.contains(t)) return;
            setIsOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const currentYear = new Date().getFullYear();

    // Generate year range: from 1950 to current year
    const years = Array.from({ length: currentYear - 1950 + 1 }, (_, i) => currentYear - i);

    const firstDayOfMonth = new Date(year, month, 1);
    let startDay = firstDayOfMonth.getDay() - 1;
    if (startDay < 0) startDay = 6;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
    const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

    const selectDate = (day: number) => {
        const selected = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (maxDate && selected > maxDate) return;
        if (minDate && selected < minDate) return;
        onChange(selected);
        setIsOpen(false);
    };

    const selectYearMonth = (y: number, m: number) => {
        setViewDate(new Date(y, m, 1));
        setShowYearMonth(false);
    };

    const isSelected = (day: number) => {
        if (!value) return false;
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` === value;
    };

    const isDisabled = (day: number) => {
        const check = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (maxDate && check > maxDate) return true;
        if (minDate && check < minDate) return true;
        return false;
    };

    const formatDisplay = (iso: string) => {
        if (!iso) return '';
        const [y, m, d] = iso.split('-');
        return `${d}/${m}/${y}`;
    };

    const cells: (number | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return (
        <div className={cn('w-full', className)}>
            {label && <label className="text-sm font-medium text-slate-400 mb-2 block">{label}</label>}

            <button
                ref={triggerRef}
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    'flex items-center gap-3 w-full h-11 rounded-xl border bg-slate-800 px-4 text-sm transition-all duration-200 hover:border-white/20 text-left',
                    error ? 'border-red-500/50' : 'border-white/10',
                    isOpen && 'ring-2 ring-blue-500/50'
                )}
            >
                <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                <span className={value ? 'text-slate-200' : 'text-slate-500'}>
                    {value ? formatDisplay(value) : placeholder}
                </span>
            </button>

            {error && <p className="text-xs text-red-400 font-medium mt-1">{error}</p>}

            {isOpen && createPortal(
                <div
                    ref={dropdownRef}
                    className="fixed z-[9999] bg-slate-900 border border-white/10 rounded-xl shadow-2xl shadow-black/60 p-3 w-[290px]"
                    style={{ top: dropdownPos.top, left: dropdownPos.left }}
                >
                    {/* Header with clickable month/year → opens year-month picker */}
                    <div className="flex items-center justify-between mb-3">
                        <button type="button" onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowYearMonth(!showYearMonth)}
                            className="flex items-center gap-1 text-sm font-semibold text-slate-200 hover:text-blue-400 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
                        >
                            {MONTHS[month]} {year}
                            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showYearMonth && 'rotate-180')} />
                        </button>
                        <button type="button" onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {showYearMonth ? (
                        /* ── Year + Month quick selector ── */
                        <div className="space-y-2">
                            {/* Year grid — scrollable */}
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Año</label>
                            <div className="h-[120px] overflow-y-auto pr-1 grid grid-cols-4 gap-1">
                                {years.map(y => (
                                    <button
                                        key={y}
                                        type="button"
                                        onClick={() => setViewDate(new Date(y, month, 1))}
                                        className={cn(
                                            'h-7 rounded-md text-xs font-medium transition-all',
                                            y === year
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                                                : 'text-slate-400 hover:bg-white/10 hover:text-white'
                                        )}
                                    >
                                        {y}
                                    </button>
                                ))}
                            </div>

                            {/* Month grid */}
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Mes</label>
                            <div className="grid grid-cols-4 gap-1">
                                {MONTHS_SHORT.map((m, i) => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => selectYearMonth(year, i)}
                                        className={cn(
                                            'h-7 rounded-md text-xs font-medium transition-all',
                                            i === month
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                                                : 'text-slate-400 hover:bg-white/10 hover:text-white'
                                        )}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* ── Day grid ── */
                        <>
                            <div className="grid grid-cols-7 mb-1">
                                {DAYS.map(d => (
                                    <div key={d} className="text-center text-[10px] font-semibold text-slate-500 uppercase py-1">{d}</div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-0.5">
                                {cells.map((day, i) => (
                                    <div key={i} className="aspect-square flex items-center justify-center">
                                        {day !== null ? (
                                            <button
                                                type="button"
                                                onClick={() => selectDate(day)}
                                                disabled={isDisabled(day)}
                                                className={cn(
                                                    'w-8 h-8 rounded-lg text-xs font-medium transition-all duration-150',
                                                    isSelected(day)
                                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                                        : isDisabled(day)
                                                            ? 'text-slate-700 cursor-not-allowed'
                                                            : 'text-slate-300 hover:bg-white/10 hover:text-white'
                                                )}
                                            >
                                                {day}
                                            </button>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>,
                document.body
            )}
        </div>
    );
};

export default DatePicker;
