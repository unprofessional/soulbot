# SOULBOT
a discord bot

## Features
- Persist a nickname prefix for users that change their nicknames and profile pictures too often

## Deployment
makes use of Kubernetes, a Persistent Volume, and a Persistent Volume Claim
- all config resids in the `/kubernetes` directory
- you must set the `DISCORD_BOT_TOKEN` environment variable within Kubernetes via:
  - `kubectl create secret generic discord-bot-secret --from-literal=DISCORD_BOT_TOKEN=xxxxx`

## If using Minikube
### Start
1) `minikube start --driver=docker`
2) `eval $(minikube -p minikube docker-env)`
  - https://stackoverflow.com/a/42564211
3) `docker build --platform="linux/amd64" --no-cache -t unprofessional/soulbot:rc-0.0.1 .`
  - generic: `docker build --no-cache -t unprofessional/soulbot:rc-0.0.1 .`
4) `kubectl create secret generic discord-bot-secret --from-literal=DISCORD_BOT_TOKEN=xxxxx`
5) `kubectl apply -f kubernetes/soulbot-deployment.yaml ; kubectl apply -f kubernetes/soulbot-http-service.yaml`
### Stop
1) `kubectl delete service soulbot-http-service ; kubectl delete deployment soulbot`
2) `kubectl delete persistentvolumeclaim soulbot-pvc ; kubectl delete persistentvolume soulbot-pv`
3) `kubectl delete pods -l app=soulbot`

## Misc Kube Troubleshooting
- `kubectl get svc soulbot-http-service`
- `kubectl logs -f pod/soulbot-xxxxxxxxx-xxxxx`
- `kubectl describe pod/soulbot-xxxxxxxxx-xxxxx`

## Kubernetes Troubleshooting Pod (`pvc-inspector`)
### Start
- `kubectl apply -f kubernetes/pvc-inspector.yaml`
- `kubectl exec -it pvc-inspector -- sh`
### Stop
- `kubectl delete pod pvc-inspector`

## TODO
- Consider using GitHub issues to track problems

# Command registration
### https://discordjs.guide/creating-your-bot/command-deployment.html#command-registration
Slash commands can be registered in two ways; in one specific guild, or for every guild the bot is in. We're going to look at single-guild registration first, as this is a good way to develop and test your commands before a global deployment.

Your application will need the applications.commands scope authorized in a guild for any of its slash commands to appear, and to be able to register them in a specific guild without error.

Slash commands only need to be registered once, and updated when the definition (description, options etc) is changed. As there is a daily limit on command creations, it's not necessary nor desirable to connect a whole client to the gateway or do this on every ready event. As such, a standalone script using the lighter REST manager is preferred.

This script is intended to be run separately, only when you need to make changes to your slash command definitions - you're free to modify parts such as the execute function as much as you like without redeployment.