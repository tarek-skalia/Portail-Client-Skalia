import React from 'react';

interface LogoProps {
  className?: string;
  classNameText?: string;
  showText?: boolean;
}

const Logo: React.FC<LogoProps> = ({ 
  className = "w-10 h-10", 
  classNameText = "text-xl", 
  showText = true,
}) => {
  // Lien vers le logo final SVG
  const logoSrc = "https://cdn.prod.website-files.com/68101e1142e157b7bc0d9366/6935e99c98e4b9ac7e0cb5c4_Design%20sans%20titre%20(5).svg";

  return (
    <div className="flex items-center gap-1 select-none">
      <img 
        src={logoSrc} 
        alt="Skalia Logo" 
        className={`object-contain drop-shadow-sm transition-transform duration-500 hover:scale-105 ${className}`} 
      />
      
      {showText && (
        <span className={`font-bold tracking-tight text-white ${classNameText}`}>
          SKALIA
        </span>
      )}
    </div>
  );
};

export default Logo;