# Discord Advanced Role Manager Bot

A custom Discord bot built with `discord.js` v14 that allows server Administrators to delegate role-giving permissions to specific roles, bypassing standard Discord role hierarchy limitations.

## Features
- **Strict Hierarchy Checking:** The bot ensures it cannot give a role higher than its own.
- **Permission Delegation:** Admins can allow `Role A` to give `Role B` to users.
- **Log System:** Automated creation of a log category and channels.
- **Activity Status:** Displays a custom Twitch streaming status.

## Setup & Installation

1. Install [Node.js](https://nodejs.org/).
2. Clone or download this repository.
3. Open your terminal in the project folder and run:
   \`\`\`bash
   npm install
   \`\`\`
4. Open \`index.js\` and replace the configuration variables at the top:
   \`\`\`javascript
   const TOKEN = 'YOUR_BOT_TOKEN_HERE';
   const CLIENT_ID = 'YOUR_CLIENT_ID_HERE';
   \`\`\`
5. Run the bot:
   \`\`\`bash
   npm start
   \`\`\`

## Slash Commands

- \`/setuplogs\` - Creates the logging category and channels (Admin only).
- \`/givepermissionrole <manager_role> <assignable_role>\` - Grants permission to a role to give another role (Admin only).
- \`/removepermission <manager_role> <assignable_role>\` - Revokes permission from a manager role (Admin only).
- \`/giverole <user> <role>\` - Gives a role to a user (requires permission setup).

## Database
Permissions and channel IDs are automatically stored in \`database.json\`. Ensure this file has read/write permissions.
