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

// Auto-create Points Manager role for server owner
async function setupPointsManagerRole(guild) {
    try {
        const roleName = 'Points Manager';
        
        // Find or create role
        let pointsRole = guild.roles.cache.find(role => role.name === roleName);
        
        if (!pointsRole) {
            pointsRole = await guild.roles.create({
                name: roleName,
                color: 0xFFD700, // Gold
                reason: 'Auto-created by CivicBot',
                permissions: []
            });
            console.log(`✅ Created role: ${roleName}`);
        }
        
        // Give to server owner
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

// Bot ready event
client.once(Events.ClientReady, async () => {
    console.log(`✅ CivicBot logged in as ${client.user.tag}`);
    
    // Setup Points Manager role in all servers
    client.guilds.cache.forEach(async (guild) => {
        await setupPointsManagerRole(guild);
    });
    
    // Register slash commands
    try {
        const commands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());
        await client.application.commands.set(commands);
        console.log('✅ Slash commands registered');
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
            content: '❌ Error executing command!', 
            ephemeral: true 
        });
    }
});

// Message-based points system
client.on(Events.MessageCreate, async message => {
    // Ignore bot messages
    if (message.author.bot) return;
    
    // Check for points format: @User +1 or @User -2
    const pointsRegex = /<@!?(\d+)>\s*([+-]\d+)/;
    const match = message.content.match(pointsRegex);
    
    if (match) {
        const targetUserId = match[1];
        const pointsChange = parseInt(match[2]);
        
        // Check if user has Points Manager role
        const hasPointsManagerRole = message.member.roles.cache.some(role => 
            role.name === 'Points Manager'
        );
        
        // Allow server owner even without role
        const isServerOwner = message.author.id === message.guild.ownerId;
        
        if (!hasPointsManagerRole && !isServerOwner) {
            return message.reply({
                content: `❌ You need the "Points Manager" role to manage points.`,
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
                await message.reply('❌ Unable to update points.');
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

// Keep-alive for hosting
const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('CivicBot is online!');
});
server.listen(3000);

process.on('SIGINT', () => {
    console.log('Shutting down CivicBot...');
    db.close();
    client.destroy();
    process.exit(0);
});

// Login
client.login(process.env.DISCORD_TOKEN);
