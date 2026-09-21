import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Phone,
  Send,
  Camera,
  Paperclip,
  Check,
  CheckCheck,
  CreditCard,
  IndianRupee,
  Mic,
  FileText,
  Sparkles,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Language, User, Produce, ChatMessage } from '../../types';
import { chatTranslations } from '../../data/translations';
import { generateChatReply } from '../../data/mockData';
import { LanguageSelector } from '../ui/LanguageSelector';

interface ChatScreenProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  produce: Produce;
  currentUser: User;
  partnerUser?: User;
  onBack: () => void;
  onNavigateToPayment: (produce: Produce, agreedPrice?: number) => void;
  getTranslatedCropName: (crop: string, lang: Language) => string;
  getTranslatedUserName: (name: string, lang: Language) => string;
}

export function ChatScreen({
  language,
  onLanguageChange,
  produce,
  currentUser,
  partnerUser,
  onBack,
  onNavigateToPayment,
  getTranslatedCropName,
  getTranslatedUserName,
}: ChatScreenProps) {
  const t = chatTranslations[language];

  const partner: User = partnerUser || {
    id: produce.farmerId,
    name: produce.farmerName,
    phone: '+91 94471 23456',
    type: currentUser.type === 'buyer' ? 'farmer' : 'buyer',
    village: produce.farmerVillage,
    aadharNumber: 'XXXX-XXXX-1234',
    rating: 4.8,
    totalReviews: 24,
  };

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'm1',
      senderId: partner.id,
      message:
        language === 'ml'
          ? `നമസ്കാരം! എന്റെ ${produce.cropName} വിളവെടുപ്പിനെക്കുറിച്ച് ചോദിച്ചതിന് നന്ദി. എന്താണ് അറിയേണ്ടത്?`
          : `Hello! Thank you for your interest in my ${produce.cropName}. How can I help you today?`,
      timestamp: '10:00 AM',
      type: 'text',
      status: 'read',
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerPrice, setOfferPrice] = useState(String(Math.max(1, produce.pricePerKg - 2)));
  const [agreedPrice, setAgreedPrice] = useState<number | null>(null);
  const [showCallingModal, setShowCallingModal] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const quickPrompts =
    language === 'ml'
      ? [
          'കൂടുതൽ അളവിന് കുറഞ്ഞ വില നൽകുമോ?',
          'വിളവെടുത്തത് ഇന്നാണോ?',
          'നേരിട്ട് കൃഷിയിടം സന്ദർശിക്കാമോ?',
          'ഡെലിവറി എങ്ങനെയാണ്?',
        ]
      : [
          'What is your best bulk price?',
          'Is this freshly harvested?',
          'Can I inspect at the farm?',
          'How is delivery handled?',
        ];

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: 'm_' + Date.now(),
      senderId: currentUser.id,
      message: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'text',
      status: 'sent',
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInputText('');
    setShowAttachMenu(false);

    // Simulate partner response
    setIsTyping(true);
    setTimeout(() => {
      try {
        const replyText = generateChatReply(
          text,
          language,
          partner.type,
          produce,
          partner.name,
          nextMessages
        );

        const replyMsg: ChatMessage = {
          id: 'm_reply_' + Date.now(),
          senderId: partner.id,
          message: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'text',
          status: 'read',
        };

        setMessages((prev) => [...prev, replyMsg]);
      } catch (err) {
        console.error('Chat simulation error:', err);
      } finally {
        setIsTyping(false);
      }
    }, 1200);
  };

  const handleSendOffer = () => {
    const num = parseFloat(offerPrice);
    if (!num || num <= 0) return;

    const offerMsg: ChatMessage = {
      id: 'm_offer_' + Date.now(),
      senderId: currentUser.id,
      message:
        language === 'ml'
          ? `ഒരു കിലോഗ്രാമിന് ₹${num} എന്ന വില ഞാൻ വാഗ്ദാനം ചെയ്യുന്നു.`
          : `I would like to offer ₹${num} per kg for this lot.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'offer',
      offerAmount: num,
      status: 'sent',
    };

    setMessages((prev) => [...prev, offerMsg]);
    setShowOfferModal(false);

    // Partner evaluation
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const isAccepted = num >= produce.pricePerKg * 0.88;
      if (isAccepted) {
        setAgreedPrice(num);
        const partnerMsg: ChatMessage = {
          id: 'm_reply_' + Date.now(),
          senderId: partner.id,
          message:
            language === 'ml'
              ? `നിങ്ങളുടെ വാഗ്ദാനം (₹${num}/kg) ഞാൻ സ്വീകരിക്കുന്നു! നമുക്ക് സുരക്ഷിതമായ എസ്ക്രോ പേയ്മെന്റിലേക്ക് പോകാം.`
              : `I accept your offer of ₹${num}/kg! We can now proceed with secure escrow payment.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'text',
          status: 'read',
        };
        setMessages((prev) => [...prev, partnerMsg]);
      } else {
        const counter = Math.round((num + produce.pricePerKg) / 2);
        const partnerMsg: ChatMessage = {
          id: 'm_reply_' + Date.now(),
          senderId: partner.id,
          message:
            language === 'ml'
              ? `ക്ഷമിക്കണം, ₹${num} വളരെ കുറവാണ്. ₹${counter}/kg ആണെങ്കിൽ എനിക്ക് നൽകാൻ സാധിക്കും.`
              : `Sorry, ₹${num}/kg is a bit too low for this grade. Can we settle on ₹${counter}/kg?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'text',
          status: 'read',
        };
        setMessages((prev) => [...prev, partnerMsg]);
      }
    }, 1500);
  };

  const handleAcceptOfferMessage = (offerAmount: number) => {
    setAgreedPrice(offerAmount);
    const acceptMsg: ChatMessage = {
      id: 'm_' + Date.now(),
      senderId: currentUser.id,
      message:
        language === 'ml'
          ? `₹${offerAmount}/kg എന്ന നിരക്ക് ഞാൻ അംഗീകരിച്ചു!`
          : `Agreed! I accept ₹${offerAmount}/kg. Proceeding with escrow booking.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'text',
      status: 'sent',
    };
    setMessages((prev) => [...prev, acceptMsg]);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900">
      {/* Top Header */}
      <div className="bg-emerald-600 text-white p-3 md:p-4 shadow-md sticky top-0 z-30">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1.5 hover:bg-emerald-700 rounded-full transition-colors"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-white text-base border border-white/30">
                {partner.name.charAt(0)}
              </div>
              <div>
                <h2 className="font-bold text-base leading-tight">
                  {getTranslatedUserName(partner.name, language)}
                </h2>
                <div className="flex items-center gap-1.5 text-xs text-emerald-100">
                  <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                  <span>{t.online || 'Online'}</span>
                  <span>•</span>
                  <span>{partner.village}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSelector
              language={language}
              onLanguageChange={onLanguageChange}
              variant="glass"
            />

            <Button
              onClick={() => setShowCallingModal(true)}
              size="sm"
              className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-full h-8 w-8 p-0 flex items-center justify-center"
            >
              <Phone className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Sticky produce summary pill */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 sticky top-[60px] z-20 shadow-xs">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src={produce.imageUrl}
              alt={produce.cropName}
              className="w-9 h-9 rounded-lg object-cover border border-gray-200"
            />
            <div>
              <span className="font-bold text-xs md:text-sm text-gray-900 block leading-tight">
                {getTranslatedCropName(produce.cropName, language)} ({produce.quantity} kg)
              </span>
              <span className="text-xs text-emerald-700 font-bold">
                ₹{agreedPrice || produce.pricePerKg} / kg {agreedPrice ? '(Agreed)' : ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowOfferModal(true)}
              size="sm"
              variant="outline"
              className="h-8 text-xs font-bold border-amber-500 text-amber-800 hover:bg-amber-50 px-2.5"
            >
              <IndianRupee className="h-3.5 w-3.5 mr-1 text-amber-600" />
              <span>{t.makeOffer || 'Make Offer'}</span>
            </Button>

            {currentUser.type === 'buyer' && (
              <Button
                onClick={() => onNavigateToPayment(produce, agreedPrice || produce.pricePerKg)}
                size="sm"
                className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3 shadow-xs"
              >
                <CreditCard className="h-3.5 w-3.5 mr-1" />
                <span>Pay Escrow</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-3xl mx-auto w-full">
        {/* Deal confirmation banner if agreed */}
        {agreedPrice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-100 border border-emerald-300 rounded-xl p-3.5 text-center text-emerald-900 shadow-sm"
          >
            <div className="flex items-center justify-center gap-2 font-bold text-sm">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              <span>Deal Agreed at ₹{agreedPrice} / kg!</span>
            </div>
            <p className="text-xs text-emerald-800 mt-0.5">
              Escrow payment holds your money safely until Kerala produce delivery is verified.
            </p>
          </motion.div>
        )}

        {messages.map((msg) => {
          const isMe = msg.senderId === currentUser.id;
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-md rounded-2xl px-4 py-2.5 shadow-sm text-sm ${
                  isMe
                    ? 'bg-emerald-600 text-white rounded-tr-xs'
                    : 'bg-white text-gray-900 border border-gray-200 rounded-tl-xs'
                }`}
              >
                {msg.type === 'offer' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-amber-200">
                      <IndianRupee className="h-4 w-4" />
                      <span>Special Price Offer</span>
                    </div>
                    <p className="text-sm">{msg.message}</p>
                    <div className="bg-black/15 p-2 rounded-lg text-center font-black text-lg">
                      ₹{msg.offerAmount} / kg
                    </div>
                    {!isMe && !agreedPrice && (
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          onClick={() => handleAcceptOfferMessage(msg.offerAmount!)}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs h-7 flex-1 font-bold"
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSendMessage('I cannot accept this offer. Can you adjust?')}
                          className="bg-white/20 text-white text-xs h-7 flex-1 border-white/30 hover:bg-white/30"
                        >
                          Decline
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                )}

                <div
                  className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                    isMe ? 'text-emerald-200' : 'text-gray-400'
                  }`}
                >
                  <span>{msg.timestamp}</span>
                  {isMe && (
                    <span>
                      {msg.status === 'read' ? (
                        <CheckCheck className="h-3 w-3 text-emerald-200" />
                      ) : (
                        <Check className="h-3 w-3 text-emerald-200" />
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="flex items-center gap-1 text-xs text-gray-500 bg-white border border-gray-200 rounded-full px-3 py-1.5 w-fit shadow-xs">
            <span className="font-semibold text-emerald-700">{partner.name}</span>
            <span>is typing</span>
            <span className="flex space-x-1 ml-1">
              <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce [animation-delay:0.4s]" />
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Inquiry Prompts */}
      <div className="bg-gray-100/80 px-4 py-2 border-t border-gray-200 overflow-x-auto no-scrollbar">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <span className="text-[11px] font-bold text-gray-500 flex-shrink-0 uppercase tracking-wider">
            Quick Inquiries:
          </span>
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(p)}
              className="text-xs bg-white text-gray-700 hover:bg-emerald-50 hover:text-emerald-800 border border-gray-200 rounded-full px-3 py-1 whitespace-nowrap font-medium transition-colors shadow-2xs"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Input bar */}
      <div className="bg-white border-t border-gray-200 p-3 relative sticky bottom-0 z-20 shadow-lg">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              className="p-2.5 text-gray-500 hover:text-emerald-700 hover:bg-gray-100 rounded-full transition-colors"
            >
              <Paperclip className="h-5 w-5" />
            </button>

            {showAttachMenu && (
              <div className="absolute bottom-12 left-0 bg-white rounded-2xl shadow-xl border border-gray-200 p-2 w-48 space-y-1 z-30">
                <button
                  onClick={() => {
                    handleSendMessage('📷 [Harvest Photo Sent for Quality Verification]');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-emerald-50 rounded-xl"
                >
                  <Camera className="h-4 w-4 text-emerald-600" />
                  <span>Harvest Photo</span>
                </button>
                <button
                  onClick={() => {
                    handleSendMessage('📄 [Andra Pradesh APMC Mandi Receipt Attached]');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-emerald-50 rounded-xl"
                >
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span>Mandi Receipt</span>
                </button>
                <button
                  onClick={() => {
                    handleSendMessage('🎙️ [Voice Note: 14s recorded]');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-emerald-50 rounded-xl"
                >
                  <Mic className="h-4 w-4 text-amber-600" />
                  <span>Voice Note</span>
                </button>
              </div>
            )}
          </div>

          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSendMessage();
            }}
            placeholder={t.typeMessage || 'Type your message...'}
            className="flex-1 h-11 bg-gray-50 border-gray-200 rounded-xl text-sm"
          />

          <Button
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 w-11 p-0 flex items-center justify-center shadow-sm disabled:opacity-40"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Offer Modal */}
      {showOfferModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-100"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-1">Make Custom Price Offer</h3>
            <p className="text-xs text-gray-500 mb-4">
              Current listing price is ₹{produce.pricePerKg}/kg. Enter your proposed price.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Offered Price (₹ / kg)
              </label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="number"
                  value={offerPrice}
                  onChange={(e) => setOfferPrice(e.target.value)}
                  className="pl-10 h-12 text-lg font-bold text-emerald-800"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowOfferModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendOffer}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                Send Offer
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Simulated Call Modal */}
      {showCallingModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-8 max-w-xs w-full text-center shadow-2xl space-y-4"
          >
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-700 animate-pulse">
              <Phone className="h-10 w-10" />
            </div>
            <div>
              <h3 className="font-bold text-xl text-gray-900">{partner.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{partner.phone}</p>
              <p className="text-emerald-600 text-sm font-semibold mt-2 animate-bounce">
                Calling farmer directly...
              </p>
            </div>
            <Button
              onClick={() => setShowCallingModal(false)}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl"
            >
              End Call
            </Button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
