# hazardous-killbot
[Invite the Bot to your Server!](https://discord.com/api/oauth2/authorize?client_id=981835348030160948&permissions=274877925376&scope=bot%20applications.commands)
User: Hazardous-Killbot#1916

Posts EvE-Online Killmails von zkillboard.com to a discord channel using the zkillboard webhook endpoint and discord.js

## Commands

| key                                            | description                                                                                     |
|------------------------------------------------|-------------------------------------------------------------------------------------------------|
| /zkill-subscribe corperation [id] ([min-vaue]) | Make bot post kills of corperation with id [id] ([min-value] is optional minimal amout of isk)  |
| /zkill-subscribe alliance [id] ([min-vaue])    | Make bot post kills of alliance with id [id] ([min-value] is optional minimal amout of isk)     |
| /zkill-subscribe character [id] ([min-vaue])   | Make bot post kills of character with id [id] ([min-value] is optional minimal amout of isk)    |
| /zkill-subscribe public ([min-vaue])           | Make bot post kills the public feed ([min-value] is optional minimal amout of isk)              |
| /zkill-unsubscribe corperation [id]            | Make the bot not post any kills for corperation [id] anymore                                    |
| /zkill-unsubscribe alliance [id]               | Make the bot not post any kills for alliance [id] anymore                                       |
| /zkill-unsubscribe corperation [id]            | Make the bot not post any kills for character [id] anymore                                      |
| /zkill-unsubscribe public                      | Make the bot not post any kills of the ublic feed anymore                                       |

## Develop

### Requirements:

- docker
- docker-compose


### Startup (dev):

- run `copy the env.sample to .env and fill out params`
- run `docker-compose up`

### Startup (prod):
 
- run `copy the env.sample to .env and fill out params`
- run `docker-compose -f ./docker-compose.prod.yaml up`

### Build (prod):
 
- run `cd src && docker-compose -f ./docker-compose.prod.yaml build`

### Config:

#### Environment

| key                  | description                        |
|----------------------|------------------------------------|
| DISCORD_BOT_TOKEN    | Your discord bot token             |
| DISCORD_CLIENT_ID    | Your discord application client id |
