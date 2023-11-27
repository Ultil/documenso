import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { compare } from 'bcrypt';
import { DateTime } from 'luxon';
import type { AuthOptions, Session, User } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import type { GoogleProfile } from 'next-auth/providers/google';
import GoogleProvider from 'next-auth/providers/google';

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
              emailVerified: new Date(),
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
      const merged = {
        ...token,
        ...user,
      };

      if (!merged.email) {
        const userId = Number(merged.id ?? token.sub);

        const retrieved = await prisma.user.findFirst({
          where: {
            id: userId,
          },
        });

        if (!retrieved) {
          return token;
        }

        merged.id = retrieved.id;
        merged.name = retrieved.name;
        merged.email = retrieved.email;
        merged.emailVerified = retrieved.emailVerified;
      }

      if (
        merged.id &&
        (!merged.lastSignedIn ||
          DateTime.fromISO(merged.lastSignedIn).plus({ hours: 1 }) <= DateTime.now())
      ) {
        merged.lastSignedIn = new Date().toISOString();

        await prisma.user.update({
          where: {
            id: Number(merged.id),
          },
          data: {
            lastSignedIn: merged.lastSignedIn,
          },
        });
      }

      return {
        id: merged.id,
        name: merged.name,
        email: merged.email,
        lastSignedIn: merged.lastSignedIn,
        emailVerified: merged.emailVerified,
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
            emailVerified:
              typeof token.emailVerified === 'string' ? new Date(token.emailVerified) : null,
          },
        } satisfies Session;
      }

      return session;
    },
  },
};
