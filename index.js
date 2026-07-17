const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    ActivityType, 
    PermissionFlagsBits, 
    ChannelType,
    EmbedBuilder,
    Events
} = require('discord.js');
const fs = require('fs');

// ================= CONFIGURATION =================
const TOKEN = 'YOUR_BOT_TOKEN_HERE';
const CLIENT_ID = 'YOUR_CLIENT_ID_HERE';
const DATABASE_FILE = './database.json';

// ================= DATABASE HANDLER =================
function loadDatabase() {
    // 1. Create file if it doesn't exist
    if (!fs.existsSync(DATABASE_FILE)) {
        fs.writeFileSync(DATABASE_FILE, JSON.stringify({ permissions: {}, logChannels: {} }));
    }
    
    // 2. Read the file
    let db = JSON.parse(fs.readFileSync(DATABASE_FILE, 'utf-8'));
    
    // 3. FIX: If file is empty (e.g., just {}), initialize the required properties
    if (!db.permissions) db.permissions = {};
    if (!db.logChannels) db.logChannels = {};
    
    return db;
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
const givePermCmd = new SlashCommandBuilder()
    .setName('givepermissionrole')
    .setDescription('Allow up to 5 manager roles to give up to 20 specific roles.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const removePermCmd = new SlashCommandBuilder()
    .setName('removepermission')
    .setDescription('Remove permission from up to 5 manager roles for up to 20 roles.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

for (let i = 1; i <= 5; i++) {
    givePermCmd.addRoleOption(opt => opt.setName(`manager_${i}`).setDescription(`Manager Role ${i}`).setRequired(i === 1));
    removePermCmd.addRoleOption(opt => opt.setName(`manager_${i}`).setDescription(`Manager Role ${i}`).setRequired(i === 1));
}

for (let i = 1; i <= 20; i++) {
    givePermCmd.addRoleOption(opt => opt.setName(`role_${i}`).setDescription(`Role ${i} they can give`).setRequired(i === 1));
    removePermCmd.addRoleOption(opt => opt.setName(`role_${i}`).setDescription(`Role ${i} to remove`).setRequired(i === 1));
}

const giveRoleCmd = new SlashCommandBuilder()
    .setName('giverole')
    .setDescription('Give up to 24 roles to a user at once.');
giveRoleCmd.addUserOption(opt => opt.setName('user').setDescription('The user to receive the roles').setRequired(true));

for (let i = 1; i <= 24; i++) {
    giveRoleCmd.addRoleOption(opt => opt.setName(`role_${i}`).setDescription(`Role ${i} to give`).setRequired(i === 1));
}

const setupLogsCmd = new SlashCommandBuilder()
    .setName('setuplogs')
    .setDescription('Create a log category and log channels for the system.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const commands = [givePermCmd.toJSON(), removePermCmd.toJSON(), giveRoleCmd.toJSON(), setupLogsCmd.toJSON()];

// ================= READY EVENT =================
client.once(Events.ClientReady, async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    
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
        console.error('❌ Failed to reload commands:', error);
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
        console.log(`Could not send log to channel for ${logType}. The channel might have been deleted.`);
    }
}

// ================= COMMAND HANDLING =================
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, guild, member } = interaction;
    let db = loadDatabase();

    // 1. SETUP LOGS
    if (commandName === 'setuplogs') {
        await interaction.deferReply({ ephemeral: true });
        try {
            const category = await guild.channels.create({ name: '📋 BOT LOGS', type: ChannelType.GuildCategory });
            const roleLogs = await guild.channels.create({ name: 'role-gives-logs', type: ChannelType.GuildText, parent: category.id });
            const permLogs = await guild.channels.create({ name: 'permission-updates', type: ChannelType.GuildText, parent: category.id });

            db.logChannels = { roles: roleLogs.id, permissions: permLogs.id };
            saveDatabase(db);
            await interaction.editReply(`✅ Logs setup complete! Category and channels created successfully.`);
        } catch (error) {
            await interaction.editReply(`❌ Failed to create channels. Ensure the bot has Administrator permissions in the server settings.`);
        }
    }

    // 2. GIVE PERMISSION ROLE
    else if (commandName === 'givepermissionrole') {
        await interaction.deferReply({ ephemeral: true });
        
        let managers = [];
        for(let i = 1; i <= 5; i++) {
            const r = options.getRole(`manager_${i}`);
            if (r) managers.push(r);
        }

        let rolesToAssign = [];
        for(let i = 1; i <= 20; i++) {
            const r = options.getRole(`role_${i}`);
            if (r) rolesToAssign.push(r);
        }

        let changesMade = false;

        for (const mRole of managers) {
            if (!db.permissions[mRole.id]) db.permissions[mRole.id] = [];
            for (const aRole of rolesToAssign) {
                if (!db.permissions[mRole.id].includes(aRole.id)) {
                    db.permissions[mRole.id].push(aRole.id);
                    changesMade = true;
                }
            }
        }
        
        saveDatabase(db);

        const managersText = managers.map(m => `<@&${m.id}>`).join(', ');
        const rolesText = rolesToAssign.map(r => `<@&${r.id}>`).join(', ');

        if (!changesMade) {
            return interaction.editReply(`⚠️ Permissions were already set up for these roles. No changes made.`);
        }

        await interaction.editReply(`✅ **Permissions granted!**\n**Managers:** ${managersText}\n**Can now give:** ${rolesText}`);

        const embed = new EmbedBuilder()
            .setTitle('🟢 Permissions Added')
            .setColor('Green')
            .addFields(
                { name: 'Admin', value: `${interaction.user}`, inline: false },
                { name: 'Manager Roles (Max 5)', value: managersText, inline: false },
                { name: 'Assignable Roles (Max 20)', value: rolesText, inline: false }
            )
            .setTimestamp();
        sendLog(guild, 'permissions', embed);
    }

    // 3. REMOVE PERMISSION
    else if (commandName === 'removepermission') {
        await interaction.deferReply({ ephemeral: true });

        let managers = [];
        for(let i = 1; i <= 5; i++) {
            const r = options.getRole(`manager_${i}`);
            if (r) managers.push(r);
        }

        let rolesToRemove = [];
        for(let i = 1; i <= 20; i++) {
            const r = options.getRole(`role_${i}`);
            if (r) rolesToRemove.push(r);
        }

        let changesMade = false;

        for (const mRole of managers) {
            if (!db.permissions[mRole.id]) continue;
            
            for (const aRole of rolesToRemove) {
                if (db.permissions[mRole.id].includes(aRole.id)) {
                    db.permissions[mRole.id] = db.permissions[mRole.id].filter(id => id !== aRole.id);
                    changesMade = true;
                }
            }
        }
        
        saveDatabase(db);

        const managersText = managers.map(m => `<@&${m.id}>`).join(', ');
        const rolesText = rolesToRemove.map(r => `<@&${r.id}>`).join(', ');

        if (!changesMade) {
            return interaction.editReply(`⚠️ None of the selected managers had these permissions anyway. No changes made.`);
        }

        await interaction.editReply(`✅ **Permissions removed!**\n**Managers:** ${managersText}\n**Can no longer give:** ${rolesText}`);

        const embed = new EmbedBuilder()
            .setTitle('🔴 Permissions Removed')
            .setColor('Red')
            .addFields(
                { name: 'Admin', value: `${interaction.user}`, inline: false },
                { name: 'Manager Roles', value: managersText, inline: false },
                { name: 'Removed Roles', value: rolesText, inline: false }
            )
            .setTimestamp();
        sendLog(guild, 'permissions', embed);
    }

    // 4. GIVE ROLE
    else if (commandName === 'giverole') {
        await interaction.deferReply(); 

        const targetUser = options.getUser('user');
        const targetMember = await guild.members.fetch(targetUser.id);
        
        let rolesToProcess = [];
        for(let i = 1; i <= 24; i++) {
            const r = options.getRole(`role_${i}`);
            if (r) rolesToProcess.push(r);
        }

        const userRoles = member.roles.cache.map(r => r.id);
        const botHighestRole = guild.members.me.roles.highest;

        let successRoles = [];
        let errorMessages = [];

        for (const role of rolesToProcess) {
            const hasPermission = userRoles.some(roleId => db.permissions[roleId] && db.permissions[roleId].includes(role.id));
            if (!hasPermission) {
                errorMessages.push(`❌ ${role}: You don't have permission to give this role.`);
                continue;
            }

            if (botHighestRole.position <= role.position) {
                errorMessages.push(`❌ ${role}: My role is too low in the hierarchy to give this.`);
                continue;
            }

            if (targetMember.roles.cache.has(role.id)) {
                errorMessages.push(`⚠️ ${role}: User already has this role.`);
                continue;
            }

            try {
                await targetMember.roles.add(role);
                successRoles.push(role);
            } catch (error) {
                errorMessages.push(`❌ ${role}: Discord API error (I might lack permissions).`);
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
                    { name: 'Roles Added', value: successRoles.map(r => `<@&${r.id}>`).join(', '), inline: false }
                )
                .setTimestamp();
            sendLog(guild, 'roles', embed);
        }
        
        if (errorMessages.length > 0) {
            replyMsg += `\n**Errors/Warnings:**\n${errorMessages.join('\n')}`;
        }

        if (successRoles.length === 0 && errorMessages.length === 0) {
            replyMsg = `⚠️ You must select at least one role to give.`;
        }

        await interaction.editReply({ content: replyMsg });
    }
});

// ================= ERROR HANDLING =================
client.on('error', (error) => console.error('❌ Discord Client Error:', error));
process.on('unhandledRejection', (error) => console.error('⚠️ Unhandled Promise Rejection:', error));
process.on('uncaughtException', (error) => console.error('🚨 Uncaught Exception:', error));

client.login(TOKEN);
