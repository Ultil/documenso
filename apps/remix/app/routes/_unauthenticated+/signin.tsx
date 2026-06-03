import { useEffect } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Loader } from 'lucide-react';
import { redirect } from 'react-router';

import { authClient } from '@documenso/auth/client';
import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { isValidReturnTo, normalizeReturnTo } from '@documenso/lib/utils/is-valid-return-to';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/signin';

const MABEL_URL = 'https://app.mabelinsights.com/';

export function meta() {
  return appMetaTags('Sign In');
}

export async function loader({ request }: Route.LoaderArgs) {
  const { isAuthenticated } = await getOptionalSession(request);

  let returnTo = new URL(request.url).searchParams.get('returnTo') ?? undefined;

  returnTo = isValidReturnTo(returnTo) ? normalizeReturnTo(returnTo) : undefined;

  if (isAuthenticated) {
    throw redirect(returnTo || '/');
  }

  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    throw redirect(MABEL_URL);
  }

  return { token, returnTo };
}

export default function SignIn({ loaderData }: Route.ComponentProps) {
  const { token, returnTo } = loaderData;

  const { _ } = useLingui();
  const { toast } = useToast();

  const verifyToken = async () => {
    try {
      await authClient.mabel.signIn({ token, redirectPath: returnTo });
    } catch (err) {
      console.error(err);

      toast({
        title: _(msg`Sign-in failed`),
        description: _(msg`We couldn't verify your sign-in request. Please try again.`),
      });
    }
  };

  useEffect(() => {
    void verifyToken();
  }, []);

  return (
    <div className="relative">
      <Loader className="h-8 w-8 animate-spin text-documenso" />
    </div>
  );
}
