import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { RefreshCw } from 'lucide-react';
import D3FunnelChart from './D3FunnelChart';
import { Role, DashboardConfig } from '../types';

const Dashboard: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [config] = useState<DashboardConfig>({
    refreshInterval: 60,
    conversionThreshold: 30,
    inactivityThreshold: 3
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);

  // Week selector (Monday–Sunday) - declare BEFORE functions that use it
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
    // generate last 24 weeks ranges (~6 months)
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

  const [selectedWeekIdx, setSelectedWeekIdx] = useState<number>(0); // 0 = current week
  const selectedWeek = weeks[selectedWeekIdx] || weeks[0];

  const fetchData = async () => {
    try {
      setLoading(true);
      // attach weekly range to request
      const params: any = {};
      if (selectedWeek) {
        const startISO = new Date(selectedWeek.start).toISOString().split('T')[0];
        const endISO = new Date(selectedWeek.end).toISOString().split('T')[0];
        params.start = startISO;
        params.end = endISO;
      }
      const response = await axios.get('/api/dashboard', { params });
      setRoles(response.data.roles);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, config.refreshInterval * 60 * 1000);
    return () => clearInterval(interval);
  }, [config.refreshInterval, selectedWeekIdx]);

  // Derive department from role name: "Department - Role"
  const getDepartmentFromRoleName = (roleName: string): string => {
    const parts = roleName.split(' - ');
    return parts.length > 1 ? parts[0] : 'General';
  };

  const activeRoles = useMemo(() => roles.filter(role => role.isActive), [roles]);

  const allDepartments = useMemo(() => {
    const set = new Set<string>();
    activeRoles.forEach(r => set.add(getDepartmentFromRoleName(r.name)));
    return Array.from(set).sort();
  }, [activeRoles]);

  // Initialize default departments once data arrives
  useEffect(() => {
    if (allDepartments.length && selectedDepartments.length === 0) {
      // Preselect commonly requested departments if present; otherwise select all
      const preferred = ['Sales (MY)', 'CX (MY)', 'Sales (PH)', 'CX (PH)'].filter(d => allDepartments.includes(d));
      setSelectedDepartments(preferred.length ? preferred : allDepartments);
    }
  }, [allDepartments]);

  const filteredRoles = useMemo(() => {
    if (selectedDepartments.length === 0) return activeRoles;
    return activeRoles.filter(r => selectedDepartments.includes(getDepartmentFromRoleName(r.name)));
  }, [activeRoles, selectedDepartments]);

  const totalApplicants = useMemo(() => {
    return filteredRoles.reduce((sum, role) => sum + (role.stages[0]?.candidate_count || 0), 0);
  }, [filteredRoles]);

  const totalHired = useMemo(() => {
    return filteredRoles.reduce((sum, role) => {
      const hiredStage = role.stages.find(s => s.stage_name.toLowerCase().includes('hired'));
      return sum + (hiredStage?.candidate_count || 0);
    }, 0);
  }, [filteredRoles]);

  const toggleDepartment = (dept: string) => {
    setSelectedDepartments(prev => prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]);
  };


  return (
                <div className="min-h-screen bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6 border border-gray-700">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white">TA Dashboard</h1>
              <p className="text-gray-300 mt-2">
                Real-time hiring funnel visualization
                <span className="ml-3 px-2 py-0.5 text-xs rounded-full bg-gray-700 text-gray-200 align-middle" title="Week (Mon–Sun)">
                  {selectedWeek?.label || ''}
                </span>
                {lastUpdated && (
                  <span className="ml-4 text-sm text-gray-400">
                    Last updated: {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </p>
            </div>
            {/* window selector */}
            <select
              className="bg-gray-700 text-gray-200 border border-gray-600 rounded-md px-2 py-1 mr-3"
              title="Select week (Mon–Sun)"
              value={selectedWeekIdx}
              onChange={(e) => setSelectedWeekIdx(parseInt(e.target.value, 10))}
            >
              {weeks.map((w, idx) => (
                <option key={idx} value={idx}>{w.label}</option>
              ))}
            </select>
            <div className="flex space-x-3">
              <button
                onClick={fetchData}
                disabled={loading}
                className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Department Filter */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Filter by Department</h2>
            <div className="flex space-x-4">
              <button
                onClick={() => setSelectedDepartments(allDepartments)}
                className="text-sm text-gray-300 hover:text-white"
              >
                Select all
              </button>
              <button
                onClick={() => setSelectedDepartments([])}
                className="text-sm text-gray-300 hover:text-white"
              >
                Deselect all
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {allDepartments.map((dept) => {
              const active = selectedDepartments.includes(dept);
              return (
                <button
                  key={dept}
                  onClick={() => toggleDepartment(dept)}
                  className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                    active
                      ? 'bg-orange-600 text-white border-orange-500'
                      : 'bg-gray-700 text-gray-200 border-gray-600 hover:bg-gray-600'
                  }`}
                >
                  {dept}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-white">Overall Funnel Health</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-orange-100 rounded-lg border border-orange-200">
              <div className="text-2xl font-bold text-orange-800">
                {filteredRoles.length}
              </div>
              <div className="text-orange-600">Active Roles</div>
            </div>
            <div className="text-center p-4 bg-red-100 rounded-lg border border-red-200">
              <div className="text-2xl font-bold text-red-800">
                {totalApplicants}
              </div>
              <div className="text-red-600">Total Applicants</div>
            </div>
            <div className="text-center p-4 bg-yellow-100 rounded-lg border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-800">
                {totalHired}
              </div>
              <div className="text-yellow-600">Total Hired</div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
            <p className="mt-4 text-gray-300">Loading funnel data...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {filteredRoles.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No active roles found</p>
              </div>
            ) : (
              filteredRoles.map((role) => (
                <D3FunnelChart
                  key={role.name}
                  stages={role.stages}
                  roleName={role.name}
                  conversionRates={role.conversionRates}
                  conversionThreshold={config.conversionThreshold}
                  remarks={role.remarks}
                  lastUpdated={role.lastUpdated}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
