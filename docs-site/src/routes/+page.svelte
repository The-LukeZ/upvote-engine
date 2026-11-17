<script lang="ts">
  import { DocsShell, Hero, FeatureGrid, Feature, CTA, Action } from "svelte-docsmith";
  import { docs } from "svelte-docsmith/content";
</script>

<DocsShell content={docs} search={() => import("svelte-docsmith/search").then((m) => m.docs)} layout="page">
  <Hero title="Upvote Engine">
    {#snippet description()}
      A Discord vote-role bot for Top.gg and Discord Bot List. Assigns a role when someone votes, removes it
      when the vote expires.
    {/snippet}
    {#snippet actions()}
      <Action href="/docs/getting-started/">Read the docs</Action>
      <Action href="/invite" variant="secondary">Add the bot to your server</Action>
      <Action href="https://github.com/The-LukeZ/upvote-engine" variant="secondary" external>GitHub</Action>
    {/snippet}
  </Hero>

  <FeatureGrid title="How it works" columns={3}>
    <Feature title="Webhook in">Top.gg and DBL vote webhooks land on a per-guild config.</Feature>
    <Feature title="Role applied">The configured role is assigned to the voter automatically.</Feature>
    <Feature title="Role expires">The role is removed once the vote's duration runs out.</Feature>
  </FeatureGrid>

  <CTA title="Set it up in Discord">
    {#snippet children()}
      Run <code>/app create</code> in your server to configure a webhook.
    {/snippet}
    {#snippet actions()}
      <Action href="/docs/getting-started/">Get started</Action>
      <Action href="https://top.gg/bot/1435613778547834910" variant="secondary" external
        >Vote for the bot</Action
      >
      <Action href="/info" variant="secondary">Bot info and stats</Action>
      <Action href="/bug" variant="secondary">Report an issue</Action>
      <Action href="/help" variant="secondary">Get support</Action>
    {/snippet}
  </CTA>
</DocsShell>
