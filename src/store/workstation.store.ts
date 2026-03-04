import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WorkstationState {
    workstationId: string | null;
    workstationName: string | null;
    workstationType: 'FULL_SERVICE' | 'SNACK_ONLY' | 'TIME_ONLY' | 'DINO_TREN' | null;
    trainCapacity: number | null;      // Max passengers per train trip (DINO_TREN)
    dinoCapacity: number | null;       // Max simultaneous dino sessions (DINO_TREN)
    gokartCapacity: number | null;     // Number of go-karts (TIME_ONLY)
    playgroundCapacity: number | null; // Max simultaneous children (FULL_SERVICE)
    setWorkstation: (id: string, name: string, type: 'FULL_SERVICE' | 'SNACK_ONLY' | 'TIME_ONLY' | 'DINO_TREN' | undefined, trainCapacity?: number, dinoCapacity?: number, gokartCapacity?: number, playgroundCapacity?: number) => void;
    clearWorkstation: () => void;
}

export const useWorkstationStore = create<WorkstationState>()(
    persist(
        (set) => ({
            workstationId: null,
            workstationName: null,
            workstationType: null,
            trainCapacity: null,
            dinoCapacity: null,
            gokartCapacity: null,
            playgroundCapacity: null,
            setWorkstation: (id, name, type, trainCapacity, dinoCapacity, gokartCapacity, playgroundCapacity) => set({
                workstationId: id,
                workstationName: name,
                workstationType: type || 'FULL_SERVICE',
                trainCapacity: trainCapacity ?? null,
                dinoCapacity: dinoCapacity ?? null,
                gokartCapacity: gokartCapacity ?? null,
                playgroundCapacity: playgroundCapacity ?? null,
            }),
            clearWorkstation: () => set({ workstationId: null, workstationName: null, workstationType: null, trainCapacity: null, dinoCapacity: null, gokartCapacity: null, playgroundCapacity: null }),
        }),
        {
            name: 'workstation-storage',
        }
    )
);
