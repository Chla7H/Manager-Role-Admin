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
        .setDescription('Allow a manager role to give up to 5 specific roles.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addRoleOption(opt => opt.setName('manager_role').setDescription('The role that will be ALLOWED to give the roles').setRequired(true))
        .addRoleOption(opt => opt.setName('role_1').setDescription('Role 1 they can give').setRequired(true))
        .addRoleOption(opt => opt.setName('role_2').setDescription('Role 2 they can give').setRequired(false))
        .addRoleOption(opt => opt.setName('role_3').setDescription('Role 3 they can give').setRequired(false))
        .addRoleOption(opt => opt.setName('role_4').setDescription('Role 4 they can give').setRequired(false))
        .addRoleOption(opt => opt.setName('role_5').setDescription('Role 5 they can give').setRequired(false)),
        
    new SlashCommandBuilder()
        .setName('removepermission')
        .setDescription('Remove permission from a manager role to give up to 5 roles.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addRoleOption(opt => opt.setName('manager_role').setDescription('The role losing the permission').setRequired(true))
        .addRoleOption(opt => opt.setName('role_1').setDescription('Role 1 to remove').setRequired(true))
        .addRoleOption(opt => opt.setName('role_2').setDescription('Role 2 to remove').setRequired(false))
        .addRoleOption(opt => opt.setName('role_3').setDescription('Role 3 to remove').setRequired(false))
        .addRoleOption(opt => opt.setName('role_4').setDescription('Role 4 to remove').setRequired(false))
        .addRoleOption(opt => opt.setName('role_5').setDescription('Role 5 to remove').setRequired(false)),

    new SlashCommandBuilder()
        .setName('giverole')
        .setDescription('Give up to 5 roles to a user at once.')
        .addUserOption(opt => opt.setName('user').setDescription('The user to receive the roles').setRequired(true))
        .addRoleOption(opt => opt.setName('role_1').setDescription('Role 1 to give').setRequired(true))
        .addRoleOption(opt => opt.setName('role_2').setDescription('Role 2 to give').setRequired(false))
        .addRoleOption(opt => opt.setName('role_3').setDescription('Role 3 to give').setRequired(false))
        .addRoleOption(opt => opt.setName('role_4').setDescription('Role 4 to give').setRequired(false))
        .addRoleOption(opt => opt.setName('role_5').setDescription('Role 5 to give').setRequired(false)),

    new SlashCommandBuilder()
        .setName('setuplogs')
        .setDescription('Create a log category and log channels for the system.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(command => command.toJSON());

// ================= READY EVENT =================
client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    
    // Status Streaming
    client.user.setActivity('discord.gg/3zJKB6PyVx', { 
        type: ActivityType.Streaming, 
        url: 'https://www.twitch.tv/discord' 
    });

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
            const category = await guild.channels.create({ name: '📋 BOT LOGS', type: ChannelType.GuildCategory });
            const roleLogs = await guild.channels.create({ name: 'role-gives-logs', type: ChannelType.GuildText, parent: category.id });
            const permLogs = await guild.channels.create({ name: 'permission-updates', type: ChannelType.GuildText, parent: category.id });

            db.logChannels = { roles: roleLogs.id, permissions: permLogs.id };
            saveDatabase(db);
            await interaction.editReply(`✅ Logs setup complete!`);
        } catch (error) {
            await interaction.editReply(`❌ Failed to create channels. Make sure the bot has Administrator permissions.`);
        }
    }

    // 2. GIVE PERMISSION ROLE COMMAND
    else if (commandName === 'givepermissionrole') {
        const managerRole = options.getRole('manager_role');
        const rolesToAssign = [
            options.getRole('role_1'), options.getRole('role_2'), 
            options.getRole('role_3'), options.getRole('role_4'), 
            options.getRole('role_5')
        ].filter(r => r !== null);

        if (!db.permissions[managerRole.id]) db.permissions[managerRole.id] = [];
        
        let addedRoles = [];
        for (const role of rolesToAssign) {
            if (!db.permissions[managerRole.id].includes(role.id)) {
                db.permissions[managerRole.id].push(role.id);
                addedRoles.push(role);
            }
        }
        
        saveDatabase(db);

        if (addedRoles.length === 0) {
            return interaction.reply({ content: `⚠️ ${managerRole} already has permission for the specified role(s).`, ephemeral: true });
        }

        const addedRolesText = addedRoles.map(r => `<@&${r.id}>`).join(', ');
        interaction.reply({ content: `✅ Permissions granted! ${managerRole} can now give: ${addedRolesText}`, ephemeral: true });

        const embed = new EmbedBuilder()
            .setTitle('🟢 Permissions Added')
            .setColor('Green')
            .addFields(
                { name: 'Admin', value: `${interaction.user}`, inline: true },
                { name: 'Manager Role', value: `${managerRole}`, inline: true },
                { name: 'Assignable Roles', value: addedRolesText, inline: false }
            )
            .setTimestamp();
        sendLog(guild, 'permissions', embed);
    }

    // 3. REMOVE PERMISSION COMMAND
    else if (commandName === 'removepermission') {
        const managerRole = options.getRole('manager_role');
        const rolesToRemove = [
            options.getRole('role_1'), options.getRole('role_2'), 
            options.getRole('role_3'), options.getRole('role_4'), 
            options.getRole('role_5')
        ].filter(r => r !== null);

        if (!db.permissions[managerRole.id]) {
            return interaction.reply({ content: `⚠️ ${managerRole} has no permissions setup.`, ephemeral: true });
        }

        let removedRoles = [];
        for (const role of rolesToRemove) {
            if (db.permissions[managerRole.id].includes(role.id)) {
                db.permissions[managerRole.id] = db.permissions[managerRole.id].filter(id => id !== role.id);
                removedRoles.push(role);
            }
        }
        
        saveDatabase(db);

        if (removedRoles.length === 0) {
            return interaction.reply({ content: `⚠️ ${managerRole} didn't have permission for the specified role(s) anyway.`, ephemeral: true });
        }

        const removedRolesText = removedRoles.map(r => `<@&${r.id}>`).join(', ');
        interaction.reply({ content: `✅ Permissions removed! ${managerRole} can no longer give: ${removedRolesText}`, ephemeral: true });

        const embed = new EmbedBuilder()
            .setTitle('🔴 Permissions Removed')
            .setColor('Red')
            .addFields(
                { name: 'Admin', value: `${interaction.user}`, inline: true },
                { name: 'Manager Role', value: `${managerRole}`, inline: true },
                { name: 'Removed Roles', value: removedRolesText, inline: false }
            )
            .setTimestamp();
        sendLog(guild, 'permissions', embed);
    }

    // 4. GIVE ROLE COMMAND
    else if (commandName === 'giverole') {
        await interaction.deferReply(); 

        const targetUser = options.getUser('user');
        const targetMember = await guild.members.fetch(targetUser.id);
        const rolesToProcess = [
            options.getRole('role_1'), options.getRole('role_2'), 
            options.getRole('role_3'), options.getRole('role_4'), 
            options.getRole('role_5')
        ].filter(r => r !== null);

        const userRoles = member.roles.cache.map(r => r.id);
        const botHighestRole = guild.members.me.roles.highest;

        let successRoles = [];
        let errorMessages = [];

        for (const role of rolesToProcess) {
            const hasPermission = userRoles.some(roleId => db.permissions[roleId] && db.permissions[roleId].includes(role.id));
            if (!hasPermission) {
                errorMessages.push(`❌ ${role}: You don't have permission.`);
                continue;
            }

            if (botHighestRole.position <= role.position) {
                errorMessages.push(`❌ ${role}: My role is too low to give this.`);
                continue;
            }

            if (targetMember.roles.cache.has(role.id)) {
                errorMessages.push(`⚠️ ${role}: User already has it.`);
                continue;
            }

            try {
                await targetMember.roles.add(role);
                successRoles.push(role);
            } catch (error) {
                errorMessages.push(`❌ ${role}: Discord API error.`);
            }
        }

        let replyMsg = `**Action Complete for ${targetUser}:**\n`;
        if (successRoles.length > 0) {
            replyMsg += `✅ **Successfully Added:** ${successRoles.map(r => `<@&${r.id}>`).join(', ')}\n`;
            
            const embed = new EmbedBuilder()
                .setTitle('🔰 Roles Granted')
                .setColor('Blue')
                .addFields(
                    { name: 'Given By', value: `${interaction.user}`, inline: true },
                    { name: 'Given To', value: `${targetUser}`, inline: true },
                    { name: 'Roles', value: successRoles.map(r => `<@&${r.id}>`).join(', '), inline: false }
                )
                .setTimestamp();
            sendLog(guild, 'roles', embed);
        }
        
        if (errorMessages.length > 0) {
            replyMsg += `\n**Errors/Warnings:**\n${errorMessages.join('\n')}`;
        }

        await interaction.editReply({ content: replyMsg });
    }
});

// ================= ERROR HANDLING (BASH MAYCRASHICH L'BOT) =================
client.on('error', (error) => {
    console.error('❌ Discord Client Error:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('⚠️ Unhandled Promise Rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('🚨 Uncaught Exception:', error);
});

// ================= LOGIN =================
client.login(TOKEN);
