The store makes use of the file system:
- If the file doesn't exist locally, it creates it
- For Kubernetes, it makes use of a Persistent Volume and Persistent Volume Claim

Required Environment Variables:
- STORE_PATH
  - default: "/data"
- GUILD_STORE_FILE
  - default: "guild.store.json"
- CHANNEL_STORE_FILE
  - default: "channel.store.json"
- MEMBER_STORE_FILE
  - default: "member.store.json"