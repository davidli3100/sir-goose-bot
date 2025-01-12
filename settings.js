const mongo = require('./mongo.js');

let servers = new Map();

const defaultSettings = {
    prefix: "$",
    verificationEnabled: false,
    verificationRules: {},
    enablePins: false
}

const loadSettings = () => {
    return mongo.getDB().collection("settings").find({}).toArray(function (err, result) {
        if (err) throw err;
        result.forEach(setting => {
            servers.set(setting.serverID, setting);
        });
        console.log("Settings loaded successfully");
    });
}

const get = (serverID) => {
    // return server data if exists, else default settings
    return { ...defaultSettings, ...servers.get(serverID) } || { ...defaultSettings, serverID: serverID };
}

const set = async (serverID, settings) => {
    servers.set(serverID, { ...settings, serverID: serverID });
    return mongo.getDB().collection("settings").replaceOne({ serverID: serverID }, { ...settings, serverID: serverID }, { upsert: true });
}

const getAll = () => {
    return servers;
}

module.exports = { get, set, getAll, loadSettings };