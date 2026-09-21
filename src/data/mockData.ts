import { Produce, User, GovernmentPrice, Language, ChatMessage, UserType } from '../types';

export const INITIAL_PRODUCE: Produce[] = [
  {
    "id": "1",
    "farmerId": "farmer1",
    "farmerName": "NEERAJA",
    "farmerVillage": "Thiruvananthapuram",
    "cropName": "Tomato",
    "quantity": 500,
    "pricePerKg": 25,
    "negotiable": true,
    "status": "available",
    "imageUrl": "https://images.unsplash.com/photo-1631292171396-26a654f51c48?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMHJlZCUyMHRvbWF0b2VzJTIwaGFydmVzdHxlbnwxfHx8fDE3NTg1NTM5NjR8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    "postedDate": "2024-12-20"
  },
  {
    "id": "2",
    "farmerId": "farmer2",
    "farmerName": "Manjunath S",
    "farmerVillage": "Kochi",
    "cropName": "Onion",
    "quantity": 300,
    "pricePerKg": 18,
    "negotiable": false,
    "status": "available",
    "imageUrl": "https://images.unsplash.com/photo-1639172486437-28d0e1ce6493?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHxyZWQlMjBvbmlvbnMlMjBmcmVzaCUyMHZlZ2V0YWJsZXN8ZW58MXx8fHwxNzU4NTM3NDQ0fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    "postedDate": "2024-12-20"
  },
  {
    "id": "3",
    "farmerId": "farmer3",
    "farmerName": "Suresh Gowda",
    "farmerVillage": "Thrissur",
    "cropName": "Corn",
    "quantity": 750,
    "pricePerKg": 22,
    "negotiable": true,
    "status": "available",
    "imageUrl": "https://images.unsplash.com/photo-1757332914764-ca5a484c5fe1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMGNvcm4lMjBtYWl6ZSUyMGhhcnZlc3R8ZW58MXx8fHwxNzU4NTUzOTc1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    "postedDate": "2024-12-19"
  },
  {
    "id": "4",
    "farmerId": "farmer3",
    "farmerName": "Suresh Gowda",
    "farmerVillage": "Thrissur",
    "cropName": "Cabbage",
    "quantity": 200,
    "pricePerKg": 12,
    "negotiable": true,
    "status": "available",
    "imageUrl": "https://images.unsplash.com/photo-1587096677895-52478b441d9c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMGNhYmJhZ2UlMjB2ZWdldGFibGVzfGVufDF8fHx8MTc1ODU1Mzk3OXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    "postedDate": "2024-12-19"
  },
  {
    "id": "5",
    "farmerId": "farmer4",
    "farmerName": "Rajesh Naik",
    "farmerVillage": "Kottayam",
    "cropName": "Carrot",
    "quantity": 400,
    "pricePerKg": 30,
    "negotiable": false,
    "status": "available",
    "imageUrl": "https://images.unsplash.com/photo-1722456503963-f248c6f2c385?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMGNhcnJvdHMlMjBvcmFuZ2UlMjBoYXJ2ZXN0fGVufDF8fHx8MTc1ODU1Mzk4M3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    "postedDate": "2024-12-18"
  },
  {
    "id": "6",
    "farmerId": "farmer1",
    "farmerName": "NEERAJA",
    "farmerVillage": "Thiruvananthapuram",
    "cropName": "Green Beans",
    "quantity": 150,
    "pricePerKg": 35,
    "negotiable": true,
    "status": "available",
    "imageUrl": "https://images.unsplash.com/photo-1693667660388-7cccf194fc06?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMGdyZWVuJTIwYmVhbnMlMjB2ZWdldGFibGVzJTIwbmF0dXJhbCUyMGhhcnZlc3R8ZW58MXx8fHwxNzU4NjM2OTYyfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    "postedDate": "2024-12-18"
  },
  {
    "id": "7",
    "farmerId": "farmer2",
    "farmerName": "Manjunath S",
    "farmerVillage": "Kochi",
    "cropName": "Potato",
    "quantity": 600,
    "pricePerKg": 15,
    "negotiable": true,
    "status": "sold",
    "imageUrl": "https://images.unsplash.com/photo-1741517922282-45b999eb9e49?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMHBvdGF0b2VzJTIwaGFydmVzdHxlbnwxfHx8fDE3NTg1NTM5NzF8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    "postedDate": "2024-12-17"
  },
  {
    "id": "8",
    "farmerId": "farmer4",
    "farmerName": "Rajesh Naik",
    "farmerVillage": "Kottayam",
    "cropName": "Tomato",
    "quantity": 350,
    "pricePerKg": 28,
    "negotiable": false,
    "status": "pending",
    "imageUrl": "https://images.unsplash.com/photo-1631292171396-26a654f51c48?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMHJlZCUyMHRvbWF0b2VzJTIwaGFydmVzdHxlbnwxfHx8fDE3NTg1NTM5NjR8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    "postedDate": "2024-12-16"
  },
  {
    "id": "9",
    "farmerId": "farmer5",
    "farmerName": "Krishnan Pillai",
    "farmerVillage": "Palakkad",
    "cropName": "Rice",
    "quantity": 1000,
    "pricePerKg": 32,
    "negotiable": true,
    "status": "available",
    "imageUrl": "https://images.unsplash.com/photo-1607013844479-54e602a3373a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMHJpY2UlMjBncmFpbnMlMjBoYXJ2ZXN0fGVufDF8fHx8MTc1ODU1Mzk5Mnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    "postedDate": "2024-12-20"
  },
  {
    "id": "10",
    "farmerId": "farmer6",
    "farmerName": "Ramesh Kumar",
    "farmerVillage": "Malappuram",
    "cropName": "Spinach",
    "quantity": 80,
    "pricePerKg": 25,
    "negotiable": true,
    "status": "available",
    "imageUrl": "https://images.unsplash.com/photo-1602193815349-525071f27564?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMHNwaW5hY2glMjBncmVlbiUyMGxlYXZlc3xlbnwxfHx8fDE3NTg1NTQwMDB8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    "postedDate": "2024-12-19"
  },
  {
    "id": "11",
    "farmerId": "farmer7",
    "farmerName": "Sita Devi",
    "farmerVillage": "Idukki",
    "cropName": "Cauliflower",
    "quantity": 250,
    "pricePerKg": 20,
    "negotiable": false,
    "status": "available",
    "imageUrl": "https://images.unsplash.com/photo-1613743983303-b3e89f8a2b80?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMGNhdWxpZmxvd2VyJTIwdmVnZXRhYmxlfGVufDF8fHx8MTc1ODU1MDM1Mnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    "postedDate": "2024-12-19"
  },
  {
    "id": "12",
    "farmerId": "farmer8",
    "farmerName": "Mohan Nair",
    "farmerVillage": "Wayanad",
    "cropName": "Brinjal",
    "quantity": 300,
    "pricePerKg": 23,
    "negotiable": true,
    "status": "available",
    "imageUrl": "https://images.unsplash.com/photo-1694152417806-e42b0d469990?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMGJyaW5qYWwlMjBlZ2dwbGFudCUyMHB1cnBsZSUyMHZlZ2V0YWJsZSUyMG5hdHVyYWx8ZW58MXx8fHwxNzU4NjM2OTY4fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    "postedDate": "2024-12-18"
  },
  {
    "id": "13",
    "farmerId": "farmer9",
    "farmerName": "Priya Kumari",
    "farmerVillage": "Kannur",
    "cropName": "Okra",
    "quantity": 180,
    "pricePerKg": 32,
    "negotiable": true,
    "status": "available",
    "imageUrl": "https://images.unsplash.com/photo-1610210143623-417eda0cca0e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMG9rcmElMjBsYWRpZXMlMjBmaW5nZXIlMjBncmVlbnxlbnwxfHx8fDE3NTg1NTQwMTJ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    "postedDate": "2024-12-18"
  },
  {
    "id": "14",
    "farmerId": "farmer10",
    "farmerName": "Vinod Menon",
    "farmerVillage": "Kasaragod",
    "cropName": "Cucumber",
    "quantity": 220,
    "pricePerKg": 16,
    "negotiable": false,
    "status": "available",
    "imageUrl": "https://images.unsplash.com/photo-1725369865895-0dd4566c8864?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMGN1Y3VtYmVyJTIwZ3JlZW4lMjB2ZWdldGFibGVzfGVufDF8fHx8MTc1ODU1NDAxNnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    "postedDate": "2024-12-17"
  },
  {
    "id": "15",
    "farmerId": "farmer7",
    "farmerName": "Sita Devi",
    "farmerVillage": "Idukki",
    "cropName": "Chili",
    "quantity": 50,
    "pricePerKg": 65,
    "negotiable": true,
    "status": "available",
    "imageUrl": "https://images.unsplash.com/photo-1743193143066-29d976eb6edd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMHJlZCUyMGNoaWxpJTIwcGVwcGVyc3xlbnwxfHx8fDE3NTg1NTQwMTl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    "postedDate": "2024-12-17"
  }
];

export const MOCK_USERS: User[] = [
  {
    "id": "farmer1",
    "name": "NEERAJA",
    "phone": "+91 9876543210",
    "type": "farmer",
    "village": "Thiruvananthapuram",
    "aadharNumber": "1234-5678-9012",
    "rating": 4.5,
    "totalReviews": 23
  },
  {
    "id": "farmer2",
    "name": "Manjunath S",
    "phone": "+91 9876543211",
    "type": "farmer",
    "village": "Kochi",
    "aadharNumber": "2345-6789-0123",
    "rating": 4.2,
    "totalReviews": 18
  },
  {
    "id": "farmer3",
    "name": "Suresh Gowda",
    "phone": "+91 9876543214",
    "type": "farmer",
    "village": "Thrissur",
    "aadharNumber": "4567-8901-2345",
    "rating": 4.3,
    "totalReviews": 15
  },
  {
    "id": "farmer4",
    "name": "Rajesh Naik",
    "phone": "+91 9876543215",
    "type": "farmer",
    "village": "Kottayam",
    "aadharNumber": "5678-9012-3456",
    "rating": 4.6,
    "totalReviews": 27
  },
  {
    "id": "farmer5",
    "name": "Krishnan Pillai",
    "phone": "+91 9876543216",
    "type": "farmer",
    "village": "Palakkad",
    "aadharNumber": "7890-1234-5678",
    "rating": 4.7,
    "totalReviews": 34
  },
  {
    "id": "farmer6",
    "name": "Ramesh Kumar",
    "phone": "+91 9876543217",
    "type": "farmer",
    "village": "Malappuram",
    "aadharNumber": "8901-2345-6789",
    "rating": 4.1,
    "totalReviews": 12
  },
  {
    "id": "farmer7",
    "name": "Sita Devi",
    "phone": "+91 9876543218",
    "type": "farmer",
    "village": "Idukki",
    "aadharNumber": "9012-3456-7890",
    "rating": 4.8,
    "totalReviews": 41
  },
  {
    "id": "farmer8",
    "name": "Mohan Nair",
    "phone": "+91 9876543219",
    "type": "farmer",
    "village": "Wayanad",
    "aadharNumber": "0123-4567-8901",
    "rating": 4.4,
    "totalReviews": 19
  },
  {
    "id": "farmer9",
    "name": "Priya Kumari",
    "phone": "+91 9876543220",
    "type": "farmer",
    "village": "Kannur",
    "aadharNumber": "1357-2468-9012",
    "rating": 4.6,
    "totalReviews": 28
  },
  {
    "id": "farmer10",
    "name": "Vinod Menon",
    "phone": "+91 9876543221",
    "type": "farmer",
    "village": "Kasaragod",
    "aadharNumber": "2468-1357-9013",
    "rating": 4.2,
    "totalReviews": 16
  },
  {
    "id": "buyer1",
    "name": "TAMAN RK",
    "phone": "+91 9876543213",
    "type": "buyer",
    "village": "Kozhikode",
    "aadharNumber": "3456-7890-1234",
    "rating": 4.8,
    "totalReviews": 31
  },
  {
    "id": "buyer2",
    "name": "Suresh Traders",
    "phone": "+91 9876543212",
    "type": "buyer",
    "village": "Thiruvananthapuram",
    "aadharNumber": "6789-0123-4567",
    "rating": 4.5,
    "totalReviews": 45
  },
  {
    "id": "buyer3",
    "name": "Metro Fresh Foods",
    "phone": "+91 9876543222",
    "type": "buyer",
    "village": "Kochi",
    "aadharNumber": "3579-1357-2468",
    "rating": 4.9,
    "totalReviews": 67
  },
  {
    "id": "buyer4",
    "name": "Green Valley Traders",
    "phone": "+91 9876543223",
    "type": "buyer",
    "village": "Kozhikode",
    "aadharNumber": "4680-2468-1357",
    "rating": 4.6,
    "totalReviews": 52
  },
  {
    "id": "buyer5",
    "name": "Farm Direct Co.",
    "phone": "+91 9876543224",
    "type": "buyer",
    "village": "Thrissur",
    "aadharNumber": "5791-3579-2468",
    "rating": 4.7,
    "totalReviews": 38
  },
  {
    "id": "buyer6",
    "name": "Kerala Organics",
    "phone": "+91 9876543225",
    "type": "buyer",
    "village": "Kottayam",
    "aadharNumber": "6802-4680-3579",
    "rating": 4.4,
    "totalReviews": 29
  },
  {
    "id": "buyer7",
    "name": "Spice Route Exports",
    "phone": "+91 9876543226",
    "type": "buyer",
    "village": "Kochi",
    "aadharNumber": "7913-5791-4680",
    "rating": 4.8,
    "totalReviews": 73
  },
  {
    "id": "buyer8",
    "name": "Fresh Harvest Ltd",
    "phone": "+91 9876543227",
    "type": "buyer",
    "village": "Palakkad",
    "aadharNumber": "8024-6802-5791",
    "rating": 4.3,
    "totalReviews": 21
  },
  {
    "id": "buyer9",
    "name": "Coastal Vegetables",
    "phone": "+91 9876543228",
    "type": "buyer",
    "village": "Kollam",
    "aadharNumber": "9135-7913-6802",
    "rating": 4.6,
    "totalReviews": 44
  },
  {
    "id": "buyer10",
    "name": "Hill Station Produce",
    "phone": "+91 9876543229",
    "type": "buyer",
    "village": "Idukki",
    "aadharNumber": "0246-8024-7913",
    "rating": 4.5,
    "totalReviews": 33
  }
];

export const GOVERNMENT_PRICES: GovernmentPrice[] = [
  {
    "cropName": "Tomato",
    "minPrice": 20,
    "maxPrice": 30,
    "averagePrice": 25,
    "market": "Andhra Pradesh APMC",
    "date": "2024-12-20"
  },
  {
    "cropName": "Onion",
    "minPrice": 15,
    "maxPrice": 22,
    "averagePrice": 18,
    "market": "Andhra Pradesh APMC",
    "date": "2024-12-20"
  },
  {
    "cropName": "Potato",
    "minPrice": 12,
    "maxPrice": 18,
    "averagePrice": 15,
    "market": "Andhra Pradesh APMC",
    "date": "2024-12-20"
  },
  {
    "cropName": "Corn",
    "minPrice": 18,
    "maxPrice": 25,
    "averagePrice": 22,
    "market": "Andhra Pradesh APMC",
    "date": "2024-12-19"
  },
  {
    "cropName": "Cabbage",
    "minPrice": 8,
    "maxPrice": 15,
    "averagePrice": 12,
    "market": "Andhra Pradesh APMC",
    "date": "2024-12-19"
  },
  {
    "cropName": "Carrot",
    "minPrice": 25,
    "maxPrice": 35,
    "averagePrice": 30,
    "market": "Andhra Pradesh APMC",
    "date": "2024-12-18"
  },
  {
    "cropName": "Green Beans",
    "minPrice": 30,
    "maxPrice": 40,
    "averagePrice": 35,
    "market": "Andhra Pradesh APMC",
    "date": "2024-12-18"
  },
  {
    "cropName": "Rice",
    "minPrice": 28,
    "maxPrice": 35,
    "averagePrice": 32,
    "market": "Andhra Pradesh APMC",
    "date": "2024-12-20"
  },
  {
    "cropName": "Wheat",
    "minPrice": 22,
    "maxPrice": 28,
    "averagePrice": 25,
    "market": "Andhra Pradesh APMC",
    "date": "2024-12-20"
  },
  {
    "cropName": "Spinach",
    "minPrice": 20,
    "maxPrice": 30,
    "averagePrice": 25,
    "market": "Andhra Pradesh APMC",
    "date": "2024-12-19"
  },
  {
    "cropName": "Cauliflower",
    "minPrice": 15,
    "maxPrice": 25,
    "averagePrice": 20,
    "market": "Andhra Pradesh APMC",
    "date": "2024-12-19"
  },
  {
    "cropName": "Brinjal",
    "minPrice": 18,
    "maxPrice": 28,
    "averagePrice": 23,
    "market": "Andhra Pradesh APMC",
    "date": "2024-12-18"
  },
  {
    "cropName": "Okra",
    "minPrice": 25,
    "maxPrice": 40,
    "averagePrice": 32,
    "market": "Andhra Pradesh APMC",
    "date": "2024-12-18"
  },
  {
    "cropName": "Cucumber",
    "minPrice": 12,
    "maxPrice": 20,
    "averagePrice": 16,
    "market": "Andhra Pradesh APMC",
    "date": "2024-12-17"
  },
  {
    "cropName": "Chili",
    "minPrice": 50,
    "maxPrice": 80,
    "averagePrice": 65,
    "market": "Andhra Pradesh APMC",
    "date": "2024-12-17"
  }
];

export const CROP_IMAGES: Record<string, string> = {
  "Tomato": "https://images.unsplash.com/photo-1631292171396-26a654f51c48?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80",
  "Onion": "https://images.unsplash.com/photo-1639172486437-28d0e1ce6493?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80",
  "Corn": "https://images.unsplash.com/photo-1757332914764-ca5a484c5fe1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80",
  "Cabbage": "https://images.unsplash.com/photo-1587096677895-52478b441d9c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80",
  "Carrot": "https://images.unsplash.com/photo-1722456503963-f248c6f2c385?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80",
  "Green Beans": "https://images.unsplash.com/photo-1693667660388-7cccf194fc06?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80",
  "Potato": "https://images.unsplash.com/photo-1741517922282-45b999eb9e49?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80",
  "Rice": "https://images.unsplash.com/photo-1607013844479-54e602a3373a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80",
  "Wheat": "https://images.unsplash.com/photo-1680008703013-f5a32cc8ca2a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80",
  "Spinach": "https://images.unsplash.com/photo-1602193815349-525071f27564?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80",
  "Cauliflower": "https://images.unsplash.com/photo-1613743983303-b3e89f8a2b80?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80",
  "Brinjal": "https://images.unsplash.com/photo-1694152417806-e42b0d469990?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80",
  "Okra": "https://images.unsplash.com/photo-1610210143623-417eda0cca0e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80",
  "Cucumber": "https://images.unsplash.com/photo-1725369865895-0dd4566c8864?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80",
  "Chili": "https://images.unsplash.com/photo-1743193143066-29d976eb6edd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80"
};

export function getCropImage(cropName: string): string {
  return CROP_IMAGES[cropName] || "https://images.unsplash.com/photo-1631292171396-26a654f51c48?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80";
}

const Hn = (e: any, t: Language, r: any, i: string) => {
  const o: Record<Language, string[]> = {
    en: [
      `Thank you for your message about ${r.cropName}! I'm ${i}, and I'm here to help with all your questions.`,
      `Great to hear from you! My ${r.cropName} is fresh and ready. What would you like to know?`,
      `Hello! I appreciate your interest in my ${r.cropName}. Let me know how I can assist you better.`,
      `Thanks for reaching out! My ${r.cropName} is of excellent quality. Feel free to ask anything!`
    ],
    ml: [
      `${r.cropName} നെ കുറിച്ചുള്ള നിങ്ങളുടെ സന്ദേശത്തിന് നന്ദി! ഞാൻ ${i} ആണ്, നിങ്ങളുടെ എല്ലാ സംശയങ്ങൾക്കും ഉത്തരം നൽകാൻ ഇവിടെയുണ്ട്.`,
      `നിങ്ങളിൽ നിന്ന് കേൾക്കുന്നതിൽ സന്തോഷം! എന്റെ ${r.cropName} പുതുമയുള്ളതും തയ്യാറാണ്. എന്താണ് അറിയേണ്ടത്?`,
      `നമസ്കാരം! എന്റെ ${r.cropName} ൽ താല്പര്യം കാണിച്ചതിന് നന്ദി. എങ്ങനെ കൂടുതൽ സഹായിക്കാം?`
    ],
    hi: [
      `${r.cropName} के बारे में आपके संदेश के लिए धन्यवाद! मैं ${i} हूँ, आपकी सहायता के लिए यहाँ उपस्थित हूँ।`,
      `आपसे बात करके बहुत खुशी हुई! मेरी ${r.cropName} की फसल ताज़ा और तैयार है। आप क्या जानना चाहते हैं?`,
      `नमस्ते! ${r.cropName} में रुचि लेने के लिए धन्यवाद। मैं आपकी क्या मदद कर सकता हूँ?`,
      `संपर्क करने के लिए धन्यवाद! मेरी उपज की गुणवत्ता बहुत अच्छी है। कोई भी सवाल बेझिझक पूछें!`
    ],
    te: [
      `${r.cropName} గురించిన మీ సందేశానికి ధన్యవాదాలు! నేను ${i}, మీ ప్రశ్నలకు సమాధానం ఇవ్వడానికి ఇక్కడ ఉన్నాను.`,
      `మీతో మాట్లాడటం సంతోషంగా ఉంది! నా ${r.cropName} తాజాగా సిద్ధంగా ఉంది. మీరు ఏమి తెలుసుకోవాలనుకుంటున్నారు?`,
      `నమస్కారం! నా ${r.cropName} పై ఆసక్తి చూపినందుకు ధన్యవాదాలు. నేను మీకు ఎలా సహాయపడగలను?`,
      `సంప్రదించినందుకు ధన్యవాదాలు! మా పంట నాణ్యత చాలా బాగుంది. ఏదైనా నిస్సందేహంగా అడగండి!`
    ]
  };
  const list = o[t] || o.en;
  return list[Math.floor(Math.random() * list.length)];
};

// @ts-ignore
function generateChatReply(e,t,r,i,s,o) {let n=new Date,d=n.getHours(),l=n.getMonth(),h=n.getDay(),p=l>=3&&l<=5?"summer":l>=6&&l<=9?"monsoon":l>=10&&l<=2?"winter":"spring",y=d<6?"earlyMorning":d<12?"morning":d<17?"afternoon":d<20?"evening":"night",m=h===0||h===6,k=o.length,f=o.slice(-3).map(O=>O.message.toLowerCase()),g=f.some(O=>O.includes("price")||O.includes("cost")||O.includes("\u20B9")),v=f.some(O=>O.includes("quality")||O.includes("fresh")||O.includes("organic")),x=f.some(O=>O.includes("deliver")||O.includes("transport")||O.includes("send")),w=e.toLowerCase(),b=e.includes("?")||w.startsWith("how")||w.startsWith("when")||w.startsWith("where")||w.startsWith("what")||w.startsWith("why"),I=w.includes("urgent")||w.includes("quickly")||w.includes("asap")||w.includes("immediately"),L=w.includes("please")||w.includes("thank")||w.includes("sorry"),S=w.includes("price")||w.includes("cost")||w.includes("expensive")||w.includes("cheap")||w.includes("discount"),H=w.includes("quality")||w.includes("fresh")||w.includes("good")||w.includes("organic"),F={NEERAJA:{personality:"wise_grandmother",traits:["warm","experienced","caring","traditional","patient"],mood:k<3?"welcoming":L?"pleased":g?"business-focused":"friendly",expertise:["organic_farming","traditional_methods","family_recipes"],communication_style:"nurturing",en:{greeting:[`${y==="morning"?"Good morning, beta!":y==="evening"?"Good evening, dear!":"Hello, my child!"} I'm NEERAJA from Thiruvananthapuram. ${m?"Even on weekends, I take care of my precious vegetables!":""} You're asking about my ${i.cropName}? Come, let me tell you everything! \u{1F64F}`,`Namaskaram! I'm NEERAJA, your friendly neighborhood farmer. ${p==="monsoon"?"This monsoon season has blessed my "+i.cropName+" with extra freshness!":p==="summer"?"Despite the heat, my traditional farming keeps the "+i.cropName+" fresh and healthy!":"Perfect weather for growing the best "+i.cropName+"!"} How can I help you today?`,`Ayyo, another wonderful customer! \u{1F60A} I'm NEERAJA, and I've been growing vegetables with love for over 15 years. My ${i.cropName} are like my own children - grown with care, harvested with gratitude!`],price_responses:[`${g?"As I mentioned about pricing,":""} \u20B9${i.pricePerKg}/kg is very fair for organic quality, beta! ${I?"I understand you need it quickly - these are ready to harvest right now!":""} ${p==="monsoon"?"Monsoon vegetables need extra care, so pricing reflects the effort!":"Each rupee includes years of farming wisdom!"} ${i.pricePerKg>30?"Yes, premium price, but your family health is priceless!":"Very reasonable for this quality!"}`,`Market rate today is \u20B9${i.pricePerKg}/kg for premium organic ${i.cropName}. ${y==="morning"?"Morning prices are always honest!":""} ${L?"Thank you for asking so nicely!":""} No chemicals, only cow dung and grandmother's blessings! ${i.negotiable?"For bulk orders, we can discuss small adjustments.":"Fixed price ensures consistent quality for all customers."}`,`Beta, ${g?"regarding the pricing we discussed,":""} \u20B9${i.pricePerKg}/kg includes my 15 years of experience and traditional methods. ${b?"Good question!":""} These ${i.cropName} have no pesticides - completely safe for children and elderly!`],quality_responses:[`${v?"About quality - let me tell you more!":""} Quality is my life's pride! ${b?"Excellent question, dear!":""} My ${i.cropName} are grown like babies - organic manure, filtered well water, traditional Kerala methods. ${p==="monsoon"?"Monsoon makes them extra juicy and nutritious!":"Perfect growing conditions this season!"} ${L?"Thank you for caring about quality!":"Come visit my farm if you want to see yourself!"}`,`${v?"More about quality -":""} Beta, I guarantee 100% quality! ${I?"Even for urgent orders, quality never compromises!":""} My late husband always said "farming is like cooking - you put love, you get love." No harmful chemicals, only natural fertilizers. ${y==="evening"?"Evening harvest keeps them fresher overnight!":"Morning harvest ensures maximum freshness!"} Your family will taste the difference!`,`Quality? Hai! ${L?"So sweet of you to ask!":""} That's why my ${i.cropName} go to 5-star hotels in Trivandrum! ${b?"Want to know the secret?":""} Traditional organic methods passed down 3 generations. Even birds love eating from my farm! \u{1F426} ${v?"As I always say, quality speaks for itself!":""}`],delivery_responses:[`${x?"About delivery arrangements -":""} Of course, dear! ${I?"Urgent delivery? No problem!":""} I can deliver ${i.quantity}kg to you. ${y==="morning"?"Morning orders get same-day evening delivery!":y==="evening"?"Evening orders delivered fresh tomorrow morning!":"Perfect timing for quick delivery!"} ${m?"Weekend delivery available too!":""} My son helps with transport in our reliable pickup! \u{1F69A}`,`${x?"More delivery details -":""} Delivery? ${L?"Thank you for asking!":""} My nephew drives tempo, very careful with vegetables. ${p==="monsoon"?"Extra waterproof packing during rains!":p==="summer"?"Ice packs in summer heat!":"Perfect weather for safe transport!"} ${b?"Distance from Thiruvananthapuram?":""} Within 50km, same day delivery guaranteed!`,`${I?"Urgent delivery needed? I understand!":""} Beta, I've been delivering for 15 years - never disappointed! ${L?"Your politeness is appreciated!":""} Each ${i.cropName} wrapped with care. ${y==="morning"?"Morning deliveries include fresh dew!":""} Quality reaches you exactly as it leaves my farm!`],emotional_responses:[`${L?"Your good manners remind me of my own grandchildren!":""} ${I?"I can feel your urgency - let me help quickly!":""} ${b?"Such thoughtful questions - you really care about what you buy!":""} It makes my heart happy when customers appreciate good farming! \u{1F60A}`,`${k>5?"We are having such a nice conversation!":""} ${p==="winter"?"Winter vegetables carry extra blessings!":""} You know, farming teaches patience, but customers like you make it all worthwhile!`,`${v&&g?"I love customers who care about both quality and fair pricing!":""} ${m?"Working weekends is hard, but serving good customers is my joy!":""} Farming is not just business - it's sharing nature's gifts!`],contextual_responses:[`${y==="earlyMorning"?"Early morning customers are the best - they get the freshest picks!":y==="night"?"Late night chat? I love dedicated customers!":""} ${m?"Weekend farmers never rest - neither do our vegetables!":""} ${p==="monsoon"?"Monsoon brings challenges but also the most nutritious crops!":""}`,`${d>=12&&d<14?"Lunch time questions? Food is always on my mind too!":""} ${h===1?"Monday motivation - fresh start with fresh vegetables!":h===5?"Friday feeling - weekend cooking plans?":""} ${I?"Life moves fast, but good food needs good farming!":""}`,`${k===1?"First time chatting? Welcome to NEERAJA's family!":k>10?"We are becoming old friends through this chat!":""} ${o.some(O=>O.message.includes("family"))?"Family customers are always special to me!":""}`]},ml:{greeting:[`${y==="morning"?"\u0D38\u0D41\u0D2A\u0D4D\uFFFD\uFFFD\u0D2D\u0D3E\u0D24\u0D02 \u0D2E\u0D4B\u0D28\u0D47!":y==="evening"?"\u0D38\u0D41\u0D38\u0D28\u0D4D\u0D27\u0D4D\u0D2F \u0D15\u0D41\u0D1F\u0D4D\u0D1F\u0D3E!":"\u0D28\u0D2E\u0D38\u0D4D\u0D15\u0D3E\u0D30\u0D02!"} \u0D1E\u0D3E\u0D7B \u0D24\u0D3F\u0D30\u0D41\u0D35\u0D28\u0D28\u0D4D\u0D24\u0D2A\u0D41\u0D30\u0D24\u0D4D\u0D24\u0D46 \u0D28\u0D40\u0D30\u0D1C\u0D2F\u0D3E\u0D23\u0D4D. ${m?"\u0D35\u0D3E\u0D30\u0D3E\u0D28\u0D4D\u0D24\u0D4D\u0D2F\u0D19\u0D4D\u0D19\u0D33\u0D3F\u0D32\u0D41\u0D02 \u0D0E\u0D28\u0D4D\u0D31\u0D46 \u0D2A\u0D1A\u0D4D\u0D1A\u0D15\u0D4D\u0D15\u0D31\u0D3F\u0D15\u0D33\u0D46 \u0D2A\u0D30\u0D3F\u0D1A\u0D30\u0D3F\u0D15\u0D4D\u0D15\u0D41\u0D28\u0D4D\u0D28\u0D41!":""} \u0D0E\u0D28\u0D4D\u0D31\u0D46 ${i.cropName} \u0D28\u0D46 \u0D15\u0D41\u0D31\u0D3F\u0D1A\u0D4D\u0D1A\u0D4D \u0D1A\u0D4B\u0D26\u0D3F\u0D15\u0D4D\u0D15\u0D41\u0D28\u0D4D\u0D28\u0D4B? \u0D35\u0D30\u0D42, \u0D0E\u0D32\u0D4D\u0D32\u0D3E\u0D02 \u0D2A\u0D31\u0D1E\u0D4D\u0D1E\u0D41\u0D24\u0D30\u0D3E\u0D02! \u{1F64F}`,`\u0D28\u0D2E\u0D38\u0D4D\u0D15\u0D3E\u0D30\u0D02! \u0D28\u0D3F\u0D19\u0D4D\u0D19\u0D33\u0D41\u0D1F\u0D46 \u0D38\u0D57\u0D39\u0D43\u0D26 \u0D15\u0D7C\u0D37\u0D15 \u0D28\u0D40\u0D30\u0D1C\u0D2F\u0D3E\u0D23\u0D4D. ${p==="monsoon"?"\u0D08 \u0D2E\u0D34\u0D15\u0D4D\u0D15\u0D3E\u0D32\u0D02 \u0D0E\u0D28\u0D4D\u0D31\u0D46 "+i.cropName+" \u0D07\u0D28\u0D4D \u0D05\u0D27\u0D3F\u0D15 \u0D2A\u0D41\u0D24\u0D41\u0D2E \u0D28\u0D7D\u0D15\u0D3F\u0D2F\u0D3F\u0D30\u0D3F\u0D15\u0D4D\u0D15\u0D41\u0D28\u0D4D\u0D28\u0D41!":p==="summer"?"\u0D35\u0D47\u0D28\u0D7D \u0D1A\u0D42\u0D1F\u0D3F\u0D28\u0D4D\u0D31\u0D46 \u0D15\u0D4A\u0D1F\u0D41\u0D2E\u0D41\u0D1F\u0D3F\u0D2F\u0D3F\u0D32\u0D41\u0D02 \u0D2A\u0D30\u0D2E\u0D4D\u0D2A\u0D30\u0D3E\u0D17\u0D24 \u0D15\u0D43\u0D37\u0D3F\u0D2F\u0D3F\u0D32\u0D42\u0D1F\u0D46 "+i.cropName+" \u0D2A\u0D41\u0D24\u0D41\u0D2E\u0D2F\u0D4B\u0D1F\u0D46!":i.cropName+" \u0D35\u0D33\u0D7C\u0D24\u0D4D\u0D24\u0D3E\u0D7B \u0D05\u0D28\u0D41\u0D15\u0D42\u0D32 \u0D15\u0D3E\u0D32\u0D3E\u0D35\u0D38\u0D4D\u0D25!"} \u0D07\u0D28\u0D4D\u0D28\u0D4D \u0D0E\u0D19\u0D4D\u0D19\u0D28\u0D46 \u0D38\u0D39\u0D3E\u0D2F\u0D3F\u0D15\u0D4D\u0D15\u0D3E\u0D02?`],default:[`${L?"\u0D28\u0D3F\u0D19\u0D4D\u0D19\u0D33\u0D41\u0D1F\u0D46 \u0D2E\u0D30\u0D4D\u0D2F\u0D3E\u0D26\u0D2F\u0D41\u0D33\u0D4D\u0D33 \u0D38\u0D02\u0D38\u0D3E\u0D30\u0D02 \u0D0E\u0D28\u0D4D\u0D31\u0D46 \u0D15\u0D41\u0D1F\u0D4D\u0D1F\u0D3F\u0D15\u0D33\u0D46 \u0D13\u0D7C\u0D2E\u0D4D\u0D2E\u0D3F\u0D2A\u0D4D\u0D2A\u0D3F\u0D15\u0D4D\u0D15\u0D41\u0D28\u0D4D\u0D28\u0D41!":""} \u0D0E\u0D28\u0D4D\u0D31\u0D46 ${i.cropName} \u0D28\u0D46 \u0D15\u0D41\u0D31\u0D3F\u0D1A\u0D4D\u0D1A\u0D4D \u0D2E\u0D31\u0D4D\u0D31\u0D46\u0D28\u0D4D\u0D24\u0D46\u0D19\u0D4D\u0D15\u0D3F\u0D32\u0D41\u0D02 \u0D05\u0D31\u0D3F\u0D2F\u0D23\u0D4B? ${y==="evening"?"\u0D38\u0D28\u0D4D\u0D27\u0D4D\u0D2F\u0D3E \u0D38\u0D2E\u0D2F\u0D02 \u0D2A\u0D1A\u0D4D\u0D1A\u0D15\u0D4D\u0D15\u0D31\u0D3F \u0D35\u0D3E\u0D19\u0D4D\u0D19\u0D3E\u0D7B \u0D0F\u0D31\u0D4D\u0D31\u0D35\u0D41\u0D02 \u0D28\u0D32\u0D4D\u0D32 \u0D38\u0D2E\u0D2F\u0D02!":""} \u0D0E\u0D28\u0D4D\u0D31\u0D46 \u0D2B\u0D3E\u0D02 \u0D38\u0D28\u0D4D\u0D26\u0D7C\u0D36\u0D3F\u0D15\u0D4D\u0D15\u0D42 - \u0D15\u0D41\u0D1F\u0D41\u0D02\u0D2C\u0D24\u0D4D\u0D24\u0D4B\u0D1F\u0D4A\u0D2A\u0D4D\u0D2A\u0D02 \u0D35\u0D30\u0D42!`,`${k>5?"\u0D0E\u0D24\u0D4D\u0D30 \u0D28\u0D32\u0D4D\u0D32 \u0D38\u0D02\u0D2D\u0D3E\u0D37\u0D23\u0D02!":""} \u0D15\u0D43\u0D37\u0D3F\u0D2F\u0D46\u0D15\u0D4D\u0D15\u0D41\u0D31\u0D3F\u0D1A\u0D4D\u0D1A\u0D4D \u0D38\u0D02\u0D38\u0D3E\u0D30\u0D3F\u0D15\u0D4D\u0D15\u0D3E\u0D7B \u0D0E\u0D28\u0D3F\u0D15\u0D4D\u0D15\u0D4D \u0D0E\u0D2A\u0D4D\u0D2A\u0D4B\u0D34\u0D41\u0D02 \u0D07\u0D37\u0D4D\u0D1F\u0D2E\u0D3E\u0D23\u0D4D! ${b?"\u0D28\u0D32\u0D4D\u0D32 \u0D1A\u0D4B\u0D26\u0D4D\u0D2F\u0D02!":""} \u0D0E\u0D28\u0D4D\u0D31\u0D46 \u0D35\u0D3E\u0D1F\u0D4D\u0D38\u0D3E\u0D2A\u0D4D\u0D2A\u0D4D \u0D0E\u0D2A\u0D4D\u0D2A\u0D4B\u0D34\u0D41\u0D02 \u0D09\u0D2A\u0D2D\u0D4B\u0D15\u0D4D\u0D24\u0D3E\u0D15\u0D4D\u0D15\u0D7E\u0D15\u0D4D\u0D15\u0D4D \u0D32\u0D2D\u0D4D\u0D2F\u0D2E\u0D3E\u0D23\u0D4D!`]}},"Manjunath S":{personality:"tech_savvy_professional",traits:["efficient","modern","reliable","business-minded","innovative"],mood:k<2?"professional":S?"analytical":v?"confident":"friendly-business",expertise:["modern_farming","export_quality","technology","logistics"],communication_style:"professional_friendly",en:{greeting:[`${y==="morning"?"Good morning and great timing!":y==="evening"?"Good evening! Perfect time to discuss business!":"Hello there!"} Manjunath speaking from Kochi AgriTech Farm. ${m?"Weekend operations running smoothly!":""} You're interested in our export-quality ${i.cropName}? ${I?"Urgent requirement? We specialize in quick delivery!":"Excellent choice!"} We maintain international standards! \u{1F3C6}`,`Greetings! ${L?"Thank you for your courteous approach!":""} Manjunath here from coastal Kerala. Our ${i.cropName} meets stringent export standards! ${p==="monsoon"?"Monsoon challenges handled with controlled environment farming!":p==="summer"?"Summer quality maintained through climate control!":"Optimal growing conditions achieved!"} ${b?"Happy to answer all your questions!":""}`,`Professional greetings! ${k>1?"Continuing our discussion -":""} Manjunath S from advanced farming operations. ${I?"Time-sensitive requirements are our specialty!":""} Our ${i.cropName} supplies to premium hotels across South India! ISO certified, technologically advanced, customer-focused! \u{1F680}`],price_responses:[`${g?"Regarding our pricing structure -":""} Current market analysis: \u20B9${i.pricePerKg}/kg represents premium export-grade ${i.cropName}. ${b?"Detailed breakdown available!":""} ${i.pricePerKg>25?"Premium pricing reflects superior grading, cold storage, and international compliance!":"Competitive pricing for restaurant-grade quality!"} ${I?"Urgent orders maintain same quality standards!":""} ROI guaranteed through consistent quality!`,`${L?"Thank you for the pricing inquiry!":""} Professional rate: \u20B9${i.pricePerKg}/kg for Grade-A ${i.cropName}. ${p==="summer"?"Summer pricing includes climate control costs!":p==="monsoon"?"Monsoon protection adds value!":"Seasonal optimization complete!"} ${g?"As discussed earlier,":""} Bulk discounts available for 500kg+ orders. Investment in technology reflects in superior output!`,`${y==="afternoon"?"Afternoon pricing confirmed with fresh harvest data!":"Real-time market rates applied!"} \u20B9${i.pricePerKg}/kg for premium ${i.cropName}. ${I?"Expedited processing available!":""} Our advanced farming infrastructure justifies premium pricing. ${b?"Cost breakdown available on request!":""} Value proposition includes quality assurance and reliability!`],quality_responses:[`${v?"Quality assurance details -":""} Quality is our competitive advantage! ${b?"Excellent technical question!":""} ${i.cropName} undergoes comprehensive quality checks: soil analysis, water purity testing, growth monitoring, pesticide residue analysis, size grading, freshness verification, packaging standards. ${p==="winter"?"Winter produce shows enhanced nutritional profiles!":"Optimal quality parameters achieved!"} ${I?"Quality never compromised for speed!":""}`,`${L?"Appreciate your quality focus!":""} Export-standard quality guaranteed! ${v?"Building on our quality discussion -":""} Controlled environment farming, precision irrigation, soilless cultivation, automated monitoring systems ensure consistent ${i.cropName} quality. ${y==="morning"?"Morning harvest maintains peak freshness!":""} Laboratory certification available for every batch! \u{1F52C}`,`${k>3?"Continuing our quality conversation -":""} Systematic quality assurance implemented! GPS-tracked farming plots, blockchain growth data, certified organic inputs, farm-to-customer cold chain. ${b?"Technical specifications available!":""} Our ${i.cropName} quality surpasses imported varieties! ${I?"Emergency quality checks completed in 2 hours!":""} International compliance maintained!`],delivery_responses:[`${x?"Delivery logistics update -":""} Professional delivery network activated! ${I?"Urgent delivery protocols engaged!":""} Refrigerated fleet delivers ${i.quantity}kg anywhere in Kerala within 24 hours. ${y==="morning"?"Morning dispatch enables same-day delivery!":"Next-day morning delivery confirmed!"} Real-time tracking, temperature monitoring, quality guarantee upon delivery! \u{1F69B} ${L?"Thank you for trusting our logistics!":""}`,`${b?"Delivery query - here are the details!":""} Advanced logistics covering entire South India! ${i.quantity}kg handled through specialized transport with GPS tracking. ${p==="summer"?"Enhanced cooling protocols for summer!":p==="monsoon"?"Weather-resistant packaging systems!":"Optimal transport conditions maintained!"} ${x?"As mentioned previously,":""} Direct farm-to-customer in 18-36 hours maximum!`,`${k>2?"Regarding our delivery capabilities -":""} Restaurant-grade delivery standards! ${I?"Emergency delivery available!":""} Refrigerated trucks, trained drivers, quality maintenance protocols, 24/7 customer support. ${L?"Your professional approach is appreciated!":""} Daily deliveries to premium hotels - same standards for all customers! Perfect condition guaranteed! \u2705`],technology_responses:[`${b?"Great technology question!":""} Latest agritech implementation: IoT sensors monitoring soil moisture, automated irrigation systems, climate-controlled greenhouses, AI-powered crop health analysis. ${I?"Technology enables rapid response!":""} Technology ensures consistent ${i.cropName} quality! \u{1F916} ${k>5?"Technology discussion continues to fascinate!":""}`,`${v?"Technology supporting our quality -":""} Completely digitized operations! Drone monitoring, satellite imagery for crop analysis, mobile app for real-time updates, blockchain supply chain transparency. ${p==="monsoon"?"Weather monitoring systems optimize monsoon farming!":""} Modern farming for modern customers! ${L?"Thank you for appreciating innovation!":""}`,`${y==="afternoon"?"Afternoon tech update -":""} Smart farming infrastructure: automated climate control, precision nutrient delivery, predictive analytics for harvest timing. ${I?"Technology enables quick decision-making!":""} Data-driven farming produces superior ${i.cropName}! Innovation meets tradition! \u{1F4F1}`],business_responses:[`${g&&v?"Business partnership opportunity -":""} Professional partnerships our specialty! ${L?"Your business approach is commendable!":""} Regular supply contracts, volume discounts, quality guarantees, dedicated account management. ${b?"Business terms discussion?":""} Long-term ${i.cropName} requirements planning available! \u{1F4C8} ${I?"Flexible terms for urgent needs!":""}`,`${k>7?"Our business relationship developing well!":""} Efficiency-driven operations! ${b?"Business query - happy to elaborate!":""} Same-day quotations, 24-hour delivery commitment, quality certification with every batch, transparent pricing. ${m?"Weekend business support available!":""} Corporate clients demand reliability - we deliver! ${I?"Rapid response protocols activated!":""}`,`${L?"Professional courtesy appreciated!":""} Scalable business solutions! ${x?"Logistics supporting business growth -":""} Monthly supply planning, seasonal price agreements, quality consistency guarantees. ${y==="evening"?"Evening business discussions welcome!":""} Partnership approach to ${i.cropName} supply! Win-win business model! \u{1F91D}`]}}}[s];if(!F)return Hn(e,t,i,s);let X=F[t];if(!X)return Hn(e,t,i,s);let D={greeting:["hello","hi","hey","good morning","good evening","namaste","\u0D28\u0D2E\u0D38\u0D4D\u0D15\u0D3E\u0D30\u0D02","\u0D39\u0D3E\u0D2F\u0D4D","\u0D39\u0D32\u0D4B"],price:["price","cost","rate","expensive","cheap","money","rupees","\u0D35\u0D3F\u0D32","\u0D2A\u0D48\u0D38","\u0D30\u0D42\u0D2A","\u20B9"],quality:["quality","fresh","good","organic","chemical","pesticide","\u0D17\u0D41\u0D23\u0D02","\u0D2A\u0D41\u0D24\u0D41\u0D2E","\u0D13\u0D7C\u0D17\u0D3E\u0D28\u0D3F\u0D15\u0D4D"],delivery:["delivery","transport","send","ship","\u0D21\u0D46\u0D32\u0D3F\u0D35\u0D31\u0D3F","\u0D15\u0D4A\u0D23\u0D4D\u0D1F\u0D41\u0D35\u0D30\u0D3E\u0D7B","\u0D05\u0D2F\u0D15\u0D4D\u0D15\u0D3E\u0D7B"],quantity:["quantity","stock","available","how much","\u0D05\u0D33\u0D35\u0D4D","\u0D38\u0D4D\u0D31\u0D4D\u0D31\u0D4B\u0D15\u0D4D\u0D15\u0D4D","\u0D0E\u0D24\u0D4D\u0D30"],technology:["tech","modern","digital","automation","\u0D1F\u0D46\u0D15\u0D4D\u0D28\u0D4B\u0D33\u0D1C\u0D3F","\u0D06\u0D27\u0D41\u0D28\u0D3F\u0D15"],business:["business","contract","partnership","professional","\u0D2C\u0D3F\u0D38\u0D3F\u0D28\u0D38\u0D4D","\u0D15\u0D30\u0D3E\u0D7C"],emotional:["thank","sorry","please","appreciate","\u0D28\u0D28\u0D4D\u0D26\u0D3F","\u0D15\u0D4D\u0D37\u0D2E\u0D3F\u0D15\u0D4D\u0D15\u0D41\u0D15"]},B="default",se=0;Object.entries(D).forEach(([O,$])=>{let z=$.filter(De=>w.includes(De)).length;z>se&&(se=z,B=O)}),(k===0||D.greeting.some(O=>w.includes(O)))&&(B="greeting");let fe=B+"_responses",re=X[fe]||X.default||[];if(re.length||(s==="Manjunath S"?re=X.business_responses||X.technology_responses||X.default||[]:re=X.emotional_responses||X.contextual_responses||X.default||[]),re.length>0){let O=o[o.length-1]?.message||"",$=re[Math.floor(Math.random()*re.length)],z=0;for(;$.length>50&&$.substring(0,50)===O.substring(0,50)&&z<3;)$=re[Math.floor(Math.random()*re.length)],z++;return $}return Hn(e,t,i,s)}

export { generateChatReply };
