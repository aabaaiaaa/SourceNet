/**
 * System Messages - Banking and HR automated messages
 *
 * Core game systems (Banking, Reputation) send their own messages
 * based on system state changes, independent of story missions.
 *
 * Triggered by creditsChanged and reputationChanged events.
 */

/**
 * Banking system message templates
 */
export const BANKING_MESSAGES = {
  firstOverdraft: {
    from: 'bank',
    fromId: 'SNET-FBL-000-001',
    fromName: 'First Bank Ltd',
    subject: 'Overdraft Notice - Interest Charges Apply',
    bodyTemplate: (balance) => `Dear {username},

Your account with First Bank Ltd is currently overdrawn.

Current Balance: ${balance.toLocaleString()} credits
Overdraft Interest Rate: 1% per minute (in-game time)

Interest will be charged every minute until your balance returns to positive.

BANKRUPTCY WARNING:
If your account remains overdrawn by MORE than 10,000 credits for 5 consecutive
minutes, your account will be referred to financial authorities for asset seizure.

We recommend depositing funds immediately to avoid further charges.

Sincerely,
First Bank Ltd`,
  },

  approachingBankruptcy: {
    from: 'bank',
    fromId: 'SNET-FBL-000-001',
    fromName: 'First Bank Ltd',
    subject: 'Warning: Approaching Bankruptcy Threshold',
    bodyTemplate: (balance) => `Dear {username},

WARNING: Your account balance is approaching the bankruptcy threshold.

Current Balance: ${balance.toLocaleString()} credits
Bankruptcy Threshold: -10,000 credits

You are ${Math.abs(balance + 10000).toLocaleString()} credits away from the bankruptcy threshold.

If your balance drops below -10,000 credits for 5 consecutive minutes, your
account will be referred to financial authorities for asset seizure.

Please take immediate action to improve your account balance.

Sincerely,
First Bank Ltd`,
  },

  bankruptcyCountdownStart: {
    from: 'bank',
    fromId: 'SNET-FBL-000-001',
    fromName: 'First Bank Ltd',
    subject: 'URGENT: Bankruptcy Proceedings Initiated',
    bodyTemplate: (balance, timeRemaining) => `URGENT NOTICE

Dear {username},

Your account has been overdrawn by more than 10,000 credits.

Current Balance: ${balance.toLocaleString()} credits
Time Remaining: ${timeRemaining} minutes

Financial authorities will seize your assets in ${timeRemaining} minutes if your
balance does not improve above -10,000 credits.

This is your final warning. Take immediate action.

Sincerely,
First Bank Ltd`,
  },

  bankruptcyCancelled: {
    from: 'bank',
    fromId: 'SNET-FBL-000-001',
    fromName: 'First Bank Ltd',
    subject: 'Bankruptcy Proceedings Cancelled',
    bodyTemplate: (balance) => `Dear {username},

Your account balance has improved above the bankruptcy threshold.

Current Balance: ${balance.toLocaleString()} credits

Bankruptcy proceedings have been cancelled. However, your account is still
overdrawn and interest charges continue to apply.

Sincerely,
First Bank Ltd`,
  },
};

/**
 * HR (Reputation) system message templates
 */
export const HR_MESSAGES = {
  performancePlanWarning: {
    from: 'hr',
    fromId: 'SNET-HQ0-000-001',
    fromName: 'SourceNet Human Resources',
    subject: 'URGENT - Performance Plan Required',
    bodyTemplate: (tier, tierName) => `{username},

Your recent mission failures have resulted in you being placed on a performance
improvement plan.

Current Reputation: ${tierName} (Tier ${tier})

This is a formal warning. If your reputation drops to "Should be let go" (Tier 1),
you will have ONE FINAL CHANCE to prove yourself. Failure to complete a mission
successfully within 10 minutes will result in termination of your contract with
SourceNet.

We expect immediate improvement in your performance.

- SourceNet Human Resources`,
  },

  finalTerminationWarning: {
    from: 'hr',
    fromId: 'SNET-HQ0-000-001',
    fromName: 'SourceNet Human Resources',
    subject: 'FINAL WARNING - Termination Imminent',
    bodyTemplate: (tier, tierName) => `{username},

Your reputation has reached "${tierName}" (Tier ${tier}).

You have 10 MINUTES to successfully complete a mission or your contract will
be TERMINATED.

Complete any available mission successfully within the next 10 minutes to avoid
termination. If you fail this mission OR the timer expires, you will be let go.

This is your final chance.

- SourceNet Human Resources`,
  },

  performanceImproved: {
    from: 'hr',
    fromId: 'SNET-HQ0-000-001',
    fromName: 'SourceNet Human Resources',
    subject: 'Performance Improvement Acknowledged',
    bodyTemplate: (tier, tierName) => `{username},

We acknowledge your recent successful mission completion.

Your reputation has improved to: ${tierName} (Tier ${tier})

The termination countdown has been cancelled. However, you remain on a
performance improvement plan. Continue to demonstrate competence.

- SourceNet Human Resources`,
  },
};

/**
 * Create a system message from template
 * @param {object} template - Message template
 * @param {string} username - Player username
 * @param {object} data - Template data
 * @returns {object} Complete message object
 */
export const createSystemMessage = (template, username, data = {}) => {
  let body = template.bodyTemplate(data.balance, data.timeRemaining, data.tier, data.tierName);

  // Replace {username} placeholder
  body = body.replace(/{username}/g, username);

  return {
    id: `sys-${template.from}-${Date.now()}`,
    from: template.from,
    fromId: template.fromId,
    fromName: template.fromName,
    subject: template.subject,
    body: body,
    timestamp: null, // Will be set when added to game
    read: false,
    archived: false,
  };
};
