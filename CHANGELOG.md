2024-08-07
---
- Fix group filter for kills only (#11)
- Fix kills beeing posted multiple times (#12)

2024-04-18
---

- fix: show correct totalValue of kills instead of destroyedValue

2024-04-13
---

- the bot now uses a mongodb to store/cache data required to render killmails
- redis is now required for running the bot
- the bot will now fetch all data required to render a killmail from esi and store it in the mongodb
- posting kills with colors (green/red) is working again

2024-04-06
---

- add bullmq for queueing messages to prevent rate limiting of discord api and asyncQueue (optional)
- add redis as requirement for bullmq
- when bullmq is enabled, sending will be retried up to 10 times

2024-02-24
---

- added new functionality to filter groups and ships by region, constellation, and system
- update nodejs to 20
- update discordjs to 14
- update all other dependencies
- add new eslint rules
- __attention: new command filters will roll out within 24 hours__

2023-11-19
---

- added new functionality to filter by kill type (kill/loss)
- __attention: new command filters will roll out within 24 hours__


2023-01-29
---

- add new functionality to subscribe to a ship type
- bot will restart itself after a disconnect or error (thanks for https://github.com/ocn for the code idea)
- __attention: new commands will roll out within 24 hours__

2022-09-25
---

- make system/region/constellation unsubscribeable
- add new functionality to subscribe to a ship group
- __attention: new commands will roll out within 24 hours__
 
2022-06-30
---

- make alliance/corp/char killmails filterable by region/constellation/system (#5)
- improved killmail embedings by fetching the open graph data from zkillboard url (#2)
- colors for kills (green) / losses (red) on the embeds (#2)
- __attention: new commands will roll out within 24 hours__

2022-06-23
---

- fix typo in corporation
- add possibility to subscripe to region, constellation of system kills
- add command to unsubscribe whole channel
- __attention: new commands will roll out within 24 hours__

2022-06-17
---

- prevent message from sending twice to the same channel due to multiple subscriptions
- try message owner of discord on channel permission problem when sending a killmail