import routes from "./server/routes";
import importController from "./server/controllers/import";

export default {
  register() {},
  bootstrap() {},
  routes,
  controllers: {
    "import": importController,
  },
};
