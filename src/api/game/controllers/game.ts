/**
 * game controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController(
  "api::game.game",
  ({ strapi }) => ({
    async populate(ctx) {
      console.log("Starting to populate...");
      const options = {
        limit: 48,
        order: "desc:trending",
        ...ctx.query
      }

      await strapi.service("api::game.game").populateService(options);
      ctx.send("Finished populating!");
    },
  })
);
