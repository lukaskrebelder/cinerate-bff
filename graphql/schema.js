// KI-Log C4, C7, C15, C16, C19, C20 (mit KI Claude-Unterstützung)
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

    type Comment {
    commentId: String!
    userId: String!
    firstName: String!
    text: String!
    createdAt: String!
    updatedAt: String
  }

  type CommentPage {
    page: Int!
    totalPages: Int!
    comments: [Comment!]!
  }

  type CommentResult {
    message: String!
    commentId: String!
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
    kommentare(movieId: Int!, page: Int): CommentPage!
  } 
    type Mutation {
    filmBewerten(movieId: Int!, stars: Int!): RatingResult!
    filmVormerken(movieId: Int!): MessageResult!
    vonWatchlistEntfernen(movieId: Int!): MessageResult!
    filmKommentieren(movieId: Int!, text: String!): CommentResult!
    kommentarBearbeiten(movieId: Int!, commentId: String!, text: String!): MessageResult!
    kommentarLoeschen(movieId: Int!, commentId: String!): MessageResult!
  }
  
`);

module.exports = schema;