
import React from 'react';

const BackgroundBlobs: React.FC = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-0">
      {/* Blob 1: Haut Gauche (Violet/Indigo) */}
      <div 
        className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] bg-indigo-400/10 rounded-full blur-[100px] animate-float"
        style={{ animationDuration: '15s' }}
      />
      
      {/* Blob 2: Bas Droite (Rose/Pourpre) - Délai pour mouvement asynchrone */}
      <div 
        className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-400/10 rounded-full blur-[120px] animate-float-delayed"
        style={{ animationDuration: '18s' }}
      />

      {/* Blob 3: Centre Gauche (Bleu ciel très léger) */}
      <div 
        className="absolute top-[40%] left-[20%] w-[400px] h-[400px] bg-blue-300/10 rounded-full blur-[90px] animate-float"
        style={{ animationDuration: '20s', animationDelay: '2s' }}
      />

      {/* Blob 4: Haut Droite (Accent Rose) */}
      <div 
        className="absolute top-[10%] right-[10%] w-[300px] h-[300px] bg-pink-400/10 rounded-full blur-[80px] animate-float-delayed"
        style={{ animationDuration: '12s', animationDelay: '1s' }}
      />
    </div>
  );
};

export default BackgroundBlobs;
