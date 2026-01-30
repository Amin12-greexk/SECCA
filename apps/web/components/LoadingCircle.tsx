import React from 'react';

interface LoadingCircleProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export default function LoadingCircle({ size = 'md', className = '' }: LoadingCircleProps) {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-8 h-8',
        lg: 'w-12 h-12',
    };

    return (
        <div className={`${sizeClasses[size]} ${className}`}>
            <svg
                className="animate-spin-slow"
                viewBox="0 0 50 50"
                xmlns="http://www.w3.org/2000/svg"
            >
                <circle
                    cx="25"
                    cy="25"
                    r="20"
                    fill="none"
                    stroke="rgb(22, 163, 74)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray="80, 200"
                    strokeDashoffset="0"
                />
            </svg>
        </div>
    );
}
