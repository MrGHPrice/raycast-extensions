# Beeper Raycast Extension

Manage all your messaging services through Beeper directly from Raycast. Search chats, open conversations, and send messages across WhatsApp, Telegram, Signal, Instagram, Discord, Slack, and more — all from one place.

## Features

- **Open Chat** - Search and open chats from any connected messaging service
- **Search Messages** - Search your message history across all services
- **Connected Accounts** - View all your connected messaging services
- **AI Tools** - Use natural language to open chats and send messages

## Prerequisites

Before using this extension, you need:

1. **Beeper Desktop** v4.1.169 or later installed
2. **Beeper Desktop API** enabled

### How to Enable Beeper Desktop API

1. Open Beeper Desktop
2. Go to **Settings** → **Developers**
3. Toggle **Beeper Desktop API** to enable it
4. The API will start on `http://localhost:23373`

For more details, see the [Beeper Desktop API documentation](https://developers.beeper.com/desktop-api).

## Commands

### Open Chat
Search and open any chat from your connected messaging services. Filter by service (WhatsApp, Telegram, etc.) using the dropdown.

### Search Messages
Search across your entire message history from all connected services. Results show the message content, sender, and which chat it's from.

### Connected Accounts
View all your connected messaging services and their connection status.

## AI Tools

This extension includes AI tools that let you interact with Beeper using natural language:

- **"Open chat with John"** - Opens the chat with John
- **"Send a message to Sarah on Telegram: Hey, how are you?"** - Sends a message to Sarah via Telegram
- **"What messaging services do I have connected?"** - Lists your connected services
- **"Search my chats for project updates"** - Searches for chats matching "project updates"

## Supported Services

Beeper aggregates these messaging services (and more):

- WhatsApp
- Telegram
- Signal
- Instagram
- Facebook Messenger
- Discord
- Slack
- LinkedIn
- X (Twitter)
- Google Chat
- Google Messages
- Google Voice
- iMessage
- SMS
- Matrix

## Troubleshooting

### "Cannot connect to Beeper Desktop"
- Make sure Beeper Desktop is running
- Ensure the Desktop API is enabled in Settings → Developers
- Try restarting Beeper Desktop

### "Authentication failed"
- Re-enable the Desktop API in Beeper Settings → Developers
- The extension uses PKCE authentication which should work automatically

### Chats not showing
- Make sure you have chats in Beeper Desktop
- Try refreshing the list (Cmd + R)

## Development

This extension is built with:
- [Raycast API](https://developers.raycast.com)
- [Beeper Desktop API TypeScript SDK](https://developers.beeper.com/desktop-api-reference/typescript/)

## License

MIT
