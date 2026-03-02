import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CashSession } from '../types';
import { getActiveCashSession, openCashSession } from '../lib/cashSession';

interface CashSessionState {
    /** The active session object, null if none */
    activeSession: CashSession | null;
    /** Loading flag for async operations */
    isLoading: boolean;
    /** Error message from last operation */
    error: string | null;
    /** Load the active session from PocketBase for the current operator+station */
    loadSession: (operatorId: string, stationId: string) => Promise<CashSession | null>;
    /** Open a new cash session */
    openNewSession: (operatorId: string, stationId: string, openingBalance: number) => Promise<CashSession>;
    /** Clear the local session (after closing in PB) */
    clearSession: () => void;
}

export const useCashSessionStore = create<CashSessionState>()(
    persist(
        (set) => ({
            activeSession: null,
            isLoading: false,
            error: null,

            loadSession: async (operatorId, stationId) => {
                set({ isLoading: true, error: null });
                try {
                    const session = await getActiveCashSession(operatorId, stationId);
                    set({ activeSession: session, isLoading: false });
                    return session;
                } catch (err: any) {
                    set({ isLoading: false, error: err.message || 'Error loading session' });
                    return null;
                }
            },

            openNewSession: async (operatorId, stationId, openingBalance) => {
                set({ isLoading: true, error: null });
                try {
                    const session = await openCashSession(operatorId, stationId, openingBalance);
                    set({ activeSession: session, isLoading: false });
                    return session;
                } catch (err: any) {
                    set({ isLoading: false, error: err.message || 'Error opening session' });
                    throw err;
                }
            },

            clearSession: () => set({ activeSession: null, error: null }),
        }),
        {
            name: 'cash-session-storage',
        }
    )
);
