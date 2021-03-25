const express = require('express');
const app = express();
const mongo = require('../mongo.js');
const settings = require('../settings');

let client;

function init(discordClient) {
    client = discordClient;
}

app.use(express.json());

app.post('/adduser', (req, res) => {
    if (!req.body.discordId) {
        res.sendStatus(400);
        return;
    }
    mongo.getDB().collection("users").replaceOne({ discordId: req.body.discordId }, req.body, { upsert: true }).then(async (result) => {
        console.log(`Inserted Discord ID: ${req.body.discordId}`);

        const settingsMap = settings.getAll();
        for (const [guildId, guildSettings] of settingsMap) {
            if (guildSettings.verificationEnabled) {
                try {
                    const guild = await client.guilds.fetch(guildId);
                    if (!guild) { continue; }

                    const user = await guild.members.fetch(req.body.discordId);
                    if (!user) { continue; }

                    if (req.body.department === guildSettings.verificationProgram) {
                        const verifiedRole = guild.roles.cache.find(role => role.name === guildSettings.verifiedRole);
                        if (!verifiedRole) { continue; }

                        user.roles.add(verifiedRole, "Verified UW ID through bot");
                    } else if (guildSettings.autoGuest) {
                        const guestRole = guild.roles.cache.find(role => role.name === guildSettings.guestRole);
                        if (!guestRole) { continue; }

                        user.roles.add(guestRole, "Verified UW ID through bot (guest)");
                    }
                } catch (e) {
                    console.log(`Failed to add role to user in guild with id ${guildId}, likely due to permissions`);
                }
            }
        }

        res.sendStatus(200);
        
    }).catch(err => {
        console.log(`Failed to insert ${JSON.stringify(req.body)}`);
        console.log(err);
        res.sendStatus(500);
    });
});

app.listen(process.env.PORT, () => {
    console.log(`Express server running on port ${process.env.PORT}`);
});

module.exports = { init };