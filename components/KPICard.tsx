
import React from 'react';

interface KPICardProps {
  title: string;
  value: string;
  color: 'green' | 'purple' | 'blue' | 'red';
  subtext?: React.ReactNode;
  fullWidth?: boolean;
}

const KPICard: React.FC<KPICardProps> = ({ title, value, color, subtext, fullWidth = false }) => {
  const colorStyles = {
    green: {
      bg: 'bg-green-50',
      border: 'border-green-100',
      text: 'text-green-700',
      value: 'text-green-800',
      shadow: 'hover:shadow-green-200/50',
    },
    purple: {
      bg: 'bg-purple-50',
      border: 'border-purple-100',
      text: 'text-purple-700',
      value: 'text-purple-800',
      shadow: 'hover:shadow-purple-200/50',
    },
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-100',
      text: 'text-blue-700',
      value: 'text-blue-900',
      shadow: 'hover:shadow-blue-200/50',
    },
    red: {
      bg: 'bg-pink-50',
      border: 'border-pink-100',
      text: 'text-pink-700',
      value: 'text-pink-800',
      shadow: 'hover:shadow-pink-200/50',
    },
  };

  const styles = colorStyles[color];

  return (
    <div className={`p-6 rounded-2xl border ${styles.bg} ${styles.border} shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl ${styles.shadow} cursor-default ${fullWidth ? 'col-span-1 md:col-span-2' : ''}`}>
      <h3 className={`text-sm font-semibold mb-2 ${styles.text} transition-colors`}>{title}</h3>
      <div className={`text-4xl font-bold ${styles.value} tracking-tight`}>
        {value}
      </div>
      {subtext && <div className="mt-2 text-sm opacity-80">{subtext}</div>}
    </div>
  );
};

export default KPICard;
