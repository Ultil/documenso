import type { SVGAttributes } from 'react';

export type LogoProps = SVGAttributes<SVGSVGElement>;

export const Logo = ({ ...props }: LogoProps) => {
  return (
    <div className="flex items-center gap-2">
      <img alt="logo" src="/android-chrome-192x192.png" className="h-8 w-8" />
      <h1 className="text-2xl font-bold">Mabel Documenso</h1>
    </div>
  );
};
