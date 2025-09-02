import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { FunnelStage } from '../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface FunnelChartProps {
  stages: FunnelStage[];
  roleName: string;
  conversionRates: Array<{ fromStage: string; toStage: string; rate: number; isLow: boolean }>;
  conversionThreshold: number;
}

const FunnelChart: React.FC<FunnelChartProps> = ({ stages, roleName, conversionRates, conversionThreshold }) => {
  // Create funnel effect by making bars progressively smaller
  const funnelData = stages.map((stage, index) => {
    const baseValue = stage.candidate_count;
    // Create funnel effect: each stage is slightly smaller than the previous
    const funnelMultiplier = Math.max(0.3, 1 - (index * 0.15));
    return {
      name: stage.stage_name,
      candidates: Math.round(baseValue * funnelMultiplier),
      actualCandidates: baseValue,
      color: index === 0 ? '#d32f2f' : 
             index === 1 ? '#e53935' : 
             index === 2 ? '#f44336' : 
             index === 3 ? '#ff5722' : 
             index === 4 ? '#ff7043' : 
             index === 5 ? '#ff8a65' : 
             index === 6 ? '#ffab91' : '#ffcc02'
    };
  });

  const chartData = {
    labels: funnelData.map(item => item.name),
    datasets: [
      {
        label: 'Candidates',
        data: funnelData.map(item => item.candidates),
        backgroundColor: funnelData.map(item => item.color),
        borderColor: funnelData.map(item => item.color),
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const stageIndex = context.dataIndex;
            const actualCandidates = funnelData[stageIndex].actualCandidates;
            const conversionRate = stageIndex > 0 ? conversionRates[stageIndex - 1] : null;
            
            let tooltipText = [`Candidates: ${actualCandidates}`];
            if (conversionRate) {
              tooltipText.push(`Conversion: ${conversionRate.rate.toFixed(1)}%`);
            }
            return tooltipText;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          display: false,
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  return (
    <div className="bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-700">
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-white mb-2">{roleName}</h3>
        <div className="flex items-center space-x-4 text-sm text-gray-300">
          <span>Total Applicants: {stages[0]?.candidate_count || 0}</span>
          <span>•</span>
          <span>Hired: {stages[stages.length - 1]?.candidate_count || 0}</span>
          <span>•</span>
          <span>Overall Conversion: {((stages[stages.length - 1]?.candidate_count || 0) / (stages[0]?.candidate_count || 1) * 100).toFixed(1)}%</span>
        </div>
      </div>
      
      <div className="h-64 mb-6">
        <Bar data={chartData} options={chartOptions} />
      </div>
      
      <div className="mt-8">
        <h4 className="text-lg font-semibold mb-4 text-white">Stage Conversion Analysis</h4>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {conversionRates.map((rate, index) => {
            // Determine health status based on conversion rate
            let healthStatus = 'healthy';
            let healthText = 'Healthy';
            
            if (rate.rate < 30) {
              healthStatus = 'critical';
              healthText = 'Needs Attention';
            } else if (rate.rate < 50) {
              healthStatus = 'risk';
              healthText = 'At Risk';
            }
            
            return (
              <div key={index} className={`p-4 rounded-lg border ${
                healthStatus === 'healthy' ? 'bg-green-900/30 border-green-600' :
                healthStatus === 'risk' ? 'bg-yellow-900/30 border-yellow-600' :
                'bg-red-900/30 border-red-600'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${
                    healthStatus === 'healthy' ? 'text-green-300' :
                    healthStatus === 'risk' ? 'text-yellow-300' :
                    'text-red-300'
                  }`}>
                    {rate.fromStage} → {rate.toStage}
                  </span>
                  <span className={`text-lg font-bold ${
                    healthStatus === 'healthy' ? 'text-green-400' :
                    healthStatus === 'risk' ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {rate.rate.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      healthStatus === 'healthy' ? 'bg-green-500' :
                      healthStatus === 'risk' ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(rate.rate, 100)}%` }}
                  ></div>
                </div>
                <div className={`mt-1 text-xs ${
                  healthStatus === 'healthy' ? 'text-green-400' :
                  healthStatus === 'risk' ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {healthText}
                </div>
              </div>
            );
          })}
        </div>
        {conversionRates.some(rate => rate.isLow) && (
          <div className="mt-4 p-3 bg-red-900/30 border border-red-600 rounded-lg">
            <div className="flex items-center">
              <span className="text-red-400 mr-2">⚠️</span>
              <span className="text-sm text-red-300">
                {conversionRates.filter(rate => rate.isLow).length} stage(s) below {conversionThreshold}% conversion threshold
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FunnelChart;
