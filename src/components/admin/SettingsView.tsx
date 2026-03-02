import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../../store/settings.store';
import { Settings } from '../../types';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Input } from '../ui/input';
import { Settings as SettingsIcon, Save, X, RefreshCw, Shield, DollarSign, Users, Info, MonitorX, LogOut, ShieldAlert } from 'lucide-react';
import { createInventoryLog } from '../../lib/inventoryLog';
import { useAuthStore } from '../../store/auth.store';
import { useWorkstationStore } from '../../store/workstation.store';

export const SettingsView: React.FC = () => {
    const { user } = useAuthStore();
    const { workstationName, clearWorkstation } = useWorkstationStore();
    const { settings, updateSettings, isLoading, error } = useSettingsStore();

    const [localSettings, setLocalSettings] = useState<Settings | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isConfirmingRelease, setIsConfirmingRelease] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Sync local state when store settings change
    useEffect(() => {
        if (settings) {
            setLocalSettings(settings);
        }
    }, [settings]);

    const hasChanges = () => {
        if (!settings || !localSettings) return false;
        return JSON.stringify(settings) !== JSON.stringify(localSettings);
    };

    const handleSave = async () => {
        if (!localSettings) return;
        setIsSaving(true);
        setSaveError(null);
        try {
            await updateSettings(localSettings);
            if (user) {
                createInventoryLog('SYSTEM_SETTINGS', 0, 'adjustment', user.id);
            }
        } catch (err: any) {
            console.error(err);
            setSaveError(err.message || 'Error al guardar los cambios');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDiscard = () => {
        if (settings) {
            setLocalSettings(settings);
        }
    };

    const handleReleaseWorkstation = () => {
        clearWorkstation();
    };

    // Helper updaters
    const updateNumberParam = (key: keyof Settings, value: number) => {
        if (value < 0) return;
        setLocalSettings(prev => prev ? { ...prev, [key]: value } : prev);
    };

    const updateBoolParam = (key: keyof Settings, value: boolean) => {
        setLocalSettings(prev => prev ? { ...prev, [key]: value } : prev);
    };

    if (isLoading && !localSettings) return <div className="p-12 text-center text-slate-500">Cargando...</div>;
    if (error && !localSettings) return <div className="p-12 text-center text-red-500">Error: {error}</div>;
    if (!localSettings) return null;

    return (
        <div className="p-8 max-w-5xl mx-auto pb-32">
            <div className="flex items-center gap-3 mb-8 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <SettingsIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white">Ajustes Master</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Configuración global y administración de la terminal.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* WORKSTATION CONFIG (Legacy merged into UI) */}
                <div className="col-span-1 lg:col-span-3">
                    <div className="mb-4 bg-blue-900/20 border border-blue-500/30 rounded-2xl p-4 flex gap-4">
                        <div className="p-2 bg-blue-500/20 rounded-lg h-fit">
                            <ShieldAlert className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-blue-200 font-semibold mb-1">Zona Administrador</h3>
                            <p className="text-sm text-blue-300">Estás accediendo a la configuración avanzada. Sé cauteloso.</p>
                        </div>
                    </div>

                    <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 relative overflow-hidden ring-1 ring-white/10 flex flex-col sm:flex-row justify-between gap-6">
                        <div className="space-y-4 z-10">
                            <div>
                                <h2 className="text-xl font-bold text-white mb-2">Identidad de Caja</h2>
                                <p className="text-sm text-slate-400">Esta computadora está enlazada a la estación física.</p>
                            </div>
                            <div className="flex flex-col space-y-1">
                                <span className="text-xs uppercase font-bold text-slate-500">Estación Asignada</span>
                                <span className="text-2xl font-bold text-emerald-400 tracking-tight flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                                    {workstationName || 'Desconocida'}
                                </span>
                            </div>
                        </div>
                        <div className="sm:border-l border-slate-800 sm:pl-6 flex flex-col min-w-[200px] z-10">
                            <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
                                <MonitorX className="w-4 h-4 text-slate-400" /> Liberar Software
                            </h3>
                            {!isConfirmingRelease ? (
                                <button onClick={() => setIsConfirmingRelease(true)} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium border border-slate-700">
                                    Reasignar Estación
                                </button>
                            ) : (
                                <div className="space-y-3 w-full">
                                    <button onClick={handleReleaseWorkstation} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white rounded-xl font-bold ring-1 ring-red-500/50">
                                        <LogOut className="w-4 h-4" /> Ejecutar
                                    </button>
                                    <button onClick={() => setIsConfirmingRelease(false)} className="w-full text-sm text-slate-400 hover:text-white">Cancelar</button>
                                </div>
                            )}
                        </div>
                        <div className="absolute top-[-50px] right-[-50px] w-32 h-32 bg-red-500/10 rounded-full blur-[50px] pointer-events-none"></div>
                    </div>
                </div>

                {/* GENERAL */}
                <div className="col-span-1 lg:col-span-3">
                    <h2 className="text-xl font-bold flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-200">
                        <Users className="w-5 h-5 text-blue-500" /> Capacidad y General
                    </h2>
                    <Card className="p-6 rounded-[1.5rem] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="block text-base font-bold text-slate-700 dark:text-slate-200">Capacidad Máxima (Niños)</label>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Límite global para mostrar advertencias.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="icon" className="h-10 w-10 text-xl font-bold rounded-xl" onClick={() => updateNumberParam('max_capacity', localSettings.max_capacity - 10)}>-</Button>
                                <Input type="number" value={localSettings.max_capacity} onChange={(e) => updateNumberParam('max_capacity', parseInt(e.target.value) || 0)} className="w-20 text-center font-bold text-lg h-10 rounded-xl" />
                                <Button variant="outline" size="icon" className="h-10 w-10 text-xl font-bold rounded-xl" onClick={() => updateNumberParam('max_capacity', localSettings.max_capacity + 10)}>+</Button>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* FINANZAS */}
                <div className="col-span-1 lg:col-span-3">
                    <h2 className="text-xl font-bold flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-200 mt-6">
                        <DollarSign className="w-5 h-5 text-green-500" /> Reglas Financieras y Tiempo Extra
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="p-6 rounded-[1.5rem] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                            <div className="mb-4">
                                <label className="block text-base font-bold text-slate-700 dark:text-slate-200">Periodo de Gracia (min)</label>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Minutos tolerados al cierre.</p>
                            </div>
                            <div className="flex items-center gap-2 self-start bg-slate-50 dark:bg-slate-800 p-2 rounded-2xl">
                                <Button variant="ghost" size="icon" className="h-10 w-10 text-xl font-bold rounded-xl" onClick={() => updateNumberParam('grace_period', localSettings.grace_period - 1)}>-</Button>
                                <Input type="number" value={localSettings.grace_period} onChange={(e) => updateNumberParam('grace_period', parseInt(e.target.value) || 0)} className="w-16 text-center font-bold text-lg h-10 border-0 bg-transparent" />
                                <Button variant="ghost" size="icon" className="h-10 w-10 text-xl font-bold rounded-xl" onClick={() => updateNumberParam('grace_period', localSettings.grace_period + 1)}>+</Button>
                            </div>
                        </Card>

                        <Card className="p-6 rounded-[1.5rem] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                            <div className="mb-4">
                                <label className="block text-base font-bold text-slate-700 dark:text-slate-200">Fracción de Cobro (min)</label>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Bloques de tabulación de tiempo extra.</p>
                            </div>
                            <div className="flex items-center gap-2 self-start bg-slate-50 dark:bg-slate-800 p-2 rounded-2xl">
                                <Button variant="ghost" size="icon" className="h-10 w-10 text-xl font-bold rounded-xl" onClick={() => updateNumberParam('fraction_size', localSettings.fraction_size - 5)}>-</Button>
                                <Input type="number" value={localSettings.fraction_size} onChange={(e) => updateNumberParam('fraction_size', parseInt(e.target.value) || 0)} className="w-16 text-center font-bold text-lg h-10 border-0 bg-transparent" />
                                <Button variant="ghost" size="icon" className="h-10 w-10 text-xl font-bold rounded-xl" onClick={() => updateNumberParam('fraction_size', localSettings.fraction_size + 5)}>+</Button>
                            </div>
                        </Card>

                        <Card className="p-6 rounded-[1.5rem] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                            <div className="mb-4">
                                <label className="block text-base font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">Caja Chica Base <Info className="w-4 h-4 text-slate-400" /></label>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Monto de apertura de turno automático.</p>
                            </div>
                            <div className="relative w-40">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                                <Input type="number" value={localSettings.fixed_opening_balance} onChange={(e) => updateNumberParam('fixed_opening_balance', parseInt(e.target.value) || 0)} className="pl-8 font-bold text-lg h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white" />
                            </div>
                        </Card>
                    </div>
                </div>

                {/* SEGURIDAD */}
                <div className="col-span-1 lg:col-span-3">
                    <h2 className="text-xl font-bold flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-200 mt-6">
                        <Shield className="w-5 h-5 text-red-500" /> Seguridad y Verificación
                    </h2>
                    <Card className="p-0 rounded-[1.5rem] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                        <div className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <div>
                                <h4 className="font-bold text-base text-slate-800 dark:text-slate-200">Requerir PIN Administrador</h4>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Bloquea acciones directas.</p>
                            </div>
                            <Switch checked={localSettings.require_admin_pin} onCheckedChange={(checked: boolean) => updateBoolParam('require_admin_pin', checked)} />
                        </div>
                        <div className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <div>
                                <h4 className="font-bold text-base text-slate-800 dark:text-slate-200">Firma Digital (Cierre Caja)</h4>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Dibuja la firma ciega al corte.</p>
                            </div>
                            <Switch checked={localSettings.require_signature} onCheckedChange={(checked: boolean) => updateBoolParam('require_signature', checked)} />
                        </div>
                        <div className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <div>
                                <h4 className="font-bold text-base text-slate-800 dark:text-slate-200">Habilitar Caja Obligatoria</h4>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Bloquea TPV si no hay turno activo.</p>
                            </div>
                            <Switch checked={localSettings.is_cash_session_mandatory} onCheckedChange={(checked: boolean) => updateBoolParam('is_cash_session_mandatory', checked)} />
                        </div>
                    </Card>
                </div>

            </div>

            {/* Unsaved Changes Bar */}
            <div className={`fixed bottom-0 left-0 right-0 sm:left-64 bg-white/80 dark:bg-slate-900/90 backdrop-blur-2xl p-6 transform transition-all duration-500 z-40 border-t border-slate-200 dark:border-white/10 shadow-[0_-1px_0_rgba(0,0,0,0.05),0_-20px_50px_-20px_rgba(0,0,0,0.1)]
                ${hasChanges() ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}
            >
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center ring-1 ring-amber-500/30">
                            <Info className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <p className="font-bold text-slate-900 dark:text-white text-lg tracking-tight">Cambios pendientes</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Existen modificaciones en la configuración del sistema sin aplicar.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {saveError && (
                            <div className="mr-4 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl">
                                <p className="text-xs font-bold text-red-600 dark:text-red-400">Error: {saveError}</p>
                            </div>
                        )}
                        <Button variant="ghost" className="text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl px-6" onClick={handleDiscard}>
                            <X className="w-4 h-4 mr-2" /> Descartar
                        </Button>
                        <Button
                            className="bg-blue-600 hover:bg-blue-700 text-white font-black shadow-md shadow-blue-500/10 px-8 rounded-xl h-12"
                            onClick={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            Guardar Cambios
                        </Button>
                    </div>
                </div>
            </div>

        </div>
    );
};
