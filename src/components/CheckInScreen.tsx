
import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Search, Camera, User, Phone, Mail, Calendar, AlertCircle, Heart } from 'lucide-react';
import { Parent } from '../types';

const CheckInScreen: React.FC = () => {
    // State for Parent
    const [searchQuery, setSearchQuery] = useState('');
    const [parent, setParent] = useState<Parent | null>(null);
    const [parentForm, setParentForm] = useState({
        name: '',
        phone: '',
        email: '',
    });

    // State for Child
    const [childForm, setChildForm] = useState({
        name: '',
        dob: '',
        allergies: '',
    });

    // Camera ref
    const webcamRef = useRef<Webcam>(null);

    // Mock function to simulate searching for a parent
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        // Simulate database lookup
        console.log(`Searching for: ${searchQuery}`);
        // In a real app, this would query PocketBase
    };

    const captureId = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        console.log('Captured photo:', imageSrc);
    }, [webcamRef]);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 p-6 flex flex-col gap-6 font-sans">

            {/* Header / Title could go here */}

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Left Column: Tutor Management */}
                <div className="flex flex-col gap-6">
                    <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl p-6 shadow-xl">
                        <h2 className="text-xl font-semibold text-blue-400 mb-4 flex items-center gap-2">
                            <User className="w-5 h-5" />
                            Gestión del Tutor
                        </h2>

                        {/* Search Bar */}
                        <form onSubmit={handleSearch} className="relative mb-6">
                            <input
                                type="text"
                                placeholder="Buscar por nombre o teléfono..."
                                className="w-full bg-slate-950/50 border border-slate-700 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-100 placeholder-slate-500 transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                        </form>

                        {/* Parent Form */}
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-400 ml-1">Nombre Completo</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        className="w-full bg-slate-800/50 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 focus:outline-none focus:border-blue-500/50 text-white"
                                        value={parentForm.name}
                                        onChange={(e) => setParentForm({ ...parentForm, name: e.target.value })}
                                    />
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-400 ml-1">Teléfono</label>
                                <div className="relative">
                                    <input
                                        type="tel"
                                        className="w-full bg-slate-800/50 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 focus:outline-none focus:border-blue-500/50 text-white"
                                        value={parentForm.phone}
                                        onChange={(e) => setParentForm({ ...parentForm, phone: e.target.value })}
                                    />
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-400 ml-1">Correo Electrónico</label>
                                <div className="relative">
                                    <input
                                        type="email"
                                        className="w-full bg-slate-800/50 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 focus:outline-none focus:border-blue-500/50 text-white"
                                        value={parentForm.email}
                                        onChange={(e) => setParentForm({ ...parentForm, email: e.target.value })}
                                    />
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                                </div>
                            </div>
                        </div>

                        {/* Loyalty Badge */}
                        {parent && (
                            <div className="mt-6 bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="bg-blue-500/20 p-2 rounded-full">
                                        <Heart className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-blue-100">Miembro Leal</h3>
                                        <p className="text-xs text-blue-300">Cliente registrado</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-2xl font-bold text-blue-400">{parent.loyalty_points}</span>
                                    <p className="text-[10px] uppercase tracking-wider text-blue-300">Puntos</p>
                                </div>
                            </div>
                        )}

                        {/* Demo toggle for badge */}
                        <div className="mt-4 flex justify-end">
                            <button
                                onClick={() => setParent(parent ? null : { id: '1', name: 'Demo Parent', phone: '123', photo: '', loyalty_points: 1500 } as Parent)}
                                className="text-xs text-slate-600 hover:text-slate-400 underline"
                            >
                                Toggle Demo Badge
                            </button>
                        </div>

                    </div>
                </div>

                {/* Right Column: Child & Camera */}
                <div className="flex flex-col gap-6">
                    <div className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col h-full">
                        <h2 className="text-xl font-semibold text-blue-400 mb-4 flex items-center gap-2">
                            <User className="w-5 h-5" /> {/* Using User icon for child too, or could find a better "Child" one if available in lucide */}
                            Datos del Niño
                        </h2>

                        {/* Child Form */}
                        <div className="space-y-4 mb-6">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-400 ml-1">Nombre del Niño</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg py-2.5 px-4 focus:outline-none focus:border-blue-500/50 text-white"
                                    value={childForm.name}
                                    onChange={(e) => setChildForm({ ...childForm, name: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-400 ml-1">Fecha de Nacimiento</label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        className="w-full bg-slate-800/50 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 focus:outline-none focus:border-blue-500/50 text-white [color-scheme:dark]"
                                        value={childForm.dob}
                                        onChange={(e) => setChildForm({ ...childForm, dob: e.target.value })}
                                    />
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-orange-400 ml-1 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    Alergias / Condiciones Médicas
                                </label>
                                <textarea
                                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg py-2.5 px-4 focus:outline-none focus:border-orange-500/50 text-white resize-none h-24"
                                    placeholder="Ninguna..."
                                    value={childForm.allergies}
                                    onChange={(e) => setChildForm({ ...childForm, allergies: e.target.value })}
                                ></textarea>
                            </div>
                        </div>

                        {/* Camera Module */}
                        <div className="flex-1 min-h-[200px] flex flex-col">
                            <label className="text-xs font-medium text-slate-400 ml-1 mb-2">Foto del Tutor (Seguridad)</label>
                            <div className="relative flex-1 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 group">
                                {/* 16:9 Aspect Ratio Placeholder or Webcam */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Webcam
                                        audio={false}
                                        ref={webcamRef}
                                        screenshotFormat="image/jpeg"
                                        videoConstraints={{ facingMode: "user", aspectRatio: 16 / 9 }}
                                        className="absolute inset-0 w-full h-full object-cover"
                                    />
                                    {/* Fallback/Overlay if needed, but webcam creates built-in video element */}
                                </div>

                                <button
                                    onClick={captureId}
                                    className="absolute bottom-4 right-4 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white p-3 rounded-full transition-all border border-white/20 shadow-lg active:scale-95"
                                    title="Capturar Foto"
                                >
                                    <Camera className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                    </div>
                </div>

            </div>

            {/* Main Action Button */}
            <div className="pt-4">
                <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-[0.99] text-lg uppercase tracking-wide">
                    Iniciar Sesión de Juego
                </button>
            </div>

        </div>
    );
};

export default CheckInScreen;
