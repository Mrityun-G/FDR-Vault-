/**
 * AICTE Official Logo (public/aicte-logo.png)
 */

import React from 'react';

interface Props {
  className?: string;
  size?: number;
}

export const AicteLogo: React.FC<Props> = ({ className = 'w-12 h-12', size = 48 }) => {
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      <img
        src="/aicte-logo.png"
        alt="AICTE logo"
        width={size}
        height={size}
        className="w-full h-full object-contain"
      />
    </div>
  );
};
