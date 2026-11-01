# Try Esau's Trails on your phone for free (Vercel)

No server to look after. Takes about 10 minutes. Everything here is on the free Hobby plan, for personal use.

1. Go to vercel.com, choose **Sign Up**, then **Continue with GitHub**.
2. Click **Add New → Project**, find `esaus-trails`, click **Import**.
3. Framework Preset should say **Vite**. Leave the build settings alone.
4. Open **Environment Variables** and add:
   - `NWS_USER_AGENT` = `esaus-trails, your@email.com` (weather.gov asks for contact info)
   - `ANTHROPIC_API_KEY` = your new key (optional; without it Esau gives the short offline read)
5. Click **Deploy**. When it finishes you get an address like `esaus-trails.vercel.app`.
6. On your phone open that address. In Safari tap Share → **Add to Home Screen**. In Chrome tap the menu → **Install app**.

## Check it worked
On a computer with Node: `node scripts/smoke.mjs https://your-app.vercel.app`. Four lines starting `ok` means the site, weather and ground lookups answer.

## Notes
- Your marks, photos and tracks stay on your phone. Nothing here stores them.
- If the ground lookup times out, wait a minute and tap again. The free plan limits each request to 30 seconds.
- Free plan is for personal, non-commercial use. A paid app later would need a paid plan.
- Revoke an API key at console.anthropic.com if it ever leaks.
- Set a monthly spend limit in the Anthropic console. The per-minute limit on Esau is per server instance on Vercel, so treat it as a soft limit.
