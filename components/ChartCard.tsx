
import React, { useEffect, useState, useRef } from 'react';
import { ResponsiveContainer } from 'recharts';

interface ChartCardProps {
  title: string;
  children: React.ReactElement;
  height?: number;
}

const ChartCard: React.FC<ChartCardProps> = ({ title, children, height = 250 }) => {
  const [shouldRenderChart, setShouldRenderChart] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // On attend un court instant que le layout (Grid/Flex) soit calculé par le navigateur
    // Cela évite que Recharts ne mesure une largeur de 0 ou -1 au premier cycle.
    const timer = setTimeout(() => {
        if (containerRef.current) {
            setShouldRenderChart(true);
        }
    }, 100); // 100ms suffisent généralement

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm flex flex-col h-full">
      <h3 className="text-gray-900 font-semibold mb-6 text-sm">{title}</h3>
      <div 
        ref={containerRef}
        style={{ width: '100%', height: height, minWidth: 0 }}
        className="relative"
      >
        {shouldRenderChart ? (
            <ResponsiveContainer width="100%" height="100%" debounce={50}>
               {children}
            </ResponsiveContainer>
        ) : (
            // Placeholder pendant le calcul du layout pour éviter le "saut" visuel
            <div className="w-full h-full bg-slate-50/50 rounded-lg flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-indigo-100 border-t-indigo-400 rounded-full animate-spin"></div>
            </div>
        )}
      </div>
    </div>
  );
};

export default ChartCard;
