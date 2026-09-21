import { useState } from 'react';
import { motion } from 'motion/react';
import {
  ShieldCheck,
  CheckCircle2,
  Truck,
  Star,
  PackageCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Language, User, Produce } from '../../types';
import { deliveryTranslations } from '../../data/translations';
import { LanguageSelector } from '../ui/LanguageSelector';

interface DeliveryConfirmationScreenProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  orderData: {
    orderId: string;
    produce: Produce;
    totalAmount: number;
    unitPrice: number;
  };
  buyer: User;
  onFinish: () => void;
  getTranslatedCropName: (crop: string, lang: Language) => string;
  getTranslatedUserName: (name: string, lang: Language) => string;
}

export function DeliveryConfirmationScreen({
  language,
  onLanguageChange,
  orderData,
  buyer,
  onFinish,
  getTranslatedCropName,
  getTranslatedUserName,
}: DeliveryConfirmationScreenProps) {
  const t = deliveryTranslations[language];

  const [deliveryConfirmed, setDeliveryConfirmed] = useState(false);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('Excellent fresh produce delivered directly from the farm!');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  const handleConfirmDelivery = () => {
    setDeliveryConfirmed(true);
  };

  const handleSubmitReview = async () => {
    setIsSubmittingReview(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setIsSubmittingReview(false);
    setReviewSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/60 to-emerald-100/40 pb-20 text-gray-900">
      {/* Top Banner */}
      <div className="bg-emerald-600 text-white p-4 md:p-6 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">{t.delivery}</h1>
            <p className="text-xs text-emerald-100 mt-0.5">Order #{orderData.orderId}</p>
          </div>

          <LanguageSelector
            language={language}
            onLanguageChange={onLanguageChange}
            variant="glass"
          />
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
        {/* Order Details Mini Card */}
        <Card className="shadow-md border-gray-100">
          <CardContent className="p-4 md:p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={orderData.produce.imageUrl}
                alt={orderData.produce.cropName}
                className="w-14 h-14 rounded-xl object-cover border border-gray-100"
              />
              <div>
                <h3 className="font-bold text-base text-gray-900">
                  {getTranslatedCropName(orderData.produce.cropName, language)}
                </h3>
                <p className="text-xs text-gray-500">
                  {orderData.produce.quantity} {t.kg} • {t.farmerDetails}:{' '}
                  {getTranslatedUserName(orderData.produce.farmerName, language)}
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs text-gray-400 block">{t.amount}</span>
              <span className="font-black text-lg text-emerald-700">
                ₹{orderData.totalAmount.toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Order Progression Status */}
        <Card className="shadow-md border-gray-100">
          <CardHeader className="border-b border-gray-100 pb-3">
            <CardTitle className="text-base text-gray-900">{t.orderStatus}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 space-y-4">
            <div className="space-y-4 relative">
              {/* Vertical line connecting steps */}
              <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-emerald-200" />

              {/* Step 1: Payment Held */}
              <div className="flex items-start gap-4 relative z-10">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900">
                    {t.paymentHeld}
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    ₹{orderData.totalAmount.toLocaleString()} secured safely by platform guarantee.
                  </p>
                </div>
              </div>

              {/* Step 2: In Transit */}
              <div className="flex items-start gap-4 relative z-10">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${
                    deliveryConfirmed
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  <Truck className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900">
                    {t.awaitingDelivery}
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Farmer dispatched harvest from {orderData.produce.farmerVillage}.
                  </p>
                </div>
              </div>

              {/* Step 3: Payment Release */}
              <div className="flex items-start gap-4 relative z-10">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${
                    deliveryConfirmed
                      ? 'bg-emerald-600 text-white animate-bounce'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  <PackageCheck className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900">
                    {t.deliveryComplete}
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {deliveryConfirmed
                      ? 'Payment of ₹' + orderData.totalAmount.toLocaleString() + ' released directly to farmer.'
                      : 'Waiting for your inspection and confirmation.'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action button: Confirm Delivery */}
        {!deliveryConfirmed ? (
          <div className="space-y-3">
            <Button
              onClick={handleConfirmDelivery}
              className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-3"
            >
              <CheckCircle2 className="h-6 w-6" />
              <span>{t.confirmButton}</span>
            </Button>
            <p className="text-xs text-center text-gray-500">
              {t.confirmationText}
            </p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            {/* Payment Released Feedback Banner */}
            <div className="bg-emerald-100 border border-emerald-300 rounded-2xl p-4 text-center space-y-1 shadow-sm">
              <div className="flex items-center justify-center gap-2 text-emerald-900 font-extrabold text-base">
                <ShieldCheck className="h-5 w-5 text-emerald-700" />
                <span>{t.paymentReleased}</span>
              </div>
              <p className="text-xs text-emerald-800">
                {t.thankYou}
              </p>
            </div>

            {/* Rating and Review Card */}
            {!reviewSubmitted ? (
              <Card className="shadow-md border-gray-100">
                <CardHeader className="border-b border-gray-100 pb-3 text-center">
                  <CardTitle className="text-base text-gray-900">
                    {t.rateExperience}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-5">
                  {/* Star Rating Selector */}
                  <div className="flex justify-center items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1.5 focus:outline-none transition-transform hover:scale-125"
                      >
                        <Star
                          className={`h-8 w-8 ${
                            (hoverRating || rating) >= star
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      {t.writeReview}
                    </label>
                    <Textarea
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value.slice(0, 200))}
                      placeholder="Share your experience regarding harvest freshness, weight, and communication..."
                      className="text-sm min-h-[90px]"
                    />
                    <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                      <span>Helpful for other Kerala buyers</span>
                      <span>{reviewText.length}/200</span>
                    </div>
                  </div>

                  <Button
                    onClick={handleSubmitReview}
                    disabled={isSubmittingReview}
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md"
                  >
                    {isSubmittingReview ? 'Submitting Review...' : t.submitReview}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-md border-emerald-100 text-center p-6 space-y-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900">Review Submitted!</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Your verified review helps build trust across Kerala's farming community.
                  </p>
                </div>
                <Button
                  onClick={onFinish}
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  Return to Marketplace
                </Button>
              </Card>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
