import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, ShoppingCart, Package, Trash2, Plus, Minus, CreditCard, Banknote, Zap, CheckCircle2, Users, X, AlertTriangle, ChevronRight, Loader2, Wallet } from 'lucide-react';
import { Product, Asset, Session, Child } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import ServicePriceModal from './ServicePriceModal';
import ModalAlert, { AlertType } from '../ui/ModalAlert';
import { useAuthStore } from '../../store/auth.store';
import { useSessionStore } from '../../store/session.store';
import { useWorkstationStore } from '../../store/workstation.store';
import { useCashSessionStore } from '../../store/cashSession.store';
import { pb } from '../../lib/pocketbase';
import { triggerWristbandPrint } from '../../lib/printer';
import { incrementSessionSales, getNextOpeningBalance } from '../../lib/cashSession';
import { createInventoryLog } from '../../lib/inventoryLog';
import { useCartActionStore } from '../../store/cartAction.store';

interface CartItem {
    id: string; // Unique ID for the cart item, since identical products might be for different children
    product: Product;
    quantity: number;
    child?: Child;
    sessionToFinish?: Session;
    basePrice?: number;
}

interface POSViewProps {
    products: Product[];
    formatCurrency: (amount: number) => string;
    onSaleComplete?: () => void;
    onNavigate?: (view: string) => void;
}

const getSizeLabel = (name: string) => {
    const match = name.match(/\b(CH|M|G|S|L|XL)\b/i);
    return match ? match[0].toUpperCase() : 'Unitalla';
};

const getBaseName = (name: string) => {
    return name.replace(/\s*-?\s*\b(CH|M|G|S|L|XL)\b/i, '').trim();
};

const POSView: React.FC<POSViewProps> = ({ products, formatCurrency, onSaleComplete, onNavigate }) => {
    const { user } = useAuthStore();
    const { activeParent, selectedChild, isFirstVisit, clearSession } = useSessionStore();
    const { workstationId, workstationName, workstationType } = useWorkstationStore();
    const { activeSession, isLoading: isSessionLoading, loadSession, openNewSession } = useCashSessionStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTypeFilter, setActiveTypeFilter] = useState<'all' | 'service' | 'socks' | 'snack'>('all');
    const [checkoutStep, setCheckoutStep] = useState<'services' | 'socks' | 'snacks'>('services');
    const isWizardMode = !!activeParent && workstationType !== 'SNACK_ONLY' && workstationType !== 'TIME_ONLY';
    const [cart, setCart] = useState<CartItem[]>([]);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
    const [isProcessing, setIsProcessing] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const autoCartDone = useRef(false);

    // --- Cart Action Store Hook (Overtime) ---
    const { pendingAction, clearPendingAction } = useCartActionStore();

    useEffect(() => {
        if (pendingAction && pendingAction.type === 'ADD_OVERTIME') {
            const overtimeProduct: Product = {
                id: `overtime-${pendingAction.session.id}`,
                name: 'Servicio de Tiempo Extra',
                category: 'service',
                price: pendingAction.basePrice / 4,
            };

            const now = Date.now();
            const end = new Date(pendingAction.session.end_time || '').getTime();
            let fractions = Math.ceil((now - end) / 60000 / 15);
            if (fractions < 1) fractions = 1;

            overtimeProduct.price = fractions * (pendingAction.basePrice / 4);

            setCart(prev => [
                ...prev,
                {
                    id: `ot-${pendingAction.session.id}-${Date.now()}`,
                    product: overtimeProduct,
                    quantity: 1,
                    child: pendingAction.child,
                    sessionToFinish: pendingAction.session,
                    basePrice: pendingAction.basePrice
                }
            ]);
            clearPendingAction();
        }
    }, [pendingAction, clearPendingAction]);

    // --- Continuous Sync for Overtime ---
    useEffect(() => {
        const interval = setInterval(() => {
            setCart(prevCart => {
                let hasChanges = false;
                const newCart = prevCart.map(item => {
                    if (item.sessionToFinish && item.basePrice && item.sessionToFinish.end_time) {
                        const now = Date.now();
                        const end = new Date(item.sessionToFinish.end_time).getTime();
                        const diffMins = Math.floor((now - end) / 60000);
                        if (diffMins > 0) {
                            let fractions = Math.ceil(diffMins / 15);
                            if (fractions < 1) fractions = 1;
                            const newPrice = fractions * (item.basePrice / 4);
                            if (newPrice !== item.product.price) {
                                hasChanges = true;
                                return {
                                    ...item,
                                    product: { ...item.product, price: newPrice }
                                };
                            }
                        }
                    }
                    return item;
                });
                return hasChanges ? newCart : prevCart;
            });
        }, 30000); // 30 seconds

        return () => clearInterval(interval);
    }, []);

    // ─── Cash Session Gate ───
    const [openingBalance, setOpeningBalance] = useState<string>('0');
    const [isOpeningSession, setIsOpeningSession] = useState(false);
    const sessionChecked = useRef(false);

    // Check for active cash session on mount
    useEffect(() => {
        if (!user?.id || !workstationId || sessionChecked.current) return;
        sessionChecked.current = true;
        loadSession(user.id, workstationId);
    }, [user?.id, workstationId, loadSession]);

    // Pre-fill the handover opening balance from the last closed session
    useEffect(() => {
        if (workstationId && !activeSession) {
            getNextOpeningBalance(workstationId)
                .then(balance => setOpeningBalance(balance.toString()))
                .catch(err => console.error('Failed to get handover balance:', err));
        }
    }, [workstationId, activeSession]);

    const handleOpenSession = async () => {
        if (!user?.id || !workstationId) return;
        setIsOpeningSession(true);
        try {
            const balance = parseFloat(openingBalance) || 0;
            await openNewSession(user.id, workstationId, balance);
        } catch (err) {
            console.error('Error opening session:', err);
        } finally {
            setIsOpeningSession(false);
        }
    };

    // Service modal
    const [serviceModalProduct, setServiceModalProduct] = useState<Product | null>(null);

    // Child Selection Modal
    const [childSelectionProduct, setChildSelectionProduct] = useState<{ product: Product, customPriceValue?: number } | null>(null);

    // Capacity Validation state (TIME_ONLY)
    const [maxCapacity, setMaxCapacity] = useState<number>(0);
    const [currentUsage, setCurrentUsage] = useState<number>(0);

    // Alert State
    const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; type: AlertType; title: string; message: string }>({
        isOpen: false,
        type: 'info',
        title: '',
        message: ''
    });

    const showAlert = (type: AlertType, title: string, message: string) => {
        setAlertConfig({ isOpen: true, type, title, message });
    };

    const hideAlert = () => {
        setAlertConfig(prev => ({ ...prev, isOpen: false }));
    };

    // Load Capacity Data
    useEffect(() => {
        if (workstationType !== 'TIME_ONLY' || !workstationId) return;

        let isMounted = true;
        const loadCapacityData = async () => {
            try {
                // 1. Fetch total Assets for this workstation that are NOT in maintenance
                const assets = await pb.collection('assets').getFullList<Asset>({
                    filter: `workstation = '${workstationId}' && status != 'maintenance'`
                });

                // 2. Fetch active sessions created at this workstation (via operator or sale link - simplified counting active sessions)
                const activeSessions = await pb.collection('sessions').getFullList<Session>({
                    filter: `status = 'active'`
                });

                if (isMounted) {
                    setMaxCapacity(assets.length);
                    setCurrentUsage(activeSessions.length);
                }
            } catch (error: any) {
                if (!error.isAbort) console.error('Error fetching capacity data:', error);
            }
        };

        loadCapacityData();
        const interval = setInterval(loadCapacityData, 10000); // Poll every 10s

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [workstationType, workstationId]);

    // Reset wizard step when family changes
    useEffect(() => {
        if (activeParent) {
            setCheckoutStep('services');
        }
    }, [activeParent]);

    // Remove old Auto-add entry completely as per Phase 4 Plan - Option B.

    // Filter: only show is_for_sale products (default true if undefined)
    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            // Note: Disabled is_for_sale check temporarily because existing PocketBase products default to false
            // if (product.is_for_sale === false) return false;

            // By Workstation Type Enforcment
            if (workstationType === 'SNACK_ONLY' && product.category === 'service') return false;
            if (workstationType === 'TIME_ONLY' && product.category !== 'service') return false;

            const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());

            if (isWizardMode) {
                if (checkoutStep === 'services') {
                    return matchesSearch && product.category === 'service';
                }
                if (checkoutStep === 'socks') {
                    return matchesSearch && product.category === 'socks';
                }
                if (checkoutStep === 'snacks') {
                    return matchesSearch && product.category === 'snack';
                }
            }

            // Normal Flow (Express or non-wizard)
            // By Type Menu
            let matchesType = true;
            if (activeTypeFilter !== 'all') {
                matchesType = product.category === activeTypeFilter;
            }

            return matchesSearch && matchesType;
        });
    }, [products, searchQuery, activeTypeFilter, workstationType, isWizardMode, checkoutStep]);

    // Cart calculations
    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const tax = subtotal * 0.16;
    const total = subtotal + tax;

    const addToCart = (product: Product, customPriceValue?: number, forceChild?: Child) => {
        // 1. Variable Price Check
        if (product.category === 'service' && product.price === 0 && customPriceValue === undefined) {
            setServiceModalProduct(product);
            return;
        }

        // 2. Child Assignment Check for Services
        const isServiceProduct = product.category === 'service';

        if (isServiceProduct && activeParent && selectedChild.length > 0 && !forceChild) {
            // Find children who ALREADY have a service in the cart
            const childrenWithServices = new Set(
                cart.filter(item => item.product.category === 'service')
                    .map(item => item.child?.id)
                    .filter(Boolean)
            );

            // Filter available children
            const availableChildren = selectedChild.filter(child => !childrenWithServices.has(child.id));

            if (availableChildren.length === 0) {
                showAlert('warning', 'Sin niños disponibles', 'Todos los niños ya tienen un servicio de tiempo asignado.');
                return;
            }

            if (availableChildren.length === 1) {
                // Auto-assign to the only remaining child
                addToCart(product, customPriceValue, availableChildren[0]);
                return;
            } else {
                // Show modal to pick from available children
                setChildSelectionProduct({ product, customPriceValue });
                return;
            }
        }

        if (product.category !== 'service' && (product.stock || 0) === 0) return;

        // Capacity Check for TIME_ONLY Services
        const isService = product.category === 'service';
        if (workstationType === 'TIME_ONLY' && isService) {
            const currentCartQuantity = cart.filter(item => item.product.category === 'service').reduce((sum, item) => sum + item.quantity, 0);
            if (currentUsage + currentCartQuantity >= maxCapacity) {
                // Cannot add more, capacity full
                showAlert('error', 'Capacidad Agotada', `No hay más activos disponibles (${maxCapacity} máx).`);
                return;
            }
        }

        const priceToUse = customPriceValue !== undefined ? customPriceValue : product.price;

        setCart(prev => {
            const productToAdd = { ...product, price: priceToUse };

            // Si es físico o si es un servicio y encontramos uno idéntico (mismo child)
            const existingIndex = prev.findIndex(item =>
                item.product.id === product.id &&
                item.product.price === productToAdd.price &&
                item.child?.id === forceChild?.id
            );

            if (existingIndex >= 0) {
                const existing = prev[existingIndex];
                if (product.category !== 'service' && existing.quantity >= (product.stock || 0)) return prev;
                // Si es un servicio asignado a un niño, generalmente la cantidd será 1, pero permitimos sumar si es explícito
                const newCart = [...prev];
                newCart[existingIndex] = { ...existing, quantity: existing.quantity + 1 };
                return newCart;
            }

            return [...prev, { id: `${product.id}-${Date.now()}-${Math.random()}`, product: productToAdd, quantity: 1, child: forceChild }];
        });
    };

    const removeFromCart = (cartItemId: string) => {
        setCart(prev => prev.filter(item => item.id !== cartItemId));
    };

    const updateQuantity = (cartItemId: string, price: number, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.id === cartItemId && item.product.price === price) {
                const newQuantity = item.quantity + delta;
                if (newQuantity <= 0) return item;

                // Stock Check constraints
                const isPhysical = item.product.category !== 'service';
                if (isPhysical && newQuantity > (item.product.stock || 0)) return item;

                // Service constraints (Option B - 1 qty per child max)
                const isService = item.product.category === 'service';
                if (isService && item.child && newQuantity > 1) {
                    showAlert('warning', 'Límite alcanzado', 'Cada niño solo puede tener 1 servicio de tiempo activo.');
                    return item; // Block pushing beyond 1 for assigned child service
                }

                // Capacity Check constraints (for TIME_ONLY primarily)
                if (workstationType === 'TIME_ONLY' && isService && delta > 0) {
                    const totalServiceQuantityInCart = cart.filter(c => c.product.category === 'service').reduce((sum, c) => sum + c.quantity, 0);
                    if (currentUsage + totalServiceQuantityInCart >= maxCapacity) {
                        showAlert('error', 'Capacidad Agotada', 'No hay más activos disponibles.');
                        return item;
                    }
                }

                return { ...item, quantity: newQuantity };
            }
            return item;
        }));
    };

    const handleFinalizeSale = async () => {
        if (cart.length === 0) return;

        // --- Validación Previa Importante: Servicios vs Niños ---
        if (isWizardMode && activeParent && selectedChild.length > 0) {
            const serviceItems = cart.filter(item => item.product.category === 'service');
            const totalDistinctServicesAssigned = new Set(serviceItems.map(i => i.child?.id).filter(Boolean)).size;

            if (totalDistinctServicesAssigned < selectedChild.length) {
                showAlert(
                    'warning',
                    'Faltan Servicios',
                    `Has ingresado a ${selectedChild.length} niños, pero solo has asignado servicios a ${totalDistinctServicesAssigned}. Debes asignar un servicio por cada niño ingresado.`
                );
                return; // Detener flujo
            }
        }

        if (!workstationId) {
            showAlert('error', 'Error de Sistema', 'Estación de caja no configurada. Por favor recarga la aplicación.');
            return;
        }

        setIsProcessing(true);
        try {
            // --- PASO A: Contexto del Cliente (Update visits) ---
            if (activeParent && activeParent.id) {
                const updatedVisits = (activeParent.total_visits || 0) + 1;
                await pb.collection('parents').update(activeParent.id, {
                    total_visits: updatedVisits
                });
            }

            // --- PASO B: Creación del Registro Maestro (Sale) ---
            const saleData: Record<string, any> = {
                total_amount: total,
                payment_method: paymentMethod,
                operator: user?.id || '',
                workstation: workstationId,
            };
            if (activeParent) {
                saleData.parent = activeParent.id;
            }
            if (activeSession?.id) {
                saleData.cash_session = activeSession.id;
            }
            const saleRecord = await pb.collection('sales').create(saleData);

            // --- PASO C: Detalle y Activación de Tiempos ---
            for (const item of cart) {
                // 1. Create sale_items
                await pb.collection('sales_items').create({
                    sale: saleRecord.id,
                    product: item.product.id,
                    quantity: item.quantity,
                    unit_price: item.product.price,
                });

                // 2. Deduct physical stock (non-blocking: don't crash sale if product was deleted)
                const isPhysical = item.product.category !== 'service';
                if (isPhysical) {
                    try {
                        const currentProduct = products.find(p => p.id === item.product.id);
                        if (currentProduct) {
                            const newStock = Math.max(0, (currentProduct.stock || 0) - item.quantity);
                            await pb.collection('products').update(item.product.id, { stock: newStock });
                            createInventoryLog(item.product.id, -item.quantity, 'sale', user?.id || '');
                        }
                    } catch (stockErr) {
                        console.warn(`[Stock] No se pudo actualizar stock para ${item.product.name} (${item.product.id}):`, stockErr);
                    }
                }

                // 3. Spawning Session timers for Services
                const isService = item.product.category === 'service';

                if (isService) {
                    // --- OVERTIME INTERCEPT ---
                    if (item.sessionToFinish) {
                        await pb.collection('sessions').update(item.sessionToFinish.id, {
                            status: 'finished',
                            is_paid: true
                        });
                        continue; // Skip creating a new session
                    }

                    const durationMins = item.product.duration_min || 60;

                    if (workstationType === 'TIME_ONLY') {
                        // Anonymous express mode: 1 session per item quantity
                        for (let i = 0; i < item.quantity; i++) {
                            const startTime = new Date();
                            const endTime = new Date(startTime.getTime() + durationMins * 60000);

                            const sessionRecord = await pb.collection('sessions').create({
                                sale: saleRecord.id, // Only sale linked
                                status: 'active',
                                operator: user?.id || '',
                                start_time: startTime.toISOString(),
                                end_time: endTime.toISOString(),
                                is_gokart: item.product.name.toLowerCase().includes('kart') // optional helper
                            });

                            triggerWristbandPrint({
                                childName: `Express - ${item.product.name}`,
                                parentName: 'N/A',
                                startTime: sessionRecord.start_time,
                                endTime: sessionRecord.end_time || '',
                                sessionId: sessionRecord.id
                            });
                        }
                    } else if (activeParent && item.child) {
                        // Option B mode: Session assigned to specific child
                        const startTime = new Date();
                        const endTime = new Date(startTime.getTime() + durationMins * 60000);

                        const sessionRecord = await pb.collection('sessions').create({
                            parent: activeParent.id,
                            child: [item.child.id],
                            sale: saleRecord.id,
                            status: 'active',
                            operator: user?.id || '',
                            start_time: startTime.toISOString(),
                            end_time: endTime.toISOString(),
                        });

                        triggerWristbandPrint({
                            childName: item.child.name,
                            parentName: activeParent.name,
                            startTime: sessionRecord.start_time,
                            endTime: sessionRecord.end_time || '',
                            sessionId: sessionRecord.id
                        });
                    } else if (activeParent && selectedChild.length > 0) {
                        // Fallback (e.g. they skipped selection somehow) - Standard Mode
                        const startTime = new Date();
                        const endTime = new Date(startTime.getTime() + durationMins * 60000);

                        const sessionRecord = await pb.collection('sessions').create({
                            parent: activeParent.id,
                            child: selectedChild.map(c => c.id),
                            sale: saleRecord.id,
                            status: 'active',
                            operator: user?.id || '',
                            start_time: startTime.toISOString(),
                            end_time: endTime.toISOString(),
                        });

                        // Fallback bulk print
                        selectedChild.forEach((c) => {
                            triggerWristbandPrint({
                                childName: c.name,
                                parentName: activeParent.name,
                                startTime: sessionRecord.start_time,
                                endTime: sessionRecord.end_time || '',
                                sessionId: sessionRecord.id
                            });
                        });
                    }
                }
            }

            // 4. Success: Clear context and Redirect
            setCart([]);
            const familyLabel = activeParent ? ` — Familia ${activeParent.name}` : '';
            setSuccessMessage(`Venta y sesión registradas exitosamente${familyLabel}`);

            // 5. Increment cash session sales total (non-blocking)
            if (activeSession?.id && paymentMethod === 'cash') {
                incrementSessionSales(activeSession.id, total).catch(err =>
                    console.error('[CashSession] Failed to increment sales total:', err)
                );
            }

            setTimeout(() => {
                setSuccessMessage(null);
                if (activeParent) {
                    autoCartDone.current = false;
                    clearSession();
                    if (onNavigate) {
                        onNavigate('dashboard');
                    }
                }
                onSaleComplete?.();
            }, 1500);

        } catch (error: any) {
            console.error('[handleFinalizeSale] Transacción fallida:', error);
            if (error?.response?.data) {
                console.error('Detalles Base de Datos:', JSON.stringify(error.response.data, null, 2));
            }
            // Mantiene el carrito vivo para re-intentar según la solicitud
            showAlert('error', 'Venta Fallida', 'Falló el procesamiento de la venta o sesión. El carrito no se ha borrado. Intenta de nuevo.');
        } finally {
            setIsProcessing(false);
        }
    };

    const getStockBadge = (product: Product) => {
        if (product.category === 'service') return null;
        const s = product.stock || 0;
        if (s === 0) {
            return <span className="px-2 py-1 rounded-full text-xs font-bold border bg-red-500/20 text-red-400 border-red-500/30">Sin Stock</span>;
        }
        if (product.min_stock && s <= product.min_stock) {
            return <span className="px-2 py-1 rounded-full text-xs font-bold border bg-orange-500/90 text-white border-orange-400/50 animate-pulse">{s} un.</span>;
        }
        return <span className="px-2 py-1 rounded-full text-xs font-bold border bg-green-500/90 text-white border-green-400/50">{s} un.</span>;
    };

    const getProductIcon = (product: Product) => {
        if (product.category === 'service') return <Zap className="w-12 h-12 opacity-50" />;
        return <Package className="w-12 h-12 opacity-50" />;
    };

    const typeFilterOptions = [
        { key: 'all' as const, label: 'Todos' },
        { key: 'service' as const, label: 'Servicios' },
        { key: 'socks' as const, label: 'Calcetas' },
        { key: 'snack' as const, label: 'Snacks' },
    ];

    return (
        <div className="flex flex-col h-full gap-3">

            {/* ═══ CASH SESSION GATE ═══ */}
            {isSessionLoading && (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
            )}

            {!isSessionLoading && !activeSession && (
                <div className="flex-1 flex items-center justify-center">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 shadow-xl p-10 max-w-md w-full flex flex-col items-center text-center">
                        <div className="p-4 bg-blue-100 dark:bg-blue-500/10 rounded-2xl mb-5">
                            <Wallet className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Abrir Caja</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                            Debes abrir tu sesión de caja para <span className="font-bold text-slate-700 dark:text-slate-200">{workstationName || 'esta estación'}</span> antes de vender.
                        </p>
                        <div className="w-full space-y-4">
                            <div className="text-left">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 block">
                                    Fondo Inicial (Traspaso Efectivo) <span className="text-emerald-500 ml-1">✓ Autocompletado</span>
                                </label>
                                <div className="relative">
                                    <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500 pointer-events-none" />
                                    <input
                                        type="number"
                                        value={openingBalance}
                                        onChange={(e) => setOpeningBalance(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full h-14 rounded-xl border-2 border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 pl-12 pr-4 text-2xl font-bold text-slate-900 dark:text-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                                    />
                                </div>
                            </div>
                            <Button
                                onClick={handleOpenSession}
                                disabled={isOpeningSession}
                                className="w-full h-14 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-base shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-2"
                            >
                                {isOpeningSession ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" /> Abriendo...</>
                                ) : (
                                    <><Wallet className="w-5 h-5" /> Abrir Caja para {workstationName || 'Estación'}</>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {!isSessionLoading && activeSession && (<>

                {/* Active Check-In Banner */}
                {activeParent && workstationType !== 'TIME_ONLY' && (
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl shrink-0">
                        <Users className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0" />
                        <span className="text-sm font-semibold text-blue-800 dark:text-blue-200">Atendiendo a:</span>
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Familia {activeParent.name}</span>
                        <span className="text-xs text-blue-400 dark:text-blue-300/60">·</span>
                        <span className="text-sm text-blue-700 dark:text-blue-300">{selectedChild.length} niño{selectedChild.length !== 1 ? 's' : ''}</span>
                        {isFirstVisit && (
                            <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">Primera Visita</span>
                        )}
                        <button onClick={() => { clearSession(); autoCartDone.current = false; setCart([]); }}
                            className="ml-auto p-1 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                <div className="flex flex-1 gap-6 min-h-0">
                    {/* Left: Product Gallery */}
                    <div className="flex-1 flex flex-col gap-4 min-w-0">

                        {/* Strict Filtering for TIME_ONLY */}
                        {workstationType === 'TIME_ONLY' && (
                            <div className="flex items-center justify-between p-4 bg-white/80 dark:bg-slate-900/60 border border-blue-200 dark:border-blue-500/20 rounded-xl shadow-sm dark:shadow-inner">
                                <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-2">
                                    <Zap className="w-5 h-5" /> Modo Express
                                </span>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm text-slate-500 dark:text-slate-400 font-semibold">Uso actual:</span>
                                    <span className={`text-lg font-black ${currentUsage >= maxCapacity ? 'text-red-500 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>
                                        {currentUsage} <span className="text-sm font-semibold text-slate-400 dark:text-slate-500">/ {maxCapacity}</span>
                                    </span>
                                </div>
                            </div>
                        )}

                        {workstationType !== 'TIME_ONLY' && (
                            <>
                                {/* Type Filters / Wizard Tabs */}
                                {isWizardMode ? (
                                    <div className="flex p-1 bg-slate-100 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-white/5">
                                        {[
                                            { id: 'services', label: '1. Servicios' },
                                            { id: 'socks', label: '2. Calcetas' },
                                            { id: 'snacks', label: '3. Snacks y Bebidas' }
                                        ].map(step => (
                                            <button
                                                key={step.id}
                                                onClick={() => setCheckoutStep(step.id as any)}
                                                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${checkoutStep === step.id ? 'bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-blue-500/50' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                            >
                                                {step.label}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex p-1 bg-slate-100 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-white/5">
                                        {typeFilterOptions.map(opt => (
                                            <button
                                                key={opt.key}
                                                onClick={() => setActiveTypeFilter(opt.key)}
                                                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTypeFilter === opt.key ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-transparent' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {/* Search & Category (hidden if TIME_ONLY and < 6 products) */}
                        {!(workstationType === 'TIME_ONLY' && filteredProducts.length < 6) && (
                            <div className="flex items-center gap-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <Input
                                        placeholder="Buscar productos..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10 bg-white/80 dark:bg-slate-900/50 border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100"
                                    />
                                </div>
                            </div>
                        )}



                        {/* Product Grid — scroll wrapper separate from grid to prevent row compression */}
                        <div className="flex-1 overflow-y-auto min-h-0 pr-1 pb-4">
                            <div className={`grid ${workstationType === 'TIME_ONLY' ? 'grid-cols-2 lg:grid-cols-3 gap-8 pb-10' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'}`}>
                                {isWizardMode && checkoutStep === 'socks' ? (
                                    (() => {
                                        const grouped = filteredProducts.reduce((acc, product) => {
                                            const baseName = getBaseName(product.name);
                                            if (!acc[baseName]) acc[baseName] = [];
                                            acc[baseName].push(product);
                                            return acc;
                                        }, {} as Record<string, Product[]>);

                                        return Object.entries(grouped).map(([baseName, variants]) => {
                                            const first = variants[0];
                                            const totalStock = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
                                            const isOut = totalStock === 0;

                                            return (
                                                <div
                                                    key={baseName}
                                                    className={`group relative bg-white/80 dark:bg-slate-900/40 backdrop-blur-md border border-gray-200 dark:border-white/5 rounded-2xl overflow-hidden transition-all duration-200 hover:border-gray-300 dark:hover:border-white/10 hover:shadow-xl hover:shadow-blue-500/5 flex flex-col h-full ${isOut ? 'opacity-50 grayscale' : ''}`}
                                                >
                                                    <div className="aspect-square relative overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                                                        {first.imagen ? (
                                                            <img src={first.imagen} alt={baseName} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-600">
                                                                <Package className="w-12 h-12 opacity-50" />
                                                            </div>
                                                        )}
                                                        <div className="absolute top-3 right-3 shadow-sm">
                                                            {isOut ? (
                                                                <span className="px-2 py-1 rounded-full text-xs font-bold border bg-red-500/20 text-red-400 border-red-500/30">Agotado</span>
                                                            ) : (
                                                                <span className="px-2 py-1 rounded-full text-xs font-bold border bg-blue-500/90 text-white border-blue-400/50">{totalStock} un.</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="p-4 flex flex-col flex-1">
                                                        <h3 className="font-semibold text-slate-800 dark:text-slate-200 truncate text-sm mb-1">{baseName}</h3>
                                                        <p className="text-blue-600 dark:text-blue-400 font-bold mb-3">
                                                            {formatCurrency(first.price)}
                                                        </p>
                                                        <div className="mt-auto pt-3 border-t border-gray-100 dark:border-white/5 flex gap-2 h-12">
                                                            {variants.map(v => {
                                                                const size = getSizeLabel(v.name);
                                                                const stock = v.stock || 0;
                                                                return (
                                                                    <Button
                                                                        key={v.id}
                                                                        disabled={stock === 0}
                                                                        onClick={() => addToCart(v)}
                                                                        className={`flex-1 rounded-xl flex items-center justify-center font-bold text-sm transition-all ${stock > 0
                                                                            ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 dark:bg-white/5 dark:hover:bg-blue-600/20 dark:text-slate-300 dark:hover:text-blue-400 dark:border-white/5'
                                                                            : 'bg-slate-100 text-slate-400 border border-gray-200 dark:bg-white/5 dark:border-white/5 outline-none cursor-not-allowed opacity-50'
                                                                            }`}
                                                                    >
                                                                        {size === 'Unitalla' ? 'Unitalla' : `Talla ${size}`}
                                                                    </Button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()
                                ) : (
                                    filteredProducts.map(product => (
                                        <div
                                            key={product.id}
                                            className={`group relative bg-white/80 dark:bg-slate-900/40 backdrop-blur-md border border-gray-200 dark:border-white/5 rounded-2xl overflow-hidden transition-all duration-200 hover:border-gray-300 dark:hover:border-white/10 hover:shadow-xl hover:shadow-blue-500/5 flex flex-col h-full ${product.category !== 'service' && product.stock === 0 ? 'opacity-50 grayscale' : ''}`}
                                        >
                                            <div className="aspect-square relative overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                                                {product.imagen ? (
                                                    <img src={product.imagen} alt={product.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-600">
                                                        {getProductIcon(product)}
                                                    </div>
                                                )}
                                                <div className="absolute top-3 right-3 shadow-sm">
                                                    {getStockBadge(product)}
                                                </div>
                                            </div>

                                            <div className="p-4 flex flex-col flex-1">
                                                <h3 className="font-semibold text-slate-800 dark:text-slate-200 truncate text-sm mb-1">{product.name}</h3>
                                                <div className="flex items-center justify-between mt-auto">
                                                    <p className="text-blue-600 dark:text-blue-400 font-bold">
                                                        {product.category === 'service' && product.price === 0 ? 'Var' : formatCurrency(product.price)}
                                                    </p>
                                                </div>

                                                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/5 flex gap-2 h-12">
                                                    {/* Capacity Indicator Button Block */}
                                                    {(() => {
                                                        const isService = product.category === 'service';
                                                        const isPhysical = product.category !== 'service';

                                                        // Check physical stock
                                                        if (isPhysical && product.stock === 0) {
                                                            return (
                                                                <button disabled className="w-full h-full bg-slate-100 dark:bg-white/5 text-slate-500 border border-gray-200 dark:border-white/5 rounded-xl flex items-center justify-center gap-2 transition-all text-sm opacity-60 dark:opacity-40 cursor-not-allowed font-medium">
                                                                    <span>Agotado</span>
                                                                </button>
                                                            );
                                                        }

                                                        // Check Service Capacity (TIME_ONLY)
                                                        if (workstationType === 'TIME_ONLY' && isService) {
                                                            const currentCartQuantity = cart.filter(item => item.product.category === 'service').reduce((sum, item) => sum + item.quantity, 0);
                                                            const capacityFull = currentUsage + currentCartQuantity >= maxCapacity;

                                                            if (capacityFull) {
                                                                return (
                                                                    <button disabled className="w-full h-full text-xs font-bold uppercase tracking-wider bg-red-50 dark:bg-red-600/20 text-red-600 dark:text-red-500 border border-red-200 dark:border-red-500/30 rounded-xl flex items-center justify-center gap-2 transition-all cursor-not-allowed">
                                                                        <AlertTriangle className="w-4 h-4" /> Lleno
                                                                    </button>
                                                                );
                                                            }
                                                        }

                                                        return (
                                                            <button
                                                                onClick={() => addToCart(product)}
                                                                className={`w-full h-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:hover:bg-blue-800/40 dark:border-blue-500/30 dark:text-blue-300 rounded-xl flex items-center justify-center gap-2 transition-all text-sm font-bold ${workstationType === 'TIME_ONLY' ? '!text-base bg-blue-600 text-white border-blue-600 hover:bg-blue-500 hover:border-blue-500 dark:bg-blue-600/80 dark:text-white dark:hover:bg-blue-500' : ''}`}
                                                            >
                                                                <Plus className="w-4 h-4" />
                                                                <span>Añadir</span>
                                                            </button>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    )))}
                                {filteredProducts.length === 0 && (
                                    <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
                                        <Package className="w-12 h-12 mb-3 opacity-20" />
                                        <p>No se encontraron productos</p>
                                    </div>
                                )}
                            </div>

                            {/* Wizard Navigation Footer */}
                            {isWizardMode && (
                                <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 dark:border-white/5 pt-6 mb-2">
                                    {checkoutStep === 'services' && (
                                        <button
                                            onClick={() => setCheckoutStep('socks')}
                                            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95 flex items-center gap-2"
                                        >
                                            Continuar a Calcetas <ChevronRight className="w-5 h-5" />
                                        </button>
                                    )}
                                    {checkoutStep === 'socks' && (
                                        <>
                                            <button
                                                onClick={() => setCheckoutStep('snacks')}
                                                className="px-6 py-3 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 font-bold rounded-xl transition-all active:scale-95 border border-slate-200 dark:border-white/10"
                                            >
                                                Omitir Calcetas
                                            </button>
                                            <button
                                                onClick={() => setCheckoutStep('snacks')}
                                                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95 flex items-center gap-2"
                                            >
                                                Continuar a Snacks <ChevronRight className="w-5 h-5" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Cart Sidebar */}
                    <div className="w-[340px] min-w-[300px] bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-white/5 flex flex-col rounded-2xl shadow-2xl shadow-black/5 dark:shadow-black/50">
                        <div className="p-5 border-b border-slate-200 dark:border-white/5">
                            <div className="flex items-center gap-3 text-slate-800 dark:text-slate-200">
                                <div className="p-2 bg-blue-100 dark:bg-blue-500/10 rounded-lg">
                                    <ShoppingCart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Carrito</h2>
                                <span className="ml-auto bg-slate-100 dark:bg-slate-800 text-xs px-2.5 py-1 rounded-full text-slate-500 dark:text-slate-400">
                                    {cart.reduce((acc, item) => acc + item.quantity, 0)}
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {cart.map((item) => (
                                <div key={item.id} className="flex gap-3 p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-white/5 group hover:border-blue-200 dark:hover:border-white/10 transition-colors">
                                    {item.product.imagen ? (
                                        <img src={item.product.imagen} alt={item.product.name} className="w-14 h-14 rounded-lg object-cover bg-slate-100 dark:bg-slate-800 shrink-0" />
                                    ) : (
                                        <div className="w-14 h-14 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-600 shrink-0">
                                            <Package className="w-6 h-6" />
                                        </div>
                                    )}
                                    <div className="flex-1 flex flex-col justify-between min-w-0">
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="flex flex-col min-w-0">
                                                <h4 className="font-medium text-sm text-slate-700 dark:text-slate-300 truncate">{item.product.name}</h4>
                                                {item.child && (
                                                    <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 px-1.5 py-0.5 rounded inline-block w-fit mt-0.5">
                                                        👦 {item.child.name}
                                                    </span>
                                                )}
                                            </div>
                                            <button onClick={() => removeFromCart(item.id)} className="text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors flex-shrink-0">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="text-blue-600 dark:text-blue-400 font-semibold text-sm">
                                                {formatCurrency(item.product.price * item.quantity)}
                                            </span>
                                            <div className="flex items-center gap-2 bg-white dark:bg-slate-950/50 rounded-lg p-1 border border-slate-200 dark:border-white/5">
                                                <button
                                                    onClick={() => item.quantity > 1 ? updateQuantity(item.id, item.product.price, -1) : removeFromCart(item.id)}
                                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-slate-700 dark:hover:text-white"
                                                >
                                                    <Minus className="w-3 h-3" />
                                                </button>
                                                <span className="text-xs font-bold w-5 text-center text-slate-800 dark:text-slate-200">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateQuantity(item.id, item.product.price, 1)}
                                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {cart.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-600 space-y-4">
                                    <ShoppingCart className="w-12 h-12 opacity-20" />
                                    <p className="text-sm">El carrito está vacío</p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-5 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-white/5 backdrop-blur-md space-y-4">
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                                    <span>Subtotal</span>
                                    <span>{formatCurrency(subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                                    <span>IVA (16%)</span>
                                    <span>{formatCurrency(tax)}</span>
                                </div>
                                <div className="flex justify-between text-slate-900 dark:text-slate-200 text-lg font-bold pt-2 border-t border-slate-200 dark:border-white/10 mt-2">
                                    <span>Total</span>
                                    <span className="text-blue-600 dark:text-blue-400">{formatCurrency(total)}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-950/50 p-1 rounded-xl border border-slate-200 dark:border-white/5">
                                <button
                                    onClick={() => setPaymentMethod('cash')}
                                    className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${paymentMethod === 'cash' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-white/10' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                >
                                    <Banknote className="w-4 h-4" /> Efectivo
                                </button>
                                <button
                                    onClick={() => setPaymentMethod('card')}
                                    className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${paymentMethod === 'card' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-white/10' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                >
                                    <CreditCard className="w-4 h-4" /> Tarjeta
                                </button>
                            </div>

                            <Button
                                disabled={cart.length === 0 || isProcessing}
                                onClick={handleFinalizeSale}
                                className={`w-full py-4 text-base font-bold shadow-md transition-all duration-300 ${cart.length > 0
                                    ? '!bg-emerald-600 hover:!bg-emerald-500 text-white'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                                    }`}
                            >
                                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                                Finalizar Venta
                            </Button>
                        </div>
                    </div>

                    {/* Service Price Modal */}
                    <ServicePriceModal
                        isOpen={!!serviceModalProduct}
                        product={serviceModalProduct}
                        onConfirm={addToCart}
                        onClose={() => setServiceModalProduct(null)}
                    />

                    {/* Success Toast */}
                    {successMessage && (
                        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
                            <div className="flex items-center gap-3 px-5 py-4 bg-emerald-500/10 backdrop-blur-xl border border-emerald-500/20 rounded-xl shadow-2xl shadow-emerald-500/10 ring-1 ring-emerald-500/20">
                                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                                <span className="text-sm font-medium text-emerald-300">{successMessage}</span>
                            </div>
                        </div>
                    )}

                    {/* Child Selection Modal */}
                    {childSelectionProduct && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/60 backdrop-blur-sm animate-in fade-in">
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95">
                                <div className="p-5 text-center border-b border-slate-200 dark:border-white/5">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{childSelectionProduct.product.name}</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">¿A quién se lo asignamos?</p>
                                </div>
                                <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
                                    {selectedChild
                                        .filter(child => !cart.some(item => item.product.category === 'service' && item.child?.id === child.id))
                                        .map(child => (
                                            <button
                                                key={child.id}
                                                onClick={() => {
                                                    addToCart(childSelectionProduct.product, childSelectionProduct.customPriceValue, child);
                                                    setChildSelectionProduct(null);
                                                }}
                                                className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50 dark:hover:bg-blue-600/20 hover:border-blue-300 dark:hover:border-blue-500/30 transition-all text-left group"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 border border-slate-300 dark:border-white/10 group-hover:bg-blue-500 group-hover:border-blue-500 group-hover:text-white transition-colors">
                                                    <Users className="w-5 h-5 text-slate-500 dark:text-slate-400 group-hover:text-white" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-700 dark:group-hover:text-blue-300">{child.name}</p>
                                                </div>
                                            </button>
                                        ))}
                                </div>
                                <div className="p-4 border-t border-slate-200 dark:border-white/5">
                                    <Button
                                        variant="secondary"
                                        onClick={() => setChildSelectionProduct(null)}
                                        className="w-full h-11"
                                    >
                                        Cancelar
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    <ModalAlert
                        isOpen={alertConfig.isOpen}
                        type={alertConfig.type}
                        title={alertConfig.title}
                        message={alertConfig.message}
                        onClose={hideAlert}
                    />
                </div>
            </>)}
        </div>
    );
};

export default POSView;
