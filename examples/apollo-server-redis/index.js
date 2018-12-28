const { ApolloServer, gql } = require('apollo-server');
const { createRateLimitDirective, rateLimitTypeDefs } = require('../../dist/index');

const typeDefs = gql`
  # Apply default rate limiting to all fields of 'Query'
  type Query @rateLimit {
    books: [Book!]

    # Override behaviour imposed from 'Query' type on this field to have a custom limit
    quote: String @rateLimit(max: 15)
  }

  type Book {
    # For each 'Book' where this field is requested, rate limit
    title: String @rateLimit(period: DAY)

    author: String
  }
`;

const resolvers = {
  Query: {
    books: () => [
      {
        title: 'A Game of Thrones',
        author: 'George R. R. Martin',
      },
      {
        title: 'The Hobbit',
        author: '	J. R. R. Tolkien',
      },
    ],
    quote: () => 'The future is something which everyone reaches at the rate of sixty minutes an hour, whatever he does, whoever he is. ― C.S. Lewis',
  },
};

// Define custom key generator to log where rate limiting logic would be applied
const logKeyGenerator = (source, args, context, info, directiveArgs) => {
  console.log(`${info.fieldName}: ${directiveArgs.max}/${directiveArgs.period}`);
  return info.fieldName;
}

const server = new ApolloServer({
  typeDefs: [rateLimitTypeDefs, typeDefs],
  resolvers,
  schemaDirectives: {
    rateLimit: createRateLimitDirective({
      keyGenerator: logKeyGenerator,
    }),
  },
});
server.listen()
  .then(({ url }) => {
    console.log(`🚀  Server ready at ${url}`);
  })
  .catch(error => {
    console.error(error);
  });
