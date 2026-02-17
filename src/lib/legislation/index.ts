// ═══════════════════════════════════════════════════════════════
// Civic Social — Legislation Module Barrel Export
// ═══════════════════════════════════════════════════════════════

export * from './canonical-key';
export * from './types';
export * from './congress-api';
export * from './bill-store';
export * from './impact-generator';

// Re-export fetchBillListing explicitly for clarity
// (it's already exported via congress-api, but this documents its availability)
