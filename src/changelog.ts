/** What's new, newest first. Add an entry at the top whenever an update is published. */
export interface Release {
  id: string
  date: string // YYYY-MM-DD
  title: string
  items: string[]
}

export const CHANGELOG: Release[] = [
  {
    id: '2026-10-16-pdf-help',
    date: '2026-10-16',
    title: 'Rotations PDF, help and this updates list',
    items: [
      'Rotations tab: share or download a PDF for players with a lineup page and pages for Rotation, Serve, Serve receive and Base (defense pages optional).',
      'New Rotation page in the PDF: the basic rotation order, each player in their spot before switching.',
      'Help button (?) in the top corner with a guide for every tab.',
      'This What\'s new list, so you can see how the app has grown.',
    ],
  },
  {
    id: '2026-10-15-backup',
    date: '2026-10-15',
    title: 'Smoother dragging and backups',
    items: [
      'Moving players with a finger on the Rotations court is much smoother.',
      'Roster tab: Backup card to save everything to a file and restore it, also how you move data to another phone or iPad.',
      'The app asks your phone to keep its data so it isn\'t cleaned up automatically.',
    ],
  },
  {
    id: '2026-10-15-touch',
    date: '2026-10-15',
    title: 'Finger-friendly court',
    items: [
      'The page no longer scrolls while you hold a player.',
      'Tap a player, then tap a spot, to move them without dragging.',
      'Bigger touch areas for players on the court.',
    ],
  },
  {
    id: '2026-10-15-reports',
    date: '2026-10-15',
    title: 'Match details, Game and Season reports, MaxPreps export',
    items: [
      'Matches record type (region, non-region, tournament, playoff, scrimmage), date and time, location, home or away, and season.',
      'Choose whether a match counts toward the season; scrimmages are off by default.',
      'Game tab: one match with per-set stats, plus a MaxPreps import file and a spreadsheet.',
      'Season tab: record overall and by type, player totals, and a season spreadsheet, with filters.',
    ],
  },
  {
    id: '2026-10-15-launch',
    date: '2026-10-15',
    title: 'Volley goes live',
    items: [
      'Teams with up to 14 players each.',
      'Rotations for 5-1, 6-2 and 4-2 with libero and subs; serve, receive, base and defense formations you can arrange and save.',
      'Live match stats with two-tap entry, ratings, attack types, fault kinds, timeouts, undo and redo, and mid-set lineup changes.',
      'Installs to your phone\'s Home Screen and works offline.',
    ],
  },
]
