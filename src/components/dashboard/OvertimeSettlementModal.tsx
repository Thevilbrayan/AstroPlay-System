import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Session, Child } from '../../types';
import { ShieldAlert, CreditCard, Clock, LogOut } from 'lucide-react';
import AdminPinModal from './AdminPinModal';

interface OvertimeSettlementModalProps {
    isOpen: boolean;
    onClose: () => void;
    session: Session;
    child: Child;
    exceededMins: number;
    basePrice: number;
    onCharge: (child: Child, session: Session, basePrice: number) => void;
    onForgive: () => void;
    fractionSize: number;
    requireAdminPin: boolean;
}

const OvertimeSettlementModal: React.FC<OvertimeSettlementModalProps> = ({
    isOpen,
    onClose,
    session,
    child,
    exceededMins,
    basePrice,
    onCharge,
    onForgive,
    fractionSize,
    requireAdminPin
}) => {
    const [showAdminPin, setShowAdminPin] = useState(false);

    // Calculate Debt: Price / (60 / fractionSize) per fraction chunk (rounded up)
    // Actually the previous logic was: Price / 4 per 15 mins.
    // If fractionSize changes (say 10 mins), it should be: basePrice / (60 / 10) = basePrice / 6.
    const priceDivisor = 60 / fractionSize;
    const fractions = Math.ceil(exceededMins / fractionSize);
    const debtAmount = fractions * (basePrice / priceDivisor);

    const handleForgiveSuccess = () => {
        setShowAdminPin(false);
        onForgive();
    };

    return (
        <React.Fragment>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-0 overflow-hidden shadow-2xl rounded-2xl">
                    <div className="bg-red-500 p-6 flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-4">
                            <Clock className="w-8 h-8 text-white animate-pulse" />
                        </div>
                        <DialogTitle className="text-2xl font-black text-white">
                            Tiempo Excedido
                        </DialogTitle>
                        <p className="text-red-100 font-medium mt-1">
                            {child.name} tiene un retraso en la salida.
                        </p>
                    </div>

                    <div className="p-6">
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 mb-6 border border-slate-200 dark:border-slate-700">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Minutos Excedidos:</span>
                                <span className="text-lg font-black text-red-500">{exceededMins} min</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Deuda Calculada:</span>
                                <span className="text-xl font-black text-slate-900 dark:text-white">${debtAmount.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <Button
                                className="w-full h-14 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg flex items-center justify-center gap-2 shadow-lg"
                                onClick={() => onCharge(child, session, basePrice)}
                            >
                                <CreditCard className="w-5 h-5" /> Cobrar Tiempo Extra
                            </Button>

                            <Button
                                variant="outline"
                                className="w-full h-14 rounded-xl border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-400 dark:hover:bg-amber-950/30 font-bold text-base flex items-center justify-center gap-2"
                                onClick={() => {
                                    if (requireAdminPin) {
                                        setShowAdminPin(true);
                                    } else {
                                        onForgive();
                                    }
                                }}
                            >
                                <ShieldAlert className="w-5 h-5" /> Perdonar (Admin)
                            </Button>

                            <Button
                                variant="ghost"
                                className="w-full h-12 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-semibold"
                                onClick={onClose}
                            >
                                <LogOut className="w-4 h-4 mr-2" /> Volver
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <AdminPinModal
                isOpen={showAdminPin}
                onClose={() => setShowAdminPin(false)}
                onSuccess={handleForgiveSuccess}
                actionDescription={`Autoriza condonar ${exceededMins} min de exceso a ${child.name}.`}
            />
        </React.Fragment>
    );
};

export default OvertimeSettlementModal;
