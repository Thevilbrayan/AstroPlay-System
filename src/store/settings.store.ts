import { create } from 'zustand';
import { Settings } from '../types';
import { pb } from '../lib/pocketbase';

interface SettingsState {
    settings: Settings | null;
    isLoading: boolean;
    error: string | null;
    fetchSettings: () => Promise<void>;
    updateSettings: (params: Partial<Settings>) => Promise<void>;
}

// Single singleton record ID mapped to our pocketbase schema
const SETTINGS_RECORD_ID = 'pbcsettingsv002';

export const useSettingsStore = create<SettingsState>((set) => ({
    settings: null,
    isLoading: false,
    error: null,

    fetchSettings: async () => {
        set({ isLoading: true, error: null });
        try {
            const record = await pb.collection('settings').getOne<Settings>(SETTINGS_RECORD_ID);
            set({ settings: record, isLoading: false });
        } catch (error: any) {
            console.error('Failed to fetch settings:', error);
            // Fallback default structure if record doesn't exist yet, to prevent app crash
            const defaultSettings: Settings = {
                id: SETTINGS_RECORD_ID,
                max_capacity: 50,
                grace_period: 5,
                fraction_size: 15,
                fixed_opening_balance: 500,
                require_admin_pin: true,
                admin_pin: '1234',
                require_signature: false,
                is_cash_session_mandatory: true,
                loyalty_rate: 1,
                points_redemption_value: 0.10,
            };
            set({ settings: defaultSettings, isLoading: false, error: error.message });
        }
    },

    updateSettings: async (params) => {
        set({ isLoading: true, error: null });
        try {
            const record = await pb.collection('settings').update<Settings>(SETTINGS_RECORD_ID, params);
            set({ settings: record, isLoading: false });
        } catch (error: any) {
            if (error.status === 404) {
                try {
                    console.log("Settings record not found, attempting to create...");
                    const newRecord = await pb.collection('settings').create<Settings>({
                        ...params,
                        id: SETTINGS_RECORD_ID
                    });
                    set({ settings: newRecord, isLoading: false });
                    return;
                } catch (createError: any) {
                    console.error('Failed to create settings:', createError);
                    set({ isLoading: false, error: createError.message });
                    throw createError;
                }
            }
            console.error('Failed to update settings:', error);
            set({ isLoading: false, error: error.message });
            throw error;
        }
    }
}));
