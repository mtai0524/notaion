# NOTAION

## Demo

https://notaion.onrender.com/


## Table of Contents
1. [Overview](#overview)
2. [Features](#features)
3. [Technologies Used](#technologies-used)
4. [Screenshots](#screenshots)
5. [Installation](#installation)
6. [Usage](#usage)
7. [MCP Server (Claude Code)](#mcp-server-claude-code)

---

## Overview
Fast note for dev

---

## Features
- Create personal notes
- Real-time private messaging with **SignalR** integration
- User profiles with **customizable avatars**
- Friend request management (add, accept, decline)
- Online/offline user tracking
- **Responsive** design for mobile and desktop views
- **MCP server** to read/write your Daily Notes from **Claude Code** (see below)

---

## Technologies Used


### Back-end:
- **ASP.NET Core Web API**  (ver 7.0)
- **SignalR** for real-time functionality
- **Entity Framework** for data management

### Front-end:
- **ReactJS**
- **Ant Design** for UI components
- **TailwindCSS** for styling


### Database:
- **SQL Server**

### Supporting Tools:
- **Docker**
- **Git**


### CI/CD:
- **Jenkins**
- **Azure Sandbox**
- **Github Actions**

---

## Screenshots

### Main Page
![Main Page](https://res.cloudinary.com/dl3hvap4a/image/upload/v1729658746/bdamwhq9v5vo0hnuphm2.png)

### Private Chat
![Private Chat](https://res.cloudinary.com/dl3hvap4a/image/upload/v1729658519/w3nzsdh25si35xzq9pur.png)

### Profile Page
![Profile Page](https://res.cloudinary.com/dl3hvap4a/image/upload/v1726144726/Screenshot_2024-09-12_193302_lhgtgw.png)

### List Pages
![List Pages](https://res.cloudinary.com/dl3hvap4a/image/upload/v1726144725/Screenshot_2024-09-12_193200_tzkmjc.png)

### Content View
![Content View](https://res.cloudinary.com/dl3hvap4a/image/upload/v1726144725/Screenshot_2024-09-12_193353_xi4825.png)

---

## Installation

1. Clone the repository:

    ```bash
    git clone https://github.com/mtai0524/notaion.git
    ```

2. Install dependencies:

    ```bash
    cd notaion
    npm install
    ```

3. Set up the backend environment:
   - Update the connection string in `appsettings.json` to your database
   - Run the migrations to set up the database

4. Start the project:

    ```bash
    npm run dev
    ```

---

## Usage

- To start chatting and create personal note, log in or register an account.
- Send private messages to your contacts and manage friend requests in real time.

---

## MCP Server (Claude Code)

Notaion ships an [MCP](https://modelcontextprotocol.io) server in
[`mcp-server/`](mcp-server/README.md) that lets **Claude Code** read, search,
create, append to, update, and delete your **Daily Notes** straight from the
terminal.

**Tools exposed:** `list_daily_notes`, `search_daily_notes`,
`create_daily_note`, `append_to_daily_note`, `update_daily_note`,
`delete_daily_note`.

### 1. Install

```bash
cd mcp-server
npm install
```

### 2. Add your Notaion credentials

Copy the template and fill in your login. `.env.local` is git-ignored, so your
password is never committed.

```bash
cp .env.local.example .env.local
# then edit .env.local:
#   NOTAION_EMAIL=your_email_or_username
#   NOTAION_PASSWORD=your_password
#   NOTAION_API_URL=https://notaion.runasp.net   # optional, this is the default
```

You can log in with either your email or your username — the same value goes in
`NOTAION_EMAIL`.

### 3. Register with Claude Code

Use an **absolute** path to `mcp-server/src/index.js`. The `-s user` scope makes
the server available in every project/directory:

```bash
claude mcp add -s user notaion -- node /ABSOLUTE/PATH/notaion/mcp-server/src/index.js
```

(Drop `-s user` to register it only for the current project.)

### 4. Use it

**Restart Claude Code** (MCP servers load at startup), then run `/mcp` to
confirm `notaion` shows **✔ Connected**. Now just ask in plain language:

- "list my daily notes for today"
- "search my daily notes for báo cáo"
- "add a note titled Standup with today's summary"

### Verify without Claude Code

Quickly check the connection and print today's notes:

```bash
cd mcp-server
node smoke.js            # today
node smoke.js 2026-07-24 # a specific date
```

More detail (troubleshooting, `.mcp.json` alternative) lives in
[`mcp-server/README.md`](mcp-server/README.md).
