import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'danger-ghost';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const baseClasses = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0f0f]";
    
    const variantClasses = {
      primary: "bg-[#7f5af0] text-white hover:bg-[#7f5af0]/90 focus-visible:ring-[#7f5af0]",
      secondary: "bg-[#242424] border border-gray-700 text-gray-200 hover:bg-gray-800 focus-visible:ring-gray-500",
      danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500",
      ghost: "hover:bg-gray-800/80 text-gray-300 focus-visible:ring-gray-500",
      'danger-ghost': "text-red-500/70 hover:bg-red-500/10 hover:text-red-500 focus-visible:ring-red-500",
    };

    const sizeClasses = {
      sm: "h-9 px-3",
      md: "h-10 px-4 py-2",
      lg: "h-11 px-8 text-base",
      icon: "h-9 w-9",
    };

    return (
      <button
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export default Button;