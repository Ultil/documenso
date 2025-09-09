import { useEffect } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Loader } from 'lucide-react';
import { redirect, useNavigate } from 'react-router';

import { authClient } from '@documenso/auth/client';
import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';
import { useOptionalSession } from '@documenso/lib/client-only/providers/session';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/external';

const MABEL_URL = 'https://app.mabelinsights.com/';

export function meta() {
  return appMetaTags('Sign In');
}

export async function loader({ request }: Route.LoaderArgs) {
  const { isAuthenticated } = await getOptionalSession(request);

  if (isAuthenticated) {
    throw redirect('/');
  }

  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    throw redirect(MABEL_URL);
  }

  return {
    token,
  };
}

export default function SignIn({ loaderData }: Route.ComponentProps) {
  const { token } = loaderData;

  const navigate = useNavigate();

  const { _ } = useLingui();
  const { toast } = useToast();
  const { refreshSession } = useOptionalSession();

  const verifyToken = async () => {
    try {
      await authClient.mabel.signIn({
        token,
      });

      await refreshSession();

      await navigate('/');
    } catch (err) {
      console.error(err);

      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`We were unable to verify your email at this time.`),
      });

      window.location.href = MABEL_URL;
    }
  };

  useEffect(() => {
    void verifyToken();
  }, []);

  return (
    <div className="relative">
      <Loader className="text-documenso h-8 w-8 animate-spin" />
    </div>
  );
}
