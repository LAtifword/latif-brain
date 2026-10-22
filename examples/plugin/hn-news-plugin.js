export async function init(context) {
  context.registerTool('fetch-hn-top', {
    name: 'fetch-hn-top',
    description: 'Fetch top stories from Hacker News',
    execute: async () => ({ stories: [] })
  });
}
