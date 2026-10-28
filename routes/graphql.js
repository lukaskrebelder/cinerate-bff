const express = require("express");
const { createHandler } = require("graphql-http/lib/use/express");

const schema = require("../graphql/schema");
const resolvers = require("../graphql/resolvers");

const router = express.Router();

// KI-Log C4 (mit KI Claude-Unterstützung)
// GraphQL-Endpunkt: /bff/graphql
router.all(
  "/",
  createHandler({
    schema,
    rootValue: resolvers,

    // Authorization-Header für die Resolver bereitstellen.
    context: (request) => ({
      authorization: request.raw.headers.authorization,
    }),
  })
);

module.exports = router;