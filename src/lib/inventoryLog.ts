import { pb } from './pocketbase';

/**
 * Creates an inventory log entry for audit trail purposes.
 * Called automatically on: sales (stock deduction), adjustments, waste, purchases.
 */
export async function createInventoryLog(
    productId: string,
    quantity: number,
    type: 'purchase' | 'sale' | 'adjustment' | 'waste',
    operatorId: string
): Promise<void> {
    try {
        await pb.collection('inventory_logs').create({
            product: productId,
            quantity,
            type,
            operator: operatorId,
        });
    } catch (err) {
        // Non-blocking: log errors but don't break the parent operation
        console.error('[InventoryLog] Failed to create log entry:', err);
    }
}
