/** @type {import('@sveltejs/vite-plugin-svelte').SvelteConfig} */
export default {
  compilerOptions: {
    compatibility: {
      componentApi: 4,
    },
    cssHash: ({ hash, css }) => `svelte-${hash(css)}`,
  },
};
