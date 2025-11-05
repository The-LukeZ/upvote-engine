export interface Guild {
  id: number;
  guild_id: string;
  vote_role_id: string;
  role_duration_seconds: number;
  created_at: Date;
  updated_at: Date;
}

export interface GuildInsert {
  guild_id: string;
  vote_role_id: string;
  role_duration_seconds: number;
}

export interface GuildUpdate {
  guild_id?: string;
  vote_role_id?: string;
  role_duration_seconds?: number;
  updated_at?: Date;
}

export interface WebhookSecret {
  application_id: string;
  secret: string;
  guild_id: string;
  created_at: Date;
}

export interface WebhookSecretInsert {
  application_id: string;
  secret: string;
  guild_id: string;
}

export interface WebhookSecretUpdate {
  secret?: string;
  guild_id?: string;
}

export interface ActiveVote {
  id: number;
  guild_id: string;
  user_id: string;
  role_id: string;
  expires_at: Date;
}

export interface ActiveVoteInsert {
  guild_id: string;
  user_id: string;
  role_id: string;
  expires_at: Date;
}

export interface ActiveVoteUpdate {
  guild_id?: string;
  user_id?: string;
  role_id?: string;
  expires_at?: Date;
}
