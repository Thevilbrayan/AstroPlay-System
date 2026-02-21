import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, ShoppingCart, Package, Trash2, Plus, Minus, CreditCard, Banknote, Zap, Edit3, CheckCircle2, Users, X } from 'lucide-react';
import { Product } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import ServicePriceModal from './ServicePriceModal';
import { useAuthStore } from '../../store/auth.store';
import { useSessionStore } from '../../store/session.store';
import { useWorkstationStore } from '../../store/workstation.store';
import { pb } from '../../lib/pocketbase';

interface CartItem {
    product: Product;
    quantity: number;
}

interface POSViewProps {
    products: Product[];
    formatCurrency: (amount: number) => string;
    onSaleComplete?: () => void;
    onNavigate?: (view: string) => void;
}

const POSView: React.FC<POSViewProps> = ({ products, formatCurrency, onSaleComplete, onNavigate }) => {
    const { user } = useAuthStore();
    const { activeParent, selectedChild, isFirstVisit, clearSession } = useSessionStore();
    const { workstationId, workstationType } = useWorkstationStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTypeFilter, setActiveTypeFilter] = useState<'all' | 'physical' | 'service'>('all');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
    const [isProcessing, setIsProcessing] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const autoCartDone = useRef(false);

    // Service modal
    const [serviceModalProduct, setServiceModalProduct] = useState<Product | null>(null);

    // Auto-add entry products when coming from check-in
    useEffect(() => {
        if (autoCartDone.current || !activeParent || selectedChild.length === 0 || products.length === 0) return;
        autoCartDone.current = true;
        // Find an "Entrada" product (service_fixed type or name contains "entrada")
        const entryProduct = products.find(p =>
            p.name.toLowerCase().includes('entrada') && p.is_for_sale !== false
        );
        if (entryProduct) {
            setCart([{ product: entryProduct, quantity: selectedChild.length }]);
        }
    }, [activeParent, selectedChild, products]);

    // Filter: only show is_for_sale products (default true if undefined)
    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            // Note: Disabled is_for_sale check temporarily because existing PocketBase products default to false
            // if (product.is_for_sale === false) return false;

            // By Workstation Type Enforcment
            if (workstationType === 'SNACK_ONLY' && (product.type === 'service_fixed' || product.type === 'service_open')) return false;
            if (workstationType === 'TIME_ONLY' && (product.type === 'physical' || !product.type)) return false;

            const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());

            // By Type Menu
            let matchesType = true;
            if (activeTypeFilter === 'physical') {
                matchesType = product.type === 'physical' || !product.type;
            } else if (activeTypeFilter === 'service') {
                matchesType = product.type === 'service_fixed' || product.type === 'service_open';
            }

            return matchesSearch && matchesType;
        });
    }, [products, searchQuery, activeTypeFilter, workstationType]);

    // Cart calculations
    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const tax = subtotal * 0.16;
    const total = subtotal + tax;

    const addToCart = (product: Product, customPriceValue?: number) => {
        if (product.type === 'service_open' && !customPriceValue) {
            setServiceModalProduct(product);
            return;
        }

        if ((product.type === 'physical' || !product.type) && (product.stock || 0) === 0) return;

        const priceToUse = customPriceValue !== undefined ? customPriceValue : product.price;

        setCart(prev => {
            const productToAdd = { ...product, price: priceToUse };
            const existingIndex = prev.findIndex(item => item.product.id === product.id && item.product.price === productToAdd.price);

            if (existingIndex >= 0) {
                const existing = prev[existingIndex];
                if ((product.type === 'physical' || !product.type) && existing.quantity >= (product.stock || 0)) return prev;
                const newCart = [...prev];
                newCart[existingIndex] = { ...existing, quantity: existing.quantity + 1 };
                return newCart;
            }

            return [...prev, { product: productToAdd, quantity: 1 }];
        });
    };

    const removeFromCart = (productId: string) => {
        setCart(prev => prev.filter(item => item.product.id !== productId));
    };

    const updateQuantity = (productId: string, price: number, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.product.id === productId && item.product.price === price) {
                const newQuantity = item.quantity + delta;
                if (newQuantity <= 0) return item;
                const isPhysical = item.product.type === 'physical' || !item.product.type;
                if (isPhysical && newQuantity > (item.product.stock || 0)) return item;
                return { ...item, quantity: newQuantity };
            }
            return item;
        }));
    };

    const handleFinalizeSale = async () => {
        if (cart.length === 0) return;
        if (!workstationId) {
            alert('Error: Estación de caja no configurada. Por favor recarga la aplicación.');
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

                // 2. Deduct physical stock
                const isPhysical = item.product.type === 'physical' || !item.product.type;
                if (isPhysical) {
                    const currentProduct = products.find(p => p.id === item.product.id);
                    if (currentProduct) {
                        const newStock = Math.max(0, (currentProduct.stock || 0) - item.quantity);
                        await pb.collection('products').update(item.product.id, { stock: newStock });
                    }
                }

                // 3. Spawning Session timers for Services
                const isService = item.product.type === 'service_fixed' || item.product.type === 'service_open';
                if (isService && activeParent && selectedChild.length > 0) {
                    // Extract exact minutes from product's name (Assume 60 mins if missing digits)
                    const extractDigits = item.product.name.match(/\d+/);
                    const durationMins = extractDigits ? parseInt(extractDigits[0], 10) : 60;

                    const startTime = new Date();
                    const endTime = new Date(startTime.getTime() + durationMins * 60000);

                    await pb.collection('sessions').create({
                        parent: activeParent.id,
                        child: selectedChild.map(c => c.id),
                        sale: saleRecord.id,
                        status: 'active',
                        operator: user?.id || '',
                        start_time: startTime.toISOString(),
                        end_time: endTime.toISOString(),
                    });
                }
            }

            // 4. Success: Clear context and Redirect
            setCart([]);
            const familyLabel = activeParent ? ` — Familia ${activeParent.name}` : '';
            setSuccessMessage(`Venta y sesión registradas exitosamente${familyLabel}`);

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
            alert('Falló el procesamiento de la venta o sesión. El carrito no se ha borrado. Intenta de nuevo.');
        } finally {
            setIsProcessing(false);
        }
    };

    const getStockBadge = (product: Product) => {
        if (product.type && product.type !== 'physical') return null;
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
        if (product.type === 'service_fixed') return <Zap className="w-12 h-12 opacity-50" />;
        if (product.type === 'service_open') return <Edit3 className="w-12 h-12 opacity-50" />;
        return <Package className="w-12 h-12 opacity-50" />;
    };

    const typeFilterOptions = [
        { key: 'all' as const, label: 'Todos' },
        { key: 'physical' as const, label: 'Físicos' },
        { key: 'service' as const, label: 'Servicios' },
    ];

    return (
        <div className="flex flex-col h-full gap-3">

            {/* Active Check-In Banner */}
            {activeParent && (
                <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl shrink-0">
                    <Users className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="text-sm font-semibold text-blue-200">Atendiendo a:</span>
                    <span className="text-sm font-bold text-slate-100">Familia {activeParent.name}</span>
                    <span className="text-xs text-blue-300/60">·</span>
                    <span className="text-sm text-blue-300">{selectedChild.length} niño{selectedChild.length !== 1 ? 's' : ''}</span>
                    {isFirstVisit && (
                        <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Primera Visita</span>
                    )}
                    <button onClick={() => { clearSession(); autoCartDone.current = false; setCart([]); }}
                        className="ml-auto p-1 text-slate-500 hover:text-slate-300 rounded-md hover:bg-white/5 transition-colors">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            <div className="flex flex-1 gap-6 min-h-0">
                {/* Left: Product Gallery */}
                <div className="flex-1 flex flex-col gap-4 min-w-0">
                    {/* Type Filters */}
                    <div className="flex p-1 bg-slate-900/50 rounded-xl border border-white/5">
                        {typeFilterOptions.map(opt => (
                            <button
                                key={opt.key}
                                onClick={() => setActiveTypeFilter(opt.key)}
                                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTypeFilter === opt.key ? 'bg-slate-800 text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* Search & Category */}
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1">
                            <Input
                                icon={<Search className="w-5 h-5" />}
                                placeholder="Buscar productos..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-slate-900/50 border-white/10"
                            />
                        </div>
                    </div>



                    {/* Product Grid — scroll wrapper separate from grid to prevent row compression */}
                    <div className="flex-1 overflow-y-auto min-h-0 pr-1 pb-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {filteredProducts.map(product => (
                                <div
                                    key={product.id}
                                    className={`group relative bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden transition-all duration-200 hover:border-white/10 hover:shadow-xl hover:shadow-blue-500/5 ${(product.type === 'physical' || !product.type) && product.stock === 0 ? 'opacity-50 grayscale' : ''}`}
                                >
                                    <div className="aspect-square relative overflow-hidden bg-slate-800">
                                        {product.imagen ? (
                                            <img src={product.imagen} alt={product.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                                                {getProductIcon(product)}
                                            </div>
                                        )}
                                        <div className="absolute top-3 right-3">
                                            {getStockBadge(product)}
                                        </div>
                                    </div>

                                    <div className="p-4">
                                        <h3 className="font-semibold text-slate-200 truncate text-sm">{product.name}</h3>
                                        <p className="text-blue-400 font-bold mt-1">
                                            {product.type === 'service_open' ? 'Precio variable' : formatCurrency(product.price)}
                                        </p>
                                        <button
                                            onClick={() => addToCart(product)}
                                            disabled={(product.type === 'physical' || !product.type) && product.stock === 0}
                                            className="mt-3 w-full py-2 bg-white/5 hover:bg-blue-600/20 hover:text-blue-400 border border-white/5 rounded-lg flex items-center justify-center gap-2 transition-all text-sm disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/5 disabled:hover:text-slate-500"
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span>
                                                {(product.type === 'physical' || !product.type) && product.stock === 0 ? 'Agotado' : 'Añadir'}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {filteredProducts.length === 0 && (
                                <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-500">
                                    <Package className="w-12 h-12 mb-3 opacity-20" />
                                    <p>No se encontraron productos</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Cart Sidebar */}
                <div className="w-[340px] min-w-[300px] bg-slate-900/60 backdrop-blur-xl border border-white/5 flex flex-col rounded-2xl shadow-2xl shadow-black/50">
                    <div className="p-5 border-b border-white/5">
                        <div className="flex items-center gap-3 text-slate-200">
                            <div className="p-2 bg-blue-500/10 rounded-lg">
                                <ShoppingCart className="w-5 h-5 text-blue-400" />
                            </div>
                            <h2 className="text-lg font-bold text-slate-100">Carrito</h2>
                            <span className="ml-auto bg-slate-800 text-xs px-2.5 py-1 rounded-full text-slate-400">
                                {cart.reduce((acc, item) => acc + item.quantity, 0)}
                            </span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {cart.map((item, idx) => (
                            <div key={`${item.product.id}-${item.product.price}-${idx}`} className="flex gap-3 p-3 bg-slate-800/30 rounded-xl border border-white/5 group hover:border-white/10 transition-colors">
                                {item.product.imagen ? (
                                    <img src={item.product.imagen} alt={item.product.name} className="w-14 h-14 rounded-lg object-cover bg-slate-800" />
                                ) : (
                                    <div className="w-14 h-14 rounded-lg bg-slate-800 flex items-center justify-center text-slate-600">
                                        <Package className="w-6 h-6" />
                                    </div>
                                )}
                                <div className="flex-1 flex flex-col justify-between min-w-0">
                                    <div className="flex justify-between items-start gap-2">
                                        <h4 className="font-medium text-sm text-slate-300 truncate">{item.product.name}</h4>
                                        <button onClick={() => removeFromCart(item.product.id)} className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between mt-2">
                                        <span className="text-blue-400 font-semibold text-sm">
                                            {formatCurrency(item.product.price * item.quantity)}
                                        </span>
                                        <div className="flex items-center gap-2 bg-slate-950/50 rounded-lg p-1 border border-white/5">
                                            <button
                                                onClick={() => item.quantity > 1 ? updateQuantity(item.product.id, item.product.price, -1) : removeFromCart(item.product.id)}
                                                className="p-1 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-white"
                                            >
                                                <Minus className="w-3 h-3" />
                                            </button>
                                            <span className="text-xs font-bold w-5 text-center">{item.quantity}</span>
                                            <button
                                                onClick={() => updateQuantity(item.product.id, item.product.price, 1)}
                                                className="p-1 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                            >
                                                <Plus className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {cart.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-4">
                                <ShoppingCart className="w-12 h-12 opacity-20" />
                                <p className="text-sm">El carrito está vacío</p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-5 bg-slate-900/80 border-t border-white/5 backdrop-blur-md space-y-4">
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between text-slate-400">
                                <span>Subtotal</span>
                                <span>{formatCurrency(subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                                <span>IVA (16%)</span>
                                <span>{formatCurrency(tax)}</span>
                            </div>
                            <div className="flex justify-between text-slate-200 text-lg font-bold pt-2 border-t border-white/10 mt-2">
                                <span>Total</span>
                                <span className="text-blue-400">{formatCurrency(total)}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 bg-slate-950/50 p-1 rounded-xl border border-white/5">
                            <button
                                onClick={() => setPaymentMethod('cash')}
                                className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${paymentMethod === 'cash' ? 'bg-slate-800 text-white shadow-sm ring-1 ring-white/10' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <Banknote className="w-4 h-4" /> Efectivo
                            </button>
                            <button
                                onClick={() => setPaymentMethod('card')}
                                className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${paymentMethod === 'card' ? 'bg-slate-800 text-white shadow-sm ring-1 ring-white/10' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <CreditCard className="w-4 h-4" /> Tarjeta
                            </button>
                        </div>

                        <Button
                            variant="primary"
                            isLoading={isProcessing}
                            disabled={cart.length === 0 || isProcessing}
                            onClick={handleFinalizeSale}
                            className="w-full py-4 text-base shadow-xl shadow-blue-500/20"
                        >
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
            </div>
        </div>
    );
};

export default POSView;
