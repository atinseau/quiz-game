import importController from "./server/controllers/import";
import routes from "./server/routes";

export default {
  register() {},
  bootstrap() {},
  routes,
  controllers: {
    import: importController,
  },
};
