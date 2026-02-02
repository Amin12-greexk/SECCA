import React from 'react';

type LogoPlaceholderProps = {
  textClassName?: string;
};

export default function LogoPlaceholder({
  textClassName = "text-green-600",
}: LogoPlaceholderProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Leaf/Circle Icon */}
      <div className="relative w-8 h-8">
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Circle background */}
          <circle cx="16" cy="16" r="15" fill="rgb(22, 163, 74)" opacity="0.2" />
          
          {/* Leaf shape */}
          <path
            d="M16 8C16 8 10 10 10 16C10 22 16 24 16 24C16 24 22 22 22 16C22 10 16 8 16 8Z"
            fill="rgb(22, 163, 74)"
          />
          
          {/* Leaf vein */}
          <path
            d="M16 10L16 22"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      
      {/* Text Logo */}
      <span className={`text-xl font-bold ${textClassName}`}>SECCA</span>
    </div>
  );
}
