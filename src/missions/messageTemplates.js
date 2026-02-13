/**
 * Message Templates for Story Missions
 *
 * Templates for manager messages during tutorial missions.
 * These are referenced by templateId in mission JSON files.
 * 
 * Available placeholders (passed via data object):
 * - {username} - Player's username
 * - {managerName} - Manager's name
 * - {clientName} - Client organization name
 * - {missionTitle} - Mission title
 * - {payoutAmount} - Payment amount
 * - {serverName} - Server hostname
 * - {networkName} - Network name
 * - {destinationServer} - Destination server for transfers
 * - {targetFilesList} - List of target files
 * - {clientCity} - Client location city (if available)
 * - {clientRegion} - Client location region (e.g., "North Sea", "Pacific Northwest")
 * - {clientCountry} - Client location country
 * - {locationType} - Location type (office, offshore, vessel, remote, etc.)
 * - {chequeAmount} - Payment cheque amount (for attachment processing)
 * - {random} - Auto-generated random ID segment
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
    body: `Dear {username},

Thank you for completing the work on "{missionTitle}".

Please find attached a digital cheque for {payoutAmount} credits as agreed.

Sincerely,
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
    body: `Dear {username},

While you've been working, our monitoring systems detected additional file corruption on {serverName}.

These files need to be repaired as well - they're part of the same data set and equally critical to our operations.{targetFilesList}

We're increasing your payment to reflect the additional work. Please continue and repair these files as well.

Sincerely,
{clientName}`,
  },

  'extension-additionalServer': {
    from: '{clientName}',
    fromId: 'CLIENT-{random}',
    fromName: '{clientName}',
    subject: 'Additional Server Needs Attention',
    body: `Dear {username},

Good progress so far. However, we've discovered that the corruption has spread to {serverName} on the same network.

Please also repair the files on this additional system. The server should be visible when you scan the network.{targetFilesList}

Your payment has been increased to compensate for the extra work.

Sincerely,
{clientName}`,
  },

  'extension-newNetworkRepair': {
    from: '{clientName}',
    fromId: 'CLIENT-{random}',
    fromName: '{clientName}',
    subject: 'Urgent: Archive Network Also Affected',
    body: `Dear {username},

We've just discovered that our {networkName} network has also been hit by the same corruption issue.

I'm attaching credentials for {networkName}. Please connect and repair the affected files on {serverName}.{targetFilesList}

We're significantly increasing your payment given the expanded scope of work.

Sincerely,
{clientName}`,
  },

  // Backup extensions
  'extension-additionalBackupFiles': {
    from: '{clientName}',
    fromId: 'CLIENT-{random}',
    fromName: '{clientName}',
    subject: 'Additional Files for Backup',
    body: `Dear {username},

Our compliance team just identified additional files that need to be included in this backup operation.

Please also copy these files to {destinationServer}. They've been added to the source directory.{targetFilesList}

Payment has been adjusted upward for the additional work.

Sincerely,
{clientName}`,
  },

  'extension-secondaryBackupServer': {
    from: '{clientName}',
    fromId: 'CLIENT-{random}',
    fromName: '{clientName}',
    subject: 'Secondary Backup Required',
    body: `Dear {username},

Management has requested that we also maintain a secondary backup on {serverName} for redundancy.

Please copy the files to our secondary backup server as well. It's on the same network - you should see it after scanning.{targetFilesList}

We're increasing your payment for the additional backup work.

Sincerely,
{clientName}`,
  },

  'extension-offsiteBackup': {
    from: '{clientName}',
    fromId: 'CLIENT-{random}',
    fromName: '{clientName}',
    subject: 'Offsite Backup Also Required',
    body: `Dear {username},

For disaster recovery compliance, we need a copy of these files sent to our {networkName} facility as well.

I'm attaching credentials for {networkName}. Please connect and copy the files to {serverName}.{targetFilesList}

Your payment has been substantially increased given the expanded scope.

Sincerely,
{clientName}`,
  },

  // Transfer extensions
  'extension-additionalTransferFiles': {
    from: '{clientName}',
    fromId: 'CLIENT-{random}',
    fromName: '{clientName}',
    subject: 'Additional Files to Transfer',
    body: `Dear {username},

We've identified more files that need to be included in this transfer operation.

The additional files have been added to the source location. Please include them in the transfer to {destinationServer}.{targetFilesList}

Payment adjusted accordingly.

Sincerely,
{clientName}`,
  },

  'extension-archiveServer': {
    from: '{clientName}',
    fromId: 'CLIENT-{random}',
    fromName: '{clientName}',
    subject: 'Archive Copy Required',
    body: `Dear {username},

In addition to the primary transfer, we need an archive copy on {serverName} for audit purposes.

Please also transfer the files to our archive server. It should appear when you scan the destination network.{targetFilesList}

Payment increased for the additional work.

Sincerely,
{clientName}`,
  },

  'extension-partnerTransfer': {
    from: '{clientName}',
    fromId: 'CLIENT-{random}',
    fromName: '{clientName}',
    subject: 'Partner Network Transfer Required',
    body: `Dear {username},

Our partner organization also needs a copy of these files for their records.

I'm attaching credentials for {networkName}. Please connect and transfer the files to {serverName}.{targetFilesList}

Given the expanded scope, we've significantly increased your payment.

Sincerely,
{clientName}`,
  },

  // ===== HARDWARE UNLOCK MESSAGE =====
  // Sent when player has read the "better" message AND has >= 1000 credits
  // Reading this message unlocks network-adapters (hardware) and investigation-tooling (software) features
  'hardware-unlock': {
    from: 'SourceNet Manager',
    fromId: 'SNET-MGR-{random}',
    fromName: 'SourceNet Manager {managerName}',
    subject: 'New Opportunities - Hardware & Tools',
    body: `{username},

Well done. You've worked hard and gotten yourself out of debt. I knew there was a reason we hired you.

Now that you've proven you can handle the basics, it's time to talk about upgrading your equipment. The work you've been doing is fine, but with better hardware, you could be taking on more lucrative contracts.

First, let me explain how hardware works. Unlike software (which you just download and install), hardware requires a system REBOOT to take effect. When you purchase hardware from the Portal, it won't be active until you reboot your terminal via the Power menu. The boot sequence will detect and initialize the new hardware.

I'd recommend starting with a better NETWORK ADAPTER. Your current adapter is the bottleneck - it's limiting how fast you can transfer files. Networks you connect to have plenty of bandwidth, but your terminal can only receive data as fast as your adapter allows. A faster adapter means quicker file operations, which means more missions completed in less time.

I'm also releasing access to the LOG VIEWER and DATA RECOVERY TOOL.

The Log Viewer lets you pull network records from any network you're connected to. It's useful for investigating suspicious activity, understanding what other users have been doing on a system, or reviewing your own work.

The Data Recovery Tool lets you scan file systems for deleted files and restore them. You can also securely delete files - useful when you need to ensure sensitive data is truly gone and cannot be recovered by anyone.

Keep in mind that YOUR activity is being logged too - network administrators can see what you've been up to just as easily as you can see what others have done.

Check the Portal - Network Adapters (hardware), Log Viewer and Data Recovery Tool (software) are now available for purchase.

Once you have BOTH the Log Viewer AND the Data Recovery Tool installed, I'll reach out with details on investigative work that requires these tools.

- {managerName}`,
  },

  // ===== INVESTIGATION MISSION TEMPLATES =====

  // Sent after data-detective mission is completed successfully
  'investigation-intro-success': {
    from: 'SourceNet Manager',
    fromId: 'SNET-MGR-{random}',
    fromName: 'SourceNet Manager {managerName}',
    subject: 'Excellent Work - Investigation Missions Unlocked',
    body: `{username},

Outstanding work on the Westbrook Library case. You've proven you can handle investigative work - using the logs to track down the culprit and recovering those deleted files was exactly what I needed to see.

I'm now opening up investigation missions for you. These contracts require the skills you just demonstrated:
- Analyzing system logs to identify suspicious activity
- Recovering deleted files that clients need restored
- Secure deletion when sensitive data needs to be permanently removed

The pay is better than basic file work, but the stakes are higher too. Clients expect results, and some of these cases are time-sensitive.

Check the Mission Board - you'll start seeing investigation contracts mixed in with the regular work.

One more thing - I'm looking into getting you access to some advanced decryption tools. They're not cheap though. Keep taking contracts and building up your credits. Once you've earned another 10,000 or so, I should be able to sort something out.

Keep it up.

- {managerName}`,
  },

  // Sent when data-detective mission fails (retry available)
  'investigation-failure-retry': {
    from: 'SourceNet Manager',
    fromId: 'SNET-MGR-{random}',
    fromName: 'SourceNet Manager {managerName}',
    subject: 'Mission Failed - Another Chance',
    body: `{username},

That didn't go well. The Westbrook Library needed those files recovered intact, not permanently destroyed.

Look, I get it - the Data Recovery Tool's secure delete function is powerful, but you need to be careful when to use it. Secure deletion is for when clients WANT data gone forever, not for files they're desperately trying to get back.

I've talked to the client. They're not happy, but they've agreed to let you try again. The library has restored their systems from backup, so you'll have another shot at this.

The mission will be available again shortly. Don't make the same mistake twice.

- {managerName}`,
  },

  // Decryption tools unlock message (triggered at +10k credits after investigation missions)
  'decryption-tease': {
    from: 'SourceNet Manager',
    fromId: 'SNET-MGR-{random}',
    fromName: 'SourceNet Manager {managerName}',
    subject: 'Decryption Work - Ready to Go',
    body: `{username},

Good news. You've built up enough credits for me to get you access to the decryption tools I mentioned.

The Decryption Tool is now available in the Portal. It's 500 credits - handles AES-128 and AES-256 encrypted files out of the box. The workflow is straightforward: download encrypted files from the remote system to your local SSD, decrypt them locally, then upload the clean files back.

I already have a client lined up. MetroLink Transit Authority - they run the regional train network. Got hit by a ransomware attack last week and their ticketing systems are down. Thousands of commuters affected. They need someone to decrypt their databases and get everything back online.

Install the Decryption Tool from the Portal and check the Mission Board. The MetroLink job should appear shortly.

This is bigger money than the investigation work. Don't let me down.

- {managerName}`,
  },

  // ===== RANSOMWARE RECOVERY MISSION TEMPLATES =====

  // Urgent manager message when player's terminal is under ransomware attack
  'ransomware-rescue': {
    from: 'SourceNet Manager',
    fromId: 'SNET-MGR-{random}',
    fromName: 'SourceNet Manager {managerName}',
    subject: 'EMERGENCY - Your Terminal Is Under Attack!',
    body: `{username},

YOUR TERMINAL IS BEING ENCRYPTED! One of those files you decrypted was a planted virus disguised as passenger data!

I'm attaching an emergency license for our Advanced Firewall & Antivirus suite. Install it from the Portal RIGHT NOW and activate it - it should halt the encryption and clean the threat.

DO NOT WAIT. Every second counts. Install the software and run it IMMEDIATELY.

- {managerName}`,
    attachments: [
      {
        type: 'softwareLicense',
        softwareId: 'advanced-firewall-av',
        softwareName: 'Advanced Firewall & Antivirus',
        price: 2000,
        size: 50,
      }
    ],
  },

  // Resolution message after antivirus saves the terminal
  'ransomware-resolution': {
    from: 'SourceNet Manager',
    fromId: 'SNET-MGR-{random}',
    fromName: 'SourceNet Manager {managerName}',
    subject: 'Crisis Averted - Mission Update',
    body: `{username},

The antivirus caught it in time. Your terminal is clean.

Here's what happened: that "passenger-data.dat" file was a planted trap - a ransomware payload disguised as encrypted data. The attackers who hit MetroLink must have planted it as a secondary weapon, hoping whoever tried to clean up would get infected too.

The good news is the ticketing database and crew roster you decrypted earlier are fine - the MetroLink systems are coming back online. The client is grateful for the work you did before things went sideways.

Given the circumstances, I'm marking this mission as complete. You did the decryption work, and the ransomware trap wasn't something anyone could have predicted. MetroLink's payment will come through shortly.

The Advanced Firewall & Antivirus will keep running in the background - you'll see it in your top bar. It'll protect you from similar attacks going forward.

I have to say, your decryption work impressed me. There's growing demand for specialists who can handle encrypted data recovery - ransomware attacks are on the rise and organisations are desperate for help.

I'm going to start sending you decryption contracts. You've got the basics down with AES, but the serious money is in advanced algorithms. I'll be making Blowfish and RSA-2048 decryption modules available in the Portal soon. The higher the encryption complexity, the better the payout.

Focus on building up your credits. Those advanced modules aren't cheap, but they'll pay for themselves quickly.

- {managerName}`,
  },

  // Resolution message after player enters decryption key on lock screen
  'ransomware-decrypted-resolution': {
    from: 'SourceNet Manager',
    fromId: 'SNET-MGR-{random}',
    fromName: 'SourceNet Manager {managerName}',
    subject: 'How Are You Back Online?',
    body: `{username},

Wait — your terminal is back online? I was told your workstation was completely locked down by ransomware. Our monitoring showed full encryption. How did you get back in?

Never mind, I don't need to know the details right now. What matters is you're operational again.

The good news is the work you did before the attack still stands. The ticketing database and crew roster you decrypted for MetroLink are fine — their systems are coming back online. The client is satisfied with the recovery work.

I'm marking this mission as complete. MetroLink's payment will come through shortly. Consider yourself lucky — that could have gone a lot worse.

The Advanced Firewall & Antivirus license I sent earlier is still valid if you want to install it. Might be worth having for future jobs.

Regardless of how you got back online, your decryption skills clearly go beyond what I expected. There's a lot of demand for this kind of work right now.

I'm opening up decryption contracts for you. You already have AES capability, but I'm also making advanced algorithm modules available - Blowfish and RSA-2048. They're not cheap, but the contracts that need them pay significantly more.

Earn credits, buy the modules, and take on bigger jobs. Simple as that.

- {managerName}`,
  },

  // Client thanks for ransomware recovery (payment handled by standard client-payment template)
  'ransomware-recovery-success': {
    from: 'MetroLink Transit Authority',
    fromId: 'CLIENT-{random}',
    fromName: 'MetroLink Transit Authority',
    subject: 'Thank You - Systems Coming Back Online',
    body: `Dear {username},

Thank you for your work recovering our ticketing and scheduling databases. Our systems are coming back online and service disruptions are being resolved.

We understand you encountered a secondary attack during the recovery process. We sincerely apologise - we had no idea the attackers had planted additional payloads on our systems. We're conducting a full security audit to ensure no other traps remain.

Payment has been sent separately. We've included a bonus for the additional risk you faced.

On a separate note - the sophistication of this attack was unusual. Our security consultants tell us this wasn't a standard ransomware kit. Someone specifically targeted our systems. We're not sure why a transit authority would attract this level of attention, but we're taking it seriously.

Sincerely,
MetroLink Transit Authority`,
  },
};

export default { createMessageFromTemplate, MESSAGE_TEMPLATES };
