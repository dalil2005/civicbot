require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Events, EmbedBuilder } = require('discord.js');
const db = require('./utils/database');

// Initialize Discord Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Command collection
client.commands = new Collection();

// Load commands
const fs = require('fs');
const path = require('path');

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    client.commands.set(command.data.name, command);
}

// Bot ready event
client.once(Events.ClientReady, async () => {
    console.log(`✅ CivicBot logged in as ${client.user.tag}`);
    
    // Register slash commands
    try {
        const commands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());
        await client.application.commands.set(commands);
        console.log('✅ Slash commands registered globally');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
});

// Slash command handler
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`Error executing ${interaction.commandName}:`, error);
        await interaction.reply({ 
            content: '❌ There was an error executing this command!', 
            ephemeral: true 
        });
    }
});

// Message-based points system
client.on(Events.MessageCreate, async message => {
    // Ignore bot messages
    if (message.author.bot) return;
    
    // Check for points addition/removal format: @User +1 or @User -2
    const pointsRegex = /<@!?(\d+)>\s*([+-]\d+)/;
    const match = message.content.match(pointsRegex);
    
    if (match) {
        const targetUserId = match[1];
        const pointsChange = parseInt(match[2]);
        
        // Check permissions
        const pointsManagerRole = process.env.POINTS_MANAGER_ROLE || 'Points Manager';
        const hasPermission = message.member.roles.cache.some(role => 
            role.name === pointsManagerRole
        );

        if (!hasPermission) {
            return message.reply({
                content: `❌ You need the "${pointsManagerRole}" role to manage points.`,
                allowedMentions: { repliedUser: false }
            });
        }

        try {
            const targetUser = await message.guild.members.fetch(targetUserId);
            
            // Ensure user exists in database
            await db.upsertMember(targetUserId, targetUser.user.username);
            
            // Update points
            const updated = await db.updatePoints(targetUserId, pointsChange);
            
            if (updated > 0) {
                const action = pointsChange > 0 ? 'added' : 'removed';
                const pointsAbs = Math.abs(pointsChange);
                const embed = new EmbedBuilder()
                    .setColor(pointsChange > 0 ? 0x00FF00 : 0xFF0000)
                    .setTitle(`${pointsChange > 0 ? '✅' : '➖'} Points Updated`)
                    .setDescription(`Successfully ${action} **${pointsAbs} point${pointsAbs !== 1 ? 's' : ''}**`)
                    .addFields(
                        { name: 'Member', value: `<@${targetUserId}>`, inline: true },
                        { name: 'Action', value: `${pointsChange > 0 ? '➕ Added' : '➖ Removed'}`, inline: true },
                        { name: 'Manager', value: `<@${message.author.id}>`, inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'CivicBot Points System' });
                
                await message.reply({ embeds: [embed] });
            } else {
                await message.reply('❌ Unable to update points. User may not exist in database.');
            }
            
        } catch (error) {
            console.error('Error updating points:', error);
            await message.reply('❌ An error occurred while updating points.');
        }
    }
});

// Error handling
client.on(Events.Error, error => {
    console.error('Discord client error:', error);
});

process.on('SIGINT', () => {
    console.log('Shutting down CivicBot...');
    db.close();
    client.destroy();
    process.exit(0);
});

// Login
client.login(process.env.DISCORD_TOKEN);