const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('myrank')
        .setDescription('Check your current rank and points'),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });
            
            const userId = interaction.user.id;
            const username = interaction.user.username;
            
            // Ensure user exists in database
            await db.upsertMember(userId, username);
            
            const member = await db.getMember(userId);
            const rank = await db.getRankPosition(userId);
            const totalMembers = (await db.getStandings()).length;
            
            // Simple response - just show rank
            const response = `🏆 **Rank:** ${rank}/${totalMembers}\n` +
                           `⭐ **Points:** ${member.points}`;

            await interaction.editReply(response);

        } catch (error) {
            console.error('Error in /myrank:', error);
            await interaction.editReply('❌ Error checking rank.');
        }
    }
};
