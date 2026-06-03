import type { SVGAttributes } from 'react';

export type LogoProps = SVGAttributes<SVGSVGElement>;

export const BrandingLogo = ({ ...props }: LogoProps) => {
  return (
    <div className="flex items-center gap-2">
      <img alt="logo" src="/android-chrome-192x192.png" className="h-8 w-8" />
      <h1 className="font-bold text-2xl">Mabel Documenso</h1>
    </div>
  );
};
