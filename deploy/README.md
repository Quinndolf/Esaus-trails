# Putting Esau's Trails on the droplet

Everything here runs in the DigitalOcean web Console, so no SSH setup is needed.
Open it from the DigitalOcean dashboard: **Droplets → your droplet → Console** (top right).
To paste into the Console, right-click and choose Paste, or press Ctrl+Shift+V.

## 1. First install (once)

```sh
curl -fsSL https://raw.githubusercontent.com/Quinndolf/Esaus-trails/main/deploy/setup.sh | sudo bash
```

It takes about five minutes. It leaves your other site alone: Esau gets its own nginx site that only
answers to its own address, its own Node, its own user (`esau`) and its own service. If something other
than nginx already owns port 80 it stops before changing anything and says so.

At the end it prints the address, something like `https://esau.164-90-1-2.sslip.io`.
That is a free name that points at your droplet until esaustrails.com is bought.

## 2. Give Esau his key

```sh
sudo nano /etc/esaus-trails/esau.env
```

Paste your Anthropic key right after `ANTHROPIC_API_KEY=` (no spaces, no quotes).
Save with **Ctrl+O**, **Enter**, then exit with **Ctrl+X**. Then:

```sh
sudo systemctl restart esaus-trails-api
```

The file can only be read by root and the app. The key never goes to phones or to GitHub.

## 3. Put it on your phone

Open the address in Safari (iPhone) or Chrome (Android).
iPhone: Share → **Add to Home Screen**. Android: ⋮ → **Install app**.
Allow location when asked. After the first open the app starts with no signal;
save map areas with the **Offline** button before you head into the woods.

## Updating after changes are merged

```sh
sudo /opt/esaus-trails/app/deploy/deploy.sh
```

It pulls `main`, runs the tests, builds, swaps the site over in one step and restarts the API.
If the tests or build fail, the live site stays as it was.

## When esaustrails.com is bought

At the place you bought it, add two **A records**, `@` and `www`, both pointing at the droplet's IP.
Wait a few minutes, then:

```sh
sudo /opt/esaus-trails/app/deploy/add-domain.sh esaustrails.com
```

## If something looks wrong

```sh
sudo systemctl status esaus-trails-api        # is the API running?
sudo journalctl -u esaus-trails-api -n 50     # its last 50 log lines
curl -s http://127.0.0.1:8787/api/health      # {"ok":true,"esau":true} means the key is in
```

If HTTPS fails, check that the droplet's **Networking → Firewalls** page allows ports 80 and 443.

## Where things live

| Path | What |
|---|---|
| `/opt/esaus-trails/app` | the code (a clone of this repo) |
| `/opt/esaus-trails/site` | the live build (points at one of `releases/`) |
| `/opt/esaus-trails/node` | Node 22, used only by this app |
| `/etc/esaus-trails/esau.env` | settings and the Anthropic key |
| `/etc/nginx/sites-available/zz-esaus-trails` | the nginx site |
| `/etc/systemd/system/esaus-trails-api.service` | the API service |
