import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent';
  fullWidth?: boolean;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  icon, 
  size = 'md',
  className = '',
  ...props 
}) => {
  const baseStyles = "relative inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden rounded-lg";
  
  const variants = {
    primary: "bg-slate-700 hover:bg-slate-600 text-white border border-slate-600",
    secondary: "bg-transparent hover:bg-slate-800 text-slate-300 border border-slate-700",
    accent: "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white border border-orange-500 shadow-lg shadow-orange-900/20"
  };

  const sizes = {
    sm: "text-xs px-3 py-1.5",
    md: "text-sm px-4 py-2",
    lg: "text-base px-8 py-3"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {icon && <span className="relative z-10">{icon}</span>}
      <span className="relative z-10">{children}</span>
    </button>
  );
};