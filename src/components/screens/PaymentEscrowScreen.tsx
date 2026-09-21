import { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  ShieldCheck,
  CreditCard,
  Smartphone,
  Building,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Language, User, Produce } from '../../types';
import { paymentTranslations } from '../../data/translations';
import { LanguageSelector } from '../ui/LanguageSelector';

interface PaymentEscrowScreenProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  produce: Produce;
  buyer: User;
  agreedPrice?: number;
  onBack: () => void;
  onPaymentSuccess: (orderData: {
    orderId: string;
    produce: Produce;
    totalAmount: number;
    unitPrice: number;
  }) => void;
  getTranslatedCropName: (crop: string, lang: Language) => string;
  getTranslatedUserName: (name: string, lang: Language) => string;
}

export function PaymentEscrowScreen({
  language,
  onLanguageChange,
  produce,
  buyer,
  agreedPrice,
  onBack,
  onPaymentSuccess,
  getTranslatedCropName,
  getTranslatedUserName,
}: PaymentEscrowScreenProps) {
  const t = paymentTranslations[language];

  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [upiId, setUpiId] = useState('buyer@okhdfcbank');
  const [cardNumber, setCardNumber] = useState('4532 8901 2345 6789');
  const [cardExpiry, setCardExpiry] = useState('08/29');
  const [cardCvv, setCardCvv] = useState('789');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [orderId, setOrderId] = useState('');

  const unitPrice = agreedPrice || produce.pricePerKg;
  const subtotal = produce.quantity * unitPrice;
  const escrowFee = 0; // 0% commission guarantee
  const totalAmount = subtotal + escrowFee;

  const handlePay = async () => {
    setIsProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const generatedOrderId = 'ESCROW-' + Math.floor(100000 + Math.random() * 900000);
    setOrderId(generatedOrderId);
    setIsProcessing(false);
    setIsSuccess(true);
  };

  const handleProceedToDelivery = () => {
    onPaymentSuccess({
      orderId,
      produce,
      totalAmount,
      unitPrice,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/60 to-emerald-100/40 pb-20 text-gray-900">
      {/* Top Banner */}
      <div className="bg-emerald-600 text-white p-4 md:p-6 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              disabled={isProcessing}
              className="p-2 hover:bg-emerald-700 rounded-full transition-colors disabled:opacity-30"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">{t.payment}</h1>
          </div>

          <LanguageSelector
            language={language}
            onLanguageChange={onLanguageChange}
            variant="glass"
          />
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
        {isSuccess ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-6"
          >
            <Card className="shadow-2xl border-emerald-200 overflow-hidden">
              <CardContent className="p-8 space-y-6">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="h-12 w-12" />
                </div>

                <div>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 font-bold mb-2">
                    Escrow Locked & Guaranteed
                  </Badge>
                  <h2 className="text-2xl font-black text-gray-900">
                    ₹{totalAmount.toLocaleString()} Safe in Escrow
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">Transaction Ref: #{orderId}</p>
                </div>

                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-left space-y-2.5 text-sm">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold pb-1 border-b border-emerald-200">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span>How Escrow Protects You:</span>
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed">
                    1. The farmer is notified that full payment is held safely in escrow.
                  </p>
                  <p className="text-xs text-gray-700 leading-relaxed">
                    2. The farmer arranges immediate dispatch from {produce.farmerVillage}.
                  </p>
                  <p className="text-xs text-gray-700 leading-relaxed font-semibold text-emerald-900">
                    3. Money will NOT be released to the farmer until you verify delivery.
                  </p>
                </div>

                <Button
                  onClick={handleProceedToDelivery}
                  className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg rounded-xl shadow-lg shadow-emerald-600/20"
                >
                  Confirm Delivery & Track Order
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <>
            {/* Escrow Guarantee Banner */}
            <div className="bg-emerald-800 text-white p-4 md:p-5 rounded-2xl shadow-md border border-emerald-700 space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-emerald-300" />
                <h3 className="font-extrabold text-base md:text-lg">
                  {t.escrowTitle}
                </h3>
              </div>
              <p className="text-xs md:text-sm text-emerald-100 leading-relaxed">
                {t.escrowDesc}
              </p>
            </div>

            {/* Order Summary Card */}
            <Card className="shadow-md border-gray-100">
              <CardHeader className="border-b border-gray-100 pb-3">
                <CardTitle className="text-base text-gray-900">{t.orderSummary}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 md:p-6 space-y-3">
                <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                  <img
                    src={produce.imageUrl}
                    alt={produce.cropName}
                    className="w-14 h-14 rounded-xl object-cover border border-gray-100"
                  />
                  <div>
                    <h4 className="font-bold text-base text-gray-900">
                      {getTranslatedCropName(produce.cropName, language)}
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Farmer: {getTranslatedUserName(produce.farmerName, language)} ({produce.farmerVillage})
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-gray-600 pt-1">
                  <div className="flex justify-between">
                    <span>Quantity:</span>
                    <span className="font-semibold text-gray-900">{produce.quantity} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Price per kg:</span>
                    <span className="font-semibold text-emerald-700">₹{unitPrice} / kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Platform / Escrow Fee:</span>
                    <span className="font-semibold text-emerald-600">₹0 (Zero Commission)</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-100 text-base">
                    <span className="font-bold text-gray-900">Total Payable:</span>
                    <span className="font-black text-xl text-emerald-700">
                      ₹{totalAmount.toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Method Selector */}
            <Card className="shadow-md border-gray-100">
              <CardHeader className="border-b border-gray-100 pb-3">
                <CardTitle className="text-base text-gray-900">Select Payment Method</CardTitle>
              </CardHeader>
              <CardContent className="p-4 md:p-6 space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('upi')}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all text-xs font-bold ${
                      paymentMethod === 'upi'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <Smartphone className="h-5 w-5 text-emerald-600" />
                    <span>UPI / GPay</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all text-xs font-bold ${
                      paymentMethod === 'card'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <CreditCard className="h-5 w-5 text-emerald-600" />
                    <span>Debit Card</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('netbanking')}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all text-xs font-bold ${
                      paymentMethod === 'netbanking'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <Building className="h-5 w-5 text-emerald-600" />
                    <span>Net Banking</span>
                  </button>
                </div>

                {/* Form fields based on selected method */}
                {paymentMethod === 'upi' && (
                  <div className="space-y-2 pt-2">
                    <label className="block text-xs font-bold text-gray-700">UPI VPA ID</label>
                    <Input
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="username@okaxis / phone@upi"
                      className="h-12 font-medium text-sm"
                    />
                    <div className="flex gap-2 pt-1">
                      {['@okhdfcbank', '@okaxis', '@ybl', '@paytm'].map((handle) => (
                        <button
                          key={handle}
                          type="button"
                          onClick={() => setUpiId((prev) => prev.split('@')[0] + handle)}
                          className="text-[11px] bg-gray-100 hover:bg-emerald-100 hover:text-emerald-800 text-gray-600 px-2 py-0.5 rounded-md font-medium"
                        >
                          {handle}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {paymentMethod === 'card' && (
                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Card Number
                      </label>
                      <Input
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        placeholder="4532 0000 0000 0000"
                        className="h-12 font-mono tracking-wider text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Expiry</label>
                        <Input
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          placeholder="MM/YY"
                          className="h-12 text-sm text-center font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">CVV</label>
                        <Input
                          type="password"
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value)}
                          maxLength={3}
                          placeholder="•••"
                          className="h-12 text-sm text-center font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {paymentMethod === 'netbanking' && (
                  <div className="space-y-2 pt-2">
                    <label className="block text-xs font-bold text-gray-700">Select Bank</label>
                    <select className="w-full h-12 px-4 rounded-xl border border-gray-300 bg-white font-medium text-sm">
                      <option>State Bank of India (SBI)</option>
                      <option>Federal Bank</option>
                      <option>Kerala Gramin Bank</option>
                      <option>HDFC Bank</option>
                      <option>ICICI Bank</option>
                    </select>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pay Button */}
            <Button
              onClick={handlePay}
              disabled={isProcessing}
              className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  <span>Securing Escrow Funds...</span>
                </>
              ) : (
                <>
                  <Lock className="h-5 w-5" />
                  <span>Pay ₹{totalAmount.toLocaleString()} into Escrow</span>
                </>
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
