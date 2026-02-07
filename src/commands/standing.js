const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('standing')
        .setDescription('View the club ranking standings'),

    async execute(interaction) {
        try {
            await interaction.deferReply();
            
            const standings = await db.getStandings();
            
            if (standings.length === 0) {
                return interaction.editReply('📊 No members have points yet!');
            }

            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('🏆 Club Rankings')
                .setDescription('Here are the current standings:')
                .setTimestamp()
                .setFooter({ text: 'CivicBot - Scientific Club Rankings' });

            let description = '';
            standings.slice(0, 10).forEach((member, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                description += `${medal} **${member.username}** – ${member.points} points\n`;
            });

            if (standings.length > 10) {
                description += `\n... and ${standings.length - 10} more members`;
            }

            embed.setDescription(description);
            
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in /standing:', error);
            await interaction.editReply('❌ An error occurred while fetching standings.');
        }
    }
};