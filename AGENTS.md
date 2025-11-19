# Rocket.Chat Build Dependencies and Setup

Use this guide to install the tools and system packages required to build the Rocket.Chat monorepo from source.

## System packages
Install the common build and network utilities used by the project:

- `apt-transport-https`
- `build-essential`
- `ca-certificates`
- `curl`
- `jq`
- `libssl-dev`

On Debian/Ubuntu, install them with:

```bash
sudo apt-get update
sudo apt-get install -y apt-transport-https build-essential ca-certificates curl jq libssl-dev
```

## Runtime toolchain
The repository pins the following tool versions:

- **Node.js 22.16.0**
- **Yarn 4.11.0** (installed globally for convenience)
- **Deno 1.43.5**
- **Meteor** (installed via the official shell installer)

Suggested installation steps:

1. Install **nvm** and use it to install Node.js 22.16.0, then add Yarn 4.11.0 globally:
   ```bash
   export NVM_DIR="$HOME/.nvm"
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
   . "$NVM_DIR/nvm.sh"
   nvm install 22.16.0
   npm install -g yarn@4.11.0
   ```
2. Install **Deno 1.43.5**:
   ```bash
   curl -fsSL https://deno.land/install.sh | sh
   ```
   Add the printed install path (usually `$HOME/.deno/bin`) to your `PATH`.
3. Install **Meteor**:
   ```bash
   curl https://install.meteor.com/ | sh
   ```
   Ensure the Meteor `bin` directory is on your `PATH`.

## Installing dependencies and building
With the toolchain ready:

```bash
corepack enable   # optional if Yarn 4.11.0 is already global
yarn install
yarn build
```

The `yarn build` target runs Turbo build tasks for the monorepo. Use `yarn build:services` if you only need the services subset.
