// graphql/schema.js
const { buildSchema } = require("graphql");

const schema = buildSchema(`
  type Movie {
    movieId: Int!
    title: String!
    posterUrl: String
  }

  type MovieSearchResult {
    page: Int!
    totalPages: Int!
    movies: [Movie!]!
  }

  type Query {
    filme(
      query: String
      genre: String
      fsk: Int
      page: Int
    ): MovieSearchResult!
  }
`);

module.exports = schema;