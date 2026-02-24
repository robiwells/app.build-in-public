export type FeedItem = {
  user?: { username?: string; avatar_url?: string | null } | null;
  project?: { title?: string; id?: string; slug?: string | null } | null;
  repo?: { repo_full_name?: string; repo_url?: string } | null;
  activity: {
    id?: string;
    date_utc?: string;
    type?: string;
    content_text?: string | null;
    content_image_url?: string | null;
    commit_count?: number;
    first_commit_at?: string | null;
    last_commit_at?: string | null;
    github_link?: string | null;
    commit_messages?: string[] | null;
    hearts_count?: number;
    comments_count?: number;
    hearted?: boolean;
  };
};

export type StreakMetadata = {
  currentStreak?: number;
  longestStreak?: number;
  lastActiveDayLocal?: string;
};
