/**
 * Message Templates for Story Missions
 *
 * Templates for manager messages during tutorial missions.
 * These are referenced by templateId in mission JSON files.
 */

/**
 * Create message from template
 * @param {string} templateId - Template identifier
 * @param {object} data - Template data (username, managerName, etc.)
 * @returns {object} Message object
 */
export const createMessageFromTemplate = (templateId, data) => {
  const template = MESSAGE_TEMPLATES[templateId];

  if (!template) {
    console.error(`Unknown message template: ${templateId}`);
    return null;
  }

  let body = template.body;

  // Replace placeholders
  Object.keys(data).forEach((key) => {
    const placeholder = `{${key}}`;
    body = body.replace(new RegExp(placeholder, 'g'), data[key]);
  });

  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    from: template.from,
    fromId: template.fromId.replace('{random}', generateRandomId()),
    fromName: template.fromName.replace('{managerName}', data.managerName || 'Manager'),
    subject: template.subject.replace('{managerName}', data.managerName || 'Manager'),
    body,
    timestamp: null, // Will be set when added to game
    read: false,
    archived: false,
    attachments: template.attachments || [],
  };
};

/**
 * Generate random ID segment for message IDs
 * @returns {string} Random 3-character alphanumeric
 */
const generateRandomId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

/**
 * Message templates
 */
export const MESSAGE_TEMPLATES = {
  // Tutorial Part 1 - Manager angry after failure
  'tutorial-1-failure': {
    from: 'SourceNet Manager',
    fromId: 'SNET-MGR-{random}',
    fromName: 'SourceNet Manager {managerName}',
    subject: 'What happened?!',
    body: `{username},

What just happened?! I was monitoring your mission and I saw you DELETE all the log files instead of repairing them!

The client's network administrator had to forcibly disconnect you to prevent further damage. Those files were CRITICAL for their audit compliance!

The client is demanding 10,000 credits in compensation for the data loss and the emergency recovery procedures they now have to perform. SourceNet policy requires YOU to cover mission failures, so that amount has been deducted from your account.

Your reputation has taken a serious hit. You went from Superb to Accident Prone. I know you impressed us in the interview, but this is completely unacceptable.

You need to be EXTREMELY careful. DO NOT become bankrupt. If you're overdrawn by more than 10,000 credits for 5 minutes, the financial authorities will seize your assets and SourceNet will not protect you.

I'm giving you another chance, but you need to prove you can handle this work.

- {managerName}`,
  },

  // Tutorial Part 2 - Recovery mission introduction
  'tutorial-2-intro': {
    from: 'SourceNet Manager',
    fromId: 'SNET-MGR-{random}',
    fromName: 'SourceNet Manager {managerName}',
    subject: "Let's try something simpler",
    body: `{username},

Okay, I know that was rough. Let me give you a simpler task to help you recover.

The same client (TechCorp) kept backups of those log files you... deleted. They need you to RESTORE the backups by copying them back to the original location.

This should be straightforward - just copy files from one location to another. No repairing, no deleting, just copying. You can handle that, right?

Here's what you need to do:

1. Open the Mission Board and accept "Log File Restoration"
2. Reconnect to ClientA-Corporate network (they've re-authorized you)
3. Use Network Scanner to find BOTH file systems:
   - fileserver-01 (original location - currently empty)
   - backup-server (backup location - has the files you need to copy)
4. Open TWO File Manager windows - one for each file system
5. Copy all log files FROM backup-server TO fileserver-01

This mission pays 1,000 credits. It won't get you out of debt, but it's a start.

You need to work until you're back in the black (not overdrawn anymore). There are several missions available after this one - all basic file work. Boring stuff, but you're not in a position to be picky right now given your situation.

Once you're out of debt, I'll reach out again with better work.

Don't mess this one up.

- {managerName}`,
  },

  // Tutorial Part 2 - Success acknowledgment
  'tutorial-2-success': {
    from: 'SourceNet Manager',
    fromId: 'SNET-MGR-{random}',
    fromName: 'SourceNet Manager {managerName}',
    subject: 'Better',
    body: `{username},

Okay, that's more like it. Simple task, executed correctly.

You're still deep in debt (-8,000 credits), but at least you're moving in the right direction.

Due to the recent global security exploit, there's a LOT of work available right now - mostly boring backup and file repair jobs. Not exciting work, but you need to take what you can get until you're back in the black.

Check the Mission Board - there are several missions available. Work through them until your account is positive again. Once you're out of debt, I'll reach out with better opportunities.

Your reputation is still "Accident Prone" after that first mission disaster. You'll need to successfully complete missions to rebuild it.

Keep working.

- {managerName}`,
  },

  // Player breaks even
  'back-in-black': {
    from: 'SourceNet Manager',
    fromId: 'SNET-MGR-{random}',
    fromName: 'SourceNet Manager {managerName}',
    subject: 'Back in the Black',
    body: `{username},

Good work. You're out of debt.

There's more file restoration work available if you want to keep building your reserves and reputation. Same kind of stuff, but the credits add up.

When you're ready for more interesting work, I'll have it for you.

- {managerName}`,
  },
};

export default { createMessageFromTemplate, MESSAGE_TEMPLATES };
