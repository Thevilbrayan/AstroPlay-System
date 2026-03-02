import { create } from 'zustand';
import { Session, Child } from '../types';

interface CartActionState {
    pendingAction: {
        type: 'ADD_OVERTIME';
        session: Session;
        child: Child;
        basePrice: number;
    } | null;
    setPendingAction: (action: CartActionState['pendingAction']) => void;
    clearPendingAction: () => void;
}

export const useCartActionStore = create<CartActionState>((set) => ({
    pendingAction: null,
    setPendingAction: (action) => set({ pendingAction: action }),
    clearPendingAction: () => set({ pendingAction: null }),
}));
