export interface User {
  id: string;
  email: string;
  displayName: string | null;
  credits: number;
  isAdmin: boolean;
  plan?: string;
  roles?: string[];
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Project {
  id: string;
  title: string;
  format: string;
  genres: string[];
  voice: string;
  storyPrompt: string;
  durationLabel: string;
  status: string;
  progress: number;
  thumbnailUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  title: string;
  format: string;
  genres: string[];
  voice: string;
  storyPrompt: string;
  durationLabel: string;
}

export interface Chunk {
  id: string;
  sceneId: string;
  index: number;
  status: string;
  progress: number;
  durationSec: number;
  prompt?: string;
  videoUrl?: string;
  startImageUrl?: string;
  endImageUrl?: string;
  retryCount?: number;
}

export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price_paise: number;
  currency: string;
  bonus_credits?: number;
}

export interface PaymentOrder {
  id: string;
  amount_paise: number;
  currency: string;
  status: string;
  created_at: string;
}

export interface CreateOrderResponse {
  orderId: string;
  amount_paise: number;
  currency: string;
  razorpayKeyId: string;
}

export interface Notification {
  id: string;
  title?: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface PlaygroundEvent {
  id: string;
  event_type: string;
  agent: string | null;
  message: string;
  payload_json: string | null;
  created_at: string;
}

export interface AgentLog {
  id: string;
  agent_name: string;
  level: "info" | "warn" | "error";
  message: string;
  metadata_json: string | null;
  created_at: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName?: string;
}
