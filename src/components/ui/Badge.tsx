import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success';
}

export function Badge({ className = '', variant = 'default', children, ...props }: BadgeProps) {
  let variantStyles = 'bg-emerald-100 text-emerald-800 border-transparent';
  if (variant === 'secondary') {
    variantStyles = 'bg-gray-100 text-gray-800 border-transparent';
  } else if (variant === 'destructive') {
    variantStyles = 'bg-rose-100 text-rose-800 border-transparent';
  } else if (variant === 'outline') {
    variantStyles = 'border-gray-300 text-gray-700 bg-white';
  } else if (variant === 'success') {
    variantStyles = 'bg-emerald-600 text-white border-transparent';
  }

  return (
    <div
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors ${variantStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
