const Discord = require('discord.js');
const fs = require('fs');
const { DateTime } = require("luxon");
const mongo = require('../mongo.js');

module.exports = {
    name: 'upcoming',
    description: 'List deadlines and events within the next week.',
    usage: '[days = 7]',
    args: false,
    guildOnly: false,
    displayHelp: true,
    async execute(message, args) {
        if (args && isNaN(parseFloat(args))) {
            message.channel.send(new Discord.MessageEmbed().setColor('#FF0000').setTitle('Error').setDescription('You did not provide a valid number of days to display.').setFooter('https://github.com/sunny-zuo/sir-goose-bot'));
            return;
        }
        const fromDate = Date.now();
        const toDate = fromDate + 1000 * 60 * 60 * 24 * ((args) ? parseFloat(args) : 7) // ms => s => hr = > day => week
        
        const events = await mongo.getDB().collection("tasks").find({ endTime: { $gte: new Date(fromDate), $lte: new Date(toDate) }}).sort({ endTime: 1 }).toArray();

        const outputEmbed = new Discord.MessageEmbed()
            .setColor('#0099ff')
            .setTitle('Upcoming Dates for SE 25')
            .setDescription(`These are all upcoming quizzes, due dates, and other important dates for the upcoming week. Please contact <@${process.env.ADMIN_ID}> if there are any issues`)
            .setFooter('https://github.com/sunny-zuo/sir-goose-bot');


        for (currentEvent of events) {
            const startDt = DateTime.fromJSDate(currentEvent.startTime, { zone: 'America/Toronto' });
            const endDt = DateTime.fromJSDate(currentEvent.endTime, { zone: 'America/Toronto' });

            let startDateFormat;
            let endDateFormat;

            if (currentEvent.ignoreTime) {
                startDateFormat = `${startDt.toLocaleString({ month: 'long', day: 'numeric', weekday: 'long' })} (${startDt.toRelative()})`;
                endDateFormat = `${endDt.toLocaleString({ month: 'long', day: 'numeric', weekday: 'long' })} (${endDt.toRelative()})`;
            } else {
                startDateFormat = `${startDt.toLocaleString({ month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short', weekday: 'long' })} (${startDt.toRelative()})`;
                endDateFormat = `${endDt.toLocaleString({ month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short', weekday: 'long' })} (${endDt.toRelative()})`;
            }

            if (startDt.equals(endDt)) {
                outputEmbed.addField(`${currentEvent.type}: ${currentEvent.name} for ${currentEvent.class} (#${currentEvent.seqId})`, endDateFormat)
            } else {
                outputEmbed.addField(`${currentEvent.type}: ${currentEvent.name} for ${currentEvent.class} (#${currentEvent.seqId})`, `Starts ${startDateFormat}\nDue ${endDateFormat}`) 
            }
            
        }

        message.channel.send(outputEmbed);
    }
}

