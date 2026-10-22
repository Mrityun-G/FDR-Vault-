/**
 * AICTE Official Emblem & Insignia Component
 */

import React from 'react';

interface Props {
  className?: string;
  size?: number;
}

export const AicteLogo: React.FC<Props> = ({ className = 'w-12 h-12', size = 48 }) => {
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-xs"
      >
        {/* Outer Circular Ring with subtle gold border */}
        <circle cx="50" cy="50" r="46" fill="#0A2540" stroke="#FF9933" strokeWidth="2.5" />
        <circle cx="50" cy="50" r="41" fill="none" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2 2" />

        {/* Central Sunburst / Technical Gear Wheel Motif */}
        <g transform="translate(50, 50)">
          {Array.from({ length: 16 }).map((_, i) => (
            <line
              key={i}
              x1="0"
              y1="-24"
              x2="0"
              y2="-34"
              stroke="#FFD700"
              strokeWidth="2.2"
              strokeLinecap="round"
              transform={`rotate(${i * 22.5})`}
            />
          ))}
          <circle cx="0" cy="0" r="22" fill="#1E3A8A" stroke="#FFD700" strokeWidth="2" />
          
          {/* Flame of Knowledge & Ashoka Spoke Center */}
          <path
            d="M 0 -12 C 4 -6, 8 2, 0 12 C -8 2, -4 -6, 0 -12 Z"
            fill="#FF9933"
          />
          <circle cx="0" cy="0" r="5" fill="#FFFFFF" />
          <circle cx="0" cy="0" r="2.5" fill="#0A2540" />
        </g>

        {/* Council Text Ring Label: AICTE */}
        <text
          x="50"
          y="83"
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="11"
          fontWeight="bold"
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="1.5"
        >
          AICTE
        </text>
      </svg>
    </div>
  );
};
