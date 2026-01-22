import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the clients.json data
vi.mock('./clients.json', () => ({
    default: {
        clients: [
            { id: 'bank-local-1', name: 'First Community Bank', industry: 'banking', clientType: 'bank-local', tier: 'local', minReputation: 1 },
            { id: 'bank-local-2', name: 'Metro Credit Union', industry: 'banking', clientType: 'bank-local', tier: 'local', minReputation: 1 },
            { id: 'bank-regional-1', name: 'Pacific Regional Bank', industry: 'banking', clientType: 'bank-regional', tier: 'regional', minReputation: 2 },
            { id: 'bank-national-1', name: 'National Trust Bank', industry: 'banking', clientType: 'bank-national', tier: 'national', minReputation: 4 },
            { id: 'corp-small-1', name: 'TechStart Inc', industry: 'corporate', clientType: 'corp-small', tier: 'small', minReputation: 1 },
            { id: 'corp-medium-1', name: 'DataFlow Solutions', industry: 'corporate', clientType: 'corp-medium', tier: 'medium', minReputation: 2 },
            { id: 'corp-enterprise-1', name: 'Global Dynamics', industry: 'corporate', clientType: 'corp-enterprise', tier: 'enterprise', minReputation: 5 },
            { id: 'health-clinic-1', name: 'Downtown Medical Clinic', industry: 'healthcare', clientType: 'health-clinic', tier: 'clinic', minReputation: 1 },
            { id: 'gov-municipal-1', name: 'City Hall Records', industry: 'government', clientType: 'gov-municipal', tier: 'municipal', minReputation: 2 },
        ],
        industries: {
            banking: { displayName: 'Banking & Finance', description: 'Financial institutions' },
            corporate: { displayName: 'Corporate', description: 'Business enterprises' },
            healthcare: { displayName: 'Healthcare', description: 'Medical facilities' },
            government: { displayName: 'Government', description: 'Public sector' },
        },
    },
}));

import {
    getAllClients,
    getClientById,
    getClientsByIndustry,
    getClientsByClientType,
    getAccessibleClients,
    getLockedClients,
    isClientAccessible,
    getIndustries,
    getIndustryInfo,
    getClientsGroupedByIndustry,
    getAllClientTypes,
    getFilteredClients,
    getRandomAccessibleClient,
    getRandomClientFromIndustry,
    getClientCount,
    getRegistryStats,
} from './clientRegistry';

// ============================================================================
// Tests
// ============================================================================

describe('clientRegistry', () => {
    // ========================================================================
    // getAllClients
    // ========================================================================

    describe('getAllClients', () => {
        it('should return all clients', () => {
            const clients = getAllClients();
            expect(clients).toHaveLength(9);
        });

        it('should return a copy, not the original array', () => {
            const clients1 = getAllClients();
            const clients2 = getAllClients();

            expect(clients1).not.toBe(clients2);
            expect(clients1).toEqual(clients2);
        });
    });

    // ========================================================================
    // getClientById
    // ========================================================================

    describe('getClientById', () => {
        it('should return client for valid ID', () => {
            const client = getClientById('bank-local-1');

            expect(client).toBeDefined();
            expect(client.id).toBe('bank-local-1');
            expect(client.name).toBe('First Community Bank');
        });

        it('should return undefined for invalid ID', () => {
            const client = getClientById('non-existent');

            expect(client).toBeUndefined();
        });

        it('should return undefined for null/undefined', () => {
            expect(getClientById(null)).toBeUndefined();
            expect(getClientById(undefined)).toBeUndefined();
        });
    });

    // ========================================================================
    // getClientsByIndustry
    // ========================================================================

    describe('getClientsByIndustry', () => {
        it('should return all clients for banking industry', () => {
            const clients = getClientsByIndustry('banking');

            expect(clients).toHaveLength(4);
            clients.forEach(c => expect(c.industry).toBe('banking'));
        });

        it('should return all clients for corporate industry', () => {
            const clients = getClientsByIndustry('corporate');

            expect(clients).toHaveLength(3);
            clients.forEach(c => expect(c.industry).toBe('corporate'));
        });

        it('should return empty array for non-existent industry', () => {
            const clients = getClientsByIndustry('nonexistent');

            expect(clients).toEqual([]);
        });
    });

    // ========================================================================
    // getClientsByClientType
    // ========================================================================

    describe('getClientsByClientType', () => {
        it('should return clients for bank-local type', () => {
            const clients = getClientsByClientType('bank-local');

            expect(clients).toHaveLength(2);
            clients.forEach(c => expect(c.clientType).toBe('bank-local'));
        });

        it('should return empty array for non-existent client type', () => {
            const clients = getClientsByClientType('nonexistent');

            expect(clients).toEqual([]);
        });
    });

    // ========================================================================
    // getAccessibleClients
    // ========================================================================

    describe('getAccessibleClients', () => {
        it('should return clients accessible at reputation 1', () => {
            const clients = getAccessibleClients(1);

            // bank-local-1, bank-local-2, corp-small-1, health-clinic-1
            expect(clients).toHaveLength(4);
            clients.forEach(c => expect(c.minReputation).toBeLessThanOrEqual(1));
        });

        it('should return more clients at higher reputation', () => {
            const rep1Clients = getAccessibleClients(1);
            const rep2Clients = getAccessibleClients(2);
            const rep5Clients = getAccessibleClients(5);

            expect(rep2Clients.length).toBeGreaterThan(rep1Clients.length);
            expect(rep5Clients.length).toBeGreaterThan(rep2Clients.length);
        });

        it('should return all clients at max reputation', () => {
            const clients = getAccessibleClients(10);

            expect(clients).toHaveLength(9);
        });

        it('should return empty array at reputation 0', () => {
            const clients = getAccessibleClients(0);

            expect(clients).toHaveLength(0);
        });
    });

    // ========================================================================
    // getLockedClients
    // ========================================================================

    describe('getLockedClients', () => {
        it('should return clients locked at reputation 1', () => {
            const clients = getLockedClients(1);

            // All except rep 1 clients
            expect(clients.length).toBeGreaterThan(0);
            clients.forEach(c => expect(c.minReputation).toBeGreaterThan(1));
        });

        it('should return empty array at max reputation', () => {
            const clients = getLockedClients(10);

            expect(clients).toHaveLength(0);
        });

        it('should be complementary to getAccessibleClients', () => {
            const accessible = getAccessibleClients(2);
            const locked = getLockedClients(2);

            expect(accessible.length + locked.length).toBe(9);
        });
    });

    // ========================================================================
    // isClientAccessible
    // ========================================================================

    describe('isClientAccessible', () => {
        it('should return true for accessible client', () => {
            expect(isClientAccessible('bank-local-1', 1)).toBe(true);
        });

        it('should return false for locked client', () => {
            expect(isClientAccessible('bank-national-1', 1)).toBe(false);
        });

        it('should return true for locked client at higher reputation', () => {
            expect(isClientAccessible('bank-national-1', 5)).toBe(true);
        });

        it('should return false for non-existent client', () => {
            expect(isClientAccessible('nonexistent', 10)).toBe(false);
        });
    });

    // ========================================================================
    // getIndustries
    // ========================================================================

    describe('getIndustries', () => {
        it('should return all industry names', () => {
            const industries = getIndustries();

            expect(industries).toContain('banking');
            expect(industries).toContain('corporate');
            expect(industries).toContain('healthcare');
            expect(industries).toContain('government');
        });
    });

    // ========================================================================
    // getIndustryInfo
    // ========================================================================

    describe('getIndustryInfo', () => {
        it('should return industry metadata', () => {
            const info = getIndustryInfo('banking');

            expect(info).toBeDefined();
            expect(info.displayName).toBe('Banking & Finance');
            expect(info.description).toBeDefined();
        });

        it('should return undefined for non-existent industry', () => {
            expect(getIndustryInfo('nonexistent')).toBeUndefined();
        });
    });

    // ========================================================================
    // getClientsGroupedByIndustry
    // ========================================================================

    describe('getClientsGroupedByIndustry', () => {
        it('should return clients grouped by industry', () => {
            const grouped = getClientsGroupedByIndustry();

            expect(grouped.banking).toHaveLength(4);
            expect(grouped.corporate).toHaveLength(3);
            expect(grouped.healthcare).toHaveLength(1);
            expect(grouped.government).toHaveLength(1);
        });

        it('should return copies of arrays', () => {
            const grouped1 = getClientsGroupedByIndustry();
            const grouped2 = getClientsGroupedByIndustry();

            expect(grouped1.banking).not.toBe(grouped2.banking);
        });
    });

    // ========================================================================
    // getAllClientTypes
    // ========================================================================

    describe('getAllClientTypes', () => {
        it('should return all unique client types', () => {
            const types = getAllClientTypes();

            expect(types).toContain('bank-local');
            expect(types).toContain('bank-regional');
            expect(types).toContain('bank-national');
            expect(types).toContain('corp-small');
            expect(types).toContain('corp-medium');
            expect(types).toContain('corp-enterprise');
        });
    });

    // ========================================================================
    // getFilteredClients
    // ========================================================================

    describe('getFilteredClients', () => {
        it('should filter by industry', () => {
            const clients = getFilteredClients({ industry: 'banking' });

            expect(clients).toHaveLength(4);
            clients.forEach(c => expect(c.industry).toBe('banking'));
        });

        it('should filter by tier', () => {
            const clients = getFilteredClients({ tier: 'local' });

            expect(clients).toHaveLength(2);
            clients.forEach(c => expect(c.tier).toBe('local'));
        });

        it('should filter by maxReputation', () => {
            const clients = getFilteredClients({ maxReputation: 2 });

            clients.forEach(c => expect(c.minReputation).toBeLessThanOrEqual(2));
        });

        it('should filter by minReputation', () => {
            const clients = getFilteredClients({ minReputation: 4 });

            clients.forEach(c => expect(c.minReputation).toBeGreaterThanOrEqual(4));
        });

        it('should exclude specified IDs', () => {
            const clients = getFilteredClients({
                excludeIds: ['bank-local-1', 'bank-local-2'],
            });

            expect(clients.find(c => c.id === 'bank-local-1')).toBeUndefined();
            expect(clients.find(c => c.id === 'bank-local-2')).toBeUndefined();
        });

        it('should combine multiple filters', () => {
            const clients = getFilteredClients({
                industry: 'banking',
                maxReputation: 2,
            });

            expect(clients.length).toBeGreaterThan(0);
            clients.forEach(c => {
                expect(c.industry).toBe('banking');
                expect(c.minReputation).toBeLessThanOrEqual(2);
            });
        });

        it('should return all clients with no filters', () => {
            const clients = getFilteredClients({});

            expect(clients).toHaveLength(9);
        });
    });

    // ========================================================================
    // getRandomAccessibleClient
    // ========================================================================

    describe('getRandomAccessibleClient', () => {
        it('should return an accessible client', () => {
            const client = getRandomAccessibleClient(2);

            expect(client).not.toBeNull();
            expect(client.minReputation).toBeLessThanOrEqual(2);
        });

        it('should exclude specified client IDs', () => {
            const excludeIds = ['bank-local-1', 'bank-local-2', 'corp-small-1', 'health-clinic-1'];

            // At rep 1, these are all accessible clients, so should return null
            const client = getRandomAccessibleClient(1, excludeIds);

            expect(client).toBeNull();
        });

        it('should return different clients over multiple calls (randomness)', () => {
            const clients = new Set();

            for (let i = 0; i < 20; i++) {
                const client = getRandomAccessibleClient(5);
                if (client) {
                    clients.add(client.id);
                }
            }

            // Should have selected at least 2 different clients
            expect(clients.size).toBeGreaterThan(1);
        });
    });

    // ========================================================================
    // getRandomClientFromIndustry
    // ========================================================================

    describe('getRandomClientFromIndustry', () => {
        it('should return a client from specified industry', () => {
            const client = getRandomClientFromIndustry('banking', 5);

            expect(client).not.toBeNull();
            expect(client.industry).toBe('banking');
        });

        it('should respect reputation filter', () => {
            const client = getRandomClientFromIndustry('banking', 1);

            if (client) {
                expect(client.minReputation).toBeLessThanOrEqual(1);
            }
        });

        it('should return null if no clients match', () => {
            const client = getRandomClientFromIndustry('nonexistent', 5);

            expect(client).toBeNull();
        });

        it('should exclude specified IDs', () => {
            // Exclude all banking clients at rep 1
            const excludeIds = ['bank-local-1', 'bank-local-2'];

            const client = getRandomClientFromIndustry('banking', 1, excludeIds);

            expect(client).toBeNull();
        });
    });

    // ========================================================================
    // getClientCount
    // ========================================================================

    describe('getClientCount', () => {
        it('should return total client count', () => {
            expect(getClientCount()).toBe(9);
        });
    });

    // ========================================================================
    // getRegistryStats
    // ========================================================================

    describe('getRegistryStats', () => {
        it('should return total clients count', () => {
            const stats = getRegistryStats();

            expect(stats.totalClients).toBe(9);
        });

        it('should count clients by industry', () => {
            const stats = getRegistryStats();

            expect(stats.byIndustry.banking).toBe(4);
            expect(stats.byIndustry.corporate).toBe(3);
            expect(stats.byIndustry.healthcare).toBe(1);
            expect(stats.byIndustry.government).toBe(1);
        });

        it('should count clients by tier', () => {
            const stats = getRegistryStats();

            expect(stats.byTier.local).toBe(2);
            expect(stats.byTier.regional).toBe(1);
            expect(stats.byTier.national).toBe(1);
        });

        it('should count clients by minReputation', () => {
            const stats = getRegistryStats();

            // 4 clients at rep 1, 3 at rep 2, etc
            expect(stats.byMinReputation['rep-1']).toBe(4);
        });
    });
});
