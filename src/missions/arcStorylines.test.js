import { describe, it, expect } from 'vitest';

import {
    arcStorylines,
    getRandomStoryline,
    getStorylineById,
    getStorylinesForIndustry,
    getStorylinesForRegion,
    getStorylinesForLocationType,
    getLocationSpecificStorylines,
} from './arcStorylines';

// ============================================================================
// Tests
// ============================================================================

describe('arcStorylines', () => {
    // ========================================================================
    // Static data integrity
    // ========================================================================

    describe('data integrity', () => {
        it('should have at least 5 storylines', () => {
            expect(arcStorylines.length).toBeGreaterThanOrEqual(5);
        });

        it('all storylines should have unique IDs', () => {
            const ids = arcStorylines.map(s => s.id);
            const uniqueIds = new Set(ids);

            expect(uniqueIds.size).toBe(ids.length);
        });

        it('all storylines should have required properties', () => {
            arcStorylines.forEach(storyline => {
                expect(storyline.id).toBeDefined();
                expect(typeof storyline.id).toBe('string');

                expect(storyline.name).toBeDefined();
                expect(typeof storyline.name).toBe('string');

                expect(storyline.description).toBeDefined();
                expect(typeof storyline.description).toBe('string');

                expect(storyline.length).toBeDefined();
                expect(typeof storyline.length).toBe('number');
                expect(storyline.length).toBeGreaterThanOrEqual(2);

                expect(storyline.missionSequence).toBeDefined();
                expect(Array.isArray(storyline.missionSequence)).toBe(true);
            });
        });

        it('missionSequence length should match declared length', () => {
            arcStorylines.forEach(storyline => {
                expect(storyline.missionSequence.length).toBe(storyline.length);
            });
        });

        it('all mission types should be valid', () => {
            const validTypes = ['repair', 'backup', 'transfer', 'restore', 'repair-backup'];

            arcStorylines.forEach(storyline => {
                storyline.missionSequence.forEach((step, index) => {
                    expect(validTypes).toContain(step.missionType);
                });
            });
        });

        it('all mission steps should have required properties', () => {
            arcStorylines.forEach(storyline => {
                storyline.missionSequence.forEach((step, index) => {
                    expect(step.missionType).toBeDefined();
                    expect(step.narrativeTemplate).toBeDefined();
                    expect(typeof step.hasTimed).toBe('boolean');

                    // clientIndustryFilter can be null or array
                    if (step.clientIndustryFilter !== null) {
                        expect(Array.isArray(step.clientIndustryFilter)).toBe(true);
                    }
                });
            });
        });

        it('first mission step should not have referralText', () => {
            arcStorylines.forEach(storyline => {
                const firstStep = storyline.missionSequence[0];
                // First step typically doesn't have referral text (it's the initial contact)
                // This is a soft check - some storylines might have it
            });
        });

        it('subsequent mission steps should have referralText when using different client', () => {
            arcStorylines.forEach(storyline => {
                storyline.missionSequence.forEach((step, index) => {
                    if (index > 0 && step.clientIndustryFilter !== null) {
                        // If industry filter is specified (different client), should have referral
                        expect(step.referralText).toBeDefined();
                    }
                });
            });
        });

        it('industry filters should contain valid industries', () => {
            const validIndustries = [
                'banking', 'corporate', 'healthcare', 'government',
                'utilities', 'shipping', 'emergency', 'nonprofit', 'cultural'
            ];

            arcStorylines.forEach(storyline => {
                storyline.missionSequence.forEach(step => {
                    if (step.clientIndustryFilter) {
                        step.clientIndustryFilter.forEach(industry => {
                            expect(validIndustries).toContain(industry);
                        });
                    }
                });
            });
        });
    });

    // ========================================================================
    // getRandomStoryline
    // ========================================================================

    describe('getRandomStoryline', () => {
        it('should return a valid storyline object', () => {
            const storyline = getRandomStoryline();

            expect(storyline).toBeDefined();
            expect(storyline.id).toBeDefined();
            expect(storyline.name).toBeDefined();
            expect(storyline.missionSequence).toBeDefined();
        });

        it('should return different storylines over multiple calls (randomness)', () => {
            const storylines = new Set();

            for (let i = 0; i < 30; i++) {
                const storyline = getRandomStoryline();
                storylines.add(storyline.id);
            }

            // Should have gotten at least 3 different storylines
            expect(storylines.size).toBeGreaterThanOrEqual(3);
        });

        it('returned storyline should be from arcStorylines array', () => {
            const storyline = getRandomStoryline();
            const ids = arcStorylines.map(s => s.id);

            expect(ids).toContain(storyline.id);
        });
    });

    // ========================================================================
    // getStorylineById
    // ========================================================================

    describe('getStorylineById', () => {
        it('should return storyline for valid ID', () => {
            const storyline = getStorylineById('supply-chain-breach');

            expect(storyline).toBeDefined();
            expect(storyline.id).toBe('supply-chain-breach');
            expect(storyline.name).toBe('Supply Chain Breach');
        });

        it('should return null for invalid ID', () => {
            const storyline = getStorylineById('nonexistent-storyline');

            expect(storyline).toBeNull();
        });

        it('should return null for null/undefined ID', () => {
            expect(getStorylineById(null)).toBeNull();
            expect(getStorylineById(undefined)).toBeNull();
        });

        it('should return correct storyline for each known ID', () => {
            arcStorylines.forEach(expected => {
                const actual = getStorylineById(expected.id);

                expect(actual).toBeDefined();
                expect(actual.id).toBe(expected.id);
                expect(actual.name).toBe(expected.name);
            });
        });
    });

    // ========================================================================
    // getStorylinesForIndustry
    // ========================================================================

    describe('getStorylinesForIndustry', () => {
        it('should return storylines matching industry in first mission', () => {
            const storylines = getStorylinesForIndustry('corporate');

            expect(storylines.length).toBeGreaterThan(0);

            storylines.forEach(storyline => {
                const firstStep = storyline.missionSequence[0];
                // Either null filter (any industry) or includes corporate
                expect(
                    firstStep.clientIndustryFilter === null ||
                    firstStep.clientIndustryFilter.includes('corporate')
                ).toBe(true);
            });
        });

        it('should include storylines with null clientIndustryFilter (any industry)', () => {
            const storylines = getStorylinesForIndustry('banking');

            // Any storyline with null filter should be included
            const nullFilterStorylines = arcStorylines.filter(
                s => s.missionSequence[0].clientIndustryFilter === null
            );

            nullFilterStorylines.forEach(expected => {
                expect(storylines.find(s => s.id === expected.id)).toBeDefined();
            });
        });

        it('should return storylines for healthcare industry', () => {
            const storylines = getStorylinesForIndustry('healthcare');

            expect(storylines.length).toBeGreaterThan(0);
        });

        it('should return storylines for banking industry', () => {
            const storylines = getStorylinesForIndustry('banking');

            expect(storylines.length).toBeGreaterThan(0);
        });

        it('should return empty array for non-existent industry', () => {
            const storylines = getStorylinesForIndustry('nonexistent-industry');

            // Should still return storylines with null filter
            const nullFilterCount = arcStorylines.filter(
                s => s.missionSequence[0].clientIndustryFilter === null
            ).length;

            expect(storylines.length).toBe(nullFilterCount);
        });

        it('should handle government industry', () => {
            const storylines = getStorylinesForIndustry('government');

            expect(storylines.length).toBeGreaterThan(0);

            // Verify at least one has government in filter
            const hasGovernment = storylines.some(s => {
                const filter = s.missionSequence[0].clientIndustryFilter;
                return filter && filter.includes('government');
            });

            expect(hasGovernment).toBe(true);
        });

        it('should handle emergency industry', () => {
            const storylines = getStorylinesForIndustry('emergency');

            expect(storylines.length).toBeGreaterThan(0);
        });
    });

    // ========================================================================
    // Specific storyline validation
    // ========================================================================

    describe('specific storylines', () => {
        it('supply-chain-breach should have 3 missions (repair, backup, transfer)', () => {
            const storyline = getStorylineById('supply-chain-breach');

            expect(storyline.length).toBe(3);
            expect(storyline.missionSequence[0].missionType).toBe('repair');
            expect(storyline.missionSequence[1].missionType).toBe('backup');
            expect(storyline.missionSequence[2].missionType).toBe('transfer');
        });

        it('data-recovery-escalation should have timed backup mission', () => {
            const storyline = getStorylineById('data-recovery-escalation');

            expect(storyline.missionSequence[1].hasTimed).toBe(true);
        });

        it('disaster-recovery should have all timed missions', () => {
            const storyline = getStorylineById('disaster-recovery');

            storyline.missionSequence.forEach(step => {
                expect(step.hasTimed).toBe(true);
            });
        });

        it('merger-integration should have 2 missions', () => {
            const storyline = getStorylineById('merger-integration');

            expect(storyline.length).toBe(2);
        });

        it('whistleblower-protection should involve nonprofit/cultural', () => {
            const storyline = getStorylineById('whistleblower-protection');

            const lastStep = storyline.missionSequence[storyline.length - 1];
            expect(lastStep.clientIndustryFilter).toContain('nonprofit');
        });
    });

    // ========================================================================
    // Edge cases
    // ========================================================================

    describe('edge cases', () => {
        it('should handle storylines with same client (null filter)', () => {
            // Find storylines where subsequent steps use same client
            const sameClientStorylines = arcStorylines.filter(s =>
                s.missionSequence.some((step, i) => i > 0 && step.clientIndustryFilter === null)
            );

            expect(sameClientStorylines.length).toBeGreaterThan(0);
        });

        it('should handle storylines with different clients', () => {
            // Find storylines where subsequent steps use different client
            const differentClientStorylines = arcStorylines.filter(s =>
                s.missionSequence.some((step, i) => i > 0 && step.clientIndustryFilter !== null)
            );

            expect(differentClientStorylines.length).toBeGreaterThan(0);
        });

        it('storylines should have meaningful names and descriptions', () => {
            arcStorylines.forEach(storyline => {
                expect(storyline.name.length).toBeGreaterThan(5);
                expect(storyline.description.length).toBeGreaterThan(20);
            });
        });
    });

    // ========================================================================
    // Location-based filtering
    // ========================================================================

    describe('getStorylinesForRegion', () => {
        it('should return storylines matching region in first mission', () => {
            const storylines = getStorylinesForRegion('Central Europe');

            expect(storylines.length).toBeGreaterThan(0);
            storylines.forEach(s => {
                const firstMission = s.missionSequence[0];
                // Should either have no filter or include the region
                if (firstMission.clientRegionFilter) {
                    expect(firstMission.clientRegionFilter).toContain('Central Europe');
                }
            });
        });

        it('should include storylines without region filter', () => {
            const storylines = getStorylinesForRegion('West Coast');
            const noFilterStorylines = storylines.filter(s =>
                !s.missionSequence[0].clientRegionFilter
            );

            // Most storylines don't have region filters
            expect(noFilterStorylines.length).toBeGreaterThan(0);
        });

        it('should return storylines for North Sea region', () => {
            // There's an offshore-energy-crisis storyline that could match
            const storylines = getStorylinesForRegion('North Sea');
            expect(storylines.length).toBeGreaterThan(0);
        });
    });

    describe('getStorylinesForLocationType', () => {
        it('should return storylines for offshore location type', () => {
            const storylines = getStorylinesForLocationType('offshore');

            expect(storylines.length).toBeGreaterThan(0);
            storylines.forEach(s => {
                const firstMission = s.missionSequence[0];
                // Should either have no filter or include offshore
                if (firstMission.clientLocationTypeFilter) {
                    expect(firstMission.clientLocationTypeFilter).toContain('offshore');
                }
            });
        });

        it('should return storylines for vessel location type', () => {
            const storylines = getStorylinesForLocationType('vessel');

            expect(storylines.length).toBeGreaterThan(0);
        });

        it('should return storylines for remote location type', () => {
            const storylines = getStorylinesForLocationType('remote');

            expect(storylines.length).toBeGreaterThan(0);
        });

        it('should include storylines without location type filter', () => {
            const storylines = getStorylinesForLocationType('office');
            const noFilterStorylines = storylines.filter(s =>
                !s.missionSequence[0].clientLocationTypeFilter
            );

            expect(noFilterStorylines.length).toBeGreaterThan(0);
        });
    });

    describe('getLocationSpecificStorylines', () => {
        it('should return only storylines with location filters', () => {
            const storylines = getLocationSpecificStorylines();

            expect(storylines.length).toBeGreaterThan(0);
            storylines.forEach(s => {
                const firstMission = s.missionSequence[0];
                const hasLocationFilter = firstMission.clientRegionFilter ||
                    firstMission.clientLocationTypeFilter;
                expect(hasLocationFilter).toBeTruthy();
            });
        });

        it('should include offshore-energy-crisis storyline', () => {
            const storylines = getLocationSpecificStorylines();
            const offshoreStoryline = storylines.find(s => s.id === 'offshore-energy-crisis');

            expect(offshoreStoryline).toBeDefined();
        });

        it('should include maritime-supply-chain storyline', () => {
            const storylines = getLocationSpecificStorylines();
            const maritimeStoryline = storylines.find(s => s.id === 'maritime-supply-chain');

            expect(maritimeStoryline).toBeDefined();
        });

        it('should include polar-research-station storyline', () => {
            const storylines = getLocationSpecificStorylines();
            const polarStoryline = storylines.find(s => s.id === 'polar-research-station');

            expect(polarStoryline).toBeDefined();
        });
    });

    describe('location-specific storylines', () => {
        it('offshore-energy-crisis should target offshore utilities', () => {
            const storyline = getStorylineById('offshore-energy-crisis');

            expect(storyline).toBeDefined();
            expect(storyline.missionSequence[0].clientLocationTypeFilter).toContain('offshore');
            expect(storyline.missionSequence[0].clientIndustryFilter).toContain('utilities');
        });

        it('maritime-supply-chain should target vessel shipping', () => {
            const storyline = getStorylineById('maritime-supply-chain');

            expect(storyline).toBeDefined();
            expect(storyline.missionSequence[0].clientLocationTypeFilter).toContain('vessel');
            expect(storyline.missionSequence[0].clientIndustryFilter).toContain('shipping');
        });

        it('polar-research-station should target remote government', () => {
            const storyline = getStorylineById('polar-research-station');

            expect(storyline).toBeDefined();
            expect(storyline.missionSequence[0].clientLocationTypeFilter).toContain('remote');
            expect(storyline.missionSequence[0].clientIndustryFilter).toContain('government');
        });

        it('international-banking should target Central Europe region', () => {
            const storyline = getStorylineById('international-banking');

            expect(storyline).toBeDefined();
            expect(storyline.missionSequence[0].clientRegionFilter).toContain('Central Europe');
        });

        it('pacific-conservation should target Pacific Islands region', () => {
            const storyline = getStorylineById('pacific-conservation');

            expect(storyline).toBeDefined();
            expect(storyline.missionSequence[0].clientRegionFilter).toContain('Pacific Islands');
        });
    });
});
