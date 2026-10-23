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

The MCP server now lives in its own repo:
**[mtai0524/notaion-mcp](https://github.com/mtai0524/notaion-mcp)**.

It lets Claude read, search, create, append to, update and delete your
**Daily Notes**. No clone needed — one command registers it for every project:

```bash
claude mcp add notaion --scope user -e NOTAION_EMAIL=you@example.com -e NOTAION_PASSWORD=yourpassword -- npx -y https://codeload.github.com/mtai0524/notaion-mcp/tar.gz/refs/heads/main
```

On Windows, put `cmd /c` in front of `npx`. See that repo's README for Claude
Desktop setup, configuration and troubleshooting.
