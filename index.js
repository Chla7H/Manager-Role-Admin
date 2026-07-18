const { 
    Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, 
    ActivityType, PermissionFlagsBits, ChannelType, EmbedBuilder, Events
} = require('discord.js');
const fs = require('fs');

require('dotenv').config();
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID || '1527805408779960370';
const DATABASE_FILE = './database.json';

if (!TOKEN) {
    console.error('Missing DISCORD_TOKEN environment variable. Set DISCORD_TOKEN and restart the bot.');
    process.exit(1);
}

function loadDatabase() {
    if (!fs.existsSync(DATABASE_FILE)) fs.writeFileSync(DATABASE_FILE, JSON.stringify({ permissions: {}, logChannels: {} }));
    let db = JSON.parse(fs.readFileSync(DATABASE_FILE, 'utf-8'));
    if (!db.permissions) db.permissions = {};
    if (!db.logChannels) db.logChannels = {};
    return db;
}

function saveDatabase(data) { fs.writeFileSync(DATABASE_FILE, JSON.stringify(data, null, 4)); }

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildPresences] });

// COMMAND BUILDER: Required options FIRST, Optional SECOND
const givePermCmd = new SlashCommandBuilder().setName('givepermissionrole').setDescription('Allow managers to give roles').setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
const removePermCmd = new SlashCommandBuilder().setName('removepermission').setDescription('Remove manager permissions').setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

// Add Requireds first, then Optionals
for(let i=1; i<=5; i++) givePermCmd.addRoleOption(o => o.setName(`manager_${i}`).setDescription('Manager').setRequired(i===1));
for(let i=1; i<=20; i++) givePermCmd.addRoleOption(o => o.setName(`role_${i}`).setDescription('Role').setRequired(i===1));

for(let i=1; i<=5; i++) removePermCmd.addRoleOption(o => o.setName(`manager_${i}`).setDescription('Manager').setRequired(i===1));
for(let i=1; i<=20; i++) removePermCmd.addRoleOption(o => o.setName(`role_${i}`).setDescription('Role').setRequired(i===1));

const giveRoleCmd = new SlashCommandBuilder().setName('giverole').setDescription('Give roles to a user').addUserOption(o => o.setName('user').setDescription('User').setRequired(true));
for(let i=1; i<=24; i++) giveRoleCmd.addRoleOption(o => o.setName(`role_${i}`).setDescription('Role').setRequired(i===1));

const commands = [givePermCmd.toJSON(), removePermCmd.toJSON(), giveRoleCmd.toJSON(), new SlashCommandBuilder().setName('setuplogs').setDescription('Setup logs').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).toJSON()];

client.once(Events.ClientReady, async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    client.user.setActivity('discord.gg/3zJKB6PyVx', { type: ActivityType.Streaming, url: 'https://www.twitch.tv/discord' });
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Successfully registered commands.');
});

// Minimal interaction handler for testing commands
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const commandName = interaction.commandName;
    try {
        if (commandName === 'giverole') {
            const user = interaction.options.getUser('user');
            if (!interaction.guild) return interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });
            const member = await interaction.guild.members.fetch(user.id);
            const rolesToAdd = [];
            for (let i = 1; i <= 24; i++) {
                const role = interaction.options.getRole(`role_${i}`);
                if (role) rolesToAdd.push(role.id);
            }
            if (rolesToAdd.length === 0) return interaction.reply({ content: 'No roles provided.', ephemeral: true });
            await member.roles.add(rolesToAdd, `Given by ${interaction.user.tag}`);
            return interaction.reply({ content: `Assigned ${rolesToAdd.length} role(s) to ${user.tag}.`, ephemeral: false });
        }

        // Fallback for other commands
        await interaction.reply({ content: 'Command not implemented in this test build.', ephemeral: true });
    } catch (err) {
        console.error('Interaction handler error:', err);
        if (!interaction.replied) {
            try { await interaction.reply({ content: 'An error occurred while processing the command.', ephemeral: true }); } catch (_) {}
        }
    }
});

client.login(TOKEN);
