"use client";
import { motion } from "framer-motion";

interface UniversalLoaderProps {
  text?: string;
  className?: string;
}

export default function UniversalLoader({ text = "Loading data...", className = "" }: UniversalLoaderProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-12 w-full ${className}`}>
      <div className="relative flex items-center justify-center">
        {/* Outer Ring */}
        <motion.div
          className="w-16 h-16 border-4 border-gray-100 rounded-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
        
        {/* Spinning Segment */}
        <motion.div
          className="absolute w-16 h-16 border-4 border-t-gray-900 border-r-transparent border-b-transparent border-l-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "linear",
          }}
        />

        {/* Inner Pulse */}
        <motion.div
          className="absolute w-8 h-8 bg-gray-900/10 rounded-full"
          animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.3, 0.6, 0.3] }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>
      
      {text && (
        <motion.p
          className="mt-6 text-sm font-medium text-gray-400 tracking-widest uppercase"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {text}
        </motion.p>
      )}
    </div>
  );
}
