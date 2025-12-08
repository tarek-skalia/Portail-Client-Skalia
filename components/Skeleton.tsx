
import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
}

const Skeleton: React.FC<SkeletonProps> = ({ className = "", variant = "text" }) => {
  const baseClasses = "animate-pulse bg-slate-200/80";
  
  let variantClasses = "";
  if (variant === 'circular') variantClasses = "rounded-full";
  if (variant === 'rectangular') variantClasses = "rounded-xl";
  if (variant === 'text') variantClasses = "rounded-md";

  return (
    <div className={`${baseClasses} ${variantClasses} ${className}`} />
  );
};

export default Skeleton;
