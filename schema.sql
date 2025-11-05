-- Stores configuration for each guild
CREATE TABLE
    IF NOT EXISTS guilds (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(23) UNIQUE NOT NULL,
        vote_role_id VARCHAR(23) NOT NULL,
        role_duration_seconds INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- Stores webhook verification secrets for applications
CREATE TABLE
    webhook_secrets (
        application_id VARCHAR(23) PRIMARY KEY,
        secret TEXT NOT NULL,
        guild_id VARCHAR(23) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (guild_id) REFERENCES guilds (guild_id) ON DELETE CASCADE
    );

-- Tracks active vote roles and their expiration times
CREATE TABLE
    active_votes (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(23) NOT NULL,
        user_id VARCHAR(23) NOT NULL,
        role_id VARCHAR(23) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        FOREIGN KEY (guild_id) REFERENCES guilds (id) ON DELETE CASCADE
    );