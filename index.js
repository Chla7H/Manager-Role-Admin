const { 
    Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, 
    ActivityType, PermissionFlagsBits, ChannelType, EmbedBuilder, Events
} = require('discord.js');
const fs = require('fs');

const TOKEN = 'YOUR_BOT_TOKEN_HERE';
const CLIENT_ID = 'YOUR_CLIENT_ID_HERE';
const DATABASE_FILE = './database.json';

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

// Interaction logic remains the same as previously provided...
// (Ensure you copy the interactionCreate logic from the previous message here)

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    // [Insert the rest of your interaction logic here]
});

client.login(TOKEN);
