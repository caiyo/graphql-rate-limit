import { graphql } from 'graphql';
import gql from 'graphql-tag';
import {
  makeExecutableSchema,
  IResolverValidationOptions,
} from 'graphql-tools';
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import { createRateLimitTypeDef, createRateLimitDirective } from '../index';

describe('createRateLimitTypeDef', () => {
  it('creates custom directive definition', () => {
    const directiveName = 'customRateLimit';
    const directiveTypeDef = createRateLimitTypeDef(directiveName);

    expect(directiveTypeDef.definitions[0].name.value).toBe(directiveName);
    expect(directiveTypeDef).toMatchSnapshot();
  });
});

describe('createRateLimitDirective', () => {
  const consume = jest.spyOn(RateLimiterMemory.prototype, 'consume');
  const resolvers = {
    Query: {
      books: () => [
        {
          title: 'A Game of Thrones',
          author: 'George R. R. Martin',
        },
        {
          title: 'The Hobbit',
          author: 'J. R. R. Tolkien',
        },
      ],
      quote: () =>
        'The future is something which everyone reaches at the rate of sixty minutes an hour, whatever he does, whoever he is. ― C.S. Lewis',
    },
  };
  const resolverValidationOptions: IResolverValidationOptions = {
    allowResolversNotInSchema: true,
  };
  beforeEach(() => {
    consume.mockClear();
  });

  it('limits a field', async () => {
    const typeDefs = gql`
      type Query {
        quote: String @rateLimit
      }
    `;
    const schema = makeExecutableSchema({
      typeDefs: [createRateLimitTypeDef(), typeDefs],
      resolvers,
      resolverValidationOptions,
      schemaDirectives: {
        rateLimit: createRateLimitDirective(),
      },
    });

    const response = await graphql(schema, 'query { quote }');

    expect(response).toMatchSnapshot();
    expect(consume).toHaveBeenCalledTimes(1);
    expect(consume).toHaveBeenCalledWith('Query.quote');
  });
  it('limits a repeated field', async () => {
    const typeDefs = gql`
      type Query {
        books: [Book!]
      }
      type Book {
        title: String @rateLimit
      }
    `;
    const schema = makeExecutableSchema({
      typeDefs: [createRateLimitTypeDef(), typeDefs],
      resolvers,
      resolverValidationOptions,
      schemaDirectives: {
        rateLimit: createRateLimitDirective(),
      },
    });

    const response = await graphql(schema, 'query { books { title } }');

    expect(response).toMatchSnapshot();
    expect(consume).toHaveBeenCalledTimes(2);
    expect(consume).toHaveBeenCalledWith('Book.title');
  });
  it('limits an object', async () => {
    const typeDefs = gql`
      type Query @rateLimit {
        books: [Book!]
        quote: String
      }
      type Book {
        title: String
      }
    `;
    const schema = makeExecutableSchema({
      typeDefs: [createRateLimitTypeDef(), typeDefs],
      resolvers,
      resolverValidationOptions,
      schemaDirectives: {
        rateLimit: createRateLimitDirective(),
      },
    });

    const response = await graphql(schema, 'query { quote books { title } }');

    expect(response).toMatchSnapshot();
    expect(consume).toHaveBeenCalledTimes(2);
    expect(consume).toHaveBeenCalledWith('Query.quote');
    expect(consume).toHaveBeenCalledWith('Query.books');
  });
  it('raises limiter error', async () => {
    consume.mockImplementation(() => {
      throw new Error('Some error happened');
    });
    const typeDefs = gql`
      type Query {
        quote: String @rateLimit
      }
    `;
    const schema = makeExecutableSchema({
      typeDefs: [createRateLimitTypeDef(), typeDefs],
      resolvers,
      resolverValidationOptions,
      schemaDirectives: {
        rateLimit: createRateLimitDirective(),
      },
    });

    const response = await graphql(schema, 'query { quote }');

    expect(response).toMatchSnapshot();
    expect(consume).toHaveBeenCalledTimes(1);
    expect(consume).toHaveBeenCalledWith('Query.quote');
  });
  it('throttles on limit reached', async () => {
    consume
      .mockResolvedValueOnce({
        msBeforeNext: 250,
        remainingPoints: 0,
        consumedPoints: 1,
        isFirstInDuration: true,
      })
      .mockRejectedValue({
        msBeforeNext: 250,
        remainingPoints: 0,
        consumedPoints: 0,
        isFirstInDuration: false,
      });
    const typeDefs = gql`
      type Query {
        quote: String @rateLimit(limit: 1)
      }
    `;
    const schema = makeExecutableSchema({
      typeDefs: [createRateLimitTypeDef(), typeDefs],
      resolvers,
      resolverValidationOptions,
      schemaDirectives: {
        rateLimit: createRateLimitDirective(),
      },
    });

    const response = await graphql(
      schema,
      'query { firstQuote: quote secondQuote: quote }',
    );

    expect(response).toMatchSnapshot();
    expect(consume).toHaveBeenCalledTimes(2);
    expect(consume).toHaveBeenCalledWith('Query.quote');
  });
});
