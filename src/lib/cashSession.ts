import { pb } from './pocketbase';
import { CashSession } from '../types';

/**
 * Cash Session Manager — controls the open/close lifecycle of a cash register session.
 * 
 * Rules:
 *  - Only ONE open session per operator+station at a time.
 *  - Sales cannot be created without an active session.
 *  - Closing requires a blind cash count (reported_cash).
 */

/**
 * Helper to fetch the handover (cash retained) from the last closed session
 * at a specific workstation.
 */
export async function getNextOpeningBalance(stationId: string): Promise<number> {
    try {
        const lastSession = await pb.collection('cash_sessions').getFirstListItem<CashSession>(
            `station = "${stationId}"`,
            { sort: '-created' }
        );
        // If the last session has a cash_retained value, that is our starting point.
        // Otherwise, default to 1000 (typical base amount). You can change this or pull from Workstation settings later.
        return lastSession.cash_retained ?? 1000;
    } catch (err: any) {
        if (err?.status === 404) return 1000; // No previous history
        throw err;
    }
}

/** Open a new cash session for an operator at a workstation. */
export async function openCashSession(
    operatorId: string,
    stationId: string,
    openingBalance: number
): Promise<CashSession> {
    // Guard: check no existing open session for this operator+station
    const existing = await getActiveCashSession(operatorId, stationId);
    if (existing) {
        throw new Error('Ya existe una sesión de caja abierta para este operador y estación.');
    }

    const record = await pb.collection('cash_sessions').create({
        operator: operatorId,
        station: stationId,
        opening_balance: openingBalance,
        sales_total: 0,
        status: 'open',
        opened_at: new Date().toISOString(),
    });

    return record as unknown as CashSession;
}

/** Get the active (open) cash session for an operator at a specific workstation. */
export async function getActiveCashSession(
    operatorId: string,
    stationId: string
): Promise<CashSession | null> {
    try {
        const result = await pb.collection('cash_sessions').getFirstListItem(
            `operator = "${operatorId}" && station = "${stationId}" && status = "open"`
        );
        return result as unknown as CashSession;
    } catch (err: any) {
        // PocketBase throws 404 when no record matches getFirstListItem
        if (err?.status === 404) return null;
        throw err;
    }
}

/**
 * Close a cash session with the operator's blind count.
 * Calculates difference = reported_cash - (opening_balance + sales_total)
 */
export async function closeCashSession(
    sessionId: string,
    reportedCash: number,
    salesTotalOverride?: number,
    notes?: string,
    cashRetained?: number,
    cashWithdrawn?: number
): Promise<CashSession> {
    // Fetch the current session to get opening_balance and sales_total
    const session = await pb.collection('cash_sessions').getOne(sessionId) as unknown as CashSession;

    if (session.status === 'closed') {
        throw new Error('Esta sesión de caja ya fue cerrada.');
    }

    const openingBalance = session.opening_balance || 0;
    const salesTotal = salesTotalOverride ?? session.sales_total ?? 0;
    const expectedCash = openingBalance + salesTotal;
    const difference = reportedCash - expectedCash;

    const updated = await pb.collection('cash_sessions').update(sessionId, {
        reported_cash: reportedCash,
        sales_total: salesTotal,
        difference: difference,
        status: 'closed',
        closed_at: new Date().toISOString(),
        notes: notes || '',
        cash_retained: cashRetained || 0,
        cash_withdrawn: cashWithdrawn || 0,
        audit_status: 'pending',
    });

    return updated as unknown as CashSession;
}

/**
 * Increment the sales_total on the active cash session.
 * Called after each successful sale.
 */
export async function incrementSessionSales(
    sessionId: string,
    amount: number
): Promise<void> {
    const session = await pb.collection('cash_sessions').getOne(sessionId) as unknown as CashSession;
    const newTotal = (session.sales_total || 0) + amount;
    await pb.collection('cash_sessions').update(sessionId, {
        sales_total: newTotal,
    });
}
