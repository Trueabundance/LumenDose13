import React, { useState, useEffect, useCallback, createContext, useContext, FC, ReactNode } from 'react';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, Auth } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, doc, deleteDoc, Firestore, getDocs } from 'firebase/firestore';
import { Brain, BarChart3, Info, X, Plus, Droplet, Star, Lock, Trash2, TrendingUp, Globe, Sparkles, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';


// --- Type Definitions for TypeScript ---
interface Drink {
    id?: string;
    type: string;
    volume: number;
    abv: number;
    alcoholGrams: number;
    timestamp: string;
}

interface BrainRegionAnalysis {
    name: string;
    impact: number;
    effectText: string;
    impactColor: string;
    impactWord: string;
}

interface Analysis {
    [key: string]: BrainRegionAnalysis;
}

interface Translations {
    [key: string]: {
        [key: string]: string | ((...args: any[]) => string);
    };
}

interface WeeklyChartData {
    name: string;
    drinks: number;
}

// --- Firebase Configuration ---
// IMPORTANT: Replace with your actual Firebase project configuration if deploying!
const firebaseConfig: { [key: string]: string } = {
    apiKey: "AIzaSyAcfkDIVV21EomfdNY2AQ-EZNKt8dgVZEM",
    authDomain: "lumendose.firebaseapp.com",
    projectId: "lumendose",
    storageBucket: "lumendose.firebasestorage.app",
    messagingSenderId: "493600405201",
    appId: "1:493600405201:web:20c4bacbc98e77906e37f0"
};

const appId = 'lumendose-app-standalone'; // Unique identifier for this application's data in Firestore

// --- Gemini API Key ---
// IMPORTANT: For production, this should be stored securely and not directly in client-side code.
// For Canvas environment, leave it as an empty string to use the provided key.
const GEMINI_API_KEY = "AIzaSyCh7YqkGuLqlWfZr2OzfqJrl6dilDO4YVM";


// --- I18N (Internationalization) Setup ---
const translations: Translations = {
    en: {
        app_title: "LumenDose",
        header_premium_button: "Go Premium",
        header_premium_status: "Premium",
        section_title_impact: "Real-Time Brain Impact",
        section_subtitle_impact: "Educational model of alcohol's short-term effects.",
        label_total_alcohol: "Total Alcohol",
        section_title_control: "Alcohol Intake", // Changed from "Session Control"
        button_log_drink: "Log a Drink",
        disclaimer_title: "Disclaimer",
        disclaimer_text: "LumenDose is an educational tool, not medical advice. Drink responsibly.",
        section_title_log: "Current Session Log",
        log_empty: "No drinks logged yet.",
        section_title_premium: "Premium Features",
        premium_feature_trends_title: "Historical Trends",
        premium_feature_trends_desc: "Track consumption over weeks, months, and years.",
        premium_feature_insights_title: "Personalized Insights",
        premium_feature_insights_desc: "AI-powered advice based on your unique patterns.",
        premium_unlocked_trends: "Historical Trends Unlocked!",
        premium_unlocked_trends_desc: "View your consumption patterns over time.",
        premium_unlocked_insights: "Personalized Insights Unlocked!",
        premium_unlocked_insights_desc: "Receive AI-driven feedback based on your habits.",
        modal_title: "Log a Drink",
        modal_drink_type: "Drink Type",
        modal_volume: "Volume (ml)",
        modal_abv: "ABV (%)",
        modal_add_button: "Add to Log",
        drink_beer: "Beer",
        drink_wine: "Wine",
        drink_spirit: "Spirit (Shot)",
        drink_liqueur: "Liqueur",
        drink_sake: "Sake",
        drink_soju: "Soju",
        impact_low: "Low",
        impact_moderate: "Moderate",
        impact_high: "High",
        impact_nominal: "Nominal impact at this level.",
        impact_noticeable: (func: string) => `Noticeable impairment to ${func}`,
        impact_significant: (func: string) => `Significant disruption of ${func}`,
        ai_coach_title: "AI Coach Insight",
        ai_coach_generating: "Generating insight...",
        ai_coach_no_key: "AI Coach is disabled. A Gemini API key is required for this feature.",
        premium_modal_title: "Unlock Premium!",
        premium_modal_text: "Access historical trends, advanced AI insights, and more by going Premium!",
        premium_modal_button: "Unlock Now",
        premium_dashboard_title: "Premium Dashboard",
        historical_trends_title: "Your Weekly Trends",
        long_term_insights_title: "Long-Term AI Insights",
        chart_loading: "Loading historical data...",
        chart_no_data: "Not enough data to display trends. Keep logging your drinks!",
    },
    // ... other languages ...
};

const LanguageContext = createContext<{
    language: string;
    setLanguage: (lang: string) => void;
    t: (key: string, ...args: any[]) => string;
} | undefined>(undefined);

const LanguageProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const [language, setLanguage] = useState('en');
    const t = useCallback((key: string, ...args: any[]): string => {
        const translation = translations[language]?.[key] || translations['en']?.[key];
        if (typeof translation === 'function') {
            return translation(...args);
        }
        return translation as string || key;
    }, [language]);

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

const useTranslation = () => {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useTranslation must be used within a LanguageProvider');
    }
    return context;
};

// --- Brain Data & AI Simulation ---
const brainRegionsData: { [key: string]: { name: string; functions: string; sensitivity: number; path: string; } } = {
    frontalLobe: { name: "Frontal Lobe", functions: "Judgment, planning, social conduct, and speech.", sensitivity: 1.2, path: "M 60,10 C 20,20 10,60 30,90 C 40,105 70,110 90,100 L 90,30 C 80,15 70,10 60,10 Z" },
    temporalLobe: { name: "Temporal Lobe", functions: "Auditory processing and language comprehension.", sensitivity: 1.0, path: "M 30,90 C 25,120 40,145 70,150 C 90,155 110,140 115,120 L 90,100 C 70,110 40,105 30,90 Z" },
    parietalLobe: { name: "Parietal Lobe", functions: "Sensory information, perception, and spatial awareness.", sensitivity: 0.9, path: "M 90,30 C 120,20 150,40 160,70 L 140,100 L 90,100 Z" },
    occipitalLobe: { name: "Occipital Lobe", functions: "Visual processing and interpretation.", sensitivity: 0.8, path: "M 160,70 C 175,90 170,120 150,135 L 115,120 L 140,100 Z" },
    cerebellum: { name: "Cerebellum", functions: "Coordination, balance, and motor control.", sensitivity: 1.5, path: "M 70,150 C 80,165 110,168 130,155 C 145,145 150,135 150,135 L 115,120 C 110,140 90,155 70,150 Z" },
    brainstem: { name: "Brainstem", functions: "Controls vital functions like breathing, heart rate, and consciousness.", sensitivity: 2.0, path: "M 90,100 L 115,120 L 110,140 C 100,150 90,150 90,140 L 88,110 Z" },
};

const analyzeConsumption = (drinks: Drink[], t: (key: string, ...args: any[]) => string): Analysis => {
    const totalAlcoholGrams = drinks.reduce((acc, drink) => acc + drink.alcoholGrams, 0);
    let analysis: Analysis = {};
    let overallImpactLevel = 0;
    if (totalAlcoholGrams > 0) {
        overallImpactLevel = Math.min(Math.log1p(totalAlcoholGrams / 10) * 1.5, 5);
    }
    Object.keys(brainRegionsData).forEach(key => {
        const region = brainRegionsData[key];
        const regionImpact = Math.min(overallImpactLevel * region.sensitivity, 5);
        let effectText: string = t('impact_nominal');
        let impactColor = "text-green-400";
        let impactWord = t('impact_low');
        if (regionImpact > 1.5 && regionImpact <= 3.5) {
            effectText = t('impact_noticeable', region.functions.toLowerCase());
            impactColor = "text-yellow-400";
            impactWord = t('impact_moderate');
        } else if (regionImpact > 3.5) {
            effectText = t('impact_significant', region.functions.toLowerCase());
            impactColor = "text-red-500";
            impactWord = t('impact_high');
        }
        analysis[key] = { name: region.name, impact: regionImpact, effectText, impactColor, impactWord };
    });
    return analysis;
};

// --- React Components ---

const AICoach: FC<{ drinks: Drink[]; analysis: Analysis | null }> = ({ drinks, analysis }) => {
    const { t } = useTranslation();
    const [insight, setInsight] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isVisible, setIsVisible] = useState(true);
    const [isKeyMissing, setIsKeyMissing] = useState(false);

    const generateInsight = useCallback(async () => {
        if (!GEMINI_API_KEY) {
            setIsKeyMissing(true);
            return;
        }
        if (!drinks || drinks.length < 2 || !analysis) return;
        
        setIsKeyMissing(false);
        setIsLoading(true);
        setInsight('');

        const sessionSummary = drinks.map(d => `${d.volume}ml of ${d.type} at ${d.abv}% ABV`).join(', ');
        const totalGrams = drinks.reduce((sum, d) => sum + d.alcoholGrams, 0).toFixed(1);
        const highestImpactRegion = Object.values(analysis).sort((a, b) => b.impact - a.impact)[0];
        const highestImpactRegionData = Object.values(brainRegionsData).find(r => r.name === highestImpactRegion.name);
        
        const firstDrinkTime = new Date(drinks[drinks.length - 1].timestamp);
        const lastDrinkTime = new Date(drinks[0].timestamp);
        const sessionDurationMinutes = (lastDrinkTime.getTime() - firstDrinkTime.getTime()) / (1000 * 60);
        const drinksPerHour = drinks.length > 1 && sessionDurationMinutes > 0 ? (drinks.length / (sessionDurationMinutes / 60)) : drinks.length;
        let pacingContext = `The user has had ${drinks.length} drinks over ${sessionDurationMinutes.toFixed(0)} minutes.`;
        if (drinksPerHour > 2) {
            pacingContext += " This is a rapid pace.";
        } else {
            pacingContext += " This is a moderate pace.";
        }

        const highAbvDrinks = drinks.filter(d => d.abv >= 15).length;
        let compositionContext = `The session includes ${highAbvDrinks} high-ABV drink(s).`;

        const prompt = `
            As an expert on the science of alcohol's effects, you are an AI Coach for the app LumenDose. 
            A user has logged the following drinks: ${sessionSummary}.
            This amounts to ${totalGrams}g of alcohol.
            Session context: ${pacingContext} ${compositionContext}
            The current analysis shows the highest impact is on the ${highestImpactRegion.name}, which affects ${highestImpactRegionData?.functions}.
            
            Based on all this context, provide a single, concise, actionable, and non-judgmental insight (around 20-30 words). 
            Focus on a specific, helpful suggestion related to their current drinking pattern (pacing, composition, hydration, etc.).
            Do not use generic phrases like "drink responsibly". Be specific and encouraging.
            Example for rapid pace: "We've noticed a rapid pace. A 30-minute break before your next drink can help lessen the overall impact."
            Example for high-ABV drinks: "This session is focused on high-ABV drinks. Considering a lower-ABV option next could moderate the effects on your coordination."
        `;

        try {
            let chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
            const payload = { contents: chatHistory };
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
                setInsight(result.candidates[0].content.parts[0].text);
            } else {
                setInsight("Could not generate an insight at this time.");
            }
        } catch (error) {
            console.error("Error generating AI insight:", error);
            setInsight("There was an issue connecting to the AI coach.");
        } finally {
            setIsLoading(false);
        }
    }, [drinks, analysis]);

    useEffect(() => {
        if (drinks.length >= 2) {
            generateInsight();
        }
    }, [drinks.length, generateInsight]);

    if (drinks.length < 2 || !isVisible) return null;

    return (
        <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl p-6 border border-blue-400/30 shadow-lg mt-8">
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                    <Sparkles className="text-blue-300" size={24} />
                    <h3 className="text-xl font-bold text-white">{t('ai_coach_title')}</h3>
                </div>
                <button onClick={() => setIsVisible(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="text-blue-100/90 text-sm">
                {isKeyMissing ? (
                    <p className="text-yellow-400">{t('ai_coach_no_key')}</p>
                ) : isLoading ? (
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-dashed rounded-full animate-spin border-white"></div>
                        <span>{t('ai_coach_generating')}</span>
                    </div>
                ) : (
                    <p>{insight}</p>
                )}
            </div>
        </div>
    );
};

const BrainVisual: FC<{ analysis: Analysis | null; drinkCount: number }> = ({ analysis, drinkCount }) => {
    const getFillColor = (impact: number) => {
        if (impact > 3.5) return 'rgba(239, 68, 68, 0.6)'; // Red
        if (impact > 1.5) return 'rgba(250, 204, 21, 0.6)'; // Yellow
        if (impact > 0) return 'rgba(74, 222, 128, 0.5)'; // Green
        return 'rgba(59, 130, 246, 0.2)'; // Calm Blue
    };
    
    return (
        <div className="relative w-full mx-auto aspect-square flex items-center justify-center overflow-hidden">
            <svg viewBox="0 0 300 300" className="w-full h-full absolute inset-0">
                <defs>
                    <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                        <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(107, 114, 128, 0.1)" strokeWidth="1"/>
                    </pattern>
                </defs>
                <rect width="300" height="300" fill="url(#grid)" />
            </svg>

            <svg width="200" height="180" viewBox="0 0 200 180" className="relative z-10 drop-shadow-lg w-[85%] h-[85%]">
                <defs>
                    <linearGradient id="rgbGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#ef4444" />
                        <stop offset="33%" stopColor="#34d399" />
                        <stop offset="66%" stopColor="#60a5fa" />
                        <stop offset="100%" stopColor="#ef4444" />
                        <animate attributeName="x1" from="0%" to="100%" dur="4s" repeatCount="indefinite" />
                        <animate attributeName="x2" from="100%" to="200%" dur="4s" repeatCount="indefinite" />
                    </linearGradient>
                </defs>

                <g>
                    {Object.keys(brainRegionsData).map((key) => {
                        const regionAnalysis = analysis ? analysis[key] : { impact: 0 };
                        const fillColor = getFillColor(regionAnalysis.impact);
                        const duration = 4 - (regionAnalysis.impact * 0.5);
                        return (
                            <path
                                key={`path-fill-${key}`}
                                d={brainRegionsData[key].path}
                                fill={fillColor}
                                stroke="rgba(150, 150, 180, 0.2)"
                                strokeWidth="0.5"
                                className="brain-region"
                                style={{
                                    '--pulse-duration': `${duration}s`,
                                    animationName: regionAnalysis.impact > 0 ? 'pulse-fill' : 'none',
                                    transition: 'fill 0.5s ease-in-out'
                                } as React.CSSProperties}
                            />
                        );
                    })}
                </g>
                <g>
                    {Object.keys(brainRegionsData).map((key, i) => {
                        const regionAnalysis = analysis ? analysis[key] : { impact: 0 };
                        const duration = 4 - (regionAnalysis.impact * 0.5);
                        return (
                            <path
                                key={`path-rgb-${key}`}
                                d={brainRegionsData[key].path}
                                fill="none"
                                stroke={analysis && regionAnalysis.impact > 0 ? "url(#rgbGradient)" : "none"}
                                strokeWidth="1.5"
                                strokeDasharray="4 12"
                                className="neural-path"
                                style={{'--duration': `${duration}s`, '--delay': `${i * 0.1}s`} as React.CSSProperties}
                            />
                        );
                    })}
                </g>
            </svg>

            <div className="dose-animation-container" key={drinkCount}>
                {drinkCount > 0 && (
                    <>
                        <div className="dose-splash"></div>
                        <Droplet size={36} className="text-blue-300 dose-droplet" />
                    </>
                )}
            </div>
        </div>
    );
};


const DrinkModal: FC<{ isOpen: boolean; onClose: () => void; onLogDrink: (drink: Omit<Drink, 'id'>) => void }> = ({ isOpen, onClose, onLogDrink }) => {
    const { t } = useTranslation();
    const [drinkType, setDrinkType] = useState('beer');
    const [volume, setVolume] = useState(355);
    const [abv, setAbv] = useState(5);
    
    const drinkPresets: { [key: string]: { volume: number; abv: number } } = { 
        beer: { volume: 355, abv: 5 }, 
        wine: { volume: 150, abv: 12 }, 
        spirit: { volume: 45, abv: 40 },
        liqueur: { volume: 60, abv: 20 },
        sake: { volume: 180, abv: 15},
        soju: { volume: 60, abv: 20}
    };

    // Effect to reset values to the default preset when modal opens
    useEffect(() => {
        if (isOpen) {
            const defaultType = 'beer'; // Set your desired default drink type here
            setDrinkType(defaultType);
            const preset = drinkPresets[defaultType];
            setVolume(preset.volume);
            setAbv(preset.abv);
        }
    }, [isOpen]); // Only runs when isOpen changes

    // Handle change for drink type dropdown
    const handleDrinkTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newType = e.target.value;
        setDrinkType(newType);
        // Update volume and abv based on the newly selected preset
        const preset = drinkPresets[newType] || drinkPresets['beer']; // Fallback to 'beer' if type not found
        setVolume(preset.volume);
        setAbv(preset.abv);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const alcoholGrams = (volume * (abv / 100) * 0.789); // Formula for alcohol grams
        onLogDrink({ type: drinkType, volume: Number(volume), abv: Number(abv), alcoholGrams, timestamp: new Date().toISOString() });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-md border border-gray-700">
                <div className="flex justify-between items-center mb-4"><h2 className="text-2xl font-bold text-white">{t('modal_title')}</h2><button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button></div>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4"><label className="block text-sm font-medium text-gray-300 mb-2">{t('modal_drink_type')}</label>
                        <select value={drinkType} onChange={handleDrinkTypeChange} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
                            <option value="beer">{t('drink_beer')}</option>
                            <option value="wine">{t('drink_wine')}</option>
                            <option value="spirit">{t('drink_spirit')}</option>
                            <option value="liqueur">{t('drink_liqueur')}</option>
                            <option value="sake">{t('drink_sake')}</option>
                            <option value="soju">{t('drink_soju')}</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">{t('modal_volume')}</label>
                            {/* Input for volume - now directly controlled by volume state */}
                            <input type="number" value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">{t('modal_abv')}</label>
                            {/* Input for ABV - now directly controlled by abv state */}
                            <input type="number" value={abv} step="0.1" onChange={(e) => setAbv(Number(e.target.value))} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                        </div>
                    </div>
                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-300 flex items-center justify-center gap-2"><Plus size={20} /> {t('modal_add_button')}</button>
                </form>
            </div>
        </div>
    );
};

const PremiumModal: FC<{ isOpen: boolean; onClose: () => void; onConfirm: () => void; }> = ({ isOpen, onClose, onConfirm }) => {
    const { t } = useTranslation();
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-gray-700 text-center">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex-grow flex justify-center">
                        <Star className="text-yellow-400" size={40} />
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">{t('premium_modal_title')}</h2>
                <p className="text-gray-300 mb-6">{t('premium_modal_text')}</p>
                <button onClick={onConfirm} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                    {t('premium_modal_button')}
                </button>
            </div>
        </div>
    );
};


const PremiumFeature: FC<{ title: string; description: string; icon: ReactNode; onUpgrade: () => void; }> = ({ title, description, icon, onUpgrade }) => (
    <div className="relative bg-gray-800 p-4 rounded-lg border border-gray-700 overflow-hidden">
        <div className="flex items-center mb-2">{icon}<h4 className="font-bold ml-2 text-gray-200">{title}</h4></div>
        <p className="text-xs text-gray-400">{description}</p>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center">
            <Lock className="text-yellow-400 mb-2" size={24} />
            <button onClick={onUpgrade} className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 text-xs font-bold py-1 px-3 rounded-full transition-colors">Upgrade to Unlock</button>
        </div>
    </div>
);

const LanguageSwitcher: FC = () => {
    const { language, setLanguage } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);

    const languages: { [key: string]: string } = {
        en: "English",
        de: "Deutsch",
        'fr-CA': "Français (CA)",
        es: "Español",
        ja: "日本語",
        ko: "한국어"
    };

    return (
        <div className="relative">
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 text-gray-300 hover:text-white">
                <Globe size={20} />
                <span className="hidden sm:inline">{languages[language]}</span>
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
                    {Object.entries(languages).map(([code, name]) => (
                        <button key={code} onClick={() => { setLanguage(code); setIsOpen(false); }}
                            className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700">
                            {name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- PREMIUM COMPONENTS ---

const HistoricalChart: FC<{ db: Firestore | null; userId: string | null; }> = ({ db, userId }) => {
    const { t } = useTranslation();
    const [data, setData] = useState<WeeklyChartData[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!db || !userId) return;
            setIsLoading(true);
            const drinksCollectionPath = `artifacts/${appId}/users/${userId}/drinks`;
            const querySnapshot = await getDocs(query(collection(db, drinksCollectionPath)));
            const allDrinks: Drink[] = [];
            querySnapshot.forEach((doc) => {
                allDrinks.push({ id: doc.id, ...doc.data() } as Drink);
            });

            if (allDrinks.length === 0) {
                setIsLoading(false);
                return;
            }

            // Process data into weekly totals
            const weeklyData: { [key: string]: number } = {};
            allDrinks.forEach(drink => {
                const date = new Date(drink.timestamp);
                const year = date.getFullYear();
                const week = Math.floor((date.getTime() - new Date(year, 0, 1).getTime()) / (1000 * 60 * 60 * 24 * 7));
                const weekKey = `${year}-W${week}`;
                if (!weeklyData[weekKey]) {
                    weeklyData[weekKey] = 0;
                }
                weeklyData[weekKey] += 1; // Counting number of drinks per week
            });

            const chartData = Object.entries(weeklyData).map(([name, drinks]) => ({ name, drinks })).slice(-8); // Show last 8 weeks
            setData(chartData);
            setIsLoading(false);
        };
        fetchData();
    }, [db, userId]);

    if (isLoading) {
        return <div className="text-center text-gray-400 p-8">{t('chart_loading')}</div>;
    }

    if (data.length === 0) {
        return <div className="text-center text-gray-400 p-8">{t('chart_no_data')}</div>;
    }

    return (
        <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" />
                    <YAxis stroke="rgba(255,255,255,0.5)" />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                    <Legend />
                    <Bar dataKey="drinks" fill="#8884d8" name="Drinks per Week" />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

const LongTermAICoach: FC<{ db: Firestore | null; userId: string | null; }> = ({ db, userId }) => {
    const { t } = useTranslation();
    const [insight, setInsight] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const generateLongTermInsight = async () => {
            if (!GEMINI_API_KEY) {
                setInsight(t('ai_coach_no_key'));
                setIsLoading(false);
                return;
            }
            if (!db || !userId) return;

            setIsLoading(true);
            const drinksCollectionPath = `artifacts/${appId}/users/${userId}/drinks`;
            const querySnapshot = await getDocs(query(collection(db, drinksCollectionPath)));
            const allDrinks: Drink[] = [];
            querySnapshot.forEach((doc) => {
                allDrinks.push({ id: doc.id, ...doc.data() } as Drink);
            });

            if (allDrinks.length < 5) { // Need some data to analyze
                setInsight("Keep logging your drinks to unlock long-term insights!");
                setIsLoading(false);
                return;
            }

            const totalDrinks = allDrinks.length;
            const mostCommonDay = new Date(allDrinks[0].timestamp).toLocaleDateString('en-US', { weekday: 'long' });
            const avgAbv = allDrinks.reduce((sum, d) => sum + d.abv, 0) / totalDrinks;

            const prompt = `
                As an expert on the science of alcohol's effects, you are an AI Coach for the app LumenDose.
                A user has a long-term history of ${totalDrinks} drinks. Their most frequent drinking day appears to be ${mostCommonDay}. Their average drink ABV is ${avgAbv.toFixed(1)}%.
                Provide a single, concise, actionable, and non-judgmental long-term insight (around 20-30 words).
                Focus on a helpful observation about their overall pattern.
                Example: "Your drinking is most frequent on weekends. Planning a non-drinking activity on a Saturday could be a great way to build a new habit."
            `;
            
            try {
                let chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
                const payload = { contents: chatHistory };
                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await response.json();
                if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
                    setInsight(result.candidates[0].content.parts[0].text);
                } else {
                    setInsight("Could not generate a long-term insight at this time.");
                }
            } catch (error) {
                console.error("Error generating long-term AI insight:", error);
                setInsight("There was an issue connecting to the AI coach.");
            } finally {
                setIsLoading(false);
            }
        };
        generateLongTermInsight();
    }, [db, userId, t]);

    return (
        <div className="bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-2xl p-6 border border-purple-400/30 shadow-lg">
            <div className="flex items-center gap-3 mb-3">
                <Sparkles className="text-purple-300" size={24} />
                <h3 className="text-xl font-bold text-white">{t('long_term_insights_title')}</h3>
            </div>
            <div className="text-purple-100/90 text-sm">
                {isLoading ? (
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-dashed rounded-full animate-spin border-white"></div>
                        <span>{t('ai_coach_generating')}</span>
                    </div>
                ) : (
                    <p>{insight}</p>
                )}
            </div>
        </div>
    );
};


const PremiumDashboard: FC<{ db: Firestore | null; userId: string | null; }> = ({ db, userId }) => {
    const { t } = useTranslation();
    return (
        <div className="lg:col-span-2 space-y-8">
            <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
                <div className="flex items-center mb-4">
                    <BarChart3 className="text-yellow-400" />
                    <h3 className="text-xl font-bold ml-2">{t('historical_trends_title')}</h3>
                </div>
                <HistoricalChart db={db} userId={userId} />
            </div>
            <LongTermAICoach db={db} userId={userId} />
        </div>
    );
};


// Main App Component
function AppContent() {
    const { t } = useTranslation();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
    const [drinks, setDrinks] = useState<Drink[]>([]);
    const [analysis, setAnalysis] = useState<Analysis | null>(null);
    const [db, setDb] = useState<Firestore | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [isPremium, setIsPremium] = useState(false);
    const [isConfigMissing, setIsConfigMissing] = useState(false);

    useEffect(() => {
        if (Object.keys(firebaseConfig).length === 0 || !firebaseConfig.apiKey) {
            setIsConfigMissing(true);
            return;
        }
        setIsConfigMissing(false);
        try {
            const app: FirebaseApp = initializeApp(firebaseConfig);
            const firestoreDb: Firestore = getFirestore(app);
            const firebaseAuth: Auth = getAuth(app);
            setDb(firestoreDb);
            const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
                if (user) {
                    setUserId(user.uid);
                } else {
                    await signInAnonymously(firebaseAuth);
                }
            });
            return () => unsubscribe();
        } catch (e) { console.error("Error initializing Firebase:", e); }
    }, []);

    useEffect(() => {
        if (db && userId) {
            const drinksCollectionPath = `artifacts/${appId}/users/${userId}/drinks`;
            const q = query(collection(db, drinksCollectionPath));
            const unsubscribe = onSnapshot(q, (querySnapshot) => {
                const drinksData: Drink[] = [];
                querySnapshot.forEach((doc) => { drinksData.push({ id: doc.id, ...doc.data() } as Drink); });
                drinksData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                setDrinks(drinksData);
            }, (error) => { console.error("Error listening to drinks collection:", error); });
            return () => unsubscribe();
        }
    }, [db, userId]);

    useEffect(() => { setAnalysis(analyzeConsumption(drinks, t)); }, [drinks, t]);

    const handleLogDrink = async (drinkData: Omit<Drink, 'id'>) => {
        if (db && userId) {
            try {
                const drinksCollectionPath = `artifacts/${appId}/users/${userId}/drinks`;
                await addDoc(collection(db, drinksCollectionPath), drinkData);
            } catch (error) { console.error("Error adding drink to Firestore: ", error); }
        }
    };
    
    const handleDeleteDrink = async (drinkId: string) => {
        if (db && userId) {
            try {
                const drinkDocPath = `artifacts/${appId}/users/${userId}/drinks/${drinkId}`;
                await deleteDoc(doc(db, drinkDocPath));
            } catch (error) { console.error("Error deleting drink:", error); }
        }
    };

    const handleOpenPremiumModal = () => setIsPremiumModalOpen(true);

    const handleConfirmPremium = () => {
        setIsPremium(true); // Simulate successful upgrade
        setIsPremiumModalOpen(false); // Close the modal
    };

    const totalAlcohol = drinks.reduce((sum, drink) => sum + drink.alcoholGrams, 0).toFixed(1);

    if (isConfigMissing) {
        return (
            <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center p-8 text-center">
                <AlertTriangle className="w-16 h-16 text-yellow-400 mb-4" />
                <h1 className="text-3xl font-bold mb-2">Firebase Configuration Missing</h1>
                <p className="text-lg text-gray-300 max-w-2xl">
                    To connect the app to its database, you need to add your Firebase project's configuration keys.
                </p>
                <div className="mt-6 text-left bg-gray-800 p-4 rounded-lg max-w-xl w-full">
                    <p className="text-md font-semibold mb-2">Action Required:</p>
                    <ol className="list-decimal list-inside space-y-2 text-gray-400">
                        <li>Go to your Firebase project settings.</li>
                        <li>Find and copy the `firebaseConfig` object.</li>
                        <li>In the code editor, find the `firebaseConfig` constant.</li>
                        <li>Replace the empty `{}` with the object you copied.</li>
                    </ol>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans antialiased">
            <style>
                {`
                    @keyframes pulse-fill {
                        0%, 100% { opacity: 0.6; }
                        50% { opacity: 1; }
                    }
                    .brain-region {
                        animation: pulse-fill var(--pulse-duration) ease-in-out infinite;
                    }
                    .neural-path {
                        animation: dash var(--duration) linear infinite;
                        animation-delay: var(--delay);
                    }
                    @keyframes dash {
                        to {
                            stroke-dashoffset: -20;
                        }
                    }
                    .dose-animation-container .dose-droplet,
                    .dose-animation-container .dose-splash {
                        animation-play-state: running;
                    }
                    .dose-animation-container {
                        position: absolute;
                        width: 100%;
                        height: 100%;
                        top: 0;
                        left: 0;
                        z-index: 20;
                        pointer-events: none;
                    }
                    .dose-droplet {
                        position: absolute;
                        color: #93c5fd; /* blue-300 */
                        filter: drop-shadow(0 0 5px #60a5fa);
                        opacity: 0;
                        animation: travel-up 1s ease-in forwards;
                    }
                    @keyframes travel-up {
                        0% { bottom: 0%; left: 50%; opacity: 0; transform: translateX(-50%) scale(0.8); }
                        20% { opacity: 1; }
                        100% { bottom: 55%; left: 50%; opacity: 0; transform: translateX(-50%) scale(1.2); }
                    }
                    .dose-splash {
                        position: absolute;
                        bottom: 55%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        width: 15px;
                        height: 15px;
                        border-radius: 50%;
                        background: #93c5fd;
                        opacity: 0;
                        animation: splash 0.5s 1s ease-out forwards;
                    }
                    @keyframes splash {
                        0% { opacity: 1; transform: translate(-50%, -50%) scale(0); box-shadow: 0 0 0 0 rgba(147, 197, 253, 0.7); }
                        100% { opacity: 0; transform: translate(-50%, -50%) scale(12); box-shadow: 0 0 30px 40px rgba(147, 197, 253, 0); }
                    }
                `}
            </style>
            <DrinkModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onLogDrink={handleLogDrink} />
            <PremiumModal isOpen={isPremiumModalOpen} onClose={() => setIsPremiumModalOpen(false)} onConfirm={handleConfirmPremium} />

            <header className="p-4 border-b border-gray-800 flex justify-between items-center sticky top-0 bg-gray-900/80 backdrop-blur-md z-40">
                <div className="flex items-center gap-3"><Brain className="text-blue-400" size={32} /><h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">{t('app_title')}</h1></div>
                <div className="flex items-center gap-4">
                    <LanguageSwitcher />
                    <button onClick={handleOpenPremiumModal} className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold py-2 px-4 rounded-lg transition-transform hover:scale-105 shadow-lg shadow-yellow-500/20">{t('header_premium_button')}</button>
                </div>
            </header>
            <main className="p-4 md:p-8">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-8">
                    <div className="lg:col-span-3 bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
                        <div className="flex justify-between items-start mb-4"><div><h2 className="text-3xl font-bold text-white">{t('section_title_impact')}</h2><p className="text-gray-400">{t('section_subtitle_impact')}</p></div><div className="text-right flex-shrink-0 ml-4"><p className="text-gray-400 text-sm">{t('label_total_alcohol')}</p><p className="text-2xl font-bold text-blue-400">{totalAlcohol}g</p></div></div>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-center">
                            <div className="md:col-span-3">
                                <BrainVisual analysis={analysis} drinkCount={drinks.length} />
                            </div>
                            <div className="space-y-3 md:col-span-2">
                                {analysis && Object.values(analysis).map(region => (<div key={region.name} className="bg-gray-800 p-3 rounded-lg transition-all hover:bg-gray-700/50"><div className="flex justify-between items-center"><span className="font-semibold">{region.name}</span><span className={`font-bold text-sm ${region.impactColor}`}>{region.impactWord}</span></div><p className="text-xs text-gray-400 mt-1">{region.effectText}</p></div>))}
                            </div>
                        </div>
                        <AICoach drinks={drinks} analysis={analysis} />
                    </div>
                    {isPremium ? (
                        <PremiumDashboard db={db} userId={userId} />
                    ) : (
                        <div className="lg:col-span-2 space-y-8">
                            <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50"><h3 className="text-xl font-bold mb-4">{t('section_title_control')}</h3><button onClick={() => setIsModalOpen(true)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-300 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"><Plus size={20} /> {t('button_log_drink')}</button><div className="mt-6 p-4 bg-yellow-900/30 border border-yellow-700 rounded-lg flex items-start gap-3"><Info size={20} className="text-yellow-400 mt-1 flex-shrink-0" /><div><h4 className="font-bold text-yellow-300">{t('disclaimer_title')}</h4><p className="text-xs text-yellow-300/80">{t('disclaimer_text')}</p></div></div></div>
                            <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50"><h3 className="text-xl font-bold mb-4">{t('section_title_log')}</h3><div className="space-y-3 max-h-60 overflow-y-auto pr-2">{drinks.length > 0 ? drinks.map(drink => (<div key={drink.id || ''} className="group flex items-center justify-between bg-gray-800 p-3 rounded-lg hover:bg-gray-700/50"><div className="flex items-center gap-3"><Droplet className="text-blue-400" size={18} /><div><p className="font-semibold capitalize">{t(`drink_${drink.type.toLowerCase()}`) || drink.type}</p><p className="text-xs text-gray-400">{drink.volume}ml at {drink.abv}% ABV</p></div></div><div className="flex items-center gap-3"><p className="font-mono text-sm text-gray-300">{drink.alcoholGrams.toFixed(1)}g</p><button onClick={() => drink.id && handleDeleteDrink(drink.id)} className="text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button></div></div>)) : <p className="text-center text-gray-500 py-8">{t('log_empty')}</p>}</div></div>
                            <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50"><div className="flex items-center mb-4"><Star className="text-yellow-400" /><h3 className="text-xl font-bold ml-2">{t('section_title_premium')}</h3></div><div className="space-y-4">
                                <PremiumFeature title={t('premium_feature_trends_title') as string} description={t('premium_feature_trends_desc') as string} icon={<BarChart3 className="text-gray-400" />} onUpgrade={handleOpenPremiumModal} />
                                <PremiumFeature title={t('premium_feature_insights_title') as string} description={t('premium_feature_insights_desc') as string} icon={<TrendingUp className="text-gray-400" />} onUpgrade={handleOpenPremiumModal} />
                            </div></div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

export default function App() {
    return (
        <LanguageProvider>
            <AppContent />
        </LanguageProvider>
    );
}
