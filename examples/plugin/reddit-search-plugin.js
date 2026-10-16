export async function init(context) {
  context.registerTool('search-reddit', {
    name: 'search-reddit',
    description: 'Search Reddit for discussion',
    execute: async (params) => ({ results: [] })
  });
}
