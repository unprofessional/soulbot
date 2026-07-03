# SOULBOT
a discord bot

## Features
- Persist a nickname prefix for users that change their nicknames and profile pictures too often

## Deployment

SOULbot runs as a Docker Compose service. Secrets are managed via [Infisical](https://infisical.com/) and injected at container startup.

### Notes

- Tweet renders prefer translations surfaced by the Twitter metadata API, with a guarded Ollama fallback for non-English posts whose API translation is missing
- `/translate`, `/translate-en`, and speak-english cleanup run server-side through Ollama/Kokoro using `translategemma:12b`
- Set `OLLAMA_TRANSLATION_MODEL` if you want to override the default translation/cleanup model
- The bot exposes health endpoints on `HEALTH_PORT` (default `8080`): `/livez`, `/readyz`, and `/drain`
- During shutdown the bot marks itself unready, pauses new queued work, waits for active work to finish, then disconnects Discord and closes Postgres
- A Postgres advisory lock serializes Discord leadership so a new container waits for the old one to stand down before it logs in
- Set `REGISTER_GLOBAL_COMMANDS=true` only for the one-off rollout or admin job that should publish slash command definitions

### Secret Management (Infisical)

SOULbot uses [Infisical](https://infisical.com/) for secret management. Application secrets (bot token, DB credentials, etc.) are stored in Infisical and injected at container startup via the Infisical CLI. No application secrets are stored in local files.

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
