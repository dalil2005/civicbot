const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('standing')
        .setDescription('View rankings'),

    async execute(interaction) {
        try {
            await interaction.deferReply();
            const standings = await db.getStandings();
            
            if (standings.length === 0) {
                return interaction.editReply('📊 No points yet!');
            }

            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('🏆 Rankings')
                .setTimestamp();

            let description = '';
            standings.slice(0, 10).forEach((member, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                description += `${medal} **${member.username}** – ${member.points} pts\n`;
            });

            if (standings.length > 10) {
                description += `\n... ${standings.length - 10} more`;
            }

            embed.setDescription(description);
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error:', error);
            await interaction.editReply('❌ Error.');
        }
    }
};
