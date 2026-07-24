import { motion } from "framer-motion";
import { Sparkles, BookOpen, Star, Rocket, Shield, Sword } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { useLanguage } from "../contexts/LanguageContext";

const heroImages = [
  {
    src: "/images/magic/science.png",
    alt: "Magical Science",
    className: "w-24 h-24 sm:w-36 sm:h-36",
    delay: 0.2,
    icon: Rocket,
    color: "text-blue-400",
    left: "5%",
    smLeft: "5%",
    top: "5%",
    smTop: "10%",
    rotate: -10
  },
  {
    src: "/images/magic/princess.png",
    alt: "Fairy Tale Princess",
    className: "w-28 h-28 sm:w-44 sm:h-44",
    delay: 0.4,
    icon: Star,
    color: "text-pink-400",
    left: "20%",
    smLeft: "22%",
    top: "35%",
    smTop: "35%",
    rotate: 5
  },
  {
    src: "/images/magic/dragon.png",
    alt: "Fire Dragon",
    className: "w-32 h-32 sm:w-48 sm:h-48",
    delay: 0.6,
    icon: Sparkles,
    color: "text-orange-500",
    left: "40%",
    smLeft: "45%",
    top: "5%",
    smTop: "5%",
    rotate: -5
  },
  {
    src: "/images/magic/history.png", // History
    alt: "Ancient History",
    className: "w-24 h-24 sm:w-36 sm:h-36",
    delay: 0.8,
    icon: BookOpen,
    color: "text-yellow-600",
    left: "60%",
    smLeft: "68%",
    top: "40%",
    smTop: "40%",
    rotate: 10
  },
  {
    src: "/images/magic/warrior.png", // Warrior
    alt: "Brave Warrior",
    className: "w-26 h-26 sm:w-40 sm:h-40",
    delay: 1.0,
    icon: Shield,
    color: "text-gray-400",
    left: "75%",
    smLeft: "82%",
    top: "10%",
    smTop: "10%",
    rotate: -12
  }
];

export function MagicalHero() {
  const { t } = useLanguage();
  return (
    <div className="relative overflow-hidden py-16 sm:py-24">
      {/* Background magical elements */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{ duration: 8, repeat: Infinity }}
          className="absolute -top-24 -left-24 w-96 h-96 bg-purple-500 rounded-full blur-[100px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.1, 0.15, 0.1],
          }}
          transition={{ duration: 10, repeat: Infinity, delay: 1 }}
          className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-500 rounded-full blur-[100px]"
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex flex-col items-center">
          {/* Animated floating image grid */}
          <div className="relative w-full max-w-5xl h-80 sm:h-96 mb-16 flex items-center justify-center">
            {heroImages.map((image, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.5, y: 50, rotate: image.rotate - 10 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: [0, -15, 0],
                  rotate: image.rotate
                }}
                transition={{
                  scale: { delay: image.delay, duration: 0.6, type: "spring", stiffness: 100 },
                  opacity: { delay: image.delay, duration: 0.5 },
                  y: {
                    duration: 4 + Math.random() * 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  },
                  rotate: {
                    delay: image.delay,
                    duration: 0.5
                  }
                }}
                className={`absolute ${image.className} rounded-2xl overflow-hidden shadow-2xl border-4 border-white/80 backdrop-blur-sm group cursor-pointer hover:z-50 sm:left-[var(--sm-left)] sm:top-[var(--sm-top)]`}
                style={{
                  left: image.left,
                  top: image.top,
                  '--sm-left': image.smLeft,
                  '--sm-top': image.smTop,
                  zIndex: 20 + idx,
                } as any}
              >
                <ImageWithFallback
                  src={image.src}
                  alt={image.alt}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-120"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute inset-x-0 bottom-0 p-2 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 bg-black/60 backdrop-blur-md">
                  <p className="text-white text-xs font-medium text-center">{image.alt}</p>
                </div>
                <div className="absolute top-2 right-2 bg-white/20 backdrop-blur-sm rounded-full p-1 border border-white/30">
                  <image.icon className={`size-5 ${image.color} drop-shadow-md`} />
                </div>
              </motion.div>
            ))}

            {/* Sprinkle sparkles around */}
            {[...Array(15)].map((_, i) => (
              <motion.div
                key={`sparkle-${i}`}
                initial={{ opacity: 0 }}
                animate={{
                  opacity: [0, 0.8, 0],
                  scale: [0.5, 1.2, 0.5],
                  x: [0, (Math.random() - 0.5) * 150],
                  y: [0, (Math.random() - 0.5) * 150],
                }}
                transition={{
                  duration: 3 + Math.random() * 3,
                  repeat: Infinity,
                  delay: Math.random() * 5,
                }}
                className="absolute"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
              >
                <Sparkles className="size-5 text-yellow-300 drop-shadow-[0_0_8px_rgba(253,224,71,0.8)]" />
              </motion.div>
            ))}
          </div>

          {/* Text Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.8 }}
            className="text-center"
          >
            <h1 className="text-5xl sm:text-7xl font-extrabold mb-6 tracking-tight">
              <span className="block text-gray-900 mb-2">{t("hero.unlockThe")}</span>
              <span className="relative inline-block px-2">
                <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
                  {t("hero.magicOfLearning")}
                </span>
                <motion.svg
                  className="absolute -bottom-3 left-0 w-full"
                  viewBox="0 0 100 10"
                  preserveAspectRatio="none"
                >
                  <motion.path
                    d="M0 5 Q 25 2, 50 5 T 100 5"
                    fill="none"
                    stroke="url(#gradient-line)"
                    strokeWidth="1.5"
                    strokeOpacity="0.4"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ delay: 2, duration: 1.5, ease: "easeInOut" }}
                  />
                  <defs>
                    <linearGradient id="gradient-line" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#9333ea" />
                      <stop offset="50%" stopColor="#db2777" />
                      <stop offset="100%" stopColor="#f97316" />
                    </linearGradient>
                  </defs>
                </motion.svg>
              </span>
            </h1>
            <p className="text-xl sm:text-2xl text-gray-600 max-w-2xl mx-auto leading-relaxed font-light">
              {(() => {
                const subtitle = t("hero.subtitle");
                // Split by both placeholders and interleave styled spans
                const parts = subtitle.split(/(\{personalized\}|\{educational\})/);
                return parts.map((segment, i) => {
                  if (segment === "{personalized}") return <span key={i} className="text-purple-600 font-medium">{t("hero.personalized")}</span>;
                  if (segment === "{educational}") return <span key={i} className="text-blue-600 font-medium">{t("hero.educational")}</span>;
                  return <span key={i}>{segment}</span>;
                });
              })()}
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
