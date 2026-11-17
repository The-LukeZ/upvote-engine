<script lang="ts">
  import { DocsShell } from "svelte-docsmith";
  import { docs } from "svelte-docsmith/content";

  let { children } = $props();
</script>

<DocsShell content={docs} readingTime={false}>
  {@render children()}
</DocsShell>
