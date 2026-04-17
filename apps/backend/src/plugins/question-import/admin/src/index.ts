export default {
  register(app: any) {
    app.addMenuLink({
      to: "/plugins/question-import",
      icon: () => null,
      intlLabel: {
        id: "question-import.plugin.name",
        defaultMessage: "Question Import",
      },
      Component: async () => import("./pages/Upload"),
      permissions: [],
    });
  },
  bootstrap() {},
};
