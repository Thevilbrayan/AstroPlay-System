import PocketBase from 'pocketbase';
const url = import.meta.env.VITE_PB_URL;
export const pb = new PocketBase(url);
