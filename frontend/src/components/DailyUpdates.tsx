import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { DailyUpdate } from '../types';

const DailyUpdates: React.FC = () => {
  const [updates, setUpdates] = useState<DailyUpdate[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const getMonday = (d: Date) => {
    const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = date.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    date.setDate(date.getDate() + diff);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const formatISO = (d: Date) => d.toISOString().slice(0, 10);

  const thisMonday = useMemo(() => getMonday(new Date()), []);
  const thisSunday = useMemo(() => {
    const s = new Date(thisMonday);
    s.setDate(s.getDate() + 6);
    s.setHours(23, 59, 59, 999);
    return s;
  }, [thisMonday]);

  // Filters: date range, TA, Department
  const [startDate, setStartDate] = useState<string>(() => formatISO(thisMonday));
  const [endDate, setEndDate] = useState<string>(() => formatISO(thisSunday));
  const [selectedTa, setSelectedTa] = useState<string>('All');
  const [selectedDept, setSelectedDept] = useState<string>('All');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`/api/daily-updates`, {
          params: {
            start: startDate,
            end: endDate,
            ta: selectedTa !== 'All' ? selectedTa : undefined,
            dept: selectedDept !== 'All' ? selectedDept : undefined,
          }
        });
        setUpdates(res.data?.updates || []);
      } catch (_) {
        setUpdates([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [startDate, endDate, selectedTa, selectedDept]);

  // Build filter options from current results
  const taOptions = useMemo(() => {
    const s = new Set<string>();
    updates.forEach(u => { if (u.taName) s.add(u.taName); });
    return ['All', ...Array.from(s).sort()];
  }, [updates]);
  const deptOptions = useMemo(() => {
    const s = new Set<string>();
    updates.forEach(u => { if (u.department) s.add(u.department); });
    return ['All', ...Array.from(s).sort()];
  }, [updates]);

  const totals = useMemo(() => {
    return updates.reduce((acc, u) => {
      acc.openings += u.numberOfOpenings || 0;
      acc.scheduled += u.interviewsScheduled || 0;
      acc.completed += u.interviewsCompleted || 0;
      acc.cancelled += u.cancelledNoShow || 0;
      acc.offers += u.offersMade || 0;
      acc.pending += u.pendingInterviewFeedback || 0;
      acc.upcoming += u.upcomingHmInterviews || 0;
      return acc;
    }, { openings: 0, scheduled: 0, completed: 0, cancelled: 0, offers: 0, pending: 0, upcoming: 0 });
  }, [updates]);

  const parseRemarks = (text?: string): string[] => {
    if (!text) return [];
    const s = String(text);
    // Normalize bullets from form: handle newlines and " - " separators
    const unified = s
      .replace(/\r?\n/g, ' || ')
      .replace(/\s+-\s+/g, ' || ')
      .replace(/^\s*-\s*/, '');
    return unified
      .split(/\s*\|\|\s*/)
      .map(part => part.trim())
      .filter(Boolean);
  };

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">Daily Update & Progress</h1>
        <div className="text-sm text-gray-400">Range: {startDate} – {endDate}</div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 rounded-lg shadow-lg p-4 mb-6 border border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Start date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-gray-700 text-gray-200 border border-gray-600 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">End date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-gray-700 text-gray-200 border border-gray-600 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">TA</label>
            <select value={selectedTa} onChange={(e) => setSelectedTa(e.target.value)} className="w-full bg-gray-700 text-gray-200 border border-gray-600 rounded-md px-3 py-2 text-sm">
              {taOptions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Department</label>
            <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} className="w-full bg-gray-700 text-gray-200 border border-gray-600 rounded-md px-3 py-2 text-sm">
              {deptOptions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card title="Interviews Scheduled (wk)" value={totals.scheduled} />
        <Card title="Interviews Completed (wk)" value={totals.completed} />
        <Card title="Cancelled/ No Show (wk)" value={totals.cancelled} />
        <Card title="Offers Made (wk)" value={totals.offers} />
        <Card title="Pending Feedback" value={totals.pending} />
        <Card title="Upcoming HM Interviews" value={totals.upcoming} />
      </div>

      <div className="bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">This Week Entries</h2>
        {loading ? (
          <div className="text-gray-400">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-base text-gray-200 text-center">
              <thead className="text-gray-300">
                <tr>
                  <th className="py-3 px-4 align-middle">Date</th>
                  <th className="py-3 px-4 align-middle">TA</th>
                  <th className="py-3 px-4 align-middle">Dept</th>
                  <th className="py-3 px-4 align-middle">Country</th>
                  <th className="py-3 px-4 align-middle min-w-[220px]">Role</th>
                  <th className="py-3 px-4 align-middle">Openings</th>
                  <th className="py-3 px-4 align-middle">Sched</th>
                  <th className="py-3 px-4 align-middle">Done</th>
                  <th className="py-3 px-4 align-middle">Cancelled</th>
                  <th className="py-3 px-4 align-middle">Offers</th>
                  <th className="py-3 px-4 align-middle">Pending</th>
                  <th className="py-3 px-4 align-middle">Upcoming HM</th>
                  <th className="py-3 px-4 align-middle min-w-[420px] text-left">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {updates.map((u, idx) => (
                  <tr key={idx} className="border-t border-gray-700">
                    <td className="py-3 px-4 align-middle">{u.date}</td>
                    <td className="py-3 px-4 align-middle">{u.taName}</td>
                    <td className="py-3 px-4 align-middle">{u.department}</td>
                    <td className="py-3 px-4 align-middle">{u.country}</td>
                    <td className="py-3 px-4 align-middle min-w-[220px]">{u.role}</td>
                    <td className="py-3 px-4 align-middle">{u.numberOfOpenings}</td>
                    <td className="py-3 px-4 align-middle">{u.interviewsScheduled}</td>
                    <td className="py-3 px-4 align-middle">{u.interviewsCompleted}</td>
                    <td className="py-3 px-4 align-middle">{u.cancelledNoShow}</td>
                    <td className="py-3 px-4 align-middle">{u.offersMade}</td>
                    <td className="py-3 px-4 align-middle">{u.pendingInterviewFeedback}</td>
                    <td className="py-3 px-4 align-middle">{u.upcomingHmInterviews}</td>
                    <td className="py-3 px-4 align-top min-w-[420px] text-left whitespace-pre-wrap break-words">
                      {parseRemarks(u.remarks).length > 0 ? (
                        <ul className="list-disc pl-5 space-y-1">
                          {parseRemarks(u.remarks).map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-gray-400">{u.remarks || ''}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

const Card: React.FC<{ title: string; value: number | string }> = ({ title, value }) => (
  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
    <div className="text-xs text-gray-400">{title}</div>
    <div className="text-2xl font-semibold text-white">{value}</div>
  </div>
);

export default DailyUpdates;


