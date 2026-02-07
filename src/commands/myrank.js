const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('myrank')
        .setDescription('Check your rank'),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });
            const userId = interaction.user.id;
            const username = interaction.user.username;
            
            await db.upsertMember(userId, username);
            const member = await db.getMember(userId);
            const rank = await db.getRankPosition(userId);
            const totalMembers = (await db.getStandings()).length;
            
            const response = `🏆 **Rank:** ${rank}/${totalMembers}\n⭐ **Points:** ${member.points}`;
            await interaction.editReply(response);

        } catch (error) {
            console.error('Error:', error);
            await interaction.editReply('❌ Error.');
        }
    }
};
