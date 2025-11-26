# NiceSOFT update service requirements

The Rocket.Chat server now points every automated update check to the NiceSOFT feed (`https://rchat.ncsgp.ru`). The endpoints below must mirror the behaviour of the former Rocket.Chat release host so the server, admin web banner, and Electron auto-updater continue to work.

## `GET /updates/check`
- **Headers:** Optional `Authorization: Bearer <workspace-access-token>` if supplied by the server.
- **Query parameters** (all strings):
  - `uniqueId`, `installedAt` (ISO timestamp), `version` (server version).
  - Environment details: `osType`, `osPlatform`, `osArch`, `osRelease`, `nodeVersion`.
  - Deployment metadata: `deployMethod` (defaults to `tar`), `deployPlatform` (defaults to `selfinstall`).
- **Response body:** JSON object with:
  - `versions`: array of objects `{ version, security?, infoUrl }`. Entries without prerelease tags and greater than the current version trigger admin messages and the "New version available" web banner.
  - `alerts` (optional): array of `{ id, priority, title, text, textArguments?, modifiers, infoUrl }` to surface additional notifications.

## `GET /v2/server/supportedVersions`
- **Headers:** Optional `Authorization: Bearer <workspace-access-token>` if supplied by the server.
- **Response body:** A `SignedSupportedVersions` payload compatible with `@rocket.chat/nicesoft-cloud`, including:
  - `signed`: JWT string of the payload (must be present and valid).
  - `timestamp`: ISO string; the newest timestamp wins when multiple sources are available.
  - `versions`: array of `{ version, expiration, security, infoUrl, messages? }`. Each `expiration` date must be after 2019-04-01T00:00:00.000Z, and the overall `timestamp` should be within one hour of the build time to satisfy validation checks.
  - Optional `messages`, `exceptions`, and `i18n` dictionaries follow the same structure as the existing Rocket.Chat schema.

## `GET /latest/download` and `GET /latest/asc`
- Binary tarball and detached signature used by `apps/meteor/install.sh` for automated installs/updates.
- Maintain the same filenames and integrity guarantees (PGP signature verification must continue to succeed with the published key).
