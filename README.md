# Grid Gambit

A competitive, team-based technical Bingo game built for live events.

## Project Structure

```
grid-gambit/
├── server/          # Node.js + Express + Socket.io backend
└── client/          # React + Vite frontend
```

## Quick Start (Local)

### 1. Start the Server
```bash
cd server
npm install
npm run dev
# Runs on http://localhost:3001
```

### 2. Start the Client
```bash
cd client
npm install
npm run dev
# Runs on http://localhost:5173
```

### 3. Open the App
| URL | Who uses it |
|-----|------------|
| http://localhost:5173/ | Teams (player login) |
| http://localhost:5173/play | Game screen (after team login) |
| http://localhost:5173/admin | Admin panel |
| http://localhost:5173/leaderboard | Projector screen |

**Admin code:** `ADMIN2025`

---

## Deployment

### Deploy on Railway
If you want to deploy the app on Railway, deploy the Node.js backend from the `server/` folder.

### Deploy Server → Railway
1. Push repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Set root directory to `/server`
4. Add environment variable: `PORT=3001`
5. Copy the Railway URL (e.g. `https://grid-gambit.up.railway.app`)

### Deploy Client → Vercel
1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
2. Set root directory to `/client`
3. Add environment variable:
   ```
   VITE_BACKEND_URL=https://your-railway-url.up.railway.app
   ```
4. Deploy

### Firebase (optional, for auth layer)
Not required for base functionality. The admin code system is sufficient for events.

---

## Game Flow

1. **Admin** opens `/admin`, enters code `ADMIN2025`
2. **Admin** adds teams (name + color)
3. **Teams** open `/` on their laptops, select their team, click Enter
4. **Admin** clicks **Start Game**
5. Teams answer questions → correct answers mark bingo cells automatically
6. First team to complete **5 lines** wins
7. **Projector** screen at `/leaderboard` shows live rankings
8. **Admin** can toggle leaderboard visibility from admin panel

---

## Security Notes
- Answer keys are stored server-side only, never sent to clients
- All answer validation happens in the Node.js server
- Rate limiting on answer submissions (500ms cooldown per socket)
- Admin actions require the admin code
- Teams cannot manually mark cells — all assignments are server-controlled

---

## Changing the Admin Code
In `server/index.js`, find:
```js
adminCode: 'ADMIN2025'
```
Change it before deploying.

## Adding Questions
In `server/index.js`, find the `QUESTION_BANK` array and add objects:
```js
{
  id: 'q31',
  category: 'Technical',   // Technical | Cyber Smart | Scenario | Slice of Life
  prompt: 'Your question here?',
  options: ['Correct answer', 'Wrong A', 'Wrong B', 'Wrong C'],
  answer: 0   // index of correct option (always 0, then shuffle handles randomization)
}
```
