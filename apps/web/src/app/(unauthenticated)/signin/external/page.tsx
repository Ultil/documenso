'use client';

import { useCallback, useEffect, useState } from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { signIn } from 'next-auth/react';

import { ErrorCode, isErrorCode } from '@documenso/lib/next-auth/error-codes';
import { Button } from '@documenso/ui/primitives/button';

const LOGIN_REDIRECT_PATH = '/documents';
const ERROR_MESSAGES: Partial<Record<keyof typeof ErrorCode, string>> = {
  [ErrorCode.CREDENTIALS_NOT_FOUND]: 'The email or password provided is incorrect',
  [ErrorCode.INCORRECT_EMAIL_PASSWORD]: 'The email or password provided is incorrect',
  [ErrorCode.USER_MISSING_PASSWORD]:
    'This account appears to be using a social login method, please sign in using that method',
};

export default function SignInPage() {
  const [error, setError] = useState('');
  const params = useSearchParams();

  const login = useCallback(async () => {
    try {
      const token = params?.get('token');
      if (!token) {
        throw new Error('Token required');
      }

      const result = await signIn('mabel-server', {
        token,
        callbackUrl: LOGIN_REDIRECT_PATH,
        redirect: false,
      });

      if (result?.error && isErrorCode(result.error)) {
        setError(ERROR_MESSAGES[result.error] ?? 'Unknown');
        return;
      }

      if (!result?.url) {
        throw new Error('An unknown error occurred');
      }

      window.location.href = result.url;
    } catch (err) {
      setError(
        'We encountered an unknown error while attempting to sign you In. Please try again later.',
      );
    }
  }, []);

  useEffect(() => {
    login().catch(console.log);
  }, [login]);

  if (error.length) {
    return (
      <>
        <div className="space-y-4 text-center">
          <h1 className={`mt-4 grow-0 font-semibold text-red-400`}>{error}</h1>
          <Link href="/signin">
            <Button>Go Back</Button>
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="text-center">
        <h1
          className={`mt-4 grow-0 text-2xl font-semibold md:text-3xl ${
            error.length && 'text-red-400'
          }`}
        >
          {error.length ? error : 'signing in...'}
        </h1>
      </div>
    </>
  );
}
