import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className = '',
  variant = 'default',
  onClick,
  disabled = false,
  type = 'button',
}) => {
  const baseStyles = 'px-4 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantStyles = {
    default: 'bg-purple-600 text-white hover:bg-purple-700 focus:ring-purple-500 disabled:bg-gray-300 disabled:cursor-not-allowed',
    outline: 'border-2 border-purple-600 text-purple-600 hover:bg-purple-50 focus:ring-purple-500 disabled:border-gray-300 disabled:text-gray-300 disabled:cursor-not-allowed',
    ghost: 'text-purple-600 hover:bg-purple-50 focus:ring-purple-500 disabled:text-gray-300 disabled:cursor-not-allowed',
  };

  return (
    <button
      type={type}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};
