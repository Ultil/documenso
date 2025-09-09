import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';

import { AppError } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { AuthenticationErrorCode } from '../lib/errors/error-codes';
import { onAuthorize } from '../lib/utils/authorizer';
import type { HonoAuthContext } from '../types/context';
import { ZMabelAuthRequestSchema } from './mabel.types';

export const mabelRoute = new Hono<HonoAuthContext>()
  /**
   * Authorize endpoint.
   */
  .post('/', sValidator('json', ZMabelAuthRequestSchema), async (c) => {
    const { token } = c.req.valid('json');

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

      .catch((err) => {
        console.log(err);
        return null;
      });

    if (!api) {
      throw new AppError(AuthenticationErrorCode.InvalidCredentials, {
        message: 'Invalid token',
      });
    }

    let user = await prisma.user.findFirst({
      where: {
        email: api.email.toLowerCase(),
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: `${api.firstName} ${api.lastName}`,
          email: api.email.toLowerCase(),
          emailVerified: new Date(),
        },
      });
    }

    await onAuthorize({ userId: user.id }, c);

    return c.text('', 201);
  });
