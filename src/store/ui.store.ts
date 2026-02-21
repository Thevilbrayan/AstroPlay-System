import { create } from 'zustand';

interface UIState {
    isFullscreen: boolean;
    setFullscreen: (v: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
    isFullscreen: false,
    setFullscreen: (v) => set({ isFullscreen: v }),
}));
