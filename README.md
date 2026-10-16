# Volley

Volleyball rotations, live match stats and reports. Runs in the browser and installs to a phone's home screen;
works offline once loaded. Live at https://jneyra6.github.io/volley/

## Features

- **Teams & roster**: several teams, up to 14 players each.
- **Rotations**: 5-1, 6-2 and 4-2 systems with libero and planned subs; receive, serve, base and defense
  formations you can drag and save; overlap checking; saved rotations to start matches from.
- **Match**: two-tap stat entry for your players and the opponent, serve/pass ratings, attack types and fault kinds,
  sets (best of 3 or 5), timeouts, undo/redo, manual score changes and mid-set lineup changes.
- **Reports**: per-player stats, hitting %, pass and serve ratings, side-out and point-scoring %, results by rotation.

Data is stored on each device (browser storage); nothing is sent to a server.

## Development

Requires Node.js 22+.

```bash
npm install
npm run dev      # local dev server
npm test         # engine tests
npm run build    # production build in dist/
```

Pushing to `main` builds and publishes to GitHub Pages through `.github/workflows/deploy.yml`.
