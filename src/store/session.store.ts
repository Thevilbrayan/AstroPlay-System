import { create } from 'zustand';
import { Parent, Child } from '../types';

interface SessionState {
    activeParent: Parent | null;
    selectedChild: Child[];
    sessionId: string | null;
    isFirstVisit: boolean;
    setSession: (parent: Parent, child: Child[], sessionId: string | null, isFirstVisit: boolean) => void;
    clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
    activeParent: null,
    selectedChild: [],
    sessionId: null,
    isFirstVisit: false,
    setSession: (parent, child, sessionId, isFirstVisit) =>
        set({ activeParent: parent, selectedChild: child, sessionId, isFirstVisit }),
    clearSession: () =>
        set({ activeParent: null, selectedChild: [], sessionId: null, isFirstVisit: false }),
}));
