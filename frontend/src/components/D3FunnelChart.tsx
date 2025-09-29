import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { FunnelStage } from '../types';

interface D3FunnelChartProps {
  stages: FunnelStage[];
  roleName: string;
  conversionRates: Array<{ fromStage: string; toStage: string; rate: number; isLow: boolean }>;
  conversionThreshold: number;
  remarks?: string;
  lastUpdated?: string;
}

const D3FunnelChart: React.FC<D3FunnelChartProps> = ({ stages, roleName, conversionRates, conversionThreshold, remarks, lastUpdated }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  // Sanitize stage names and hide Technical Assessment when it's 0 or missing
  const sanitizedStages: FunnelStage[] = stages
    .map(s => ({
      stage_name: (s.stage_name || '').replace(/^\s*\[(?:TA|Hiring\s*Lead)\]\s*/i, ''),
      candidate_count: s.candidate_count,
      last_updated: s.last_updated,
    }))
    .filter(s => !(s.stage_name.toLowerCase() === 'technical assessment' && (!s.candidate_count || s.candidate_count === 0)));

  // Recompute conversion rates after any stage removals/renames so cards match the funnel
  const displayConversionRates = sanitizedStages.map((_, i) => {
    if (i === 0) return null;
    const prev = sanitizedStages[i - 1];
    const curr = sanitizedStages[i];
    const rate = prev && prev.candidate_count > 0
      ? (curr.candidate_count / prev.candidate_count) * 100
      : 0;
    return {
      fromStage: prev.stage_name,
      toStage: curr.stage_name,
      rate,
      isLow: rate < 30,
    };
  }).filter(Boolean) as Array<{ fromStage: string; toStage: string; rate: number; isLow: boolean }>;

  useEffect(() => {
    if (!svgRef.current || sanitizedStages.length === 0) return;

    // Clear previous chart
    d3.select(svgRef.current).selectAll("*").remove();



    const margin = { top: 40, right: 180, bottom: 40, left: 80 };
    const width = 500 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current)
      .attr("width", width + margin.left + margin.right + 50)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create funnel data
    const funnelData = sanitizedStages.map((stage, index) => ({
      name: stage.stage_name,
      value: stage.candidate_count,
      color: index === 0 ? '#d32f2f' : 
             index === 1 ? '#e53935' : 
             index === 2 ? '#f44336' : 
             index === 3 ? '#ff5722' : 
             index === 4 ? '#ff7043' : 
             index === 5 ? '#ff8a65' : 
             index === 6 ? '#ffab91' : '#ffcc02'
    }));

    // Calculate funnel dimensions
    const maxValue = d3.max(funnelData, d => d.value) || 0;
    const stageHeight = height / funnelData.length;
    const maxWidth = width * 0.9;

    // Create funnel segments with proper funnel shape
    funnelData.forEach((d, i) => {
      // Create funnel effect: each stage is progressively narrower
      const funnelRatio = 1 - (i * 0.15);
      const segmentWidth = Math.max((d.value / maxValue) * maxWidth * funnelRatio, 50);
      const x = (width - segmentWidth) / 2;
      const y = i * stageHeight;
      
      // Create funnel segment
      const segment = svg.append("rect")
        .attr("x", x)
        .attr("y", y)
        .attr("width", segmentWidth)
        .attr("height", stageHeight - 4)
        .attr("fill", d.color)
        .attr("rx", 8)
        .attr("stroke", "#fff")
        .attr("stroke-width", 2);

      // Add value label inside the segment
      svg.append("text")
        .attr("x", width / 2)
        .attr("y", y + stageHeight / 2)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", "#fff")
        .attr("font-weight", "bold")
        .attr("font-size", "16px")
        .text(d.value.toLocaleString());

      // Add stage name to the right
      svg.append("text")
        .attr("x", width + 25)
        .attr("y", y + stageHeight / 2)
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "middle")
        .attr("font-size", "13px")
        .attr("font-weight", "500")
        .attr("fill", "#2c3e50")
        .text(d.name);

      // Add conversion rate to the left
      if (i > 0 && displayConversionRates[i - 1]) {
        const rate = displayConversionRates[i - 1];
        let rateColor = "#10b981"; // green for healthy
        
        if (rate.rate < 30) {
          rateColor = "#ef4444"; // red for critical
        } else if (rate.rate < 50) {
          rateColor = "#f59e0b"; // yellow for risk
        }
        
        svg.append("text")
          .attr("x", -15)
          .attr("y", y + stageHeight / 2)
          .attr("text-anchor", "end")
          .attr("dominant-baseline", "middle")
          .attr("font-size", "11px")
          .attr("font-weight", "bold")
          .attr("fill", rateColor)
          .text(`${rate.rate.toFixed(1)}%`);
      }

      // Add hover effects
      segment
        .on("mouseover", function() {
          d3.select(this).attr("opacity", 0.8);
        })
        .on("mouseout", function() {
          d3.select(this).attr("opacity", 1);
        });
    });

  }, [sanitizedStages, displayConversionRates]);

  return (
    <div className="bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-700">
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-white mb-2">{roleName}</h3>
        <div className="flex items-center space-x-4 text-sm text-gray-300">
          <span>Total Applicants: {sanitizedStages[0]?.candidate_count || 0}</span>
          <span>•</span>
          <span>Hired: {sanitizedStages[sanitizedStages.length - 1]?.candidate_count || 0}</span>
          <span>•</span>
          <span>Overall Conversion: {((sanitizedStages[sanitizedStages.length - 1]?.candidate_count || 0) / (sanitizedStages[0]?.candidate_count || 1) * 100).toFixed(1)}%</span>
          {lastUpdated && (
            <>
              <span>•</span>
              <span>Last Updated: {lastUpdated}</span>
            </>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="col-span-2 flex justify-center">
          <svg ref={svgRef}></svg>
        </div>
        <div className="col-span-1">
          <div className="h-full p-4 rounded-lg border border-blue-500/60 bg-blue-900/10">
            <h4 className="text-white font-semibold mb-2">Remarks</h4>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">
              {remarks && remarks.trim().length > 0 ? remarks : 'No remarks provided.'}
            </p>
          </div>
        </div>
      </div>
      
      <div className="mt-8">
        <h4 className="text-lg font-semibold mb-4 text-white">Stage Conversion Analysis</h4>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {displayConversionRates.map((rate, index) => {
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

export default D3FunnelChart; 