# ArtistDeck one-time Supabase backup

This is a manually dispatched, encrypted database export for the ArtistDeck project `ezmphpcytohigfdtfvzm`. It does not run on pushes, pull requests, schedules, or deployments.

## Required GitHub configuration

Create these repository-level values before dispatching the workflow:

- Secret `ARTISTDECK_BACKUP_DB_URL`: the Supabase **Session Pooler** PostgreSQL connection string for `ezmphpcytohigfdtfvzm`. Use the connection string from the Supabase dashboard’s **Connect** panel, not the direct `db.<project-ref>.supabase.co` host. GitHub-hosted runners need the IPv4-compatible Session Pooler.
- Variable `ARTISTDECK_BACKUP_AGE_RECIPIENT`: the `age1...` public recipient generated from the offline backup key.

The workflow validates the URL protocol, pooler hostname, `postgres.ezmphpcytohigfdtfvzm` username, database name, and port before any export. Do not place the connection string in workflow YAML, documentation, issues, or logs.

## Create and store the encryption key

On a trusted administrator machine with `age` installed:

```bash
age-keygen -o artistdeck-backup-age-key.txt
age-keygen -y artistdeck-backup-age-key.txt
```

Store `artistdeck-backup-age-key.txt` in an approved offline/password-manager location. It is the private decryption key and must never be uploaded to GitHub. Put only the `age1...` output into `ARTISTDECK_BACKUP_AGE_RECIPIENT`.

## Run and retrieve the backup

1. Confirm the Phase 1A migration checksum and production-release approval.
2. In GitHub, open **Actions → ArtistDeck one-time Supabase backup → Run workflow**.
3. Wait for the run to complete; download `artistdeck-supabase-one-time-backup` from its artifacts.
4. Copy the downloaded artifact to independent, access-controlled storage before its seven-day GitHub retention expires.

The workflow exports separate roles, schema, public data, and `supabase_migrations` history components. It creates an encrypted component manifest with UTC creation time, project reference, tool versions, plaintext component sizes/checksums, and exclusions. It then uploads only two `.age` files: an encrypted archive and an encrypted checksum for that archive.

## Verify and inspect offline

On a trusted machine, change into the directory containing the downloaded `.age` files, then run the following with the private key. The checksum is intentionally calculated against the encrypted archive by filename only, so this works after downloading it into any directory.

```bash
archive="artistdeck-supabase-<timestamp>.tar.gz.age"
age -d -i artistdeck-backup-age-key.txt -o "${archive}.sha256" "${archive}.sha256.age"
sha256sum -c "${archive}.sha256"
age -d -i artistdeck-backup-age-key.txt -o backup.tar.gz "$archive"
tar -xzf backup.tar.gz
age -d -i artistdeck-backup-age-key.txt -o manifest.json manifest.json.age
cat manifest.json
```

Each exported component inside the archive is separately encrypted. To inspect one, decrypt it with `age -d -i artistdeck-backup-age-key.txt -o schema.sql schema.sql.age`, then compare its SHA-256 checksum with `manifest.json`.

A successful export and checksum verification are not a tested restore. Restore testing requires a separately approved, isolated recovery database and must never target the production project.

## Coverage and limitations

- Includes database roles, default database schema, default database data, and migration-history data exported by the Supabase CLI.
- The default CLI schema/data dumps exclude Supabase-managed Auth and Storage schemas. This workflow therefore does not include Auth user/session data or Storage metadata.
- It never includes actual Supabase Storage objects; those must be backed up separately from their storage provider if required.
- It does not capture Supabase Auth provider configuration, redirect URLs, JWT/API settings, project secrets, Edge Function secrets, or other dashboard configuration. Record and protect those separately.
- It does not capture external Studio media, Cloud Storage objects, Vercel configuration, Meta/Google configuration, or other third-party credentials. Those services need their own recovery inventory.
- A recovery target may require extensions and platform configuration to be enabled/configured before a restore; preserve that inventory separately.
- It is not point-in-time recovery, a Supabase platform backup, or a guarantee that a restore will succeed on a future target.

## Disable after use

After the independently retained copy and its checksum have been verified, disable the workflow from GitHub Actions or remove `.github/workflows/artistdeck-supabase-backup.yml` in a separately approved change. Retain the private key and independent encrypted copy under the project’s recovery-access policy.
