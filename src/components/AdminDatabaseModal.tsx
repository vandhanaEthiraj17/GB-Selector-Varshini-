import React, { useState, useEffect } from 'react';
import { X, Upload, CheckCircle2, AlertTriangle, ShieldCheck, Database } from 'lucide-react';

interface AdminDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminDatabaseModal: React.FC<AdminDatabaseModalProps> = ({ isOpen, onClose }) => {
  const [adminToken, setAdminToken] = useState('magtorq-admin-secret-2026');
  const [dbType, setDbType] = useState<'gearbox_database' | 'engineering_data'>('gearbox_database');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [stats, setStats] = useState<{ gearboxCount: number; ratioCount: number }>({ gearboxCount: 0, ratioCount: 0 });

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/database/status');
      if (response.ok) {
        const data = await response.json();
        setStats({
          gearboxCount: data.gearboxCount || 0,
          ratioCount: data.ratioCount || 0
        });
      }
    } catch (err) {
      console.error('Failed to fetch database summary counts:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStats();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Read file as base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (!file.name.endsWith('.xlsx')) {
        setStatus('error');
        setMessage('Invalid file type. Please select a valid Excel file (.xlsx).');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setStatus('idle');
      setMessage('');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setStatus('error');
      setMessage('Please select an Excel file to upload.');
      return;
    }
    if (!adminToken) {
      setStatus('error');
      setMessage('Admin access token is required.');
      return;
    }

    setStatus('loading');
    setMessage('Uploading and parsing engineering database...');

    try {
      const fileData = await fileToBase64(selectedFile);
      const response = await fetch('/api/database/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          type: dbType,
          fileName: selectedFile.name,
          fileData: fileData
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      // Re-initialize local statistics
      await fetchStats();

      setStatus('success');
      setMessage(result.message || 'Database synchronized successfully!');
      setSelectedFile(null);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage((err as Error).message || 'Failed to update database.');
    }
  };

  const activeGbCount = stats.gearboxCount;
  const activeRatioCount = stats.ratioCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md transition-all duration-300">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4 flex items-center justify-between text-white border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-amber-500 animate-pulse" />
            <div>
              <h2 className="text-md font-bold tracking-wide">MAGTORQ DB Portal</h2>
              <p className="text-[10px] text-slate-400">Authoritative Engineering Database Synchronization</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-700 rounded-xl transition-all duration-150">
            <X className="h-5 w-5 text-slate-400 hover:text-white" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleUpload} className="p-6 space-y-5 overflow-y-auto flex-1 text-slate-700 font-sans">
          
          {/* Active Statistics Card */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/60 rounded-2xl p-4 flex justify-around text-center shadow-inner">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Catalog</p>
              <p className="text-2xl font-black text-slate-800 mt-1">{activeGbCount}</p>
              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Gearboxes (S1-S4)</p>
            </div>
            <div className="w-[1px] bg-slate-200 self-stretch"></div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ratio Tables</p>
              <p className="text-2xl font-black text-slate-800 mt-1">{activeRatioCount}</p>
              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Total Reduction Steps</p>
            </div>
          </div>

          {/* Admin Token Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
              Admin Credentials
            </label>
            <input
              type="password"
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              placeholder="Enter ADMIN_TOKEN"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm font-semibold text-slate-700"
            />
          </div>

          {/* Database Type Select */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Select Dataset Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className={`flex flex-col items-center justify-center p-3 border rounded-2xl cursor-pointer transition-all duration-150 ${dbType === 'gearbox_database' ? 'bg-amber-50/50 border-amber-500 text-amber-900 shadow-sm' : 'border-slate-200 hover:bg-slate-50/50'}`}>
                <input
                  type="radio"
                  name="dbType"
                  value="gearbox_database"
                  checked={dbType === 'gearbox_database'}
                  onChange={() => setDbType('gearbox_database')}
                  className="sr-only"
                />
                <span className="text-xs font-bold">Gearbox Catalog</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Database Updated (S1 & S4)</span>
              </label>

              <label className={`flex flex-col items-center justify-center p-3 border rounded-2xl cursor-pointer transition-all duration-150 ${dbType === 'engineering_data' ? 'bg-amber-50/50 border-amber-500 text-amber-900 shadow-sm' : 'border-slate-200 hover:bg-slate-50/50'}`}>
                <input
                  type="radio"
                  name="dbType"
                  value="engineering_data"
                  checked={dbType === 'engineering_data'}
                  onChange={() => setDbType('engineering_data')}
                  className="sr-only"
                />
                <span className="text-xs font-bold">Engineering Ratios</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Ratio Limits & Stage Maps</span>
              </label>
            </div>
          </div>

          {/* File Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Upload Excel Workbook (.xlsx)
            </label>
            <div className="border-2 border-dashed border-slate-200 hover:border-amber-500/70 rounded-2xl p-6 transition-all duration-150 text-center bg-slate-50/30">
              <input
                id="excel-file-picker"
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="excel-file-picker" className="cursor-pointer flex flex-col items-center justify-center space-y-2">
                <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:text-amber-500 transition-colors">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-700 hover:underline">Click to browse</span>
                  <span className="text-xs text-slate-400"> or drag file here</span>
                </div>
                <p className="text-[10px] text-slate-400">Only Excel files (.xlsx) up to 20MB are allowed</p>
              </label>

              {selectedFile && (
                <div className="mt-4 p-2 bg-amber-50/50 border border-amber-100 rounded-xl flex items-center justify-between text-left">
                  <div className="overflow-hidden pr-2">
                    <p className="text-xs font-bold text-slate-700 truncate">{selectedFile.name}</p>
                    <p className="text-[9px] text-slate-400 font-semibold">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setSelectedFile(null)} 
                    className="text-slate-400 hover:text-red-500 text-xs font-bold px-2 py-1"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Feedback Section */}
          {status !== 'idle' && (
            <div className={`p-4 rounded-2xl flex gap-3 text-xs border ${
              status === 'loading' ? 'bg-slate-50 border-slate-200 text-slate-500' :
              status === 'success' ? 'bg-emerald-50/80 border-emerald-100 text-emerald-800' :
              'bg-red-50/80 border-red-100 text-red-800'
            }`}>
              {status === 'loading' && <div className="h-4 w-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />}
              {status === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />}
              {status === 'error' && <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />}
              <p className="font-semibold">{message}</p>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-xs font-bold rounded-xl transition-all duration-150"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={status === 'loading'}
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all duration-150 flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Database className="h-3.5 w-3.5" />
              Synchronize DB
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
