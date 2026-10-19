# Isekai'd Into Prod on Cloudflare

This folder deploys the game to Cloudflare Workers. One Worker serves everything:

- **The game itself:** every file in `game/` (except `game/tools/`, see `game/.assetsignore`) as static assets. Static requests are free and not metered.
- **Multiplayer rooms:** `/api/room/<name>`, a WebSocket per table (Durable Object `Room`). Same shape as the claude.ai `room` capability, so Pair Mock, Whiteboard Showdown and Incident Raid run unchanged.
- **Open lobbies:** `/api/lobby/<game>`, one table directory per game (Durable Object `Directory`): the first 10 open tables, oldest first, pushed live to everyone on the Guild Hall screen.
- **Cloud saves:** `/api/save/<code>` (Durable Object `SaveSlot`). Each browser gets a 32-character save code. Menu > Play on another device shows it and accepts one from another device.

The game finds the backend by asking `api/hello` (`game/js/cloud.js`). The claude.ai artifact and a local `python3 -m http.server` copy get no answer, so they behave exactly as before.

## One-time setup (about 10 minutes)

You need Node.js 20 or later.

1. Create a free Cloudflare account at https://dash.cloudflare.com/sign-up. No card is needed for the Free plan.
2. Install the tools:
   ```sh
   cd cloudflare
   npm install
   ```
3. Sign in. This opens a browser window to approve Wrangler:
   ```sh
   npx wrangler login
   ```
4. Deploy:
   ```sh
   npx wrangler deploy
   ```
   The first deploy asks you to pick a `workers.dev` subdomain. When it finishes, it prints the game's address, like `https://isekaid-into-prod.<your-subdomain>.workers.dev`. Open it and play.

To deploy a new build later, run `npx wrangler deploy` again from this folder.

### Optional

- **Your own domain:** Cloudflare dashboard > Workers & Pages > isekaid-into-prod > Settings > Domains & Routes > Add > Custom domain. The domain must be on your Cloudflare account.
- **Deploy on every push:** Workers & Pages > isekaid-into-prod > Settings > Builds > Connect to the GitHub repo. Set the root directory to `cloudflare` and the deploy command to `npx wrangler deploy`.

## Try it locally first

```sh
cd cloudflare
npx wrangler dev
```

Then open http://localhost:8787 in two different browsers (or one normal and one private window) to play each other. Rooms, lobbies and saves all run locally.

## What it costs

On the **Workers Free** plan there is no bill. Past a daily limit, requests to the API fail until the next day (static files keep loading). The relevant free limits (Cloudflare's pricing pages, checked 2026-10-19):

- Static assets: free and unlimited.
- Worker requests (only `/api/*` runs the Worker): 100,000 a day.
- Durable Objects (rooms, lobbies, saves): 100,000 requests a day, where WebSocket messages count 20 to 1, and 5 GB of storage.

If the game outgrows that, **Workers Paid** is $5 a month and includes 10 million Worker requests and 1 million Durable Object requests, then usage pricing. You can stay on Free and nothing is ever charged.

Sources: https://developers.cloudflare.com/workers/platform/pricing/ , https://developers.cloudflare.com/durable-objects/platform/pricing/ , https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/

## Limits built into the Worker

- A message is at most 8 KB, presence at most 2 KB, and each socket gets about 20 messages a second.
- A table room holds up to 64 sockets; a lobby directory up to 5,000.
- Rooms and sockets only accept connections from the game's own address.
- A save is at most 1 MB, and an older save never overwrites a newer one.
