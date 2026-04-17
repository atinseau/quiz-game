export default {
  register(app: any) {
    app.registerPlugin({
      id: "question-import",
      name: "Question Import",
    });
  },
  bootstrap() {},
};
