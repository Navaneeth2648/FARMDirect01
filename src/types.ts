export type Language = 'en' | 'ml' | 'hi' | 'te';

export type UserType = 'farmer' | 'buyer';

export interface User {
  id: string;
  name: string;
  phone: string;
  type: UserType;
  village: string;
  aadharNumber: string;
  rating: number;
  totalReviews: number;
}

export interface Produce {
  id: string;
  farmerId: string;
  farmerName: string;
  farmerVillage: string;
  cropName: string;
  quantity: number;
  pricePerKg: number;
  negotiable: boolean;
  status: 'available' | 'sold' | 'pending';
  imageUrl: string;
  postedDate: string;
}

export interface GovernmentPrice {
  cropName: string;
  minPrice: number;
  maxPrice: number;
  averagePrice: number;
  market: string;
  date: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  message: string;
  timestamp: string;
  type: 'text' | 'offer' | 'image' | 'voice' | 'document';
  offerAmount?: number;
  status?: 'sent' | 'delivered' | 'read';
}

export type Screen =
  | 'welcome'
  | 'onboarding'
  | 'farmer-dashboard'
  | 'buyer-marketplace'
  | 'add-produce'
  | 'listing-detail'
  | 'chat'
  | 'payment-escrow'
  | 'delivery-confirmation';
