/**
 * FARMDirect Learning Centre. Every step describes the real screens and buttons
 * in the app. "needs" marks guides whose feature depends on a server service
 * that may not be configured on every installation.
 */
export type Audience = 'farmer' | 'buyer' | 'everyone';
export interface Tutorial {
  slug: string;
  title: string;
  audience: Audience;
  summary: string;
  before: string[];
  steps: { text: string; screen?: string }[];
  tips: string[];
  mistakes: string[];
  action: { label: string; to: string };
  needs?: string; // shown as an availability note
}

export const TUTORIALS: Tutorial[] = [
  {
    slug: 'create-farmer-account', title: 'Create a farmer account', audience: 'farmer',
    summary: 'Sign up with your mobile number. No password or documents are needed to start.',
    before: ['A mobile phone that can receive SMS', '2 minutes'],
    steps: [
      { text: 'Open FARMDirect and press "Get Started as a Farmer".', screen: 'Welcome' },
      { text: 'Type your name and your 10-digit mobile number. Choose your language.' },
      { text: 'Press "Send code". A 6-digit code comes by SMS.' },
      { text: 'Type the code, tick the box to agree to the privacy policy, and press "Create my account".' },
      { text: 'Step 2: choose your state, district, mandal and village. You can also search your village on the map.' },
      { text: 'Step 3 (optional): add your farm size and the crop you are growing.' },
      { text: 'Step 4 (optional): add a password and choose how we send you messages. Press "Finish".' },
    ],
    tips: ['Press the "Listen" button on any step to hear it read aloud.', 'Your answers are saved on your phone, so you can stop and continue later.', 'Owning land is not required. Tenant and sharecropping farmers can register.'],
    mistakes: ['Typing the number with +91 twice. Just type the 10 digits.', 'Waiting less than 30 seconds before pressing "Resend code".'],
    action: { label: 'Create my farmer account', to: '/register/farmer' },
  },
  {
    slug: 'farmer-verification', title: 'Complete farmer verification', audience: 'farmer',
    summary: 'Three simple levels. Level 2 lets you sell. Level 3 removes the per-order limit.',
    before: ['A FARMDirect farmer account', 'For level 3: any government photo ID (Aadhaar is not required)'],
    steps: [
      { text: 'Open the menu and choose "Verification".', screen: 'Account & verification' },
      { text: 'Level 1 (mobile verified) is done when you sign up.' },
      { text: 'Level 2: add your state, district and village in Settings. You can now publish produce for sale.' },
      { text: 'Level 3 (optional): choose an ID type, upload a clear photo or PDF, tick the consent box and press "Submit".' },
      { text: 'A FARMDirect reviewer checks it. You get a notification with the result.' },
    ],
    tips: ['If you use Aadhaar, upload a masked Aadhaar (only the last 4 digits visible).', 'Your ID is stored privately and seen only by the verification team.'],
    mistakes: ['Uploading a blurry photo – the reviewer will ask you to send it again.'],
    action: { label: 'Open my verification', to: '/account/verification' },
  },
  {
    slug: 'add-farm-and-crops', title: 'Add a farm and register crops', audience: 'farmer',
    summary: 'Tell FARMDirect about your land and crops to get a crop calendar and local advice.',
    before: ['A farmer account', 'Your sowing date'],
    steps: [
      { text: 'Open "My Farm" from the menu.', screen: 'My Farm' },
      { text: 'Press "Farm", type a name, and add the location using village search or GPS.' },
      { text: 'Press "Add crop", choose the crop, the sowing date and the season, and press "Save".' },
      { text: 'Open "Crop Calendar" to see the tasks FARMDirect created for each stage.' },
    ],
    tips: ['Add the farm location so weather and nearby storage work.', 'Crops not usually grown in your state are marked so you know advice may be less relevant.'],
    mistakes: ['Forgetting to set the location – weather cannot be shown without it.'],
    action: { label: 'Open My Farm', to: '/farm' },
  },
  {
    slug: 'weather-and-advisory', title: 'Use weather forecasts and crop advice', audience: 'farmer',
    summary: 'See the forecast for your farm and advice that matches your crop’s growth stage.',
    before: ['A farm with a location', 'At least one active crop for crop-specific advice'],
    steps: [
      { text: 'Open "Weather". The forecast for your farm loads automatically.', screen: 'Weather' },
      { text: 'Read "Recommendations for your crops" – for example when to irrigate or when it is safe to spray. Each one shows why.' },
      { text: 'Open "Crop Advisory" and choose "My crops" to read guidance for the current stage.' },
    ],
    tips: ['Weather comes from Open-Meteo forecasts. It is not an official IMD warning.', 'Advice marked "awaiting expert review" is general guidance.'],
    mistakes: ['Following a spray suggestion without checking the product label and your local agriculture officer.'],
    action: { label: 'Open Weather', to: '/weather' },
  },
  {
    slug: 'ask-medha-ai', title: 'Ask Medha AI a question', audience: 'everyone',
    summary: 'Medha AI answers farming questions using your farm, the real forecast and stored market prices.',
    before: ['A FARMDirect account'],
    steps: [
      { text: 'Open "Medha AI" from the menu.', screen: 'Medha AI' },
      { text: 'Type your question, or press the microphone and speak (on phones and browsers that support it).' },
      { text: 'Press send. Medha AI replies in your language and shows where facts came from.' },
      { text: 'Press "Listen" to hear the answer. Use the suggested buttons to open the right FARMDirect screen.' },
    ],
    tips: ['Ask one question at a time and mention your crop.', 'Medha AI never books, sells or pays for you. It shows you the screen where you can do it yourself.'],
    mistakes: ['Treating an AI answer as final for a serious problem – ask an expert for spreading diseases or chemical use.'],
    action: { label: 'Open Medha AI', to: '/assistant' },
    needs: 'Needs the AI service to be configured on the server. If it is not, Medha AI shows a clear notice instead of answering.',
  },
  {
    slug: 'identify-crop-disease', title: 'Identify a crop disease from a photo', audience: 'farmer',
    summary: 'Take a photo of a sick leaf. Crop Doctor gives a preliminary assessment and next steps.',
    before: ['A phone camera', 'Daylight'],
    steps: [
      { text: 'Open "Crop Doctor".', screen: 'Crop Doctor' },
      { text: 'Press "Take photo". Hold the phone close to one affected leaf, in daylight, in focus.' },
      { text: 'Choose your crop and the affected part. Describe what you see if you like.' },
      { text: 'Press "Analyse photo". Read the result, the confidence and the suggested next steps.' },
      { text: 'If confidence is low, press "Ask an expert" to send it to a verified agronomist.' },
    ],
    tips: ['You can also look up pests and diseases in the Field Guide.'],
    mistakes: ['A blurry or far-away photo. Crop Doctor will ask you to retake it.'],
    action: { label: 'Open Crop Doctor', to: '/crop-doctor' },
    needs: 'AI photo analysis needs the AI service configured on the server. Without it, your photo is saved and can still be sent to an expert.',
  },
  {
    slug: 'create-produce-listing', title: 'Create a produce listing', audience: 'farmer',
    summary: 'List your harvest in six short steps so verified buyers can make offers.',
    before: ['Level 2 verification (state, district and village in your profile)', 'Quantity and your price idea'],
    steps: [
      { text: 'Open "Sell Produce" and press "Sell my crop".', screen: 'Sell my crop' },
      { text: 'Choose the crop and variety.' },
      { text: 'Type the quantity and unit (quintal, kg or tonne). Choose whether buyers can buy part of it.' },
      { text: 'Type your price per unit, or leave it empty to receive offers.' },
      { text: 'Add the harvest date. Add grade, moisture and photos if you have them.' },
      { text: 'Check the summary and press "Publish".' },
    ],
    tips: ['Buyers see your village and district, never your phone number or address.', 'You can get your lot graded to give buyers more confidence (see "Understand crop grading").'],
    mistakes: ['Creating the same lot twice – FARMDirect blocks exact duplicates. Edit the existing lot instead.'],
    action: { label: 'Sell my crop', to: '/sell/new' },
  },
  {
    slug: 'find-buyers-compare-offers', title: 'Find buyers and compare offers', audience: 'farmer',
    summary: 'Answer verified buyers’ requirements and compare offers by the money you actually receive.',
    before: ['A published lot'],
    steps: [
      { text: 'Open "Market" and choose "Buyer requirements" to see what verified buyers need.', screen: 'Market' },
      { text: 'Open a requirement, choose your lot, and send an offer.' },
      { text: 'When a buyer offers on your lot, open it from "Orders & Payments". Accept, decline or counter.' },
      { text: 'On your lot page, read "Compare selling options" – offers, buyer requirements, mandi prices and storing to sell later, sorted by estimated net amount.' },
    ],
    tips: ['Costs FARMDirect does not know (for example transport without a quote) are shown as unknown, not guessed.'],
    mistakes: ['Choosing only by the highest price – check who pays transport and other charges in the breakdown.'],
    action: { label: 'See buyer requirements', to: '/market?tab=demand' },
  },
  {
    slug: 'find-nearby-storage', title: 'Find nearby storage and check a booking', audience: 'farmer',
    summary: 'Find verified warehouses or cold storage, see the price for your dates, and request a booking.',
    before: ['Your village location (or search for it)', 'Quantity and dates'],
    steps: [
      { text: 'Open "Storage".', screen: 'Nearby Storage' },
      { text: 'Choose your crop, quantity and dates, then press "Search". Use "Map" to see facilities around you.' },
      { text: 'Open a facility. In "Book storage", follow the three steps and press "Check price & space".' },
      { text: 'Read the estimate and the cancellation policy, then press "Confirm booking request".' },
      { text: 'The facility accepts or declines. When your produce arrives, a digital storage receipt appears on the booking.' },
    ],
    tips: ['Only facilities checked by FARMDirect can be booked.', 'You get a reminder 3 days before your storage period ends.'],
    mistakes: ['Booking without checking the minimum quantity and the facility’s crop types.'],
    action: { label: 'Find storage', to: '/storage' },
  },
  {
    slug: 'arrange-transport', title: 'Arrange transportation', audience: 'everyone',
    summary: 'Ask verified transporters for quotes for a confirmed order and track the trip milestones.',
    before: ['A confirmed order'],
    steps: [
      { text: 'Open the order in "Orders & Payments" and press "Arrange transport".', screen: 'Order' },
      { text: 'Check the pickup and drop addresses, quantity, date and who pays. Press "Request quotes".' },
      { text: 'Verified transporters send quotes. Open the transport request and press "Accept" on the one you choose.' },
      { text: 'The transporter records pickup and transit. The receiver presses "Confirm delivered" (or reports damage).' },
    ],
    tips: ['There is no live GPS tracking. You see the steps the transporter records.'],
    mistakes: ['Accepting a quote after it expired – ask for a new one.'],
    action: { label: 'Open my orders', to: '/trade?tab=orders' },
  },
  {
    slug: 'crop-grading', title: 'Understand crop grading and quality', audience: 'everyone',
    summary: 'Request an inspection so buyers can see a documented grade with evidence.',
    before: ['A produce lot', 'Clear photos of your produce'],
    steps: [
      { text: 'Open your lot from "Sell Produce" and press "Request grading".', screen: 'Lot' },
      { text: 'A verified inspector checks the lot against the crop’s criteria (for example moisture, foreign matter, damaged grains).' },
      { text: 'The inspector records the measurements, uploads photos and gives a grade with reasons.' },
      { text: 'Buyers see the grade, who inspected it and when. You can ask for a review if you disagree.' },
    ],
    tips: ['Grades on FARMDirect are recorded inspections, not official government certification.', 'Farmer-entered quality details are always labelled "reported by the farmer".'],
    mistakes: ['Expecting an automatic grade from a photo – grading is done by a person.'],
    action: { label: 'Open my lots', to: '/sell' },
  },
  {
    slug: 'review-market-prices', title: 'Review market prices', audience: 'everyone',
    summary: 'Compare official mandi prices, buyer bids and recent FARMDirect sales for your crop.',
    before: ['Nothing – anyone signed in can view prices'],
    steps: [
      { text: 'Open "Market" and choose "Compare prices".', screen: 'Compare prices' },
      { text: 'Choose your crop and state.' },
      { text: 'Read the three boxes: buyer bids, completed sales and farmer asking prices. Below them are official mandi prices with dates.' },
      { text: 'For more mandis and history, open "Mandi Prices".' },
    ],
    tips: ['Mandi prices are past arrival prices from Agmarknet, not live prices.'],
    mistakes: ['Comparing prices in different units – FARMDirect shows prices per quintal.'],
    action: { label: 'Compare prices', to: '/market?tab=prices' },
    needs: 'Official mandi prices need the data.gov.in key configured on the server.',
  },
  {
    slug: 'track-orders-payments', title: 'Track orders and payment status', audience: 'everyone',
    summary: 'Follow every order from confirmation to delivery and payment, with a printable statement.',
    before: ['An accepted offer'],
    steps: [
      { text: 'Open "Orders & Payments" and choose "Orders".', screen: 'Orders & Payments' },
      { text: 'Open an order. Both sides must press "Confirm order" before the quantity is final.' },
      { text: 'After delivery, the buyer records the quantity accepted. The payment due is updated.' },
      { text: 'The buyer presses "I have paid" after paying. The farmer presses "Confirm money received". Only then is it marked paid.' },
      { text: 'Press "Statement" to print or save a record of the order and payments.' },
    ],
    tips: ['FARMDirect does not hold money. Payments go directly between buyer and farmer.', 'Never share your UPI PIN or OTP with anyone.'],
    mistakes: ['Marking an order complete before payment is confirmed – FARMDirect will not allow it.'],
    action: { label: 'Open my orders', to: '/trade?tab=orders' },
  },
  {
    slug: 'verify-products-report', title: 'Verify products and report suspicious activity', audience: 'everyone',
    summary: 'Check that seeds or inputs are genuine, and report listings or people that look wrong.',
    before: ['The product pack with a FARMDirect verification code'],
    steps: [
      { text: 'Open "Verify Product". Press "Scan QR" or type the code printed under the QR.', screen: 'Verify Product' },
      { text: 'Read the result: genuine, already used (possible copy), or not verified.' },
      { text: 'If something is wrong, press "Report suspicious product".' },
      { text: 'To report a listing, buyer or facility, press the small "Report" link on its page.' },
    ],
    tips: ['A product without a FARMDirect code is not automatically fake – check the manufacturer’s own method too.'],
    mistakes: ['Ignoring "already used" – it can mean the pack was copied.'],
    action: { label: 'Verify a product', to: '/verify' },
  },
  {
    slug: 'buyer-account', title: 'Register and use a buyer account', audience: 'buyer',
    summary: 'Create a business account, get verified, then post requirements and make offers.',
    before: ['Mobile number', 'Business details; depending on your business: PAN, GSTIN, FSSAI, registration certificate'],
    steps: [
      { text: 'Press "Continue as a Buyer", then "Create a buyer account". Choose your buyer type.', screen: 'Buyer registration' },
      { text: 'Verify your mobile number with the SMS code.' },
      { text: 'On "Business verification", add business details and purchasing needs.' },
      { text: 'Upload the documents listed for your business type, accept the marketplace rules, and press "Submit for review".' },
      { text: 'After approval, open "Market" to make offers, or "My Requirements" to tell farmers what you need.' },
    ],
    tips: ['You can browse produce before verification.', 'Farmer phone numbers are shared only after both sides confirm an order.'],
    mistakes: ['Expecting instant approval – a reviewer checks your details.'],
    action: { label: 'Create a buyer account', to: '/register/buyer' },
  },
];
