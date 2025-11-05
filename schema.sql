CREATE TABLE
    IF NOT EXISTS Guilds (guild_id VARCHAR(23) PRIMARY KEY);

CREATE TABLE
    IF NOT EXISTS Applications (
        application_id VARCHAR(23) PRIMARY KEY,
        guild_id VARCHAR(23) UNIQUE REFERENCES Guilds (guild_id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
    );

-- This table stores top.gg webhook configurations for each application