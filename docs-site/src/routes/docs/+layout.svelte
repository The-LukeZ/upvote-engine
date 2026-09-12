<script lang="ts">
  import { DocsShell } from "svelte-docsmith";
  import { docs } from "svelte-docsmith/content";
  import { docsmithConfig } from "$lib/docsmith.config";

  let { children } = $props();
</script>

<DocsShell config={docsmithConfig} content={docs} readingTime={false}>
  {@render children()}
</DocsShell>
