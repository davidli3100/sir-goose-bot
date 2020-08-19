const settings = require('../settings');

module.exports = {
    name: 'prefix',
    description: 'Set the server\'s bot prefix',
    args: true,
    guildOnly: true,
    permissions: ['MANAGE_GUILD'],
    execute(message, args) {
        const prefix = args[0];

        if (prefix.length > 6) {
            return message.channel.send('The prefix must be shorter than 7 characters.')
        }

        let serverSetting = { ...settings.get(message.guild.id) };
        serverSetting.prefix = args[0];
        settings.set(message.guild.id, serverSetting);
        message.channel.send(`The bot\'s prefix has been updated to ${args[0]}`);
    }
}