# SOULBOT
a discord bot

## Features
- Persist a nickname prefix for users that change their nicknames and profile pictures too often

## Deployment

SOULbot runs as a Docker Compose service. Secrets are managed via [Infisical](https://infisical.com/) and injected at container startup.

### Notes

- Tweet renders prefer translations surfaced by the Twitter metadata API, with a guarded Ollama fallback for non-English posts whose API translation is missing
- Tweet/X translation rendering can use the small `translategemma:4b` fallback model when API-provided translations are missing
- Set `OLLAMA_TRANSLATION_MODEL` if you want to override the default translation/cleanup model
- General LLM inference is disabled by default so heavyweight chat, summary, standalone translation, speak-english cleanup, vision, and Chroma/RAG paths do not load GPU models. Set `GENERAL_LLM_INFERENCE_ENABLED=true` only when intentionally re-enabling those features.
- The bot exposes health endpoints on `HEALTH_PORT` (default `8080`): `/livez`, `/readyz`, and `/drain`
- During shutdown the bot marks itself unready, pauses new queued work, waits for active work to finish, then disconnects Discord and closes Postgres
- A Postgres advisory lock serializes Discord leadership so a new container waits for the old one to stand down before it logs in
- Set `REGISTER_GUILD_COMMANDS=true` to publish application commands immediately to the configured guild
- Set `REGISTER_GLOBAL_COMMANDS=true` to publish global application commands; global changes may take time to propagate
- Command registration requires `DISCORD_CLIENT_ID`/`DISCORD_GUILD_ID`, or their legacy aliases `CLIENT_ID`/`DEV_GUILD_ID`

### ChatGPT OAuth inference (optional)

SOULbot supports OpenAI's [Sign in with ChatGPT for open-source/self-hosted apps](https://developers.openai.com/siwc/token-sharing-open-source). Eligible Plus/Pro accounts can authorize Responses API requests against their ChatGPT plan and available credits. This is separate from API-key billing. Your account's app limits and credit settings determine the allowance; OAuth does not guarantee unlimited usage.

1. Run `npm run chatgpt:auth -- login` on the bot host, then open the printed **Continue with ChatGPT** link in your browser and authorize plan usage.
2. Run `npm run chatgpt:auth -- models` and copy a model slug available to your account.
3. Set `CHATGPT_MODEL` to that slug and `CHATGPT_TASKS=summary` (or `summary,chat,translation`) in the bot's environment, then restart it.

| Task | Routes through your ChatGPT account |
| --- | --- |
| `summary` | `/summary`, `/deleted-summary`, `/summarize-message` |
| `chat` | `/llm` replies **and** its follow-up memory summaries (two requests per conversation turn) |
| `translation` | `/translate`, `/translate-en`, and tweet translations when the metadata API has no usable translation |

Optional `CHATGPT_SUMMARY_MODEL`, `CHATGPT_CHAT_MODEL`, and `CHATGPT_TRANSLATION_MODEL` override the common model. For Luna on all selected tasks, set `CHATGPT_MODEL=gpt-6-luna` and remove other model overrides or set them to the same slug. These selected tasks work even with `GENERAL_LLM_INFERENCE_ENABLED=false`. Vision and embeddings/RAG retain their existing provider and gates. Automatic speak-english cleanup remains behind the general inference gate; when enabled, it uses the selected translation provider. Tweet API translations are reused before requesting model inference. Empty `CHATGPT_TASKS` preserves existing behavior. A selected ChatGPT task never falls back to Ollama or API-key billing on auth, quota, or stream failures.

Use `npm run chatgpt:auth -- status` to view profiles and `npm run chatgpt:auth -- logout` to revoke and clear a session. Add an optional profile name to any command, such as `login personal`, and select it in the bot with `CHATGPT_PROFILE=personal`. Reauthorization reuses that profile's registration. Use a different profile name to add another account/workspace. Review allowance and credit access in [ChatGPT Settings → Usage](https://chatgpt.com/settings/usage). Requests triggered by Discord members use the selected operator account's allowance.

Tokens and the stable host ID live in `~/.config/soulbot/chatgpt`, or `CHATGPT_AUTH_DIR`. Files are written atomically with owner-only permissions. Refreshes are serialized across the CLI and bot. Keep this directory private, writable, and persistent; do not commit it or bake it into an image. If a process crashes while holding its `.lock` directory, stop all processes using that credential directory before removing the stale `.lock`. Signing out preserves account/client mappings and the host ID for later sign-in.

For a remote host, forward the loopback callback before signing in: `ssh -L 1455:127.0.0.1:1455 user@bot-host`. Run the login command on that host and open its URL locally. `CHATGPT_CALLBACK_PORT` can select another forwarded port. The callback binds only `127.0.0.1` and times out after five minutes.

Docker Compose mounts `/var/lib/soulbot/chatgpt:/run/soulbot-chatgpt` and sets `CHATGPT_AUTH_DIR=/run/soulbot-chatgpt`. Override the host path with `CHATGPT_AUTH_HOST_DIR` in the Compose environment if needed. Run the login CLI on that same host with `CHATGPT_AUTH_DIR=/var/lib/soulbot/chatgpt`, using the same mounted directory. Set `CHATGPT_TASKS` and model settings through Infisical or Compose. Do not authenticate on a different machine and clone its host identity into the deployment. No public OAuth callback port is required in Compose. Deployments sharing this credential directory must run on the same host/filesystem so the refresh lock works.

The documented flow supports open-source and locally hosted apps; paid/remotely hosted offerings require OpenAI's partner access. See the [official setup and eligibility documentation](https://developers.openai.com/siwc/quickstart).

### Secret Management (Infisical)

SOULbot uses [Infisical](https://infisical.com/) for secret management. Application secrets (bot token, DB credentials, etc.) are stored in Infisical and injected at container startup via the Infisical CLI. Optional ChatGPT OAuth sessions use the protected persistent directory described above so rotating refresh tokens can be updated safely.

**Setup:**

1. Create a `.env.infisical` file (gitignored) with your Infisical machine identity credentials:

   ```env
   INFISICAL_CLIENT_ID=your-machine-identity-client-id
   INFISICAL_CLIENT_SECRET=your-machine-identity-client-secret
   INFISICAL_API_URL=http://your-infisical-instance
   INFISICAL_PROJECT_ID=your-project-id
   INFISICAL_ENV=prod
   ```

2. Ensure all application secrets are stored in the corresponding Infisical project and environment.

3. Build and run:

   ```bash
   docker compose up --build -d
   ```

The entrypoint script (`entrypoint.sh`) authenticates with Infisical using Universal Auth, fetches secrets, and injects them as environment variables before starting the bot. A pre-start cleanup script (`release-stale-lock.js`) terminates any orphaned Postgres sessions holding the advisory lock from a previous unclean shutdown.

**Fallback:** If you need to run without Infisical, you can override the container command to `node index.js` and provide a traditional `.env` file with all application secrets.

The container does not provision PostgreSQL — you still need a reachable database.

### Docker Compose

```bash
# Start
docker compose up --build -d

# Logs
docker compose logs -f soulbot

# Stop (graceful — 35s grace period for shutdown announcements)
docker compose down

# Restart
docker compose down && docker compose up --build -d
```

### Legacy Kubernetes

The `/kubernetes` directory contains the previous k8s/minikube deployment manifests. These are no longer used in production but are kept for reference.

## TODO
- Consider using GitHub issues to track problems

# Command registration
### https://discordjs.guide/creating-your-bot/command-deployment.html#command-registration
Slash commands can be registered in two ways; in one specific guild, or for every guild the bot is in. We're going to look at single-guild registration first, as this is a good way to develop and test your commands before a global deployment.

Your application will need the applications.commands scope authorized in a guild for any of its slash commands to appear, and to be able to register them in a specific guild without error.

Slash commands only need to be registered once, and updated when the definition (description, options etc) is changed. As there is a daily limit on command creations, it's not necessary nor desirable to connect a whole client to the gateway or do this on every ready event. As such, a standalone script using the lighter REST manager is preferred.

This script is intended to be run separately, only when you need to make changes to your slash command definitions - you're free to modify parts such as the execute function as much as you like without redeployment.
