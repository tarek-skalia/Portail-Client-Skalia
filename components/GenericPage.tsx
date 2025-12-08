import React from 'react';

interface GenericPageProps {
  title: string;
}

const GenericPage: React.FC<GenericPageProps> = ({ title }) => {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
      <div className="bg-gray-100 p-6 rounded-full">
         <div className="w-12 h-12 bg-gray-300 rounded-lg animate-pulse"></div>
      </div>
      <h2 className="text-2xl font-semibold text-gray-800">{title}</h2>
      <p className="text-gray-500 max-w-md">
        Cette page est en cours de construction. Bientôt, vous pourrez gérer vos {title.toLowerCase()} ici.
      </p>
      <button className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors shadow-sm">
        Retour au Tableau de Bord
      </button>
    </div>
  );
};

export default GenericPage;
