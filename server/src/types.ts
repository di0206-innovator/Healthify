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

export interface ScanRequest {
  ingredientText: string;
  country: string;
}

export interface OcrRequest {
  imageBase64: string;
}

// Auth types
export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'user' | 'admin';
  createdAt: string;
}

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

export interface AuthPayload {
  userId: string;
  email: string;
  role: 'user' | 'admin';
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
