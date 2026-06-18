import React, { useEffect } from 'react';
import { Settings } from 'lucide-react';

interface HeaderProps {
  projectName: string;
}

export const Header: React.FC<HeaderProps> = ({
  projectName,
}) => {
  useEffect(() => {
    document.title = projectName ? `MAGTORQ | ${projectName}` : 'MAGTORQ Gearbox Selector';
  }, [projectName]);

  return (
    <header className="w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 border-b border-slate-800 py-3 px-6 flex items-center justify-between shadow-md sticky top-0 z-50">
      <div className="flex items-center space-x-3.5">
        <div className="flex items-center gap-2">
          <div className="bg-[#ff8c00] p-1.5 rounded-lg flex items-center justify-center text-white shadow-inner">
            <Settings className="h-5 w-5 animate-[spin_20s_linear_infinite]" />
          </div>
          <span className="font-extrabold text-2xl tracking-wider text-white">
            MAG<span className="text-[#ff8c00]">TORQ</span>
          </span>
        </div>
      </div>
    </header>
  );
};

