// Installed on every configured database by the existing startup migration.
// Triggers cover writes from routes, background jobs, cascading deletes, and
// other API processes in the same transaction as the underlying mutation.
export const chatRevisionMigration = [
  `create table if not exists chat_revisions (
    team_id text not null,
    revision_key text not null,
    revision bigint not null default 0,
    primary key (team_id, revision_key)
  )`,
  `create or replace function bump_chat_revision() returns trigger language plpgsql as $$
  declare
    previous_row jsonb;
    next_row jsonb;
    target record;
  begin
    if TG_OP <> 'INSERT' then previous_row := to_jsonb(OLD); end if;
    if TG_OP <> 'DELETE' then next_row := to_jsonb(NEW); end if;
    if TG_OP = 'UPDATE' and previous_row = next_row then return null; end if;
    for target in
      select distinct coalesce(payload->>'team_id', 'default') as team_id, keys.revision_key
      from (values (previous_row), (next_row)) changed(payload)
      cross join lateral (
        select case when TG_TABLE_NAME = 'chat_message_reads' then 'reads' else 'content' end as revision_key
        union all
        select 'reader:' || (payload->>'reader_id') where TG_TABLE_NAME = 'chat_message_reads'
      ) keys
      where payload is not null and keys.revision_key is not null
      order by team_id, revision_key
    loop
      insert into chat_revisions (team_id, revision_key, revision)
        values (target.team_id, target.revision_key, 1)
      on conflict (team_id, revision_key) do update
        set revision = chat_revisions.revision + 1;
    end loop;
    return null;
  end $$`,
  ...[
    "interview_chat_messages", "chat_message_reactions", "chat_message_reads",
    "chat_polls", "chat_poll_votes", "chat_channels", "chat_channel_members",
  ].map(table => `create or replace trigger ${table}_revision
    after insert or update or delete on ${table}
    for each row execute function bump_chat_revision()`),
];
