import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'default', children, ...props }, ref) => {
    let baseStyles =
      'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 cursor-pointer disabled:pointer-events-none disabled:opacity-50 outline-none select-none';

    let variantStyles = '';
    switch (variant) {
      case 'default':
        variantStyles = 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm active:scale-[0.99]';
        break;
      case 'outline':
        variantStyles = 'border-2 border-gray-200 bg-white hover:bg-gray-50 text-gray-800 shadow-sm';
        break;
      case 'ghost':
        variantStyles = 'hover:bg-black/5 text-current';
        break;
      case 'secondary':
        variantStyles = 'bg-gray-100 hover:bg-gray-200 text-gray-900';
        break;
      case 'destructive':
        variantStyles = 'bg-red-600 hover:bg-red-700 text-white';
        break;
    }

    let sizeStyles = '';
    switch (size) {
      case 'sm':
        sizeStyles = 'h-9 px-3 text-sm';
        break;
      case 'default':
        sizeStyles = 'h-11 px-5 text-base';
        break;
      case 'lg':
        sizeStyles = 'h-14 px-8 text-lg';
        break;
      case 'icon':
        sizeStyles = 'h-10 w-10 p-2';
        break;
    }

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variantStyles} ${sizeStyles} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
