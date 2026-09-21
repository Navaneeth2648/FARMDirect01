import { motion } from 'motion/react';
import { Leaf } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Loading Farm Direct...' }: LoadingScreenProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-green-100 flex items-center justify-center p-4">
      <div className="text-center">
        <motion.div
          className="relative mb-6"
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        >
          <div className="w-16 h-16 mx-auto bg-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-600/20">
            <Leaf className="h-8 w-8 text-white" />
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-1"
        >
          <h2 className="text-2xl font-bold text-emerald-950">Farm Direct</h2>
          <p className="text-emerald-700 text-sm font-medium">{message}</p>
        </motion.div>
        <motion.div
          className="flex justify-center space-x-1.5 mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {[0, 1, 2].map((dot) => (
            <motion.div
              key={dot}
              className="w-2.5 h-2.5 bg-emerald-600 rounded-full"
              animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1, repeat: Infinity, delay: dot * 0.2 }}
            />
          ))}
        </motion.div>
      </div>
    </div>
  );
}
