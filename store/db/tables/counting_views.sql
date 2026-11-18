-- Read-only contributor views scan only accepted entries in the selected history/run.
CREATE INDEX IF NOT EXISTS counting_accepted_contributors
    ON counting_event(game_id, history_id, run_id, author_id) WHERE kind='accepted';
