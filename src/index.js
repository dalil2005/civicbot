require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Events, EmbedBuilder } = require('discord.js');
const db = require('./utils/database');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.commands = new Collection();
const fs = require('fs');
const path = require('path');
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    client.commands.set(command.data.name, command);
}

async function setupPointsManagerRole(guild) {
    try {
        const roleName = 'Points Manager';
        let pointsRole = guild.roles.cache.find(role => role.name === roleName);
        
        if (!pointsRole) {
            pointsRole = await guild.roles.create({
                name: roleName,
                color: 0xFFD700,
                reason: 'Auto-created by CivicBot',
                permissions: []
            });
            console.log(`✅ Created role: ${roleName}`);
        }
        
        const owner = await guild.fetchOwner();
        if (!owner.roles.cache.has(pointsRole.id)) {
            await owner.roles.add(pointsRole);
            console.log(`✅ Assigned role to owner: ${owner.user.tag}`);
        }
        
        return pointsRole.id;
    } catch (error) {
        console.error('Error setting up role:', error);
        return null;
    }
}

client.once(Events.ClientReady, async () => {
    console.log(`✅ CivicBot logged in as ${client.user.tag}`);
    
    client.guilds.cache.forEach(async (guild) => {
        await setupPointsManagerRole(guild);
    });
    
    try {
        const commands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());
        await client.application.commands.set(commands);
        console.log('✅ Slash commands registered');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`Error executing ${interaction.commandName}:`, error);
        await interaction.reply({ 
            content: '❌ Error!', 
            ephemeral: true 
        });
    }
});

client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;
    
    const pointsRegex = /<@!?(\d+)>\s*([+-]\d+)/;
    const match = message.content.match(pointsRegex);
    
    if (match) {
        const targetUserId = match[1];
        const pointsChange = parseInt(match[2]);
        
        const hasPointsManagerRole = message.member.roles.cache.some(role => 
            role.name === 'Points Manager'
        );
        const isServerOwner = message.author.id === message.guild.ownerId;

        if (!hasPointsManagerRole && !isServerOwner) {
            return message.reply({
                content: `❌ Need "Points Manager" role.`,
                allowedMentions: { repliedUser: false }
            });
        }

        try {
            const targetUser = await message.guild.members.fetch(targetUserId);
            await db.upsertMember(targetUserId, targetUser.user.username);
            const updated = await db.updatePoints(targetUserId, pointsChange);
            
            if (updated > 0) {
                const action = pointsChange > 0 ? 'added' : 'removed';
                const pointsAbs = Math.abs(pointsChange);
                const embed = new EmbedBuilder()
                    .setColor(pointsChange > 0 ? 0x00FF00 : 0xFF0000)
                    .setTitle(`${pointsChange > 0 ? '✅' : '➖'} Points Updated`)
                    .setDescription(`${action} **${pointsAbs} point${pointsAbs !== 1 ? 's' : ''}**`)
                    .addFields(
                        { name: 'Member', value: `<@${targetUserId}>`, inline: true },
                        { name: 'Action', value: `${pointsChange > 0 ? '➕ Added' : '➖ Removed'}`, inline: true },
                        { name: 'Manager', value: `<@${message.author.id}>`, inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'CivicBot' });
                
                await message.reply({ embeds: [embed] });
            } else {
                await message.reply('❌ Failed.');
            }
        } catch (error) {
            console.error('Error:', error);
            await message.reply('❌ Error.');
        }
    }
});

const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot online');
});
server.listen(3000);

client.login(process.env.DISCORD_TOKEN);
