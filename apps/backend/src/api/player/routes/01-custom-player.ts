export default {
  routes: [
    {
      method: 'GET',
      path: '/player/me',
      handler: 'api::player.player.me',
      config: {
        auth: false,
      },
    },
  ],
};
