import { Loader } from 'lucide-react';
import { redirect } from 'react-router';

import { getOptionalSession } from '@documenso/auth/server/lib/utils/get-session';

import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/_index';

export function meta() {
  return appMetaTags('Sign In');
}

export async function loader({ request }: Route.LoaderArgs) {
  const { isAuthenticated } = await getOptionalSession(request);

  if (isAuthenticated) {
    throw redirect('/');
  }

  throw redirect('https://app.mabelinsights.com');
}

export default function SignIn() {
  return (
    <div className="relative">
      <Loader className="text-documenso h-8 w-8 animate-spin" />
    </div>
  );
}
