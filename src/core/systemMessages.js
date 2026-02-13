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
 * Post-ransomware progression message templates
 */

/**
 * Create CPU unlock message (sent after ransomware-recovery completion)
 * Reading this message unlocks cpu-upgrades feature
 * @param {string} username - Player username
 * @param {string} managerName - Manager name
 * @returns {object} Complete message object
 */
export const createCpuUnlockMessage = (username, managerName) => ({
  id: 'msg-cpu-unlock',
  from: 'SourceNet Manager',
  fromId: 'SNET-MGR-CPU',
  fromName: `SourceNet Manager ${managerName}`,
  subject: 'Hardware Upgrade - CPU Priority',
  body: `${username},

One more thing about the decryption work - your current processor is going to be a bottleneck.

Decryption is CPU-intensive. The faster your processor, the quicker you can decrypt files. With a better CPU, those AES jobs will fly by, and when you get into Blowfish and RSA-2048 territory, you'll really feel the difference.

I've flagged your account for CPU upgrade priority. Check the Portal - you should see some better processor options available now.

The math is simple: faster decryption = more jobs per hour = more credits. It's worth the investment.

- ${managerName}`,
  timestamp: null,
  read: false,
  archived: false,
});

/**
 * Create algorithm info message (sent after ransomware-recovery completion, delayed)
 * Informational only - explains the algorithm pack system
 * @param {string} username - Player username
 * @param {string} managerName - Manager name
 * @returns {object} Complete message object
 */
export const createAlgorithmInfoMessage = (username, managerName) => ({
  id: 'msg-algorithm-info',
  from: 'SourceNet Manager',
  fromId: 'SNET-MGR-ALG',
  fromName: `SourceNet Manager ${managerName}`,
  subject: 'Algorithm Modules - How It Works',
  body: `${username},

Quick rundown on the decryption module system:

Your Decryption Tool comes with AES-128 and AES-256 algorithms built in. These handle the most common encryption you'll encounter.

Two advanced modules are available in the Portal:

BLOWFISH DECRYPTION MODULE (15,000 credits)
- Symmetric cipher used heavily in financial and corporate systems
- Blowfish contracts pay roughly 2.5x what AES jobs pay
- Good stepping stone to the serious work

RSA-2048 DECRYPTION MODULE (35,000 credits)
- Asymmetric encryption used in government and military-grade systems
- RSA contracts pay about 4x the base rate
- The most lucrative decryption work available

You'll only see contracts for algorithms you can actually decrypt, so buying the modules opens up better-paying work immediately.

Start with Blowfish, save up for RSA. That's the path.

- ${managerName}`,
  timestamp: null,
  read: false,
  archived: false,
});

/**
 * Create placeholder story teaser message (sent when both algorithm packs are installed)
 * @param {string} username - Player username
 * @param {string} managerName - Manager name
 * @returns {object} Complete message object
 */
export const createPlaceholderStoryMessage = (username, managerName) => ({
  id: 'msg-story-teaser-post-decryption',
  from: 'SourceNet Manager',
  fromId: 'SNET-MGR-STORY',
  fromName: `SourceNet Manager ${managerName}`,
  subject: 'Something Big',
  body: `${username},

I've been watching your progress. Full algorithm suite, solid track record, handling complex multi-layer jobs without breaking a sweat.

I've got something big lined up for you. Can't say more right now - I need to verify some things first. But this is different from the contract work. This is the kind of job that changes things.

Stay sharp. I'll be in touch soon.

- ${managerName}`,
  timestamp: null,
  read: false,
  archived: false,
});

/**
 * Create a system message from template
 * @param {object} template - Message template
 * @param {string} username - Player username
 * @param {object} data - Template data
 * @returns {object} Complete message object
 */
export const createSystemMessage = (template, username, data = {}) => {
  let body;

  // Banking templates expect (balance, timeRemaining)
  if (template.from === 'bank') {
    body = template.bodyTemplate(data.balance, data.timeRemaining);
  }
  // HR templates expect (tier, tierName)
  else if (template.from === 'hr') {
    body = template.bodyTemplate(data.tier, data.tierName);
  }
  else {
    body = template.bodyTemplate(data);
  }

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
