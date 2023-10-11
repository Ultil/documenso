import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { compare } from 'bcrypt';
import { AuthOptions, Session, User } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider, { GoogleProfile } from 'next-auth/providers/google';

import { prisma } from '@documenso/prisma';
import { IdentityProvider } from '@documenso/prisma/client';

import { getUserByEmail } from '../server-only/user/get-user-by-email';
import { ErrorCode } from './error-codes';

export const NEXT_AUTH_OPTIONS: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET ?? 'secret',
  session: {
    strategy: 'jwt',
  },
  providers: [
    {
      id: 'custom-server',
      name: 'Custom Authentication',
      type: 'credentials',
      credentials: {
        token: { label: 'Token', type: 'text' },
      },
      authorize: async (credentials, _req) => {
        if (!credentials) {
          throw new Error(ErrorCode.CREDENTIALS_NOT_FOUND);
        }

        const { token } = credentials;

        const api = await fetch('https://core.mabelinsights.com/users/current', {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then(async (response) => {
            if (!response.ok) {
              throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            return data as {
              id: number;
              email: string;
              firstName: string;
              lastName: string;
              role: string;
            };
          })

          .catch(() => null);

        if (!api) {
          throw new Error(ErrorCode.CREDENTIALS_NOT_FOUND);
        }

        let user = await getUserByEmail({ email: api.email }).catch(() => null);
        if (!user) {
          const userExists = await prisma.user.findFirst({
            where: {
              email: api.email.toLowerCase(),
            },
          });

          if (userExists) {
            throw new Error('User already exists');
          }

          user = await prisma.user.create({
            data: {
              name: `${api.firstName} ${api.lastName}`,
              email: api.email.toLowerCase(),
              identityProvider: IdentityProvider.DOCUMENSO,
            },
          });
        }

        return {
          id: Number(user.id),
          email: user.email,
          name: user.name,
        } satisfies User;
      },
    },
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials, _req) => {
        if (!credentials) {
          throw new Error(ErrorCode.CREDENTIALS_NOT_FOUND);
        }

        const { email, password } = credentials;

        const user = await getUserByEmail({ email }).catch(() => {
          throw new Error(ErrorCode.INCORRECT_EMAIL_PASSWORD);
        });

        if (!user.password) {
          throw new Error(ErrorCode.USER_MISSING_PASSWORD);
        }

        const isPasswordsSame = await compare(password, user.password);

        if (!isPasswordsSame) {
          throw new Error(ErrorCode.INCORRECT_EMAIL_PASSWORD);
        }

        return {
          id: Number(user.id),
          email: user.email,
          name: user.name,
        } satisfies User;
      },
    }),
    GoogleProvider<GoogleProfile>({
      clientId: process.env.NEXT_PRIVATE_GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.NEXT_PRIVATE_GOOGLE_CLIENT_SECRET ?? '',
      allowDangerousEmailAccountLinking: true,
      profile(profile) {
        return {
          id: Number(profile.sub),
          name: profile.name || `${profile.given_name} ${profile.family_name}`.trim(),
          email: profile.email,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (!token.email) {
        throw new Error('No email in token');
      }

      const retrievedUser = await prisma.user.findFirst({
        where: {
          email: token.email,
        },
      });

      if (!retrievedUser) {
        return {
          ...token,
          id: user.id,
        };
      }

      return {
        id: retrievedUser.id,
        name: retrievedUser.name,
        email: retrievedUser.email,
      };
    },

    session({ token, session }) {
      if (token && token.email) {
        return {
          ...session,
          user: {
            id: Number(token.id),
            name: token.name,
            email: token.email,
          },
        } satisfies Session;
      }

      return session;
    },
  },
};
