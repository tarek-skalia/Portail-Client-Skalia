
import React, { useEffect, useState } from 'react';
import { ResponsiveContainer } from 'recharts';

interface ChartCardProps {
  title: string;
  children: React.ReactElement;
  height?: number;
}

const ChartCard: React.FC<ChartCardProps> = ({ title, children, height = 250 }) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm flex flex-col h-full">
      <h3 className="text-gray-900 font-semibold mb-6 text-sm">{title}</h3>
      {/* 
         Fix pour les warnings Recharts "width(-1) and height(-1)":
         On n'affiche le ResponsiveContainer que lorsque le composant est monté côté client.
         Avant cela, on affiche un placeholder vide de la même taille.
      */}
      <div style={{ width: '100%', height: height, minWidth: 0 }}>
        {isMounted ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            {children}
            </ResponsiveContainer>
        ) : (
            <div className="w-full h-full bg-slate-50/50 rounded-lg animate-pulse" />
        )}
      </div>
    </div>
  );
};

export default ChartCard;
