export default {
  admin: {
    type: "admin",
    routes: [
      {
        method: "POST",
        path: "/preview",
        handler: "import.preview",
        config: { policies: ["admin::isAuthenticatedAdmin"] },
      },
      {
        method: "POST",
        path: "/commit",
        handler: "import.commit",
        config: { policies: ["admin::isAuthenticatedAdmin"] },
      },
    ],
  },
};
