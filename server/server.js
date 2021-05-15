const fs = require('fs');
const path = require('path');
const CryptoJS = require('crypto-js');
const express = require('express');
const app = express();
const mongo = require('../mongo.js');
const settings = require('../settings');

const hashes = new Map();
let client;

function init(discordClient) {
    client = discordClient;
    buildHashMap();
}

/**
 * Read all files containing uwid hashes to build a map for easier usage.
 * Hash files should be named "se20XX.hash" and contain one hash per line
 */
async function buildHashMap() {
    const emailHashFolder = './server/data/';
    const files = fs.readdirSync(emailHashFolder);

    for (fileName of files) {
        if (fileName.endsWith('.hash')) {
            const cohort = Number(fileName.replace('.hash', '').replace('se', ''));
            const filePath = path.join(emailHashFolder, fileName);
            const fileHashes = fs.readFileSync(filePath, 'utf8').split('\n');

            for (hash of fileHashes) {
                if (hash !== "") {
                    hashes.set(hash, cohort);
                }
            }
        }
    };
}

app.use(express.json());

// A forwarding mechanism is used as we only have a single oauth endpoint.
// See https://github.com/sunny-zuo/SE-bot/blob/main/server/server.js for non-forwarding setup
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

                    await assignRole(guild, guildSettings, user, req.body).catch(e => { console.log('Failed to assign role: ', e) });
                } catch (e) {
                    console.log(`Failed to add role to user in guild with id ${guildId}, likely because the user (${req.body.discordId}) isn't in the guild`);
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

async function assignRole(guild, guildSettings, user, userInfo) {
    const verificationRules = guildSettings.verificationRules?.rules;
    const baseYear = guildSettings.verificationRules?.baseYear;

    const userHash = CryptoJS.SHA256(userInfo.uwid).toString(CryptoJS.enc.Hex);
    if (hashes.get(userHash)) {
        userInfo.o365CreatedDate = new Date(hashes.get(userHash) - 5, 5);
    }

    if (!baseYear || !verificationRules) {
        throw new Error(`Server ${guild.name}/${guild.id} has invalid verification rules set.`);
    }
    const roles = [];

    for (rule of verificationRules) {
        if (checkDepartment(userInfo, rule.department, rule.match) && checkYear(userInfo, baseYear, rule.year)) {
            for (roleName of rule.roles) {
                if (guild.roles.cache.find(role => role.name === roleName)) {
                    roles.push(guild.roles.cache.find(role => role.name === roleName));
                } else {
                    await guild.roles.fetch();
                    if (guild.roles.cache.find(role => role.name === roleName)) {
                        roles.push(guild.roles.cache.find(role => role.name === roleName));
                    }
                }
            }
            break;
        }
    }
    if (guildSettings.verificationRules?.renameFullName || guildSettings.verificationRules?.renameFirstName) {
        if (!guild.me.hasPermission('MANAGE_NICKNAMES')) {
            console.log(`Server ${guild.name}/${guild.id} has renaming enabled but has not granted the bot MANAGE_NICKNAMES permissions`);
        } else if (guildSettings.verificationRules?.renameFullName && userInfo.givenName && userInfo.surname) {
            user.setNickname(`${userInfo.givenName} ${userInfo.surname}`);
        } else if (guildSettings.verificationRules?.renameFirstName && userInfo.givenName) {
            user.setNickname(userInfo.givenName);
        }
    }

    return user.roles.add(roles, "Verified UW ID through bot");
}

function checkDepartment(userInfo, department, matchType) {
    if (matchType === "anything") {
        return true;
    }
    else if (matchType === "exact") {
        return department.toLowerCase() === userInfo.department.toLowerCase();
    }
    else if (matchType === "begins") {
        return userInfo.department.toLowerCase().startsWith(department.toLowerCase());
    }
    else if (matchType === "contains") {
        return userInfo.department.toLowerCase().includes(department.toLowerCase());
    } else {
        return false;
    }
}

function checkYear(userInfo, baseYear, checkType) {
    const userYear = (new Date(userInfo.o365CreatedDate)).getFullYear();
    if (checkType === "all") {
        return true;
    } else if (checkType === "equal") {
        return userYear === baseYear;
    } else if (checkType === "upper") {
        return userYear < baseYear;
    } else if (checkType === "lower") {
        return userYear > baseYear;
    }
}

module.exports = { init, assignRole };