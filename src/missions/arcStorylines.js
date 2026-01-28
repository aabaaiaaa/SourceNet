/**
 * Arc Storylines - Extensible templates for multi-mission arcs
 * 
 * Each storyline defines a sequence of connected missions with:
 * - Narrative continuity between missions
 * - Client industry filters for appropriate client selection
 * - Client region filters for location-specific storylines
 * - Client location type filters (office, offshore, vessel, remote)
 * - Optional time pressure for specific missions
 * - Referral text for multi-client arcs
 * 
 * To add a new storyline:
 * 1. Add a new object to the arcStorylines array
 * 2. Define the mission sequence with missionType and filters
 * 3. Add narrative templates and referral text for story flow
 * 4. Optionally specify hasTimed for time-pressured missions
 * 
 * Filter options per mission step:
 * - clientIndustryFilter: Array of industry strings, or null for same client
 * - clientRegionFilter: Array of region strings (e.g., ['North Sea', 'Gulf of Mexico'])
 * - clientLocationTypeFilter: Array of location types (e.g., ['offshore', 'vessel'])
 */

export const arcStorylines = [
    // 1. Supply Chain Breach - Corporate discovers breach, traces to supplier
    {
        id: 'supply-chain-breach',
        name: 'Supply Chain Breach',
        description: 'A corporate client discovers data corruption that traces back to a compromised supplier.',
        length: 3,
        missionSequence: [
            {
                missionType: 'repair',
                clientIndustryFilter: ['corporate'],
                narrativeTemplate: 'Initial file corruption discovered in corporate systems.',
                hasTimed: false
            },
            {
                missionType: 'backup',
                clientIndustryFilter: ['corporate', 'shipping'],
                narrativeTemplate: 'Investigation reveals the breach originated from a supplier. Secure their data.',
                referralText: 'Our partner company referred you after your excellent work on their systems.',
                hasTimed: false
            },
            {
                missionType: 'transfer',
                clientIndustryFilter: ['corporate'],
                narrativeTemplate: 'Final cleanup - consolidate recovered data to secure servers.',
                referralText: 'Following the supplier investigation, we need to secure all related files.',
                hasTimed: true
            }
        ]
    },

    // 2. Data Recovery Escalation - Simple repair becomes larger recovery operation
    {
        id: 'data-recovery-escalation',
        name: 'Data Recovery Escalation',
        description: 'What starts as simple file repair escalates into a full data recovery operation.',
        length: 3,
        missionSequence: [
            {
                missionType: 'repair',
                clientIndustryFilter: ['banking', 'healthcare', 'government'],
                narrativeTemplate: 'Routine file corruption repair request.',
                hasTimed: false
            },
            {
                missionType: 'backup',
                clientIndustryFilter: null, // Same client
                narrativeTemplate: 'More corruption found. Emergency backup needed before system wipe.',
                referralText: 'Thank you for the previous repair. We\'ve discovered more issues and need immediate backup.',
                hasTimed: true
            },
            {
                missionType: 'repair',
                clientIndustryFilter: null, // Same client
                narrativeTemplate: 'System restored. Final repairs needed on recovered files.',
                referralText: 'The backup was successful. Now we need the recovered files repaired.',
                hasTimed: false
            }
        ]
    },

    // 3. Merger Integration - Two companies consolidating systems
    {
        id: 'merger-integration',
        name: 'Merger Integration',
        description: 'Two companies are merging and need their data consolidated securely.',
        length: 2,
        missionSequence: [
            {
                missionType: 'backup',
                clientIndustryFilter: ['corporate', 'banking'],
                narrativeTemplate: 'Pre-merger backup of all critical systems.',
                hasTimed: false
            },
            {
                missionType: 'transfer',
                clientIndustryFilter: ['corporate', 'banking'],
                narrativeTemplate: 'Transfer backed up data to the new merged infrastructure.',
                referralText: 'Our merger partner recommended your services for the data integration.',
                hasTimed: true
            }
        ]
    },

    // 4. Compliance Audit - Government/Banking multi-stage cleanup
    {
        id: 'compliance-audit',
        name: 'Compliance Audit Preparation',
        description: 'A regulated organization must prepare their data for an upcoming audit.',
        length: 3,
        missionSequence: [
            {
                missionType: 'repair',
                clientIndustryFilter: ['banking', 'government', 'healthcare'],
                narrativeTemplate: 'Repair corrupted compliance records before audit.',
                hasTimed: true
            },
            {
                missionType: 'backup',
                clientIndustryFilter: null, // Same client
                narrativeTemplate: 'Create audit-ready backups of all repaired files.',
                referralText: 'The repairs are complete. Now we need certified backups for the auditors.',
                hasTimed: false
            },
            {
                missionType: 'transfer',
                clientIndustryFilter: null, // Same client
                narrativeTemplate: 'Transfer backup copies to the auditor\'s secure review server.',
                referralText: 'Final step - transfer the backup copies to the auditor\'s system.',
                hasTimed: true
            }
        ]
    },

    // 5. Ransomware Aftermath - Recovery after attack
    {
        id: 'ransomware-aftermath',
        name: 'Ransomware Aftermath',
        description: 'Help an organization recover from a ransomware attack.',
        length: 3,
        missionSequence: [
            {
                missionType: 'repair',
                clientIndustryFilter: ['corporate', 'healthcare', 'utilities'],
                narrativeTemplate: 'Emergency repair of partially encrypted files after ransomware attack.',
                hasTimed: true
            },
            {
                missionType: 'backup',
                clientIndustryFilter: null, // Same client
                narrativeTemplate: 'Secure backup of all recovered data before cleanup.',
                referralText: 'The initial recovery was successful. We need secure backups before proceeding.',
                hasTimed: false
            },
            {
                missionType: 'transfer',
                clientIndustryFilter: ['corporate', 'healthcare'],
                narrativeTemplate: 'Notify partner organization and transfer incident data.',
                referralText: 'We were affected by the same attack. Can you help secure our shared data?',
                hasTimed: false
            }
        ]
    },

    // 6. Infrastructure Migration - Old system to new
    {
        id: 'infrastructure-migration',
        name: 'Infrastructure Migration',
        description: 'Complete infrastructure upgrade requiring data migration.',
        length: 2,
        missionSequence: [
            {
                missionType: 'backup',
                clientIndustryFilter: ['utilities', 'government', 'corporate'],
                narrativeTemplate: 'Backup all data from legacy systems before decommission.',
                hasTimed: false
            },
            {
                missionType: 'transfer',
                clientIndustryFilter: null, // Same client
                narrativeTemplate: 'Transfer backed up data to new infrastructure.',
                referralText: 'Backup complete. Now transfer everything to our new systems.',
                hasTimed: true
            }
        ]
    },

    // 7. Whistleblower Protection - Secure copy to journalist/nonprofit
    {
        id: 'whistleblower-protection',
        name: 'Whistleblower Protection',
        description: 'Secure sensitive documents for a whistleblower case.',
        length: 2,
        missionSequence: [
            {
                missionType: 'backup',
                clientIndustryFilter: ['government', 'corporate'],
                narrativeTemplate: 'Create secure backup of sensitive documents.',
                hasTimed: true
            },
            {
                missionType: 'transfer',
                clientIndustryFilter: ['nonprofit', 'cultural'],
                narrativeTemplate: 'Transfer documents to secure advocacy organization.',
                referralText: 'A concerned party has arranged for you to help us secure important documents.',
                hasTimed: true
            }
        ]
    },

    // 8. Disaster Recovery - Emergency services multi-network restoration
    {
        id: 'disaster-recovery',
        name: 'Disaster Recovery',
        description: 'Help emergency services recover from a system failure.',
        length: 3,
        missionSequence: [
            {
                missionType: 'repair',
                clientIndustryFilter: ['emergency'],
                narrativeTemplate: 'Emergency repair of dispatch system files.',
                hasTimed: true
            },
            {
                missionType: 'backup',
                clientIndustryFilter: ['emergency', 'government'],
                narrativeTemplate: 'Backup critical emergency response data.',
                referralText: 'Our regional emergency management office needs the same treatment.',
                hasTimed: true
            },
            {
                missionType: 'transfer',
                clientIndustryFilter: ['emergency'],
                narrativeTemplate: 'Transfer data to backup emergency operations center.',
                referralText: 'Final step - replicate all data to our backup facility.',
                hasTimed: true
            }
        ]
    },

    // 9. Vendor Transition - Switch from old vendor to new
    {
        id: 'vendor-transition',
        name: 'Vendor Transition',
        description: 'Help a client transition from one vendor to another.',
        length: 2,
        missionSequence: [
            {
                missionType: 'backup',
                clientIndustryFilter: ['corporate', 'healthcare', 'banking'],
                narrativeTemplate: 'Extract and backup all data from outgoing vendor system.',
                hasTimed: false
            },
            {
                missionType: 'transfer',
                clientIndustryFilter: null, // Same client
                narrativeTemplate: 'Transfer data to new vendor\'s system.',
                referralText: 'Data extracted successfully. Now import it to our new provider.',
                hasTimed: true
            }
        ]
    },

    // 10. Security Incident Response - Investigate and secure
    {
        id: 'security-incident-response',
        name: 'Security Incident Response',
        description: 'Respond to a security incident with investigation and remediation.',
        length: 3,
        missionSequence: [
            {
                missionType: 'repair',
                clientIndustryFilter: ['banking', 'corporate', 'government'],
                narrativeTemplate: 'Repair files damaged during security incident.',
                hasTimed: true
            },
            {
                missionType: 'backup',
                clientIndustryFilter: null, // Same client
                narrativeTemplate: 'Preserve evidence - backup all affected systems.',
                referralText: 'Repairs complete. Now we need forensic backups for investigation.',
                hasTimed: false
            },
            {
                missionType: 'transfer',
                clientIndustryFilter: null, // Same client
                narrativeTemplate: 'Transfer evidence to secure isolated network for analysis.',
                referralText: 'Transfer all evidence to our secure investigation server.',
                hasTimed: false
            }
        ]
    },

    // 11. Offshore Energy Crisis - Oil rig / wind farm emergency
    {
        id: 'offshore-energy-crisis',
        name: 'Offshore Energy Crisis',
        description: 'Emergency data recovery across offshore energy platforms.',
        length: 3,
        missionSequence: [
            {
                missionType: 'repair',
                clientIndustryFilter: ['utilities'],
                clientLocationTypeFilter: ['offshore'],
                narrativeTemplate: 'Emergency repair of SCADA control files on offshore platform.',
                hasTimed: true
            },
            {
                missionType: 'backup',
                clientIndustryFilter: ['utilities'],
                clientLocationTypeFilter: ['offshore'],
                narrativeTemplate: 'Backup critical telemetry data before storm window.',
                referralText: 'Our neighboring platform in the same field needs the same treatment urgently.',
                hasTimed: true
            },
            {
                missionType: 'transfer',
                clientIndustryFilter: ['utilities', 'corporate'],
                narrativeTemplate: 'Transfer offshore data to mainland operations center.',
                referralText: 'We manage the onshore relay for these platforms. Need data consolidated.',
                hasTimed: false
            }
        ]
    },

    // 12. Maritime Supply Chain - Ship to port logistics
    {
        id: 'maritime-supply-chain',
        name: 'Maritime Supply Chain',
        description: 'Coordinate data across vessels and port facilities.',
        length: 2,
        missionSequence: [
            {
                missionType: 'backup',
                clientIndustryFilter: ['shipping'],
                clientLocationTypeFilter: ['vessel'],
                narrativeTemplate: 'Backup critical shipping manifests before satellite window closes.',
                hasTimed: true
            },
            {
                missionType: 'transfer',
                clientIndustryFilter: ['shipping'],
                narrativeTemplate: 'Transfer manifest data to port logistics center.',
                referralText: 'We received your vessel data. Need it transferred to our port operations.',
                hasTimed: false
            }
        ]
    },

    // 13. Polar Research Station - Remote Antarctic/Arctic operations
    {
        id: 'polar-research-station',
        name: 'Polar Research Station',
        description: 'Support data operations at remote polar research stations.',
        length: 3,
        missionSequence: [
            {
                missionType: 'repair',
                clientIndustryFilter: ['government'],
                clientLocationTypeFilter: ['remote'],
                narrativeTemplate: 'Repair corrupted climate research data before resupply window.',
                hasTimed: true
            },
            {
                missionType: 'backup',
                clientIndustryFilter: null, // Same client
                narrativeTemplate: 'Create backup of all research data for safe transport.',
                referralText: 'Repairs successful. Now we need everything backed up before the blackout period.',
                hasTimed: true
            },
            {
                missionType: 'transfer',
                clientIndustryFilter: ['nonprofit', 'cultural'],
                narrativeTemplate: 'Transfer research data to university archives.',
                referralText: 'The research station sent us your contact. We archive their field data.',
                hasTimed: false
            }
        ]
    },

    // 14. International Banking - Cross-border financial operations
    {
        id: 'international-banking',
        name: 'International Banking Operations',
        description: 'Coordinate data across international financial institutions.',
        length: 2,
        missionSequence: [
            {
                missionType: 'backup',
                clientIndustryFilter: ['banking'],
                clientRegionFilter: ['Central Europe', 'Northern Europe'],
                narrativeTemplate: 'Secure backup of international transaction records.',
                hasTimed: false
            },
            {
                missionType: 'transfer',
                clientIndustryFilter: ['banking'],
                narrativeTemplate: 'Transfer reconciliation data to correspondent bank.',
                referralText: 'Our European partner recommended your services for secure transfers.',
                hasTimed: true
            }
        ]
    },

    // 15. Pacific Islands Conservation - Remote environmental monitoring
    {
        id: 'pacific-conservation',
        name: 'Pacific Islands Conservation',
        description: 'Support remote environmental monitoring stations across the Pacific.',
        length: 2,
        missionSequence: [
            {
                missionType: 'repair',
                clientIndustryFilter: ['nonprofit'],
                clientRegionFilter: ['Pacific Islands'],
                narrativeTemplate: 'Repair corrupted marine ecosystem monitoring data.',
                hasTimed: false
            },
            {
                missionType: 'transfer',
                clientIndustryFilter: ['nonprofit', 'government'],
                narrativeTemplate: 'Transfer conservation data to research consortium.',
                referralText: 'The island station shared your contact. We need their data integrated.',
                hasTimed: false
            }
        ]
    }
];

/**
 * Get a random storyline
 * @returns {Object} Random storyline template
 */
export function getRandomStoryline() {
    return arcStorylines[Math.floor(Math.random() * arcStorylines.length)];
}

/**
 * Get storyline by ID
 * @param {string} storylineId - Storyline ID
 * @returns {Object|null} Storyline template or null
 */
export function getStorylineById(storylineId) {
    return arcStorylines.find(s => s.id === storylineId) || null;
}

/**
 * Get all storylines that match a given industry
 * @param {string} industry - Industry to filter by
 * @returns {Array} Matching storylines
 */
export function getStorylinesForIndustry(industry) {
    return arcStorylines.filter(storyline =>
        storyline.missionSequence[0].clientIndustryFilter === null ||
        storyline.missionSequence[0].clientIndustryFilter.includes(industry)
    );
}

/**
 * Get all storylines that match a given region
 * @param {string} region - Region to filter by
 * @returns {Array} Matching storylines
 */
export function getStorylinesForRegion(region) {
    return arcStorylines.filter(storyline => {
        const firstMission = storyline.missionSequence[0];
        // Include storylines without region filter, or those matching the region
        return !firstMission.clientRegionFilter ||
            firstMission.clientRegionFilter.includes(region);
    });
}

/**
 * Get all storylines that match a given location type
 * @param {string} locationType - Location type to filter by (e.g., 'offshore', 'vessel')
 * @returns {Array} Matching storylines
 */
export function getStorylinesForLocationType(locationType) {
    return arcStorylines.filter(storyline => {
        const firstMission = storyline.missionSequence[0];
        // Include storylines without location type filter, or those matching the type
        return !firstMission.clientLocationTypeFilter ||
            firstMission.clientLocationTypeFilter.includes(locationType);
    });
}

/**
 * Get storylines that specifically target location-based clients
 * (have clientRegionFilter or clientLocationTypeFilter defined)
 * @returns {Array} Location-specific storylines
 */
export function getLocationSpecificStorylines() {
    return arcStorylines.filter(storyline => {
        const firstMission = storyline.missionSequence[0];
        return firstMission.clientRegionFilter || firstMission.clientLocationTypeFilter;
    });
}

export default {
    arcStorylines,
    getRandomStoryline,
    getStorylineById,
    getStorylinesForIndustry,
    getStorylinesForRegion,
    getStorylinesForLocationType,
    getLocationSpecificStorylines
};
