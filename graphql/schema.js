// KI-Log C4, C7, C15, C16, C19 (mit KI Claude-Unterstützung)
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

  type MovieDetail {
    movieId: Int!
    title: String!
    description: String
    genres: [String!]!
    fsk: Int
    posterUrl: String
    releaseYear: Int
    runtime: Int
    avgRating: Float
  }
  
    type RatingSummary {
    avgRating: Float
    ratingCount: Int!
    ownStars: Int
  }

  type RatingResult {
    message: String!
    stars: Int!
    avgRating: Float
  }

  type MessageResult {
    message: String!
  }

    type Recommendation {
    movieId: Int!
    title: String!
    description: String
    posterUrl: String
  }

  type Recommendations {
    favoriteGenre: String!
    movies: [Recommendation!]!
  }

  type Query {
    filme(
      query: String
      genre: String
      fsk: Int
      page: Int
    ): MovieSearchResult!

    film(movieId: Int!): MovieDetail!
    bewertungen(movieId: Int!): RatingSummary!
    watchlist: [Movie!]!
    vorschlaege: Recommendations!
  } 
    type Mutation {
    filmBewerten(movieId: Int!, stars: Int!): RatingResult!
    filmVormerken(movieId: Int!): MessageResult!
    vonWatchlistEntfernen(movieId: Int!): MessageResult!
  }
  
`);

module.exports = schema;