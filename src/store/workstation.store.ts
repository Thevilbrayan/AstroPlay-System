import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WorkstationState {
    workstationId: string | null;
    workstationName: string | null;
    workstationType: 'FULL_SERVICE' | 'SNACK_ONLY' | 'TIME_ONLY' | null;
    setWorkstation: (id: string, name: string, type: 'FULL_SERVICE' | 'SNACK_ONLY' | 'TIME_ONLY' | undefined) => void;
    clearWorkstation: () => void;
}

export const useWorkstationStore = create<WorkstationState>()(
    persist(
        (set) => ({
            workstationId: null,
            workstationName: null,
            workstationType: null,
            setWorkstation: (id, name, type) => set({ workstationId: id, workstationName: name, workstationType: type || 'FULL_SERVICE' }),
            clearWorkstation: () => set({ workstationId: null, workstationName: null, workstationType: null }),
        }),
        {
            name: 'workstation-storage',
        }
    )
);
