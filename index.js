const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    ActivityType, 
    PermissionFlagsBits, 
    ChannelType,
    EmbedBuilder
} = require('discord.js');
const fs = require('fs');

// ================= CONFIGURATION =================
const TOKEN = 'YOUR_BOT_TOKEN_HERE';
const CLIENT_ID = 'YOUR_CLIENT_ID_HERE';
const DATABASE_FILE = './database.json';

// ================= DATABASE HANDLER =================
function loadDatabase() {
    if (!fs.existsSync(DATABASE_FILE)) fs.writeFileSync(DATABASE_FILE, JSON.stringify({ permissions: {}, logChannels: {} }));
    return JSON.parse(fs.readFileSync(DATABASE_FILE, 'utf-8'));
}

function saveDatabase(data) {
    fs.writeFileSync(DATABASE_FILE, JSON.stringify(data, null, 4));
}

// ================= BOT SETUP =================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

// ================= SLASH COMMANDS DEFINITION =================
const commands = [
    new SlashCommandBuilder()
        .setName('givepermissionrole')
        .setDescription('Allow a specific role to give another specific role.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addRoleOption(option => option.setName('manager_role').setDescription('The role that will be ALLOWED to give the role').setRequired(true))
        .addRoleOption(option => option.setName('assignable_role').setDescription('The role they are allowed to GIVE').setRequired(true)),
        
    new SlashCommandBuilder()
        .setName('removepermission')
        .setDescription('Remove a role-giving permission from a manager role.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addRoleOption(option => option.setName('manager_role').setDescription('The role losing the permission').setRequired(true))
        .addRoleOption(option => option.setName('assignable_role').setDescription('The role they can no longer give').setRequired(true)),

    new SlashCommandBuilder()
        .setName('giverole')
        .setDescription('Give a role to a user (if you have permission).')
        .addUserOption(option => option.setName('user').setDescription('The user to receive the role').setRequired(true))
        .addRoleOption(option => option.setName('role').setDescription('The role to give').setRequired(true)),

    new SlashCommandBuilder()
        .setName('setuplogs')
        .setDescription('Create a log category and log channels for the system.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(command => command.toJSON());

// ================= READY EVENT =================
client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    
    // Set Streaming Status
    client.user.setActivity('discord.gg/3zJKB6PyVx', { 
        type: ActivityType.Streaming, 
        url: 'https://www.twitch.tv/discord' 
    });

    // Register Slash Commands
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
});

// ================= HELPER: LOGGING =================
async function sendLog(guild, logType, embed) {
    const db = loadDatabase();
    const logChannelId = db.logChannels[logType];
    if (!logChannelId) return;

    try {
        const channel = await guild.channels.fetch(logChannelId);
        if (channel) await channel.send({ embeds: [embed] });
    } catch (e) {
        console.log(`Could not send log to channel for ${logType}.`);
    }
}

// ================= COMMAND HANDLING =================
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, guild, member } = interaction;
    let db = loadDatabase();

    // 1. SETUP LOGS COMMAND
    if (commandName === 'setuplogs') {
        await interaction.deferReply({ ephemeral: true });

        try {
            // Create Category
            const category = await guild.channels.create({
                name: '📋 BOT LOGS',
                type: ChannelType.GuildCategory
            });

            // Create Role Give Logs
            const roleLogs = await guild.channels.create({
                name: 'role-gives-logs',
                type: ChannelType.GuildText,
                parent: category.id
            });

            // Create Permission Updates Logs
            const permLogs = await guild.channels.create({
                name: 'permission-updates',
                type: ChannelType.GuildText,
                parent: category.id
            });

            db.logChannels = {
                roles: roleLogs.id,
                permissions: permLogs.id
            };
            saveDatabase(db);

            await interaction.editReply(`✅ Logs setup complete! Category and channels created.`);
        } catch (error) {
            console.error(error);
            await interaction.editReply(`❌ Failed to create channels. Make sure the bot has Administrator permissions.`);
        }
    }

    // 2. GIVE PERMISSION ROLE COMMAND
    else if (commandName === 'givepermissionrole') {
        const managerRole = options.getRole('manager_role');
        const assignableRole = options.getRole('assignable_role');

        if (!db.permissions[managerRole.id]) db.permissions[managerRole.id] = [];
        
        if (db.permissions[managerRole.id].includes(assignableRole.id)) {
            return interaction.reply({ content: `⚠️ ${managerRole} already has permission to give ${assignableRole}.`, ephemeral: true });
        }

        db.permissions[managerRole.id].push(assignableRole.id);
        saveDatabase(db);

        interaction.reply({ content: `✅ Permission granted! Users with ${managerRole} can now give ${assignableRole}.`, ephemeral: true });

        // Logging
        const embed = new EmbedBuilder()
            .setTitle('🟢 Permission Added')
            .setColor('Green')
            .addFields(
                { name: 'Admin', value: `${interaction.user}`, inline: true },
                { name: 'Manager Role', value: `${managerRole}`, inline: true },
                { name: 'Assignable Role', value: `${assignableRole}`, inline: true }
            )
            .setTimestamp();
        sendLog(guild, 'permissions', embed);
    }

    // 3. REMOVE PERMISSION COMMAND
    else if (commandName === 'removepermission') {
        const managerRole = options.getRole('manager_role');
        const assignableRole = options.getRole('assignable_role');

        if (!db.permissions[managerRole.id] || !db.permissions[managerRole.id].includes(assignableRole.id)) {
            return interaction.reply({ content: `⚠️ ${managerRole} does not currently have permission to give ${assignableRole}.`, ephemeral: true });
        }

        db.permissions[managerRole.id] = db.permissions[managerRole.id].filter(id => id !== assignableRole.id);
        saveDatabase(db);

        interaction.reply({ content: `✅ Permission removed! Users with ${managerRole} can no longer give ${assignableRole}.`, ephemeral: true });

        // Logging
        const embed = new EmbedBuilder()
            .setTitle('🔴 Permission Removed')
            .setColor('Red')
            .addFields(
                { name: 'Admin', value: `${interaction.user}`, inline: true },
                { name: 'Manager Role', value: `${managerRole}`, inline: true },
                { name: 'Assignable Role', value: `${assignableRole}`, inline: true }
            )
            .setTimestamp();
        sendLog(guild, 'permissions', embed);
    }

    // 4. GIVE ROLE COMMAND
    else if (commandName === 'giverole') {
        const targetUser = options.getUser('user');
        const roleToGive = options.getRole('role');
        const targetMember = await guild.members.fetch(targetUser.id);

        // A. Check if the user trying to use the command has a manager role with permission
        const userRoles = member.roles.cache.map(r => r.id);
        let hasPermission = false;

        for (const roleId of userRoles) {
            if (db.permissions[roleId] && db.permissions[roleId].includes(roleToGive.id)) {
                hasPermission = true;
                break;
            }
        }

        if (!hasPermission) {
            return interaction.reply({ content: `❌ You do not have permission to give the ${roleToGive.name} role.`, ephemeral: true });
        }

        // B. Check Bot Role Hierarchy (Even if user is Admin, Bot MUST be higher than the role)
        const botHighestRole = guild.members.me.roles.highest;
        if (botHighestRole.position <= roleToGive.position) {
            return interaction.reply({ 
                content: `❌ I cannot give the ${roleToGive} role. My highest role must be placed ABOVE it in the server settings.`, 
                ephemeral: true 
            });
        }

        // C. Check if user already has the role
        if (targetMember.roles.cache.has(roleToGive.id)) {
            return interaction.reply({ content: `⚠️ ${targetUser} already has the ${roleToGive} role.`, ephemeral: true });
        }

        // Give the role
        try {
            await targetMember.roles.add(roleToGive);
            await interaction.reply({ content: `✅ Successfully gave ${roleToGive} to ${targetUser}.` });

            // Logging
            const embed = new EmbedBuilder()
                .setTitle('🔰 Role Granted')
                .setColor('Blue')
                .addFields(
                    { name: 'Given By', value: `${interaction.user}`, inline: true },
                    { name: 'Given To', value: `${targetUser}`, inline: true },
                    { name: 'Role', value: `${roleToGive}`, inline: true }
                )
                .setTimestamp();
            sendLog(guild, 'roles', embed);

        } catch (error) {
            console.error(error);
            interaction.reply({ content: `❌ An error occurred while trying to give the role.`, ephemeral: true });
        }
    }
});

client.login(TOKEN);
