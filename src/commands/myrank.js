const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('myrank')
        .setDescription('Check your current rank in the club'),

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

            if (!member) {
                return interaction.editReply('❌ Unable to find your ranking information.');
            }

            const rankEmoji = rank === 1 ? '👑' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '📊';
            
            const response = `${rankEmoji} **Hey ${interaction.user.username}!**\n\n` +
                           `🏅 **Your Rank:** ${rank}/${totalMembers}\n` +
                           `⭐ **Your Points:** ${member.points}\n\n` +
                           `Keep up the great work! 🚀`;

            await interaction.editReply(response);

        } catch (error) {
            console.error('Error in /myrank:', error);
            await interaction.editReply('❌ An error occurred while checking your rank.');
        }
    }
};