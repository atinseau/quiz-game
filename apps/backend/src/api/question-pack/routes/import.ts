export default {
  routes: [
    {
      method: "POST",
      path: "/question-packs/import",
      handler: "api::question-pack.question-pack.importPack",
      config: {
        auth: false,
      },
    },
  ],
};
