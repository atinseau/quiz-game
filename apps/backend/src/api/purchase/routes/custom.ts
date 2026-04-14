export default {
  routes: [
    {
      method: "POST",
      path: "/checkout",
      handler: "api::purchase.purchase.checkout",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/webhooks/stripe",
      handler: "api::purchase.purchase.stripeWebhook",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/purchases/me",
      handler: "api::purchase.purchase.me",
      config: { auth: false },
    },
  ],
};
