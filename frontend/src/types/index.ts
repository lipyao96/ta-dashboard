export interface FunnelStage {
  stage_name: string;
  candidate_count: number;
  last_updated: string;
}

export interface Role {
  name: string;
  stages: FunnelStage[];
  remarks?: string;
  lastUpdated?: string;
  isActive: boolean;
  funnelHealthScore: number;
  conversionRates: ConversionRate[];
}

export interface KeyWin {
  date: string;
  department: string;
  position: string;
  remarks: string;
}

export interface DailyUpdate {
  date: string;
  taName: string;
  department: string;
  country: string;
  role: string;
  numberOfOpenings: number;
  interviewsScheduled: number;
  interviewsCompleted: number;
  cancelledNoShow: number;
  offersMade: number;
  pendingInterviewFeedback: number;
  upcomingHmInterviews: number;
  remarks: string;
}

export interface ConversionRate {
  fromStage: string;
  toStage: string;
  rate: number;
  isLow: boolean;
}

export interface DashboardConfig {
  refreshInterval: number;
  conversionThreshold: number;
  inactivityThreshold: number;
}

export interface HistoricalData {
  date: string;
  roles: Role[];
}
