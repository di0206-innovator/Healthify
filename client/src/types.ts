export interface AnalysedIngredient {
  ingredient: string;
  severity: 'safe' | 'low' | 'medium' | 'high';
  reason: string;
  category: string;
  bans: string[];
  bannedInSelected: boolean;
  substitute: string | null;
}

export interface ScanReport {
  id?: string;
  userId?: string;
  ingredients: AnalysedIngredient[];
  safetyScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  totalCount: number;
  harmfulCount: number;
  country: string;
  scannedAt: string;
  inputText?: string;
}

export type ScanStep = 'idle' | 'parsing' | 'analysing' | 'checking-bans' | 'finding-alternatives' | 'generating-report' | 'done' | 'error';

export interface UserPublic {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: string;
}

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// Auth types
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
}

export interface StoredScan {
  id: string;
  userId: string;
  userName: string;
  report: ScanReport;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  totalScans: number;
  avgScore: number;
  gradeDistribution: Record<string, number>;
}

// Config constants
export const COUNTRIES = [
  { value: 'India', label: 'India', agency: 'FSSAI' },
  { value: 'USA', label: 'United States', agency: 'FDA' },
  { value: 'EU', label: 'European Union', agency: 'EFSA' },
  { value: 'Canada', label: 'Canada', agency: 'CFIA' },
  { value: 'Australia', label: 'Australia', agency: 'FSANZ' },
  { value: 'UK', label: 'United Kingdom', agency: 'FSA' },
];

export const SAMPLE_INGREDIENTS = `Maltodextrin, High Fructose Corn Syrup, Potassium Bromate, Stevia, MSG, Red 40, Citric Acid, Titanium Dioxide`;
