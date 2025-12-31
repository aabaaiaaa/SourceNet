
## Message Attachment System (Details)

### Attachment Types

**Cheque:**
```json
{
  "type": "cheque",
  "amount": 1000,
  "deposited": false
}
```

**Software License:**
```json
{
  "type": "softwareLicense",
  "softwareId": "vpn-client",
  "softwareName": "SourceNet VPN Client",
  "price": 500,
  "size": 500
}
```

**Network Credentials:**
```json
{
  "type": "networkAddress",
  "networkId": "clienta-corporate",
  "networkName": "ClientA-Corporate",
  "address": "10.50.0.0/16"
}
```

### Multiple Attachments
- Messages can have multiple attachments
- SNetMail displays all attachments with unique icons
- Each type has specific click action

## Placeholder Replacement System

### Supported Placeholders
- `{username}` - Replaced with player username
- `{managerName}` - Replaced with assigned manager name
- `{random}` - Replaced with random ID segment

### Usage in Messages
```json
{
  "from": "SourceNet Manager {managerName}",
  "subject": "Hi from your manager - {managerName}",
  "body": "Hey {username}!\n\nWelcome to the team..."
}
```

### Replacement Timing
- Placeholders replaced when message is created
- Uses current game state (username, managerName)
- Random IDs generated per message
