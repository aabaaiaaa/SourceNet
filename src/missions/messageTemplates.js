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

  // Helper to replace all placeholders in a string
  const replacePlaceholders = (str) => {
    let result = str;
    Object.keys(data).forEach((key) => {
      const placeholder = `{${key}}`;
      result = result.replace(new RegExp(placeholder, 'g'), data[key]);
    });
    // Also replace {random} with generated ID
    result = result.replace('{random}', generateRandomId());
    return result;
  };

  // Replace placeholders in body
  const body = replacePlaceholders(template.body);

  // Replace placeholders in from/fromName/subject
  const from = replacePlaceholders(template.from);
  const fromId = replacePlaceholders(template.fromId);
  const fromName = replacePlaceholders(template.fromName);
  const subject = replacePlaceholders(template.subject);

  // Process attachments - handle dynamic cheque amounts and descriptions
  let attachments = template.attachments || [];
  if (attachments.length > 0) {
    attachments = attachments.map((att) => {
      if (att.type === 'cheque') {
        return {
          ...att,
          amount: data.chequeAmount !== undefined ? data.chequeAmount : att.amount,
          description: att.description ? replacePlaceholders(att.description) : att.description,
        };
      }
      return att;
    });
  }

  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    from,
    fromId,
    fromName,
    subject,
    body,
    timestamp: null, // Will be set when added to game
    read: false,
    archived: false,
    attachments,
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

The client's network administrator had to forcibly disconnect you to prevent further damage and has REVOKED your network access credentials. Those files were CRITICAL for their audit compliance!

This is a critical lesson: network administrators can revoke your access at any time if they believe you're a security threat. Your NAR entry for ClientA-Corporate is now deauthorized and unusable. You'll need new credentials to reconnect.

The client is demanding 10,000 credits in compensation for the data loss and emergency recovery. SourceNet policy requires YOU to cover mission failures, so that amount has been deducted from your account.

Your reputation has taken a serious hit. You went from Superb to Accident Prone. I know you impressed us in the interview, but this is completely unacceptable.

You need to be EXTREMELY careful. DO NOT become bankrupt. If you're overdrawn by more than 10,000 credits for 5 minutes, the financial authorities will seize your assets and SourceNet will not protect you.

I'm giving you another chance, but you need to prove you can handle this work.

- {managerName}`,
  },

  // Tutorial Part 2 - Network credentials update
  'tutorial-2-network-update': {
    from: 'SourceNet Manager',
    fromId: 'SNET-MGR-{random}',
    fromName: 'SourceNet Manager {managerName}',
    subject: 'Updated Network Access - Backup Server',
    body: `{username},

I've negotiated with the client and secured NEW network credentials for you. Your old access was completely revoked, so this is a fresh NAR entry.

They've restructured their network access - you'll now connect to a different subnet with access to their backup-server. The network credentials are attached to this message.

Activate the credentials in your Network Address Register. This will give you access to both fileserver-01 and backup-server, but note that the network structure may be different than before.

Good luck.

- {managerName}`,
    attachments: [
      {
        type: 'network-credentials',
        networkId: 'clienta-corporate',
        networkName: 'ClientA-Corporate',
        address: '192.168.50.0/24',
        bandwidth: 50,
      }
    ],
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

  // Tutorial Part 2 - NAR revocation info
  'tutorial-2-nar-info': {
    from: 'SourceNet Manager',
    fromId: 'SNET-MGR-{random}',
    fromName: 'SourceNet Manager {managerName}',
    subject: 'About Network Access',
    body: `{username},

One more thing - you may have noticed your network access to ClientA-Corporate was revoked after the mission completed.

This is standard procedure. Network credentials provided for missions are temporary - once a job is done (successfully or not), the client's access credentials are automatically invalidated. You'll see revoked entries in your Network Address Register (NAR) for record-keeping.

Don't worry about losing access. Each new mission comes with fresh credentials. This keeps things clean and secure for both you and the clients.

Just something to be aware of.

- {managerName}`,
  },

  // Client payment for completed mission
  'client-payment': {
    from: '{clientName}',
    fromId: 'CLIENT-{random}',
    fromName: '{clientName}',
    subject: 'Payment for {missionTitle}',
    body: `{username},

Thank you for completing the work on "{missionTitle}".

Please find attached a digital cheque for {payoutAmount} credits as agreed.

Regards,
{clientName}`,
    attachments: [
      {
        type: 'cheque',
        amount: 0, // Will be replaced dynamically
        description: 'Payment for {missionTitle}',
      }
    ],
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

  // ===== MISSION EXTENSION TEMPLATES =====
  // These are sent mid-mission when extensions are triggered

  // Repair extensions
  'extension-moreCorruptedFiles': {
    from: '{clientName}',
    fromId: 'CLIENT-{random}',
    fromName: '{clientName}',
    subject: 'URGENT: More Corrupted Files Found',
    body: `{username},

While you've been working, our monitoring systems detected additional file corruption on the same server.

These files need to be repaired as well - they're part of the same data set and equally critical to our operations.

We're increasing your payment to reflect the additional work. Please continue and repair these files as well.

Regards,
{clientName}`,
  },

  'extension-additionalServer': {
    from: '{clientName}',
    fromId: 'CLIENT-{random}',
    fromName: '{clientName}',
    subject: 'Additional Server Needs Attention',
    body: `{username},

Good progress so far. However, we've discovered that the corruption has spread to another server on the same network.

Please also repair the files on this additional system. The server should be visible when you scan the network.

Your payment has been increased to compensate for the extra work.

Regards,
{clientName}`,
  },

  'extension-newNetworkRepair': {
    from: '{clientName}',
    fromId: 'CLIENT-{random}',
    fromName: '{clientName}',
    subject: 'Urgent: Archive Network Also Affected',
    body: `{username},

We've just discovered that our archive network has also been hit by the same corruption issue.

I'm attaching credentials for our archive network. Please connect and repair the affected files there as well.

We're significantly increasing your payment given the expanded scope of work.

Regards,
{clientName}`,
  },

  // Backup extensions
  'extension-additionalBackupFiles': {
    from: '{clientName}',
    fromId: 'CLIENT-{random}',
    fromName: '{clientName}',
    subject: 'Additional Files for Backup',
    body: `{username},

Our compliance team just identified additional files that need to be included in this backup operation.

Please also copy these files to the backup destination. They've been added to the source directory.

Payment has been adjusted upward for the additional work.

Regards,
{clientName}`,
  },

  'extension-secondaryBackupServer': {
    from: '{clientName}',
    fromId: 'CLIENT-{random}',
    fromName: '{clientName}',
    subject: 'Secondary Backup Required',
    body: `{username},

Management has requested that we also maintain a secondary backup on a different server for redundancy.

Please copy the files to our secondary backup server as well. It's on the same network - you should see it after scanning.

We're increasing your payment for the additional backup work.

Regards,
{clientName}`,
  },

  'extension-offsiteBackup': {
    from: '{clientName}',
    fromId: 'CLIENT-{random}',
    fromName: '{clientName}',
    subject: 'Offsite Backup Also Required',
    body: `{username},

For disaster recovery compliance, we need a copy of these files sent to our offsite backup facility as well.

I'm attaching credentials for our offsite network. Please connect and copy the files there too.

Your payment has been substantially increased given the expanded scope.

Regards,
{clientName}`,
  },

  // Transfer extensions
  'extension-additionalTransferFiles': {
    from: '{clientName}',
    fromId: 'CLIENT-{random}',
    fromName: '{clientName}',
    subject: 'Additional Files to Transfer',
    body: `{username},

We've identified more files that need to be included in this transfer operation.

The additional files have been added to the source location. Please include them in the transfer to the destination.

Payment adjusted accordingly.

Regards,
{clientName}`,
  },

  'extension-archiveServer': {
    from: '{clientName}',
    fromId: 'CLIENT-{random}',
    fromName: '{clientName}',
    subject: 'Archive Copy Required',
    body: `{username},

In addition to the primary transfer, we need an archive copy on a separate server for audit purposes.

Please also transfer the files to our archive server. It should appear when you scan the destination network.

Payment increased for the additional work.

Regards,
{clientName}`,
  },

  'extension-partnerTransfer': {
    from: '{clientName}',
    fromId: 'CLIENT-{random}',
    fromName: '{clientName}',
    subject: 'Partner Network Transfer Required',
    body: `{username},

Our partner organization also needs a copy of these files for their records.

I'm attaching credentials for our partner's network. Please connect and transfer the files there as well.

Given the expanded scope, we've significantly increased your payment.

Regards,
{clientName}`,
  },
};

export default { createMessageFromTemplate, MESSAGE_TEMPLATES };
