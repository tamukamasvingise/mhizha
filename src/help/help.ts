// Help: the site's tutorials, built into the app so they work offline, and how
// to get help. Plain data; the Help page in Settings shows it, and the GitHub
// Pages site (ticket 23) can be made from the same text so the two never differ.

export type HelpTopic = { id: string; title: string; steps: readonly string[] };

export const tutorials: readonly HelpTopic[] = [
  {
    id: 'quotation',
    title: 'Make a Quotation',
    steps: [
      'Tap New, then Quotation.',
      'Pick the Customer, or add a new one.',
      'Pick the Job, or add one at one of their Sites.',
      'Add the lines: pick items from your Price list or type your own, with how many and the price.',
      'Check the totals, then tap Issue. Mhizha gives it the next number and makes the PDF.',
      'Share the PDF with the Customer, by WhatsApp or email.',
      'Until you Issue it, a Quotation is a Draft: you can change it or delete it.',
    ],
  },
  {
    id: 'invoice',
    title: 'Turn a Quotation into an Invoice',
    steps: [
      'Open the Quotation from Documents or from the Customer. Once the Customer agrees, mark it Accepted.',
      'Tap Make an Invoice. A Draft Invoice opens with the same lines, and any Deposit paid is taken off.',
      'Change any lines that differ from the work done, then check the totals.',
      'Tap Issue, then share the PDF with the Customer.',
      'An Issued Invoice is never changed. To correct one, use Cancel and replace.',
    ],
  },
  {
    id: 'payment',
    title: 'Record a payment',
    steps: [
      'Tap New, then Payment, and pick the Customer who paid.',
      'Enter the amount, the date you received it and how they paid.',
      'Tick the Invoices it pays. The money fills the oldest first; change the amounts if they paid differently.',
      'Money paid before the work goes as a Deposit on their accepted Quotation. Money left over becomes Credit once you confirm.',
      'Tap Check Payment, then Save and issue Receipt. Mhizha issues a Receipt you can share with the Customer.',
    ],
  },
  {
    id: 'backup',
    title: 'Make a Backup',
    steps: [
      'Open Settings and tap Back up.',
      'The first time, choose a backup password of at least 8 characters and type it twice. Write it down somewhere safe: it cannot be recovered.',
      'The Share menu opens. Save the file to Google Drive, email it to yourself or send it to a phone you trust.',
      'Mhizha asks if you saved it somewhere safe. Tap Yes once it is saved.',
      'Make a Backup at least once a week, and always before you install an update.',
    ],
  },
  {
    id: 'restore',
    title: 'Restore from a Backup',
    steps: [
      'On a new phone, install Mhizha and tap Restore from a backup on the first screen. On a phone already set up, open Settings and tap Restore.',
      'Restoring replaces everything on this phone. Mhizha keeps a safety copy first and asks you to type RESTORE.',
      'Pick the backup file and enter its password.',
      'Check the Business name, the backup date and the counts, then continue.',
      'Enter the last number of each Document you issued after the Backup, so no number is used twice. Mhizha then lists those Documents in the Review for you to enter again.',
    ],
  },
];

export const help: readonly HelpTopic[] = [
  ...tutorials,
  {
    id: 'update',
    title: 'Install an update',
    steps: [
      'When a new version is ready, Home says so. Make a Backup first.',
      'Tap Download. The Mhizha site opens with the install steps.',
      'Install it over the old version. Your records stay.',
    ],
  },
  {
    id: 'new-key',
    title: 'If Mhizha is ever built under a new key',
    steps: [
      'Each version is signed with the developer’s key, so Android only installs it over Mhizha from the same developer.',
      'If that key is ever lost, or someone else carries Mhizha on, the new build cannot install over the old one.',
      'Then make a Backup, uninstall Mhizha, install the new build and Restore your Backup.',
    ],
  },
  {
    id: 'support',
    title: 'Getting help',
    steps: [
      'Open Settings and tap Send a problem report. It holds no Customer details, and you can read it before you share it.',
      'Ask for help at github.com/tamukamasvingise/mhizha/issues and attach the report.',
      'GitHub issues are public: anyone can read them. Never put Customer names, phone numbers, amounts or your backup password in one.',
      'Help is given when there is time. Nobody will ask you for a Backup.',
    ],
  },
];
