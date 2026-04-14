import { factories } from "@strapi/strapi";

export default factories.createCoreRouter("api::question.question", {
  config: {
    find: {
      policies: ["api::question.check-pack-access"],
    },
  },
});
