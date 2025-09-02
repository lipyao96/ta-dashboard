import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { KeyWin } from '../types';

const KeyWins: React.FC = () => {
  const [wins, setWins] = useState<KeyWin[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const getMonday = (d: Date) => {
    const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = date.getDay();
    const diff = (day === 0 ? -6 : 1) - day; // move to Monday
    date.setDate(date.getDate() + diff);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const thisMonday = useMemo(() => getMonday(new Date()), []);
  const weeks = useMemo(() => {
    const arr: { start: Date; end: Date; label: string }[] = [];
    for (let i = 0; i < 24; i++) {
      const start = new Date(thisMonday);
      start.setDate(start.getDate() - i * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const startLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const endLabel = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const yearLabel = end.getFullYear();
      arr.push({ start, end, label: `${startLabel} – ${endLabel}, ${yearLabel}` });
    }
    return arr;
  }, [thisMonday]);
  const [selectedWeekIdx, setSelectedWeekIdx] = useState<number>(0);
  const selectedWeek = weeks[selectedWeekIdx] || weeks[0];

  const fetchWins = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (selectedWeek) {
        params.start = new Date(selectedWeek.start).toISOString().split('T')[0];
        params.end = new Date(selectedWeek.end).toISOString().split('T')[0];
      }
      const res = await axios.get('/api/key-wins', { params });
      setWins(res.data.wins || []);
      setLastUpdated(new Date());
    } catch (e) {
      console.error('Failed to fetch key wins', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWins();
  }, [selectedWeekIdx]);

  const allDepartments = useMemo(() => {
    const s = new Set<string>();
    wins.forEach(w => { if (w.department) s.add(w.department); });
    return Array.from(s).sort();
  }, [wins]);

  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  useEffect(() => {
    if (allDepartments.length && selectedDepartments.length === 0) {
      setSelectedDepartments(allDepartments);
    }
  }, [allDepartments]);

  const filtered = useMemo(() => {
    if (selectedDepartments.length === 0) return wins;
    return wins.filter(w => selectedDepartments.includes(w.department));
  }, [wins, selectedDepartments]);

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6 border border-gray-700">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white">Key Wins</h1>
              <p className="text-gray-300 mt-2">
                Highlights and progress
                <span className="ml-3 px-2 py-0.5 text-xs rounded-full bg-gray-700 text-gray-200 align-middle" title="Week (Mon–Sun)">
                  {selectedWeek?.label || ''}
                </span>
                {lastUpdated && (
                  <span className="ml-4 text-sm text-gray-400">Last updated: {lastUpdated.toLocaleTimeString()}</span>
                )}
              </p>
            </div>
            <select
              className="bg-gray-700 text-gray-200 border border-gray-600 rounded-md px-2 py-1"
              title="Select week (Mon–Sun)"
              value={selectedWeekIdx}
              onChange={(e) => setSelectedWeekIdx(parseInt(e.target.value, 10))}
            >
              {weeks.map((w, idx) => (
                <option key={idx} value={idx}>{w.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Filter by Department</h2>
            <div className="flex space-x-4">
              <button onClick={() => setSelectedDepartments(allDepartments)} className="text-sm text-gray-300 hover:text-white">Select all</button>
              <button onClick={() => setSelectedDepartments([])} className="text-sm text-gray-300 hover:text-white">Deselect all</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {allDepartments.map((dept) => {
              const active = selectedDepartments.includes(dept);
              return (
                <button
                  key={dept}
                  onClick={() => setSelectedDepartments(prev => prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept])}
                  className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                    active ? 'bg-orange-600 text-white border-orange-500' : 'bg-gray-700 text-gray-200 border-gray-600 hover:bg-gray-600'
                  }`}
                >
                  {dept}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
            <p className="mt-4 text-gray-300">Loading key wins...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.length === 0 ? (
              <div className="text-center py-8"><p className="text-gray-500">No wins recorded for this week.</p></div>
            ) : (
              filtered.map((w, idx) => (
                <div key={idx} className="bg-gray-800 border border-gray-700 rounded-md p-4">
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>{w.date}</span>
                    <span>{w.department}</span>
                  </div>
                  <div className="mt-1 text-white font-semibold">{w.position}</div>
                  <div className="mt-1 text-gray-300 whitespace-pre-wrap">{w.remarks}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default KeyWins;


