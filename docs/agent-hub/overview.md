# Agent Hub

The **Agent Hub** is xClaw's built-in marketplace for browsing, installing, and managing AI agent skill packs.

## Features

### Browse & Search
- Grid and list view modes
- Filter by category (Programming, DevOps, Analytics, Content, Research, etc.)
- Search by name, description, or tag
- Sort by Featured, Name, or Most Tools

### Store Tabs
- **Browse** — View all available agents in the registry
- **Installed** — View only active/installed agents

### Install Agents
Install agents from multiple sources:
- **npm Package** — `npm install @xclaw/skill-analytics`
- **From URL** — Git repository URL
- **Upload File** — `.tar.gz`, `.tgz`, or `.zip` packages

### Skill Studio
Configure each installed agent with the Skill Studio:

#### Configuration Tab
- Auto-generated forms based on skill config fields
- Support for string, number, boolean, select, and secret inputs
- Save and reset functionality

#### Tools Tab
- Toggle individual tools on/off
- See tool descriptions and categories
- Granular control over agent capabilities

#### Statistics Tab
- Usage metrics and analytics
- Last used timestamps
- Danger zone for uninstalling agents

## Using Agent Hub

### Access
Navigate to **Agent Hub** from the top navigation bar. Available to all users (admin and regular).

### Installing an Agent

1. Browse or search for the agent you want
2. Click **Install** on the agent card
3. The agent's tools become available to the AI immediately

### Configuring an Agent

1. Click **Configure** on an installed agent card (or use the ⚙️ icon)
2. Adjust settings in the **Configuration** tab
3. Enable/disable specific tools in the **Tools** tab
4. Click **Save Changes**

### Uninstalling an Agent

1. Click **Configure** on the agent card
2. Scroll to **Statistics** → **Danger Zone**
3. Click **Uninstall Agent**

## Agent Card Information

Each agent card shows:
- **Name** and **version**
- **Author**
- **Category badge** and **Featured badge** (if applicable)
- **Description**
- **Tags** — Searchable keywords
- **Tool count**
- **Status** — Active or Available
