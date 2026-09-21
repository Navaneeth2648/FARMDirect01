const fs = require("fs");
const path = require("path");

const raw = JSON.parse(fs.readFileSync("extracted_data.json", "utf8"));

// Clean up helper to eval safe JS objects
function evalObj(str) {
  const Oe = (en, ml) => ({ en, ml });
  const te = (en, ml) => ({ en, ml });
  return eval("(" + str + ")");
}

const welcomeTrans = evalObj(raw.welcomeTrans);
const onboardingTrans = evalObj(raw.onboardingTrans);
const farmerDashTrans = evalObj(raw.farmerDashTrans);
const buyerMarketTrans = evalObj(raw.buyerMarketTrans);
const addProduceTrans = evalObj(raw.addProduceTrans);
const listingDetailTrans = evalObj(raw.listingDetailTrans);
const chatTrans = evalObj(raw.chatTrans);
const paymentTrans = evalObj(raw.paymentTrans);
const deliveryTrans = evalObj(raw.deliveryTrans);
const cropsTrans = evalObj(raw.cropsTrans);
const namesTrans = evalObj(raw.namesTrans);
const villagesTrans = evalObj(raw.villagesTrans);
const mockUsers = evalObj(raw.mockUsers);
const mockProduce = evalObj(raw.mockProduce);
const govtPrices = evalObj(raw.govtPrices);

// Ensure src/data exists
if (!fs.existsSync("src/data")) {
  fs.mkdirSync("src/data", { recursive: true });
}

// 1. Write src/data/translations.ts
const translationsTs = `// Translations for English and Malayalam
export const welcomeTranslations = ${JSON.stringify(welcomeTrans, null, 2)};

export const onboardingTranslations = ${JSON.stringify(onboardingTrans, null, 2)};

export const farmerDashTranslations = ${JSON.stringify(farmerDashTrans, null, 2)};

export const buyerMarketTranslations = ${JSON.stringify(buyerMarketTrans, null, 2)};

export const addProduceTranslations = ${JSON.stringify(addProduceTrans, null, 2)};

export const listingDetailTranslations = ${JSON.stringify(listingDetailTrans, null, 2)};

export const chatTranslations = ${JSON.stringify(chatTrans, null, 2)};

export const paymentTranslations = ${JSON.stringify(paymentTrans, null, 2)};

export const deliveryTranslations = ${JSON.stringify(deliveryTrans, null, 2)};

export const cropsTranslations: Record<string, { en: string; ml: string }> = ${JSON.stringify(cropsTrans, null, 2)};

export const namesTranslations: Record<string, { en: string; ml: string }> = ${JSON.stringify(namesTrans, null, 2)};

export const villagesTranslations: Record<string, { en: string; ml: string }> = ${JSON.stringify(villagesTrans, null, 2)};

export function getCropTranslation(crop: string, lang: 'en' | 'ml'): string {
  const item = cropsTranslations[crop];
  return item ? item[lang] : crop;
}

export function getNameTranslation(name: string, lang: 'en' | 'ml'): string {
  const item = namesTranslations[name];
  return item ? item[lang] : name;
}

export function getVillageTranslation(village: string, lang: 'en' | 'ml'): string {
  const item = villagesTranslations[village];
  return item ? item[lang] : village;
}
`;

fs.writeFileSync("src/data/translations.ts", translationsTs);
console.log("translations.ts created");

// 2. Write src/data/mockData.ts
const cropImages = {
  Tomato: "https://images.unsplash.com/photo-1631292171396-26a654f51c48?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80",
  Onion: "https://images.unsplash.com/photo-1639172486437-28d0e1ce6493?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80",
  Corn: "https://images.unsplash.com/photo-1757332914764-ca5a484c5fe1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80",
  Cabbage: "https://images.unsplash.com/photo-1587096677895-52478b441d9c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80",
  Carrot: "https://images.unsplash.com/photo-1722456503963-f248c6f2c385?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80",
  "Green Beans": "https://images.unsplash.com/photo-1693667660388-7cccf194fc06?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80",
  Potato: "https://images.unsplash.com/photo-1741517922282-45b999eb9e49?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80",
  Rice: "https://images.unsplash.com/photo-1607013844479-54e602a3373a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80",
  Wheat: "https://images.unsplash.com/photo-1680008703013-f5a32cc8ca2a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80",
  Spinach: "https://images.unsplash.com/photo-1602193815349-525071f27564?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80",
  Cauliflower: "https://images.unsplash.com/photo-1613743983303-b3e89f8a2b80?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80",
  Brinjal: "https://images.unsplash.com/photo-1694152417806-e42b0d469990?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80",
  Okra: "https://images.unsplash.com/photo-1610210143623-417eda0cca0e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80",
  Cucumber: "https://images.unsplash.com/photo-1725369865895-0dd4566c8864?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80",
  Chili: "https://images.unsplash.com/photo-1743193143066-29d976eb6edd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80"
};

const mockDataTs = `import { Produce, User, GovernmentPrice, Language, ChatMessage, UserType } from '../types';

export const INITIAL_PRODUCE: Produce[] = ${JSON.stringify(mockProduce, null, 2)};

export const MOCK_USERS: User[] = ${JSON.stringify(mockUsers, null, 2)};

export const GOVERNMENT_PRICES: GovernmentPrice[] = ${JSON.stringify(govtPrices, null, 2)};

export const CROP_IMAGES: Record<string, string> = ${JSON.stringify(cropImages, null, 2)};

export function getCropImage(cropName: string): string {
  return CROP_IMAGES[cropName] || "https://images.unsplash.com/photo-1631292171396-26a654f51c48?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080&q=80";
}

const Hn = (e: any, t: 'en' | 'ml', r: any, i: string) => {
  const o: Record<'en' | 'ml', string[]> = {
    en: [
      \`Thank you for your message about \${r.cropName}! I'm \${i}, and I'm here to help with all your questions.\`,
      \`Great to hear from you! My \${r.cropName} is fresh and ready. What would you like to know?\`,
      \`Hello! I appreciate your interest in my \${r.cropName}. Let me know how I can assist you better.\`,
      \`Thanks for reaching out! My \${r.cropName} is of excellent quality. Feel free to ask anything!\`
    ],
    ml: [
      \`\${r.cropName} നെ കുറിച്ചുള്ള നിങ്ങളുടെ സന്ദേശത്തിന് നന്ദി! ഞാൻ \${i} ആണ്, നിങ്ങളുടെ എല്ലാ സംശയങ്ങൾക്കും ഉത്തരം നൽകാൻ ഇവിടെയുണ്ട്.\`,
      \`നിങ്ങളിൽ നിന്ന് കേൾക്കുന്നതിൽ സന്തോഷം! എന്റെ \${r.cropName} പുതുമയുള്ളതും തയ്യാറാണ്. എന്താണ് അറിയേണ്ടത്?\`,
      \`നമസ്കാരം! എന്റെ \${r.cropName} ൽ താല്പര്യം കാണിച്ചതിന് നന്ദി. എങ്ങനെ കൂടുതൽ സഹായിക്കാം?\`
    ]
  };
  const list = o[t] || o.en;
  return list[Math.floor(Math.random() * list.length)];
};

// @ts-ignore
${raw.llFunction}

export { generateChatReply };
`;

fs.writeFileSync("src/data/mockData.ts", mockDataTs);
console.log("mockData.ts created");
