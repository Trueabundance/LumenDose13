import React, { useState, useEffect, useCallback, createContext, useContext, FC, ReactNode } from 'react';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, Auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, doc, deleteDoc, Firestore, getDocs, setDoc, getDoc } from 'firebase/firestore';
// Ensured all necessary icons are imported here, and unused ones are removed.
import { Brain, BarChart3, Info, X, Plus, Droplet, Star, Lock, Trash2, TrendingUp, Globe, Sparkles, AlertTriangle, BellRing, Settings, Edit, Save, Award, Share2, History, LogOut } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// --- Type Definitions for TypeScript ---
interface Drink {
    id?: string;
    type: string;
    volume: number;
    abv: number;
    alcoholGrams: number;
    timestamp: string; // ISO string
}

interface CustomQuickAdd {
    id?: string;
    type: string;
    volume: number;
    abv: number;
    label: string;
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

interface Achievement {
    id: string;
    nameKey: string;
    descriptionKey: string;
    earnedDate: string;
}

interface DailyChallenge {
    id: string;
    textKey: string;
    completed: boolean;
    type: 'log_n_drinks' | 'stay_below_goal' | 'use_custom_quick_add';
    value?: number;
}

// --- Firebase Configuration ---
const firebaseConfig: { [key: string]: string } = {
    apiKey: "AIzaSyAcfkDIVV21EomfdNY2AQ-EZNKt8dgVZEM",
    authDomain: "lumendose.firebaseapp.com",
    projectId: "lumendose",
    storageBucket: "lumendose.firebasestorage.app",
    messagingSenderId: "493600405201",
    appId: "1:493600405201:web:20c4bacbc98e77906e37f0"
};

const appId = 'lumendose-app-standalone';

// --- Gemini API Key ---
const GEMINI_API_KEY = "AIzaSyCh7YqkGuLqlWfZr2OzfqJrl6dilDO4YVM";

// --- Global Drink Presets by Region ---
const globalDrinkPresets: { [region: string]: { [key: string]: { volume: number; abv: number; translationKey: string; } } } = {
    'uk': {
        beer: { volume: 568, abv: 4.5, translationKey: "quick_add_beer_standard" },
        wine: { volume: 175, abv: 13, translationKey: "quick_add_wine_glass" },
        spirit: { volume: 25, abv: 40, translationKey: "quick_add_spirit_single" },
        cider: { volume: 568, abv: 4.5, translationKey: "quick_add_cider" },
        cocktail: { volume: 100, abv: 20, translationKey: "quick_add_cocktail" },
    },
    'us': {
        beer: { volume: 355, abv: 5, translationKey: "quick_add_beer_can" },
        wine: { volume: 147, abv: 12, translationKey: "quick_add_wine_glass_us" },
        spirit: { volume: 44, abv: 40, translationKey: "quick_add_spirit_shot_us" },
        cider: { volume: 355, abv: 5, translationKey: "quick_add_cider_can" },
        cocktail: { volume: 150, abv: 20, translationKey: "quick_add_cocktail_us" },
    },
};

// --- I18N (Internationalization) Setup ---
const translations: Translations = {
    en: {
        app_title: "LumenDose",
        header_premium_button: "Go Premium",
        header_premium_status: "Premium",
        section_title_impact: "Real-Time Brain Impact",
        section_subtitle_impact: "Educational model of alcohol's short-term effects.",
        label_total_alcohol: "Total Alcohol",
        section_title_control: "Alcohol Intake",
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
        premium_modal_button: "Proceed to Checkout",
        premium_dashboard_title: "Premium Dashboard",
        historical_trends_title: "Your Weekly Trends",
        long_term_insights_title: "Long-Term AI Insights",
        chart_loading: "Loading historical data...",
        chart_no_data: "Not enough data to display trends. Keep logging your drinks!",
        quick_log_title: "Quick Add",
        quick_add_beer_standard: "Pint of Beer (4.5%)",
        quick_add_wine_glass: "Large Wine (175ml, 13%)",
        quick_add_spirit_single: "Single Shot (25ml, 40%)",
        quick_add_cider: "Pint of Cider (4.5%)",
        quick_add_cocktail: "Cocktail (100ml, 20%)",
        quick_add_beer_can: "Can of Beer (355ml, 5%)",
        quick_add_wine_glass_us: "Glass of Wine (147ml, 12%)",
        quick_add_spirit_shot_us: "Shot (44ml, 40%)",
        quick_add_cider_can: "Can of Cider (355ml, 5%)",
        quick_add_cocktail_us: "Cocktail (150ml, 20%)",
        region_selector_title: "Region",
        region_uk: "United Kingdom",
        region_us: "United States",
        region_au: "Australia",
        region_de: "Germany",
        reminder_title: "Time to Log?",
        reminder_text: "Don't forget to log your recent drinks to keep your insights accurate!",
        reminder_log_button: "Log Now",
        reminder_dismiss_button: "Dismiss",
        // Brain region names for translation
        region_frontalLobe: "Frontal Lobe",
        region_temporalLobe: "Temporal Lobe",
        region_parietalLobe: "Parietal Lobe",
        region_occipitalLobe: "Occipital Lobe",
        region_cerebellum: "Cerebellum",
        region_brainstem: "Brainstem",
        // Custom Quick Add & Goals
        manage_quick_adds: "Manage Quick Adds",
        add_custom_quick_add: "Add Custom Quick Add",
        edit_custom_quick_add: "Edit Custom Quick Add",
        custom_quick_add_label: "Button Label",
        custom_quick_add_type: "Drink Type",
        custom_quick_add_volume: "Volume (ml)",
        abv: "ABV (%)",
        save_quick_add: "Save Quick Add",
        delete_quick_add: "Delete",
        no_custom_quick_adds: "No custom quick adds yet.",
        daily_goal_title: "Daily Alcohol Goal",
        set_goal: "Set Goal (grams)",
        current_progress: "Current Progress",
        goal_set_success: "Daily goal set!",
        goal_delete_success: "Daily goal removed.",
        goal_not_set: "No daily goal set.",
        goal_exceeded: "Goal Exceeded!",
        goal_remaining: "remaining",
        // Achievements
        achievements_title: "Achievements",
        achievement_first_log_name: "First Sip",
        achievement_first_log_desc: "Logged your first drink!",
        achievement_7_day_streak_name: "7-Day Streak",
        achievement_7_day_streak_desc: "Logged drinks for 7 consecutive days!",
        achievement_30_day_streak_name: "30-Day Streak",
        achievement_30_day_streak_desc: "Logged drinks for 30 consecutive days!",
        achievement_5_goal_name: "Goal Setter Novice",
        achievement_5_goal_desc: "Hit your daily goal 5 times!",
        achievement_10_drinks_name: "Social Drinker",
        achievement_10_drinks_desc: "Logged 10 drinks!",
        achievement_50_drinks_name: "Regular Logger",
        achievement_50_drinks_desc: "50 drinks logged!",
        achievement_100_drinks_name: "Dedicated Tracker",
        achievement_100_drinks_desc: "100 drinks logged!",
        no_achievements_yet: "No achievements earned yet. Keep logging!",
        share_progress_button: "Share Progress",
        share_message_goal: "Today I consumed {grams}g of alcohol, staying within my goal of {goal}g with LumenDose! #ResponsibleDrinking #LumenDose",
        share_message_over_goal: "Today I consumed {grams}g of alcohol, exceeding my goal of {goal}g. Time to reflect with LumenDose! #HealthJourney #LumenDose",
        share_message_no_goal: "Today I consumed {grams}g of alcohol. Track your intake with LumenDose! #HealthApp",
        daily_challenge_title: "Daily Challenge",
        daily_challenge_completed: "Completed!",
        daily_challenge_log_n_drinks: "Log at least {value} drink(s) today.",
        daily_challenge_stay_below_goal: "Stay below {value}g alcohol today.",
        daily_challenge_use_custom_quick_add: "Use a custom quick add button.",
        daily_challenge_no_challenge: "No challenge for today. Enjoy your tracking!",
        current_streak: "Current Streak",
        days: "days",
        daily_challenge_not_completed: "Not completed",
    },
    de: { // German translations
        app_title: "LumenDosis",
        header_premium_button: "Premium werden",
        header_premium_status: "Premium",
        section_title_impact: "Echtzeit-Gehirn-Auswirkung",
        section_subtitle_impact: "Bildungsmodell der kurzfristigen Auswirkungen von Alkohol.",
        label_total_alcohol: "Gesamtalkohol",
        section_title_control: "Alkoholaufnahme",
        button_log_drink: "Getränk protokollieren",
        disclaimer_title: "Haftungsausschluss",
        disclaimer_text: "LumenDosis ist ein Bildungstool, keine medizinische Beratung. Trinken Sie verantwortungsbewusst.",
        section_title_log: "Aktuelles Sitzungsprotokoll",
        log_empty: "Noch keine Getränke protokolliert.",
        section_title_premium: "Premium-Funktionen",
        premium_feature_trends_title: "Historische Trends",
        premium_feature_trends_desc: "Verfolgen Sie den Konsum über Wochen, Monate und Jahre.",
        premium_feature_insights_title: "Personalisierte Einblicke",
        premium_feature_insights_desc: "KI-gestützte Ratschläge basierend auf Ihren einzigartigen Mustern.",
        premium_unlocked_trends: "Historische Trends freigeschaltet!",
        premium_unlocked_trends_desc: "Sehen Sie sich Ihre Konsummuster im Laufe der Zeit an.",
        premium_unlocked_insights: "Personalisierte Einblicke freigeschaltet!",
        premium_unlocked_insights_desc: " erhalten Sie KI-gesteuertes Feedback zu Ihren Gewohnheiten.",
        modal_title: "Getränk protokollieren",
        modal_drink_type: "Getränketyp",
        modal_volume: "Volumen (ml)",
        modal_abv: "Alkoholgehalt (%)",
        modal_add_button: "Zum Protokoll hinzufügen",
        drink_beer: "Bier",
        drink_wine: "Wein",
        drink_spirit: "Spirituose (Shot)",
        drink_liqueur: "Likör",
        drink_sake: "Sake",
        drink_soju: "Soju",
        impact_low: "Niedrig",
        impact_moderate: "Mittel",
        impact_high: "Hoch",
        impact_nominal: "Nominale Auswirkung auf diesem Niveau.",
        impact_noticeable: (func: string) => `Merkliche Beeinträchtigung von ${func}`,
        impact_significant: (func: string) => `Erhebliche Störung von ${func}`,
        ai_coach_title: "KI-Coach-Einblick",
        ai_coach_generating: "Einblick generieren...",
        ai_coach_no_key: "KI-Coach ist deaktiviert. Ein Gemini-API-Schlüssel ist für diese Funktion erforderlich.",
        premium_modal_title: "Premium freischalten!",
        premium_modal_text: "Greifen Sie auf historische Trends, erweiterte KI-Einblicke und mehr zu, indem Sie Premium werden!",
        premium_modal_button: "Jetzt freischalten",
        premium_dashboard_title: "Premium-Dashboard",
        historical_trends_title: "Ihre wöchentlichen Trends",
        long_term_insights_title: "Langfristige KI-Einblicke",
        chart_loading: "Historische Daten werden geladen...",
        chart_no_data: "Nicht genügend Daten, um Trends anzuzeigen. Protokollieren Sie weiterhin Ihre Getränke!",
        quick_log_title: "Schnell hinzufügen",
        quick_add_beer_standard: "Pint Bier (4.5%)", // UK specific
        quick_add_wine_glass: "Großes Glas Wein (175ml, 13%)", // UK specific
        quick_add_spirit_single: "Einzelner Shot (25ml, 40%)", // UK specific
        quick_add_cider: "Pint Apfelwein (4.5%)",
        quick_add_cocktail: "Cocktail (100ml, 20%)",
        quick_add_beer_can: "Bierdose (355ml, 5%)", // US specific
        quick_add_wine_glass_us: "Glas Wein (147ml, 12%)", // US specific
        quick_add_spirit_shot_us: "Shot (44ml, 40%)", // US specific
        quick_add_cider_can: "Apfelwein Dose (355ml, 5%)", // US specific
        quick_add_cocktail_us: "Cocktail (150ml, 20%)", // US specific
        region_selector_title: "Region",
        region_uk: "Vereinigtes Königreich",
        region_us: "Vereinigte Staaten",
        region_au: "Australien",
        region_de: "Deutschland",
        reminder_title: "Zeit zum Protokollieren?",
        reminder_text: "Vergessen Sie nicht, Ihre letzten Getränke zu protokollieren, um Ihre Einblicke genau zu halten!",
        reminder_log_button: "Jetzt protokollieren",
        reminder_dismiss_button: "Ablehnen",
        // Brain region names for translation
        region_frontalLobe: "Frontallappen",
        region_temporalLobe: "Temporallappen",
        region_parietalLobe: "Parietallappen",
        region_occipitalLobe: "Okzipitallappen",
        region_cerebellum: "Kleinhirn",
        region_brainstem: "Hirnstamm",
        // Custom Quick Add & Goals
        manage_quick_adds: "Schnell-Hinzufügungen verwalten",
        add_custom_quick_add: "Benutzerdefinierte Schnell-Hinzufügung hinzufügen",
        edit_custom_quick_add: "Benutzerdefinierte Schnell-Hinzufügung bearbeiten",
        custom_quick_add_label: "Schaltflächenbeschriftung",
        custom_quick_add_type: "Getränketyp",
        custom_quick_add_volume: "Volumen (ml)",
        abv: "Alkoholgehalt (%)",
        save_quick_add: "Schnell-Hinzufügung speichern",
        delete_quick_add: "Löschen",
        no_custom_quick_adds: "Noch keine benutzerdefinierten Schnell-Hinzufügungen.",
        daily_goal_title: "Tägliches Alkoholziel",
        set_goal: "Ziel festlegen (Gramm)",
        current_progress: "Aktueller Fortschritt",
        goal_set_success: "Tägliches Ziel festgelegt!",
        goal_delete_success: "Tägliches Ziel entfernt.",
        goal_not_set: "Kein tägliches Ziel festgelegt.",
        goal_exceeded: "Ziel überschritten!",
        goal_remaining: "verbleibend",
        // Achievements
        achievements_title: "Errungenschaften",
        achievement_first_log_name: "Erster Schluck",
        achievement_first_log_desc: "Ihr erstes Getränk protokolliert!",
        achievement_7_day_streak_name: "7-Tage-Serie",
        achievement_7_day_streak_desc: "7 Tage in Folge Getränke protokolliert!",
        achievement_30_day_streak_name: "30-Tage-Serie",
        achievement_30_day_streak_desc: "30 Tage in Folge Getränke protokolliert!",
        achievement_5_goal_name: "Zielsetzer-Neuling",
        achievement_5_goal_desc: "Ihr Tagesziel 5 Mal erreicht!",
        achievement_10_drinks_name: "Geselliger Trinker",
        achievement_10_drinks_desc: "10 Getränke protokolliert!",
        achievement_50_drinks_name: "Regelmäßiger Protokollierer",
        achievement_50_drinks_desc: "50 Getränke protokolliert!",
        achievement_100_drinks_name: "Engagierter Tracker",
        achievement_100_drinks_desc: "100 Getränke protokolliert!",
        no_achievements_yet: "Noch keine Errungenschaften verdient. Protokollieren Sie weiter!",
        share_progress_button: "Fortschritt teilen",
        share_message_goal: "Heute habe ich {grams}g Alkohol konsumiert und bleibe mit LumenDosis innerhalb meines Ziels von {goal}g! #VerantwortungsvollesTrinken #LumenDosis",
        share_message_over_goal: "Heute habe ich {grams}g Alkohol konsumiert und mein Ziel von {goal}g überschritten. Zeit zum Nachdenken mit LumenDosis! #Gesundheitsreise #LumenDosis",
        share_message_no_goal: "Heute habe ich {grams}g Alkohol konsumiert. Verfolgen Sie Ihre Aufnahme mit LumenDosis! #GesundheitsApp",
        daily_challenge_title: "Tägliche Herausforderung",
        daily_challenge_completed: "Abgeschlossen!",
        daily_challenge_log_n_drinks: "Protokollieren Sie heute mindestens {value} Getränk(e).",
        daily_challenge_stay_below_goal: "Bleiben Sie heute unter {value}g Alkohol.",
        daily_challenge_use_custom_quick_add: "Verwenden Sie eine benutzerdefinierte Schnell-Hinzufügung.",
        daily_challenge_no_challenge: "Keine Herausforderung für heute. Viel Spaß beim Protokollieren!",
        current_streak: "Aktuelle Serie",
        days: "Tage",
        daily_challenge_not_completed: "Nicht abgeschlossen",
    },
    'fr-CA': { // French (Canadian) translations
        app_title: "LumenDose",
        header_premium_button: "Passer au Premium",
        header_premium_status: "Premium",
        section_title_impact: "Impact cérébral en temps réel",
        section_subtitle_impact: "Modèle éducatif des effets à court terme de l'alcool。",
        label_total_alcohol: "Alcool total",
        section_title_control: "Consommation d'alcool",
        button_log_drink: "Enregistrer une boisson",
        disclaimer_title: "Avertissement",
        disclaimer_text: "LumenDose est un outil éducatif, pas un avis médical。Buvez de manière responsable。",
        section_title_log: "Journal de session actuel",
        log_empty: "Aucune boisson enregistrée pour le moment。",
        section_title_premium: "Fonctionnalités Premium",
        premium_feature_trends_title: "Tendances historiques",
        premium_feature_trends_desc: "Suivez votre consommation sur des semaines, des mois et des années。",
        premium_feature_insights_title: "Insights personnalisés",
        premium_feature_insights_desc: "Conseils basés sur l'IA et vos habitudes uniques。",
        premium_unlocked_trends: "Tendances historiques débloquées!",
        premium_unlocked_trends_desc: "Visualisez vos habitudes de consommation au fil du temps。",
        premium_unlocked_insights: "Insights personnalisés débloqués!",
        premium_unlocked_insights_desc: "Recevez des commentaires basés sur l'IA concernant vos habitudes。",
        modal_title: "Enregistrer une boisson",
        modal_drink_type: "Type de boisson",
        modal_volume: "Volume (ml)",
        modal_abv: "ABV (%)",
        modal_add_button: "Ajouter au journal",
        drink_beer: "Bière",
        drink_wine: "Vin",
        drink_spirit: "Spiritueux (Shot)",
        drink_liqueur: "Liqueur",
        drink_sake: "Saké",
        drink_soju: "Soju",
        impact_low: "Faible",
        impact_moderate: "Modéré",
        impact_high: "Élevé",
        impact_nominal: "Impact nominal à ce niveau。",
        impact_noticeable: (func: string) => `Altération notable de ${func}`,
        impact_significant: (func: string) => `Perturbation significative de ${func}`,
        ai_coach_title: "Insight du Coach IA",
        ai_coach_generating: "Génération de l'insight...",
        ai_coach_no_key: "Le Coach IA est désactivé。Une clé API Gemini est requise pour cette fonction。",
        premium_modal_title: "Débloquer Premium!",
        premium_modal_text: "Accédez aux tendances historiques, aux insights IA avancés et plus encore en passant au Premium!",
        premium_modal_button: "Débloquer maintenant",
        premium_dashboard_title: "Tableau de bord Premium",
        historical_trends_title: "Vos tendances hebdomadaires",
        long_term_insights_title: "Insights IA à long terme",
        chart_loading: "Chargement des données historiques...",
        chart_no_data: "Pas assez de données pour afficher les tendances。Continuez à enregistrer vos boissons!",
        quick_log_title: "Ajout rapide",
        quick_add_beer_standard: "Pinte de bière (4.5%)",
        quick_add_wine_glass: "Grand verre de vin (175ml, 13%)",
        quick_add_spirit_single: "Simple shot (25ml, 40%)",
        quick_add_cider: "Pinte de cidre (4.5%)",
        quick_add_cocktail: "Cocktail (100ml, 20%)",
        quick_add_beer_can: "Canette de bière (355ml, 5%)",
        quick_add_wine_glass_us: "Verre de vin (147ml, 12%)",
        quick_add_spirit_shot_us: "Shot (44ml, 40%)",
        quick_add_cider_can: "Canette de cidre (355ml, 5%)",
        quick_add_cocktail_us: "Cocktail (150ml, 20%)",
        region_selector_title: "Région",
        region_uk: "Royaume-Uni",
        region_us: "États-Unis",
        region_au: "Australie",
        region_de: "Allemagne",
        reminder_title: "Temps d'enregistrer?",
        reminder_text: "N'oubliez pas d'enregistrer vos dernières boissons pour que vos informations restent exacts!",
        reminder_log_button: "Enregistrer maintenant",
        reminder_dismiss_button: "Rejeter",
        region_frontalLobe: "Lobe frontal",
        region_temporalLobe: "Lobe temporal",
        region_parietalLobe: "Lobe pariétal",
        region_occipitalLobe: "Lobe occipital",
        region_cerebellum: "Cervelet",
        region_brainstem: "Tronc cérébral",
        manage_quick_adds: "Gérer les ajouts rapides",
        add_custom_quick_add: "Ajouter un ajout rapide personnalisé",
        edit_custom_quick_add: "Modifier l'ajout rapide personnalisé",
        custom_quick_add_label: "Étiquette du bouton",
        custom_quick_add_type: "Type de boisson",
        custom_quick_add_volume: "Volume (ml)",
        abv: "ABV (%)",
        save_quick_add: "Enregistrer l'ajout rapide",
        delete_quick_add: "Supprimer",
        no_custom_quick_adds: "Aucun ajout rapide personnalisé pour le moment。",
        daily_goal_title: "Objectif d'alcool quotidien",
        set_goal: "Définir l'objectif (grammes)",
        current_progress: "Progrès actuel",
        goal_set_success: "Objectif quotidien défini!",
        goal_delete_success: "Objectif quotidien supprimé。",
        goal_not_set: "Aucun objectif quotidien défini。",
        goal_exceeded: "Objectif dépassé!",
        goal_remaining: "restant",
        achievements_title: "Réalisations",
        achievement_first_log_name: "Première gorgée",
        achievement_first_log_desc: "Vous avez enregistré votre première boisson!",
        achievement_7_day_streak_name: "Série de 7 jours",
        achievement_7_day_streak_desc: "Boissons enregistrées pendant 7 jours consécutifs!",
        achievement_30_day_streak_name: "Série de 30 jours",
        achievement_30_day_streak_desc: "Boissons enregistrées pendant 30 jours consécutifs!",
        achievement_5_goal_name: "Novice de l'objectif",
        achievement_5_goal_desc: "Atteint votre objectif quotidien 5 fois!",
        achievement_10_drinks_name: "Buveur social",
        achievement_10_drinks_desc: "10 boissons enregistrées!",
        achievement_50_drinks_name: "Enregistreur régulier",
        achievement_50_drinks_desc: "50 boissons enregistrées!",
        achievement_100_drinks_name: "Traqueur dédié",
        achievement_100_drinks_desc: "100 boissons enregistrées!",
        no_achievements_yet: "Aucune réalisation débloquée pour le moment。Continuez à enregistrer!",
        share_progress_button: "Partager les progrès",
        share_message_goal: "Aujourd'hui, j'ai consommé {grams}g d'alcool, restant dans mon objectif de {goal}g avec LumenDose! #ConsommationResponsable #LumenDose",
        share_message_over_goal: "Aujourd'hui, j'ai consommé {grams}g d'alcool, dépassant mon objectif de {goal}g。Temps de réfléchir avec LumenDose! #ParcoursDeSanté #LumenDose",
        share_message_no_goal: "Aujourd'hui, j'ai consommé {grams}g d'alcool。Suivez votre consommation avec LumenDose! #ApplicationSanté",
        daily_challenge_title: "Défi quotidien",
        daily_challenge_completed: "Terminé!",
        daily_challenge_log_n_drinks: "Enregistrer au moins {value} boisson(s) aujourd'hui。",
        daily_challenge_stay_below_goal: "Restez en dessous de {value}g d'alcool aujourd'hui。",
        daily_challenge_use_custom_quick_add: "Utilisez un botón d'ajout rapide personnalisé。",
        daily_challenge_no_challenge: "Aucun défi pour aujourd's。Profitez de votre suivi!",
        current_streak: "Série actuelle",
        days: "jours",
        daily_challenge_not_completed: "Non terminé",
    },
    es: { // Spanish translations
        app_title: "LumenDosis",
        header_premium_button: "Hazte Premium",
        header_premium_status: "Premium",
        section_title_impact: "Impacto cerebral en tiempo real",
        section_subtitle_impact: "Modelo educativo de los efectos a corto plazo del alcohol。",
        label_total_alcohol: "Alcohol total",
        section_title_control: "Ingesta de alcohol",
        button_log_drink: "Registrar una bebida",
        disclaimer_title: "Descargo de responsabilidad",
        disclaimer_text: "LumenDosis es una herramienta educativa, no un consejo médico。Beba con responsabilidad。",
        section_title_log: "Registro de sesión actual",
        log_empty: "No hay bebidas registradas aún。",
        section_title_premium: "Características Premium",
        premium_feature_trends_title: "Tendencias históricas",
        premium_feature_trends_desc: "Seguimiento del consumo durante semanas, meses y años。",
        premium_feature_insights_title: "Insights personalizados",
        premium_feature_insights_desc: "Consejos con IA basados en tus patrones únicos。",
        premium_unlocked_trends: "¡Tendencias históricas desbloqueadas!",
        premium_unlocked_trends_desc: "Consulta tus patrones de consumo a lo largo del tiempo。",
        premium_unlocked_insights: "¡Insights personalizados desbloqueados!",
        premium_unlocked_insights_desc: "Recibe comentarios con IA basados en tus hábitos。",
        modal_title: "Registrar una bebida",
        modal_drink_type: "Tipo de bebida",
        modal_volume: "Volumen (ml)",
        modal_abv: "ABV (%)",
        modal_add_button: "Añadir al registro",
        drink_beer: "Cerveza",
        drink_wine: "Vino",
        drink_spirit: "Licor (Chupito)",
        drink_liqueur: "Licor",
        drink_sake: "Sake",
        drink_soju: "Soju",
        impact_low: "Bajo",
        impact_moderate: "Moderado",
        impact_high: "Alto",
        impact_nominal: "Impacto nominal en este nivel。",
        impact_noticeable: (func: string) => `Deterioro notable de ${func}`,
        impact_significant: (func: string) => `Disrupción significativa de ${func}`,
        ai_coach_title: "Insight del Coach de IA",
        ai_coach_generating: "Generando insight...",
        ai_coach_no_key: "El Coach de IA está deshabilitado。Se requiere una clave API de Gemini para esta función。",
        premium_modal_title: "¡Desbloquear Premium!",
        premium_modal_text: "Accede a tendencias históricas, insights avanzados de IA y más haciéndote Premium。",
        premium_modal_button: "Desbloquear ahora",
        premium_dashboard_title: "Panel Premium",
        historical_trends_title: "Tus tendencias semanales",
        long_term_insights_title: "Insights de IA a largo plazo",
        chart_loading: "Cargando datos históricos...",
        chart_no_data: "No hay suficientes datos para mostrar tendencias。¡Sigue registrando tus bebidas!",
        quick_log_title: "Añadir rápido",
        quick_add_beer_standard: "Pinta de Cerveza (4.5%)", // UK specific
        quick_add_wine_glass: "Copa Grande de Vino (175ml, 13%)", // UK specific
        quick_add_spirit_single: "Chupito Individual (25ml, 40%)", // UK specific
        quick_add_cider: "Pinta de Sidra (4.5%)",
        quick_add_cocktail: "Cóctel (100ml, 20%)",
        quick_add_beer_can: "Lata de Cerveza (355ml, 5%)", // US specific
        quick_add_wine_glass_us: "Copa de Vino (147ml, 12%)", // US specific
        quick_add_spirit_shot_us: "Chupito (44ml, 40%)", // US specific
        quick_add_cider_can: "Lata de Sidra (355ml, 5%)", // US specific
        quick_add_cocktail_us: "Cóctel (150ml, 20%)", // US specific
        region_selector_title: "Región",
        region_uk: "Reino Unido",
        region_us: "Estados Unidos",
        region_au: "Australia",
        region_de: "Alemania",
        reminder_title: "Es hora de registrar?",
        reminder_text: "¡No olvides registrar tus últimas bebidas para mantener tus insights precisos!",
        reminder_log_button: "Registrar ahora",
        reminder_dismiss_button: "Descartar",
        // Brain region names for translation
        region_frontalLobe: "Lóbulo frontal",
        region_temporalLobe: "Lóbulo temporal",
        region_parietalLobe: "Lóbulo parietal",
        region_occipitalLobe: "Lóbulo occipital",
        region_cerebellum: "Cerebelo",
        region_brainstem: "Tronco encefálico",
        // Custom Quick Add & Goals
        manage_quick_adds: "Administrar adiciones rápidas",
        add_custom_quick_add: "Añadir adición rápida personalizada",
        edit_custom_quick_add: "Editar adición rápida personalizada",
        custom_quick_add_label: "Etiqueta del botón",
        custom_quick_add_type: "Tipo de bebida",
        custom_quick_add_volume: "Volumen (ml)",
        abv: "ABV (%)",
        save_quick_add: "Guardar adición rápida",
        delete_quick_add: "Eliminar",
        no_custom_quick_adds: "No hay adiciones rápidas personalizadas aún。",
        daily_goal_title: "Meta diaria de alcohol",
        set_goal: "Establecer meta (gramos)",
        current_progress: "Progreso actual",
        goal_set_success: "¡Meta diaria establecida!",
        goal_delete_success: "Meta diaria eliminada。",
        goal_not_set: "No hay meta diaria establecida。",
        goal_exceeded: "¡Meta excedida!",
        goal_remaining: "restante",
        // Achievements
        achievements_title: "Logros",
        achievement_first_log_name: "Primer sorbo",
        achievement_first_log_desc: "¡Has registrado tu primera bebida!",
        achievement_7_day_streak_name: "Racha de 7 días",
        achievement_7_day_streak_desc: "¡Has registrado bebidas durante 7 días consecutivos!",
        achievement_30_day_streak_name: "Racha de 30 días",
        achievement_30_day_streak_desc: "¡Has registrado bebidas durante 30 días consecutivos!",
        achievement_5_goal_name: "Novato del objetivo",
        achievement_5_goal_desc: "¡Has alcanzado tu objetivo diario 5 veces!",
        achievement_10_drinks_name: "Bebedor social",
        achievement_10_drinks_desc: "¡Has registrado 10 bebidas!",
        achievement_50_drinks_name: "Registrador habitual",
        achievement_50_drinks_desc: "¡Has registrado 50 bebidas!",
        achievement_100_drinks_name: "Seguidor dedicado",
        achievement_100_drinks_desc: "¡Has registrado 100 bebidas!",
        no_achievements_yet: "Aún no has ganado logros。¡Sigue registrando!",
        share_progress_button: "Compartir progreso",
        share_message_goal: "¡Hoy consumí {grams}g de alcohol, manteniéndome dentro de mi objetivo de {goal}g con LumenDose! #ConsumoResponsable #LumenDose",
        share_message_over_goal: "Hoy consumí {grams}g de alcohol, superando mi objetivo de {goal}g。¡Es hora de reflexionar con LumenDose! #ViajeDeSalud #LumenDose",
        share_message_no_goal: "Hoy consumí {grams}g de alcohol。¡Registra tu consumo con LumenDose! #AppDeSalud",
        daily_challenge_title: "Desafío diario",
        daily_challenge_completed: "¡Completado!",
        daily_challenge_log_n_drinks: "Registra al menos {value} bebida(s) hoy。",
        daily_challenge_stay_below_goal: "Mantente por debajo de {value}g de alcohol hoy。",
        daily_challenge_use_custom_quick_add: "Usa un botón de adición rápida personalizada。",
        daily_challenge_no_challenge: "No hay desafío para hoy。¡Disfruta de tu seguimiento!",
        current_streak: "Racha actual",
        days: "días",
        daily_challenge_not_completed: "No completado",
    },
    ja: { // Japanese translations
        app_title: "ルーメンドーズ",
        header_premium_button: "プレミアムに移行",
        header_premium_status: "プレミアム",
        section_title_impact: "リアルタイムの脳への影響",
        section_subtitle_impact: "アルコールの短期的な影響の教育モデル。",
        label_total_alcohol: "総アルコール量",
        section_title_control: "アルコール摂取量",
        button_log_drink: "飲酒を記録",
        disclaimer_title: "免責事項",
        disclaimer_text: "ルーメンドーズは教育ツールであり、医療アドバイスではありません。責任を持って飲酒してください。",
        section_title_log: "現在のセッションログ",
        log_empty: "まだ飲酒が記録されていません。",
        section_title_premium: "プレミアム機能",
        premium_feature_trends_title: "履歴トレンド",
        premium_feature_trends_desc: "数週間、数ヶ月、数年間の消費量を追跡します。",
        premium_feature_insights_title: "パーソナライズされたインサイト",
        premium_feature_insights_desc: "独自のパターンに基づいたAIパワードのアドバイス。",
        premium_unlocked_trends: "履歴トレンドがアンロックされました！",
        premium_unlocked_trends_desc: "時間の経過とともに消費パターンを視覚化します。",
        premium_unlocked_insights: "パーソナライズされたインサイトがアンロックされました！",
        premium_unlocked_insights_desc: "習慣に基づいたAI駆動のフィードバックを受け取ります。",
        modal_title: "飲酒を記録",
        modal_drink_type: "飲み物の種類",
        modal_volume: "容量 (ml)",
        modal_abv: "ABV (%)",
        modal_add_button: "ログに追加",
        drink_beer: "ビール",
        drink_wine: "ワイン",
        drink_spirit: "スピリッツ (ショット)",
        drink_liqueur: "リキュール",
        drink_sake: "日本酒",
        drink_soju: "焼酎",
        impact_low: "低い",
        impact_moderate: "中程度",
        impact_high: "高い",
        impact_nominal: "このレベルでの名目上の影響。",
        impact_noticeable: (func: string) => `${func}への顕著な障害`,
        impact_significant: (func: string) => `${func}の重大な中断`,
        ai_coach_title: "AIコーチのインサイト",
        ai_coach_generating: "インサイトを生成中...",
        ai_coach_no_key: "AIコーチは無効です。この機能にはGemini APIキーが必要です。",
        premium_modal_title: "プレミアムをアンロック！",
        premium_modal_text: "プレミアムに移行して、履歴トレンド、高度なAIインサイトなどにアクセスしましょう！",
        premium_modal_button: "今すぐアンロック",
        premium_dashboard_title: "プレミアムダッシュボード",
        historical_trends_title: "週次トレンド",
        long_term_insights_title: "長期AIインサイト",
        chart_loading: "履歴データを読み込み中...",
        chart_no_data: "トレンドを表示するのに十分なデータがありません。飲酒を記録し続けてください！",
        quick_log_title: "クイック追加",
        quick_add_beer_standard: "パイントビール (4.5%)",
        quick_add_wine_glass: "大きなワイングラス (175ml, 13%)",
        quick_add_spirit_single: "シングルショット (25ml, 40%)",
        quick_add_cider: "パイントサイダー (4.5%)",
        quick_add_cocktail: "カクテル (100ml, 20%)",
        quick_add_beer_can: "缶ビール (355ml, 5%)",
        quick_add_wine_glass_us: "ワイングラス (147ml, 12%)",
        quick_add_spirit_shot_us: "ショット (44ml, 40%)",
        quick_add_cider_can: "缶サイダー (355ml, 5%)",
        quick_add_cocktail_us: "カクテル (150ml, 20%)",
        region_selector_title: "地域",
        region_uk: "イギリス",
        region_us: "アメリカ合衆国",
        region_au: "オーストラリア",
        region_de: "ドイツ",
        reminder_title: "記録する時間ですか？",
        reminder_text: "正確なインサイトを維持するために、最近の飲酒を記録することを忘れないでください！",
        reminder_log_button: "今すぐ記録",
        reminder_dismiss_button: "閉じる",
        // Brain region names for translation
        region_frontalLobe: "前頭葉",
        region_temporalLobe: "側頭葉",
        region_parietalLobe: "頭頂葉",
        region_occipitalLobe: "後頭葉",
        region_cerebellum: "小脳",
        region_brainstem: "脳幹",
        // Custom Quick Add & Goals
        manage_quick_adds: "クイック追加を管理",
        add_custom_quick_add: "カスタムクイック追加を追加",
        edit_custom_quick_add: "カスタムクイック追加を編集",
        custom_quick_add_label: "ボタンのラベル",
        custom_quick_add_type: "飲み物の種類",
        custom_quick_add_volume: "容量 (ml)",
        abv: "ABV (%)",
        save_quick_add: "クイック追加を保存",
        delete_quick_add: "削除",
        no_custom_quick_adds: "カスタムクイック追加はまだありません。",
        daily_goal_title: "1日のアルコール目標",
        set_goal: "目標設定 (グラム)",
        current_progress: "現在の進捗",
        goal_set_success: "1日の目標が設定されました！",
        goal_delete_success: "1日の目標が削除されました。",
        goal_not_set: "1日の目標が設定されていません。",
        goal_exceeded: "目標超過！",
        goal_remaining: "残り",
    }
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
// Updated brainRegionsData to precisely match the Picture1_0.webp image
const brainRegionsData: { [key: string]: { name: string; functions: string; sensitivity: number; path: string; labelCoords: { x: number; y: number; textAnchor: string; }; } } = {
    // Frontal Lobe (Top-left, light blue/cyan in image)
    frontalLobe: {
        name: "region_frontalLobe",
        functions: "Judgment, planning, social conduct, and speech.",
        sensitivity: 1.2,
        path: "M10,120 L10,60 C20,30,80,10,150,20 C160,30,150,50,130,70 L60,110 Z",
        labelCoords: { x: 70, y: 55, textAnchor: "middle" } 
    },
    // Parietal Lobe (Top-middle, pink/light purple in image)
    parietalLobe: {
        name: "region_parietalLobe",
        functions: "Sensory information, perception, and spatial awareness.",
        sensitivity: 0.9,
        path: "M150,20 C200,5,250,10,270,50 L250,80 C230,90,190,80,150,70 C140,50,140,30,150,20 Z",
        labelCoords: { x: 205, y: 45, textAnchor: "middle" }
    },
    // Occipital Lobe (Top-right, dark teal/blue in image)
    occipitalLobe: {
        name: "region_occipitalLobe",
        functions: "Visual processing and interpretation.",
        sensitivity: 0.8,
        path: "M270,50 C290,70,290,100,270,130 L250,110 C240,90,250,70,270,50 Z",
        labelCoords: { x: 270, y: 90, textAnchor: "middle" }
    },
    // Temporal Lobe (Bottom-left, green in image)
    temporalLobe: {
        name: "region_temporalLobe",
        functions: "Auditory processing and language comprehension.",
        sensitivity: 1.0,
        path: "M60,110 L130,70 C150,80,140,110,120,140 C100,160,50,180,30,170 C10,150,30,130,60,110 Z",
        labelCoords: { x: 80, y: 130, textAnchor: "middle" }
    },
    // Cerebellum (Bottom-right, orange in image)
    cerebellum: {
        name: "region_cerebellum",
        functions: "Coordination, balance, and motor control.",
        sensitivity: 1.5,
        path: "M250,110 L270,130 C280,160,260,190,220,180 C180,170,160,150,180,130 C200,110,220,120,250,110 Z",
        labelCoords: { x: 220, y: 150, textAnchor: "middle" }
    },
    // Brainstem (Bottom-middle, red in image)
    brainstem: {
        name: "region_brainstem",
        functions: "Controls vital functions like breathing, heart rate, and consciousness.",
        sensitivity: 2.0,
        path: "M120,140 C140,160,160,180,140,200 C120,220,90,210,100,180 C110,160,110,150,120,140 Z",
        labelCoords: { x: 120, y: 175, textAnchor: "middle" }
    },
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
        // Use the translation key for the name
        analysis[key] = { name: region.name, impact: regionImpact, effectText, impactColor, impactWord };
    });
    return analysis;
};

// --- React Components ---

const BrainVisual: FC<{ analysis: Analysis | null; drinkCount: number }> = ({ analysis, drinkCount }) => {
    const getFillColor = (key: string, impact: number) => {
        // Base colors from the provided image (Picture1_0.webp)
        const baseColors: { [key: string]: string } = {
            frontalLobe: '#00BFFF',   // Deep Sky Blue (approx Cyan/Light blue from image)
            parietalLobe: '#FF69B4',  // Hot Pink (approx Pink/Purple from image)
            occipitalLobe: '#008B8B', // Dark Cyan (approx Dark blue/teal from image)
            temporalLobe: '#32CD32',  // Lime Green (approx Green from image)
            cerebellum: '#FFA500',    // Orange (approx Orange/Yellow from image)
            brainstem: '#FF4500'     // Orange Red (approx Red from image)
        };

        const baseColor = baseColors[key] || 'rgba(59, 130, 246, 0.2)'; // Fallback

        // Convert hex to rgba to apply transparency for layering if needed
        const hexToRgba = (hex: string, alpha: number) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };

        if (impact === 0) {
            return hexToRgba(baseColor, 0.6); // Base regions are slightly transparent
        } else {
            // For impacted regions, use a more vibrant, semi-transparent impact color
            if (impact > 3.5) return hexToRgba('#EF4444', 0.8); // Red for High (Tailwind red-500)
            if (impact > 1.5) return hexToRgba('#FACC15', 0.8); // Yellow for Moderate (Tailwind yellow-400)
            return hexToRgba('#4ADE80', 0.7); // Green for Low (Tailwind green-500)
        }
    };
    
    // The specific brain dimensions from the image for accurate scaling
    // Estimate bounding box of the brain outline in Picture1_0.webp
    const brainImageWidth = 280; // Approximate max X range
    const brainImageHeight = 220; // Approximate max Y range

    // Scale factor to make the brain fit within the 300x300 container
    const containerSize = 300;
    const scaleFactor = Math.min(containerSize / brainImageWidth, containerSize / brainImageHeight) * 0.9; // Use 90% of available space to add some padding

    // Calculate translation to center the brain after scaling.
    // Adjusted X translation to shift left more for better centering in its horizontal view
    const finalTranslateX = (containerSize - (brainImageWidth * scaleFactor)) / 2 - 40; 
    const finalTranslateY = (containerSize - (brainImageHeight * scaleFactor)) / 2;
    
    return (
        <div className="relative w-full mx-auto aspect-square flex items-center justify-center overflow-hidden">
            {/* Background grid - unchanged */}
            <svg viewBox="0 0 300 300" className="w-full h-full absolute inset-0">
                <defs>
                    <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                        <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(107, 114, 128, 0.1)" strokeWidth="1"/>
                    </pattern>
                </defs>
                <rect width="300" height="300" fill="url(#grid)" />
            </svg>

            {/* Main brain SVG container */}
            {/* The viewBox is based on the internal brain image dimensions. */}
            <svg width="300" height="300" viewBox={`0 0 ${brainImageWidth} ${brainImageHeight}`} className="relative z-10 drop-shadow-lg w-[95%] h-[95%]"> 
                <defs>
                    {/* Filter for glow effect */}
                    <filter id="glow">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <linearGradient id="rgbGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#ff0000" /> 
                        <stop offset="33%" stopColor="#39FF14" /> 
                        <stop offset="66%" stopColor="#00FFFF" /> 
                        <stop offset="100%" stopColor="#FF00FF" /> 
                        <animate attributeName="x1" from="0%" to="100%" dur="4s" repeatCount="indefinite" />
                        <animate attributeName="x2" from="100%" to="200%" dur="4s" repeatCount="indefinite" />
                    </linearGradient>
                </defs>

                {/* Apply overall transformation to scale and translate the entire brain group */}
                <g transform={`translate(${finalTranslateX}, ${finalTranslateY}) scale(${scaleFactor})`}>

                    {/* Draw brain regions and apply fill/pulse animation */}
                    {Object.keys(brainRegionsData).map((key) => {
                        const regionAnalysis = analysis ? analysis[key] : { impact: 0 };
                        const fillColor = getFillColor(key, regionAnalysis.impact); // Pass key to get base color
                        const duration = 4 - (regionAnalysis.impact * 0.5);
                        return (
                            <path
                                key={`path-fill-${key}`}
                                d={brainRegionsData[key].path}
                                fill={fillColor}
                                stroke="black" // Use black outline for internal regions as per image
                                strokeWidth="0.8" // Thicker border for definition
                                className="brain-region"
                                style={{
                                    '--pulse-duration': `${duration}s`,
                                    animationName: regionAnalysis.impact > 0 ? 'pulse-fill' : 'none',
                                    transition: 'fill 0.5s ease-in-out'
                                } as React.CSSProperties}
                                filter={regionAnalysis.impact > 0 ? "url(#glow)" : "none"} // Apply glow when impacted
                            />
                        );
                    })}

                    {/* Draw neural paths with animation (for active regions) */}
                    {Object.keys(brainRegionsData).map((key, i) => {
                        const regionAnalysis = analysis ? analysis[key] : { impact: 0 };
                        const duration = 4 - (regionAnalysis.impact * 0.5);
                        return (
                            <path
                                key={`path-rgb-${key}`}
                                d={brainRegionsData[key].path}
                                fill="none"
                                stroke={analysis && regionAnalysis.impact > 0 ? "url(#rgbGradient)" : "none"}
                                strokeWidth="1.8" // Slightly thicker for more visibility
                                strokeDasharray="6 8" // Adjusted dash for effect
                                className="neural-path"
                                style={{'--duration': `${duration}s`, '--delay': `${i * 0.1}s`} as React.CSSProperties}
                                filter={regionAnalysis.impact > 0 ? "url(#glow)" : "none"} // Apply glow when impacted
                            />
                        );
                    })}
                    
                    {/* Add labels for each brain region */}
                    <g className="text-sm font-bold" style={{ pointerEvents: 'none' }}>
                        {Object.keys(brainRegionsData).map((key) => {
                            const region = brainRegionsData[key];
                            return (
                                <text 
                                    key={`label-${key}`}
                                    x={region.labelCoords.x} 
                                    y={region.labelCoords.y} 
                                    textAnchor={region.labelCoords.textAnchor} 
                                    fill="white"
                                    className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" // More pronounced shadow
                                >
                                    {t(region.name).charAt(0)} {/* Display only the first letter */}
                                </text>
                            );
                        })}
                    </g>

                </g> {/* End of overall brain group transform */}

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
const AICoach: FC<{ drinks: Drink[]; analysis: Analysis | null; dailyAlcoholGoal: number | null; }> = ({ drinks, analysis, dailyAlcoholGoal }) => {
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

        let goalContext = "";
        if (dailyAlcoholGoal !== null && dailyAlcoholGoal > 0) {
            const currentGrams = parseFloat(totalGrams);
            if (currentGrams > dailyAlcoholGoal) {
                goalContext = `They have exceeded their daily goal of ${dailyAlcoholGoal}g by ${(currentGrams - dailyAlcoholGoal).toFixed(1)}g.`;
            } else {
                goalContext = `They are currently at ${currentGrams}g towards their daily goal of ${dailyAlcoholGoal}g.`;
            }
        }

        const prompt = `
            As an expert on the science of alcohol's effects, you are an AI Coach for the app LumenDose. 
            A user has logged the following drinks: ${sessionSummary}.
            This amounts to ${totalGrams}g of alcohol.
            Session context: ${pacingContext} ${compositionContext}
            The current analysis shows the highest impact is on the ${t(highestImpactRegion.name)}, which affects ${highestImpactRegionData?.functions}.
            ${goalContext}
            
            Based on all this context, provide a single, concise, actionable, and non-judgmental insight (around 20-30 words). 
            Focus on a specific, helpful suggestion related to their current drinking pattern (pacing, composition, hydration, etc., and goal adherence if applicable).
            Do not use generic phrases like "drink responsibly". Be specific and encouraging.
            Example for rapid pace: "We've noticed a rapid pace. A 30-minute break before your next drink can help lessen the overall impact."
            Example for high-ABV drinks: "This session is focused on high-ABV drinks. Considering a lower-ABV option next could moderate the effects on your coordination."
            Example for goal exceeded: "You've passed your daily goal. Consider switching to water or stopping for the night to support your health."
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
    }, [drinks, analysis, t, dailyAlcoholGoal]);

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

// Added showDateTimePicker prop to control visibility of date/time pickers
const DrinkModal: FC<{ isOpen: boolean; onClose: () => void; onLogDrink: (drink: Omit<Drink, 'id'>) => void; initialDrinkData?: { type: string; volume: number; abv: number; }; currentRegion: string; showDateTimePicker?: boolean; }> = ({ isOpen, onClose, onLogDrink, initialDrinkData, currentRegion, showDateTimePicker = false }) => {
    const { t } = useTranslation();
    const [drinkType, setDrinkType] = useState('beer');
    const [volume, setVolume] = useState(355);
    const [abv, setAbv] = useState(5);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
    const [selectedTime, setSelectedTime] = useState<string>(new Date().toTimeString().split(' ')[0].substring(0, 5)); // HH:MM
    
    // Using globalDrinkPresets based on the currentRegion
    const drinkPresets = globalDrinkPresets[currentRegion] || globalDrinkPresets['uk'];

    useEffect(() => {
        if (isOpen) {
            if (initialDrinkData) {
                setDrinkType(initialDrinkData.type);
                setVolume(initialDrinkData.volume);
                setAbv(initialDrinkData.abv);
            } else {
                const defaultType = 'beer';
                setDrinkType(defaultType);
                const preset = drinkPresets[defaultType];
                setVolume(preset.volume);
                setAbv(preset.abv);
            }
            // Always reset date/time to current when modal opens, unless initial data provides it
            if (!initialDrinkData) {
                const now = new Date();
                setSelectedDate(now.toISOString().split('T')[0]);
                setSelectedTime(now.toTimeString().split(' ')[0].substring(0, 5));
            }
        }
    }, [isOpen, initialDrinkData, drinkPresets]);

    const handleDrinkTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newType = e.target.value;
        setDrinkType(newType);
        const preset = drinkPresets[newType] || drinkPresets['beer'];
        setVolume(preset.volume);
        setAbv(preset.abv);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Construct timestamp based on whether date/time pickers are shown
        let timestamp: string;
        if (showDateTimePicker) {
            timestamp = new Date(`${selectedDate}T${selectedTime}`).toISOString();
        } else {
            timestamp = new Date().toISOString();
        }
        
        const alcoholGrams = (volume * (abv / 100) * 0.789);
        onLogDrink({ type: drinkType, volume: Number(volume), abv: Number(abv), alcoholGrams, timestamp });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-md border border-gray-700">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-white">{t('modal_title')}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-300 mb-2">{t('modal_drink_type')}</label>
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
                            <input type="number" value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">{t('modal_abv')}</label>
                            <input type="number" value={abv} step="0.1" onChange={(e) => setAbv(Number(e.target.value))} className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                        </div>
                    </div>

                    {showDateTimePicker && (
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Date</label>
                                <input 
                                    type="date" 
                                    value={selectedDate} 
                                    onChange={(e) => setSelectedDate(e.target.value)} 
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" 
                                    max={new Date().toISOString().split('T')[0]} // Prevent future dates
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Time</label>
                                <input 
                                    type="time" 
                                    value={selectedTime} 
                                    onChange={(e) => setSelectedTime(e.target.value)} 
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" 
                                />
                            </div>
                        </div>
                    )}

                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-300 flex items-center justify-center gap-2"><Plus size={20} /> {t('modal_add_button')}</button>
                </form>
            </div>
        </div>
    );
};

const PremiumModal: FC<{ isOpen: boolean; onClose: () => void; onConfirm: () => void; isLoading: boolean; }> = ({ isOpen, onClose, onConfirm, isLoading }) => {
    const { t } = useTranslation();
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-gray-700 text-center">
                <div className="flex justify-end">
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
                </div>
                <div className="flex justify-center mb-4">
                    <Star className="text-yellow-400" size={40} />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">{t('premium_modal_title')}</h2>
                <p className="text-gray-300 mb-6">{t('premium_modal_text')}</p>
                <button onClick={onConfirm} disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait">
                    {isLoading ? "Redirecting..." : t('premium_modal_button')}
                </button>
            </div>
        </div>
    );
};

const PremiumFeature: FC<{ title: string; description: string; icon: ReactNode; onUpgrade: () => void; isAuthReady: boolean; }> = ({ title, description, icon, onUpgrade, isAuthReady }) => (
    <div className="relative bg-gray-800 p-4 rounded-lg border border-gray-700 overflow-hidden">
        <div className="flex items-center mb-2">{icon}<h4 className="font-bold ml-2 text-gray-200">{title}</h4></div>
        <p className="text-xs text-gray-400">{description}</p>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center">
            <Lock className="text-yellow-400 mb-2" size={24} />
            <button onClick={onUpgrade} disabled={!isAuthReady} className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 text-xs font-bold py-1 px-3 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Upgrade to Unlock</button>
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

const RegionSwitcher: FC<{ currentRegion: string; setRegion: (region: string) => void }> = ({ currentRegion, setRegion }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const regions: { [key: string]: string } = {
        uk: t('region_uk') as string,
        us: t('region_us') as string,
        au: t('region_au') as string,
        de: t('region_de') as string,
    };
    return (
        <div className="relative">
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 text-gray-300 hover:text-white">
                <Globe size={20} />
                <span className="hidden sm:inline">{regions[currentRegion]}</span>
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
                    {Object.entries(regions).map(([code, name]) => (
                        <button key={code} onClick={() => { setRegion(code); setIsOpen(false); }}
                            className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700">
                            {name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

interface ManageQuickAddsModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string | null;
    db: Firestore | null;
    onQuickAddUpdated: () => void;
}
const ManageQuickAddsModal: FC<ManageQuickAddsModalProps> = ({ isOpen, onClose, userId, db, onQuickAddUpdated }) => {
    const { t } = useTranslation();
    const [customQuickAdds, setCustomQuickAdds] = useState<CustomQuickAdd[]>([]);
    const [newLabel, setNewLabel] = useState('');
    const [newType, setNewType] = useState('beer');
    const [newVolume, setNewVolume] = useState(330);
    const [newAbv, setNewAbv] = useState(5);
    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        let unsubscribe: (() => void) | undefined;
        if (isOpen && db && userId) {
            const q = query(collection(db, `artifacts/${appId}/users/${userId}/customQuickAdds`));
            unsubscribe = onSnapshot(q, (snapshot) => {
                const fetchedQuickAdds: CustomQuickAdd[] = [];
                snapshot.forEach(doc => {
                    fetchedQuickAdds.push({ id: doc.id, ...doc.data() } as CustomQuickAdd);
                });
                setCustomQuickAdds(fetchedQuickAdds);
            });
        }
        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [isOpen, db, userId]);

    const handleSaveQuickAdd = async () => {
        if (!db || !userId || !newLabel || !newType || newVolume <= 0 || newAbv < 0) return;
        const newQuickAddData = {
            label: newLabel,
            type: newType,
            volume: newVolume,
            abv: newAbv,
        };
        try {
            if (editingId) {
                await setDoc(doc(db, `artifacts/${appId}/users/${userId}/customQuickAdds`, editingId), newQuickAddData);
            } else {
                await addDoc(collection(db, `artifacts/${appId}/users/${userId}/customQuickAdds`), newQuickAddData);
            }
            onQuickAddUpdated();
            setNewLabel('');
            setNewType('beer');
            setNewVolume(330);
            setNewAbv(5);
            setEditingId(null);
        } catch (error) {
            console.error("Error saving quick add:", error);
        }
    };

    const handleDeleteQuickAdd = async (id: string) => {
        if (!db || !userId) return;
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/customQuickAdds`, id));
            onQuickAddUpdated();
        } catch (error) {
            console.error("Error deleting quick add:", error);
        }
    };

    const handleEditClick = (quickAdd: CustomQuickAdd) => {
        setEditingId(quickAdd.id || null);
        setNewLabel(quickAdd.label);
        setNewType(quickAdd.type);
        setNewVolume(quickAdd.volume);
        setNewAbv(quickAdd.abv);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-2xl border border-gray-700">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-white">{t('manage_quick_adds')}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg mb-6">
                    <h3 className="text-xl font-bold text-white mb-3">{editingId ? t('edit_custom_quick_add') : t('add_custom_quick_add')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">{t('custom_quick_add_label')}</label>
                            <input type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g., My Craft Beer" className="w-full bg-gray-600 border border-gray-500 rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">{t('custom_quick_add_type')}</label>
                            <select value={newType} onChange={(e) => setNewType(e.target.value)} className="w-full bg-gray-600 border border-gray-500 rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
                                <option value="beer">{t('drink_beer')}</option>
                                <option value="wine">{t('drink_wine')}</option>
                                <option value="spirit">{t('drink_spirit')}</option>
                                <option value="cider">{t('quick_add_cider')}</option>
                                <option value="cocktail">{t('quick_add_cocktail')}</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">{t('custom_quick_add_volume')}</label>
                            <input type="number" value={newVolume} onChange={(e) => setNewVolume(Number(e.target.value))} className="w-full bg-gray-600 border border-gray-500 rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">{t('custom_quick_add_abv')}</label>
                            <input type="number" value={newAbv} step="0.1" onChange={(e) => setNewAbv(Number(e.target.value))} className="w-full bg-gray-600 border border-gray-500 rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                        </div>
                    </div>
                    <button onClick={handleSaveQuickAdd} className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
                        <Save size={20} /> {t('save_quick_add')}
                    </button>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Your Custom Quick Adds</h3>
                <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                    {customQuickAdds.length > 0 ? (
                        customQuickAdds.map(qa => (
                            <div key={qa.id} className="flex items-center justify-between bg-gray-700 p-3 rounded-lg">
                                <div>
                                    <p className="font-semibold text-white">{qa.label}</p>
                                    <p className="text-xs text-gray-400">{qa.volume}ml, {qa.abv}% ABV ({t(`drink_${qa.type.toLowerCase()}`) || qa.type})</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleEditClick(qa)} className="text-blue-400 hover:text-blue-300"><Edit size={18} /></button>
                                    <button onClick={() => qa.id && handleDeleteQuickAdd(qa.id)} className="text-red-400 hover:text-red-300"><Trash2 size={16} /></button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-center text-gray-500 py-4">{t('no_custom_quick_adds')}</p>
                    )}
                </div>
            </div>
        </div>
    );
};

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
            const weeklyData: { [key: string]: number } = {};
            allDrinks.forEach(drink => {
                const date = new Date(drink.timestamp);
                const year = date.getFullYear();
                const week = Math.floor((date.getTime() - new Date(year, 0, 1).getTime()) / (1000 * 60 * 60 * 24 * 7));
                const weekKey = `${year}-W${week}`;
                if (!weeklyData[weekKey]) {
                    weeklyData[weekKey] = 0;
                }
                weeklyData[weekKey] += 1;
            });
            const chartData = Object.entries(weeklyData).map(([name, drinks]) => ({ name, drinks })).slice(-8);
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

const LongTermAICoach: FC<{ db: Firestore | null; userId: string | null; dailyAlcoholGoal: number | null; }> = ({ db, userId, dailyAlcoholGoal }) => {
    const { t } = useTranslation();
    const [insight, setInsight] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isKeyMissing, setIsKeyMissing] = useState(false);
    const [drinks, setDrinks] = useState<Drink[]>([]);
    const [analysis, setAnalysis] = useState<Analysis | null>(null);

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

        let goalContext = "";
        if (dailyAlcoholGoal !== null && dailyAlcoholGoal > 0) {
            const currentGrams = parseFloat(totalGrams);
            if (currentGrams > dailyAlcoholGoal) {
                goalContext = `They have exceeded their daily goal of ${dailyAlcoholGoal}g by ${(currentGrams - dailyAlcoholGoal).toFixed(1)}g.`;
            } else {
                goalContext = `They are currently at ${currentGrams}g towards their daily goal of ${dailyAlcoholGoal}g.`;
            }
        }

        const prompt = `
            As an expert on the science of alcohol's effects, you are an AI Coach for the app LumenDose. 
            A user has logged the following drinks: ${sessionSummary}.
            This amounts to ${totalGrams}g of alcohol.
            Session context: ${pacingContext} ${compositionContext}
            The current analysis shows the highest impact is on the ${t(highestImpactRegion.name)}, which affects ${highestImpactRegionData?.functions}.
            ${goalContext}
            
            Based on all this context, provide a single, concise, actionable, and non-judgmental insight (around 20-30 words). 
            Focus on a specific, helpful suggestion related to their current drinking pattern (pacing, composition, hydration, etc., and goal adherence if applicable).
            Do not use generic phrases like "drink responsibly". Be specific and encouraging.
            Example for rapid pace: "We've noticed a rapid pace. A 30-minute break before your next drink can help lessen the overall impact."
            Example for high-ABV drinks: "This session is focused on high-ABV drinks. Considering a lower-ABV option next could moderate the effects on your coordination."
            Example for goal exceeded: "You've passed your daily goal. Consider switching to water or stopping for the night to support your health."
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
    }, [db, userId, t, dailyAlcoholGoal, drinks, analysis]);

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

const PremiumDashboard: FC<{ db: Firestore | null; userId: string | null; dailyAlcoholGoal: number | null; }> = ({ db, userId, dailyAlcoholGoal }) => {
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
            <LongTermAICoach db={db} userId={userId} dailyAlcoholGoal={dailyAlcoholGoal} />
        </div>
    );
};

interface DailyGoalProps {
    userId: string | null;
    db: Firestore | null;
    dailyAlcoholGoal: number | null;
    setDailyAlcoholGoal: (goal: number | null) => void;
    totalAlcoholToday: number;
}
const DailyGoal: FC<DailyGoalProps> = ({ userId, db, dailyAlcoholGoal, setDailyAlcoholGoal, totalAlcoholToday }) => {
    const { t } = useTranslation();
    const [goalInput, setGoalInput] = useState<string>(dailyAlcoholGoal?.toString() || '');
    const [message, setMessage] = useState('');

    useEffect(() => {
        setGoalInput(dailyAlcoholGoal?.toString() || '');
    }, [dailyAlcoholGoal]);

    const handleSetGoal = async () => {
        if (!db || !userId) return;
        const newGoal = parseFloat(goalInput);
        if (isNaN(newGoal) || newGoal <= 0) {
            setMessage("Please enter a valid positive number for your goal.");
            return;
        }
        try {
            await setDoc(doc(db, `artifacts/${appId}/users/${userId}/goals/dailyAlcohol`), { goal: newGoal });
            setDailyAlcoholGoal(newGoal);
            setMessage(t('goal_set_success'));
            setTimeout(() => setMessage(''), 3000);
        }
        catch (error) {
            console.error("Error setting goal:", error);
            setMessage("Failed to set goal.");
        }
    };

    const handleDeleteGoal = async () => {
        if (!db || !userId) return;
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/goals/dailyAlcohol`));
            setDailyAlcoholGoal(null);
            setGoalInput('');
            setMessage(t('goal_delete_success'));
            setTimeout(() => setMessage(''), 3000);
        }
        catch (error) {
            console.error("Error deleting goal:", error);
            setMessage("Failed to delete goal.");
        }
    };

    const progress = dailyAlcoholGoal ? Math.min((totalAlcoholToday / dailyAlcoholGoal) * 100, 100) : 0;
    const progressBarColor = progress >= 100 ? 'bg-red-500' : progress > 75 ? 'bg-yellow-500' : 'bg-green-500';

    return (
        <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
            <h3 className="text-xl font-bold text-white mb-4">{t('daily_goal_title')}</h3>
            <div className="flex items-center gap-2 mb-4">
                <input
                    type="number"
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    placeholder={t('set_goal') as string}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button onClick={handleSetGoal} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors">
                    <Save size={20} />
                </button>
                {dailyAlcoholGoal !== null && (
                    <button onClick={handleDeleteGoal} className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors">
                        <Trash2 size={20} />
                    </button>
                )}
            </div>
            {message && <p className="text-sm text-center text-green-400 mb-4">{message}</p>}
            <div className="mb-2">
                <p className="text-gray-300 text-sm">{t('current_progress')}: {totalAlcoholToday.toFixed(1)}g / {dailyAlcoholGoal !== null ? `${dailyAlcoholGoal.toFixed(1)}g` : t('goal_not_set')}</p>
                {dailyAlcoholGoal !== null && totalAlcoholToday > 0 && ( // Ensure totalAlcoholToday is positive before showing progress bar
                    <div className="w-full bg-gray-700 rounded-full h-2.5 mt-2">
                        <div className={`${progressBarColor} h-2.5 rounded-full`} style={{ width: `${progress}%` }}></div>
                    </div>
                )}
            </div>
            {dailyAlcoholGoal !== null && totalAlcoholToday <= dailyAlcoholGoal && (
                <p className="text-green-400 text-sm">
                    {(dailyAlcoholGoal - totalAlcoholToday).toFixed(1)}g {t('goal_remaining')}
                </p>
            )}
            {dailyAlcoholGoal !== null && totalAlcoholToday > dailyAlcoholGoal && (
                <p className="text-red-400 text-sm font-bold">
                    {t('goal_exceeded')}! (+{(totalAlcoholToday - dailyAlcoholGoal).toFixed(1)}g)
                </p>
            )}
        </div>
    );
};

interface AchievementsModalProps {
    isOpen: boolean;
    onClose: () => void;
    achievements: Achievement[];
}
const AchievementsModal: FC<AchievementsModalProps> = ({ isOpen, onClose, achievements }) => {
    const { t } = useTranslation();
    if (!isOpen) return null;

    const allAchievements = [
        { id: "first_log", nameKey: "achievement_first_log_name", descriptionKey: "achievement_first_log_desc" },
        { id: "7_day_streak", nameKey: "achievement_7_day_streak_name", descriptionKey: "achievement_7_day_streak_desc" },
        { id: "30_day_streak", nameKey: "achievement_30_day_streak_name", descriptionKey: "achievement_30_day_streak_desc" },
        { id: "5_goal", nameKey: "achievement_5_goal_name", descriptionKey: "achievement_5_goal_desc" },
        { id: "10_drinks", nameKey: "achievement_10_drinks_name", descriptionKey: "achievement_10_drinks_desc" },
        { id: "50_drinks", nameKey: "achievement_50_drinks_name", descriptionKey: "achievement_50_drinks_desc" },
        { id: "100_drinks", nameKey: "achievement_100_drinks_name", descriptionKey: "achievement_100_drinks_desc" },
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-md border border-gray-700">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-white">{t('achievements_title')}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
                </div>
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                    {allAchievements.map(ach => {
                        const earned = achievements.find(e => e.id === ach.id);
                        return (
                            <div key={ach.id} className={`flex items-center gap-4 p-3 rounded-lg ${earned ? 'bg-green-900/30 border border-green-700' : 'bg-gray-700/30 border border-gray-600'}`}>
                                <Award size={36} className={earned ? 'text-yellow-400' : 'text-gray-500'} />
                                <div>
                                    <h4 className="font-bold text-white">{t(ach.nameKey)}</h4>
                                    <p className="text-sm text-gray-300">{t(ach.descriptionKey)}</p>
                                    {earned && <p className="text-xs text-yellow-200 mt-1">Earned: {new Date(earned.earnedDate).toLocaleDateString()}</p>}
                                </div>
                            </div>
                        );
                    })}
                    {achievements.length === 0 && <p className="text-center text-gray-500 py-4">{t('no_achievements_yet')}</p>}
                </div>
            </div>
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
    const [auth, setAuth] = useState<Auth | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [isPremium, setIsPremium] = useState(false);
    const [isConfigMissing, setIsConfigMissing] = useState(false);
    const [showReminder, setShowReminder] = useState(false);
    const [lastLogTime, setLastLogTime] = useState<number>(Date.now());
    const [userRegion, setUserRegion] = useState('uk');
    const [customQuickAdds, setCustomQuickAdds] = useState<CustomQuickAdd[]>([]);
    const [isManageQuickAddsModalOpen, setIsManageQuickAddsModalOpen] = useState(false);
    const [dailyAlcoholGoal, setDailyAlcoholGoal] = useState<number | null>(null);
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [isAchievementsModalOpen, setIsAchievementsModalOpen] = useState(false);
    const [dailyChallenge, setDailyChallenge] = useState<DailyChallenge | null>(null);
    const [isLoadingPremium, setIsLoadingPremium] = useState(false);
    const [showLateLogModal, setShowLateLogModal] = useState(false); // New state for late add modal
    const [showDynamicBrain, setShowDynamicBrain] = useState(false); // New state for dynamic brain visualizer
    const [alertModal, setAlertModal] = useState<{ isOpen: boolean; message: string; }>({ isOpen: false, message: '' });

    const finalAppId = typeof __app_id !== 'undefined' ? __app_id : appId;

    useEffect(() => {
        const finalFirebaseConfig = typeof __firebase_config !== 'undefined'
            ? JSON.parse(__firebase_config)
            : firebaseConfig;

        if (Object.keys(finalFirebaseConfig).length === 0 || !finalFirebaseConfig.apiKey) {
            setIsConfigMissing(true);
            return;
        }

        setIsConfigMissing(false);

        try {
            const app: FirebaseApp = initializeApp(finalFirebaseConfig);
            const firestoreDb: Firestore = getFirestore(app);
            const firebaseAuth: Auth = getAuth(app);
            setDb(firestoreDb);
            setAuth(firebaseAuth);

            const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
                setUser(user);
                setIsAuthReady(true);
            });

            return () => unsubscribe();
        } catch (e) {
            console.error("Error initializing Firebase:", e);
            setIsConfigMissing(true);
        }
    }, []);

    // Check for successful payment on component mount
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('success') === 'true') {
            setIsPremium(true);
            if (typeof (window as any).confetti === 'function') {
                (window as any).confetti({
                    particleCount: 150,
                    spread: 180,
                    origin: { y: 0.6 }
                });
            }
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);


    useEffect(() => {
        let unsubscribeDrinks: (() => void) | undefined;
        if (db && user) {
            const drinksCollectionPath = `artifacts/${finalAppId}/users/${user.uid}/drinks`;
            const q = query(collection(db, drinksCollectionPath));
            unsubscribeDrinks = onSnapshot(q, (querySnapshot) => {
                const drinksData: Drink[] = [];
                querySnapshot.forEach((doc) => { drinksData.push({ id: doc.id, ...doc.data() } as Drink); });
                drinksData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                setDrinks(drinksData);
                setLastLogTime(Date.now());
                setShowReminder(false);
                if (drinksData.length > 0) {
                    setShowDynamicBrain(true);
                } else {
                    setShowDynamicBrain(false);
                }
            }, (error) => { console.error("Error listening to drinks collection:", error); });
        }
        return () => {
            if (unsubscribeDrinks) {
                unsubscribeDrinks();
            }
        };
    }, [db, user, finalAppId]);

    const fetchCustomQuickAdds = useCallback(() => {
        let unsubscribeCustomQuickAdds: (() => void) | undefined;
        if (db && user) {
            const q = query(collection(db, `artifacts/${finalAppId}/users/${user.uid}/customQuickAdds`));
            unsubscribeCustomQuickAdds = onSnapshot(q, (snapshot) => {
                const fetchedQuickAdds: CustomQuickAdd[] = [];
                snapshot.forEach(doc => {
                    fetchedQuickAdds.push({ id: doc.id, ...doc.data() } as CustomQuickAdd);
                });
                setCustomQuickAdds(fetchedQuickAdds);
            });
        }
        return () => {
            if (unsubscribeCustomQuickAdds) {
                unsubscribeCustomQuickAdds();
            }
        };
    }, [db, user, finalAppId]);

    useEffect(() => {
        const unsubscribe = fetchCustomQuickAdds();
        return () => unsubscribe();
    }, [fetchCustomQuickAdds]);

    useEffect(() => {
        let unsubscribeDailyGoal: (() => void) | undefined;
        if (!db || !user) return;
        const docRef = doc(db, `artifacts/${finalAppId}/users/${user.uid}/goals/dailyAlcohol`);
        unsubscribeDailyGoal = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                setDailyAlcoholGoal(docSnap.data().goal);
            } else {
                setDailyAlcoholGoal(null);
            }
        }, (error) => {
            console.error("Error fetching daily goal:", error);
        });
        return () => {
            if (unsubscribeDailyGoal) {
                unsubscribeDailyGoal();
            }
        };
    }, [db, user, finalAppId]);

    useEffect(() => {
        let unsubscribeAchievements: (() => void) | undefined;
        if (db && user) {
            const q = query(collection(db, `artifacts/${finalAppId}/users/${user.uid}/achievements`));
            unsubscribeAchievements = onSnapshot(q, (snapshot) => {
                const fetchedAchievements: Achievement[] = [];
                snapshot.forEach(doc => {
                    fetchedAchievements.push({ id: doc.id, ...doc.data() } as Achievement);
                });
                setAchievements(fetchedAchievements);
            });
        }
        return () => {
            if (unsubscribeAchievements) {
                unsubscribeAchievements();
            }
        };
    }, [db, user, finalAppId]);

    useEffect(() => {
        let unsubscribeChallenge: (() => void) | undefined;
        const today = new Date().toISOString().split('T')[0];
        if (db && user) {
            const challengeDocRef = doc(db, `artifacts/${finalAppId}/users/${user.uid}/dailyChallenge/${today}`);
            unsubscribeChallenge = onSnapshot(challengeDocRef, async (docSnap) => {
                if (docSnap.exists()) {
                    setDailyChallenge(docSnap.data() as DailyChallenge);
                } else {
                    const challenges: Omit<DailyChallenge, 'completed'>[] = [
                        { id: 'log_2_drinks', textKey: 'daily_challenge_log_n_drinks', type: 'log_n_drinks', value: 2 },
                        { id: 'stay_below_50g', textKey: 'daily_challenge_stay_below_goal', type: 'stay_below_goal', value: 50 },
                        { id: 'use_custom_quick_add', textKey: 'daily_challenge_use_custom_quick_add', type: 'use_custom_quick_add' },
                    ];
                    const randomChallenge = challenges[Math.floor(Math.random() * challenges.length)];
                    const newChallenge: DailyChallenge = { ...randomChallenge, completed: false };
                    await setDoc(challengeDocRef, newChallenge);
                    setDailyChallenge(newChallenge);
                }
            });
        }
        return () => {
            if (unsubscribeChallenge) {
                unsubscribeChallenge();
            }
        };
    }, [db, user, finalAppId]);

    useEffect(() => { setAnalysis(analyzeConsumption(drinks, t)); }, [drinks, t]);

    const totalAlcoholToday = drinks.filter(drink => new Date(drink.timestamp).getTime() >= new Date().setHours(0, 0, 0, 0))
        .reduce((sum, drink) => sum + drink.alcoholGrams, 0);

    const checkAchievements = useCallback(async (currentDrinkCount: number) => {
        if (!db || !user) return;
        const earnedAchievementIds = new Set(achievements.map(a => a.id));
        const addAchievement = async (id: string, nameKey: string, descriptionKey: string) => {
            if (!earnedAchievementIds.has(id)) {
                await addDoc(collection(db, `artifacts/${finalAppId}/users/${user.uid}/achievements`), {
                    id, nameKey, descriptionKey, earnedDate: new Date().toISOString(),
                });
                if (typeof (window as any).confetti === 'function') {
                    (window as any).confetti({
                        particleCount: 100,
                        spread: 70,
                        origin: { y: 0.6 }
                    });
                }
            }
        };
        if (currentDrinkCount === 1) {
            addAchievement("first_log", "achievement_first_log_name", "achievement_first_log_desc");
        }
        const today = new Date();
        today.setHours(0,0,0,0);
        
        if (currentDrinkCount >= 7) addAchievement("7_day_streak", "achievement_7_day_streak_name", "achievement_7_day_streak_desc");
        if (currentDrinkCount >= 30) addAchievement("30_day_streak", "achievement_30_day_streak_name", "achievement_30_day_streak_desc");

        if (dailyAlcoholGoal !== null && totalAlcoholToday >= dailyAlcoholGoal) {
            const goalHitsRef = doc(db, `artifacts/${finalAppId}/users/${user.uid}/stats/dailyGoalHits`);
            const docSnap = await getDoc(goalHitsRef);
            let currentGoalHits = docSnap.exists() ? docSnap.data().count || 0 : 0;
            const lastGoalHitDate = docSnap.exists() ? docSnap.data().lastHitDate : null;
            const todayISO = today.toISOString().split('T')[0];
            if (lastGoalHitDate !== todayISO) {
                currentGoalHits++;
                await setDoc(goalHitsRef, { count: currentGoalHits, lastHitDate: todayISO }, { merge: true });
                if (currentGoalHits >= 5) {
                    addAchievement("5_goal", "achievement_5_goal_name", "achievement_5_goal_desc");
                }
            }
        }
        if (currentDrinkCount >= 10) addAchievement("10_drinks", "achievement_10_drinks_name", "achievement_10_drinks_desc");
        if (currentDrinkCount >= 50) addAchievement("50_drinks", "achievement_50_drinks_name", "achievement_50_drinks_desc");
        if (currentDrinkCount >= 100) addAchievement("100_drinks", "achievement_100_drinks_name", "achievement_100_drinks_desc");
    }, [db, user, achievements, totalAlcoholToday, dailyAlcoholGoal, finalAppId]);

    const checkDailyChallengeCompletion = useCallback(async (lastLoggedDrink: Drink) => {
        if (!db || !user || !dailyChallenge || dailyChallenge.completed) return;
        const today = new Date().toISOString().split('T')[0];
        const challengeDocRef = doc(db, `artifacts/${finalAppId}/users/${user.uid}/dailyChallenge/${today}`);
        let challengeCompleted = false;
        
        const isToday = new Date(lastLoggedDrink.timestamp).toISOString().split('T')[0] === today;
        const drinksTodayCount = drinks.filter(d => new Date(d.timestamp).toISOString().split('T')[0] === today).length + (isToday ? 1 : 0);
        const alcoholTodayWithNewDrink = totalAlcoholToday + (isToday ? lastLoggedDrink.alcoholGrams : 0);

        switch (dailyChallenge.type) {
            case 'log_n_drinks':
                if (drinksTodayCount >= (dailyChallenge.value || 0)) {
                    challengeCompleted = true;
                }
                break;
            case 'stay_below_goal':
                if (dailyAlcoholGoal !== null && alcoholTodayWithNewDrink <= (dailyChallenge.value || dailyAlcoholGoal)) {
                    challengeCompleted = true;
                }
                break;
            case 'use_custom_quick_add':
                const customAddUsed = customQuickAdds.some(qa => qa.type === lastLoggedDrink.type && qa.volume === lastLoggedDrink.volume && qa.abv === lastLoggedDrink.abv);
                if (customAddUsed) {
                    challengeCompleted = true;
                }
                break;
        }
        if (challengeCompleted) {
            await setDoc(challengeDocRef, { ...dailyChallenge, completed: true }, { merge: true });
            setDailyChallenge(prev => prev ? { ...prev, completed: true } : null);
            if (typeof (window as any).confetti === 'function') {
                (window as any).confetti({
                    particleCount: 150,
                    spread: 90,
                    origin: { y: 0.8 }
                });
            }
        }
    }, [db, user, dailyChallenge, drinks, dailyAlcoholGoal, totalAlcoholToday, customQuickAdds, finalAppId]);
    
    useEffect(() => {
        if (drinks.length > 0) {
            checkAchievements(drinks.length);
        }
    }, [drinks, checkAchievements]);

    const handleLogDrink = async (drinkData: Omit<Drink, 'id'>) => {
        if (db && user) {
            try {
                const drinksCollectionPath = `artifacts/${finalAppId}/users/${user.uid}/drinks`;
                await addDoc(collection(db, drinksCollectionPath), drinkData);
                setLastLogTime(Date.now());
                setShowReminder(false);
                checkDailyChallengeCompletion(drinkData);
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
            } catch (error) { console.error("Error adding drink to Firestore: ", error); }
        }
    };
    
    const handleDeleteDrink = async (drinkId: string) => {
        if (db && user) {
            try {
                await deleteDoc(doc(db, `artifacts/${finalAppId}/users/${user.uid}/drinks/${drinkId}`));
            } catch (error) { console.error("Error deleting drink:", error); }
        }
    };
    
    const handleGoPremium = async () => {
        if (!user) {
            setAlertModal({ isOpen: true, message: "Please ensure you are logged in to purchase premium." });
            return;
        }

        setIsLoadingPremium(true);
        try {
            const checkoutApiUrl = 'https://stripe-backend-api-xi-seven.vercel.app/api/create-checkout-session'; 
            const priceId = 'price_1RoPOPPEmeNnPDdSQgC5IDW7'; 
            const redirectUrl = window.location.origin; 

            const response = await fetch(checkoutApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    priceId: priceId,
                    userId: user.uid,
                    redirectUrl: redirectUrl,
                }),
            });

            const data = await response.json();

            if (response.ok && data.url) {
                window.location.assign(data.url); 
            } else {
                setAlertModal({ isOpen: true, message: `Failed to start payment: ${data.message || 'Unknown error'}. Please try again.` });
                setIsLoadingPremium(false);
            }
        } catch (error) {
            setAlertModal({ isOpen: true, message: 'A network error occurred. Please try again.' });
            setIsLoadingPremium(false);
        } finally {
            setIsPremiumModalOpen(false); 
        }
    };


    const totalAlcohol = drinks.reduce((sum, drink) => sum + drink.alcoholGrams, 0).toFixed(1);

    useEffect(() => {
        const REMINDER_INTERVAL_MINUTES = 15;
        let reminderTimer: ReturnType<typeof setInterval>;
        const checkAndShowReminder = () => {
            const timeElapsed = (Date.now() - lastLogTime) / (1000 * 60);
            if (timeElapsed >= REMINDER_INTERVAL_MINUTES && !isModalOpen && !isAchievementsModalOpen && !isManageQuickAddsModalOpen && !isPremiumModalOpen) {
                setShowReminder(true);
            }
        };
        reminderTimer = setInterval(checkAndShowReminder, REMINDER_INTERVAL_MINUTES * 60 * 1000);
        return () => clearInterval(reminderTimer);
    }, [lastLogTime, isModalOpen, isAchievementsModalOpen, isManageQuickAddsModalOpen, isPremiumModalOpen]);

    const dismissReminder = () => setShowReminder(false);
    const openModalFromReminder = () => {
        setShowReminder(false);
        setIsModalOpen(true);
    };

    const handleShareProgress = useCallback(async () => {
        let shareMessage = "";
        if (dailyAlcoholGoal !== null && dailyAlcoholGoal > 0) {
            if (totalAlcoholToday > dailyAlcoholGoal) {
                shareMessage = t('share_message_over_goal', { grams: totalAlcoholToday.toFixed(1), goal: dailyAlcoholGoal.toFixed(1) });
            } else {
                shareMessage = t('share_message_goal', { grams: totalAlcoholToday.toFixed(1), goal: dailyAlcoholGoal.toFixed(1) });
            }
        } else {
            shareMessage = t('share_message_no_goal', { grams: totalAlcoholToday.toFixed(1) });
        }
        if (navigator.share) {
            try {
                await navigator.share({
                    title: t('app_title') as string,
                    text: shareMessage,
                    url: window.location.href,
                });
                console.log('Successfully shared');
            } catch (error) {
                console.error('Error sharing:', error);
                setAlertModal({ isOpen: true, message: 'Could not share. You can copy the text: ' + shareMessage });
            }
        } else {
            const tempTextArea = document.createElement('textarea');
            tempTextArea.value = shareMessage;
            document.body.appendChild(tempTextArea);
            tempTextArea.select();
            document.execCommand('copy');
            document.body.removeChild(tempTextArea);
            setAlertModal({ isOpen: true, message: 'Web Share API not supported. Text copied to clipboard: ' + shareMessage });
        }
    }, [dailyAlcoholGoal, totalAlcoholToday, t]);

    if (!isAuthReady) {
        return (
            <div className="bg-gray-900 text-white min-h-screen flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-blue-400"></div>
            </div>
        );
    }

    if (!user) {
        return <AuthScreen auth={auth} />;
    }

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
    
    const currentRegionPresets = globalDrinkPresets[userRegion] || globalDrinkPresets['uk'];
    const defaultQuickAddTypes = ['beer', 'wine', 'spirit', 'cider', 'cocktail'];

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
                        color: #93c5fd;
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
                       @keyframes bounce-subtle {
                        0%, 100% { transform: translateY(0) translateX(-50%); }
                        50% { transform: translateY(-5px) translateX(-50%); }
                    }
                `}
            </style>
            <AlertModal
                isOpen={alertModal.isOpen}
                message={alertModal.message}
                onClose={() => setAlertModal({ isOpen: false, message: '' })}
            />
            <DrinkModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onLogDrink={handleLogDrink} currentRegion={userRegion} />
            <DrinkModal isOpen={showLateLogModal} onClose={() => setShowLateLogModal(false)} onLogDrink={handleLogDrink} currentRegion={userRegion} showDateTimePicker={true} />
            <ManageQuickAddsModal
                isOpen={isManageQuickAddsModalOpen}
                onClose={() => setIsManageQuickAddsModalOpen(false)}
                userId={user.uid}
                db={db}
                onQuickAddUpdated={fetchCustomQuickAdds}
            />
            <AchievementsModal
                isOpen={isAchievementsModalOpen}
                onClose={() => setIsAchievementsModalOpen(false)}
                achievements={achievements}
            />
            <PremiumModal 
                isOpen={isPremiumModalOpen} 
                onClose={() => setIsPremiumModalOpen(false)} 
                onConfirm={handleGoPremium} 
                isLoading={isLoadingPremium}
            />
            <header className="p-4 border-b border-gray-800 flex justify-between items-center sticky top-0 bg-gray-900/80 backdrop-blur-md z-40">
                <div className="flex items-center gap-3"><Brain className="text-blue-400" size={32} /><h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">{t('app_title')}</h1></div>
                <div className="flex items-center gap-4">
                    <RegionSwitcher currentRegion={userRegion} setRegion={setUserRegion} />
                    <LanguageSwitcher />
                    <button onClick={() => setIsPremiumModalOpen(true)} className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold py-2 px-4 rounded-lg transition-transform hover:scale-105 shadow-lg shadow-yellow-500/20">{t('header_premium_button')}</button>
                    <div className="text-sm text-gray-400">{user.email}</div>
                    <button onClick={() => auth && signOut(auth)} className="text-gray-400 hover:text-white">
                        <LogOut size={20} />
                    </button>
                </div>
            </header>
            <main className="p-4 md:p-8">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-8">
                    <div className="lg:col-span-3 bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
                        <div className="flex justify-between items-start mb-4"><div><h2 className="text-3xl font-bold text-white">{t('section_title_impact')}</h2><p className="text-gray-400">{t('section_subtitle_impact')}</p></div><div className="text-right flex-shrink-0 ml-4"><p className="text-gray-400 text-sm">{t('label_total_alcohol')}</p><p className="text-2xl font-bold text-blue-400">{totalAlcohol}g</p></div></div>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-center">
                            <div className="md:col-span-3">
                                {showDynamicBrain ? (
                                    <BrainVisual analysis={analysis} drinkCount={drinks.length} />
                                ) : (
                                    <div className="relative w-full mx-auto aspect-square flex items-center justify-center overflow-hidden">
                                        <svg viewBox="0 0 300 300" className="w-full h-full absolute inset-0">
                                            <defs>
                                                <pattern id="grid-static" width="30" height="30" patternUnits="userSpaceOnUse">
                                                    <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(107, 114, 128, 0.1)" strokeWidth="1"/>
                                                </pattern>
                                            </defs>
                                            <rect width="300" height="300" fill="url(#grid-static)" />
                                        </svg>
                                        {/* Static brain placeholder - using a large lucide-react Brain icon */}
                                        <Brain size={150} className="text-blue-500/50 relative z-10" />
                                    </div>
                                )}
                            </div>
                            <div className="space-y-3 md:col-span-2">
                                {analysis && Object.values(analysis).map(region => (
                                    <div key={region.name} className="bg-gray-800 p-3 rounded-lg transition-all hover:bg-gray-700/50">
                                        <div className="flex justify-between items-center">
                                            <span className="font-semibold">{t(region.name)}</span>
                                            <span className={`font-bold text-sm ${region.impactColor}`}>{region.impactWord}</span>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1">{region.effectText}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <AICoach drinks={drinks} analysis={analysis} dailyAlcoholGoal={dailyAlcoholGoal} />
                    </div>
                    {isPremium ? (
                        <PremiumDashboard db={db} userId={user.uid} dailyAlcoholGoal={dailyAlcoholGoal} />
                    ) : (
                        <div className="lg:col-span-2 space-y-8">
                            <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
                                <h3 className="text-xl font-bold mb-4">{t('section_title_control')}</h3>
                                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                                    <button onClick={() => setIsModalOpen(true)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-300 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20">
                                        <Plus size={20} /> {t('button_log_drink')}
                                    </button>
                                    <button onClick={() => setShowLateLogModal(true)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-300 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20">
                                        <History size={20} /> Log Late
                                    </button>
                                </div>
                                <div className="mt-6">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="text-lg font-bold text-white">{t('quick_log_title')}</h4>
                                        <button onClick={() => setIsManageQuickAddsModalOpen(true)} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm">
                                            <Settings size={16} /> Manage
                                        </button>
                                        <button onClick={() => setIsAchievementsModalOpen(true)} className="text-yellow-400 hover:text-yellow-300 flex items-center gap-1 text-sm ml-auto">
                                            <Award size={16} /> {t('achievements_title')}
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        {defaultQuickAddTypes.map(type => {
                                            const preset = currentRegionPresets[type];
                                            if (!preset) return null;
                                            return (
                                                <button
                                                    key={type}
                                                    onClick={() => handleLogDrink({ type: type, volume: preset.volume, abv: preset.abv, alcoholGrams: (preset.volume * preset.abv / 100 * 0.789), timestamp: new Date().toISOString() })}
                                                    className="bg-gray-700 hover:bg-gray-600 text-white text-sm py-2 px-3 rounded-lg transition-colors"
                                                >
                                                    {t(preset.translationKey)}
                                                </button>
                                            );
                                        })}
                                        {customQuickAdds.map(qa => (
                                            <button
                                                key={qa.id}
                                                onClick={() => handleLogDrink({ type: qa.type, volume: qa.volume, abv: qa.abv, alcoholGrams: (qa.volume * qa.abv / 100 * 0.789), timestamp: new Date().toISOString() })}
                                                className="bg-purple-700 hover:bg-purple-600 text-white text-sm py-2 px-3 rounded-lg transition-colors"
                                            >
                                                {qa.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="mt-6 p-4 bg-yellow-900/30 border border-yellow-700 rounded-lg flex items-start gap-3">
                                    <Info size={20} className="text-yellow-400 mt-1 flex-shrink-0" />
                                    <div>
                                        <h4 className="font-bold text-yellow-300">{t('disclaimer_title')}</h4>
                                        <p className="text-xs text-yellow-300/80">{t('disclaimer_text')}</p>
                                    </div>
                                </div>
                            </div>
                            <DailyGoal userId={user.uid} db={db} dailyAlcoholGoal={dailyAlcoholGoal} setDailyAlcoholGoal={setDailyAlcoholGoal} totalAlcoholToday={totalAlcoholToday} />
                            <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
                                <h3 className="text-xl font-bold mb-4">{t('section_title_log')}</h3>
                                <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                                    {drinks.length > 0 ? drinks.map(drink => (
                                        <div key={drink.id || ''} className="group flex items-center justify-between bg-gray-800 p-3 rounded-lg hover:bg-gray-700/50">
                                            <div className="flex items-center gap-3">
                                                <Droplet className="text-blue-400" size={18} />
                                                <div>
                                                    <p className="font-semibold capitalize">{t(`drink_${drink.type.toLowerCase()}`) || drink.type}</p>
                                                    <p className="text-xs text-gray-400">{drink.volume}ml at {drink.abv}% ABV</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <p className="font-mono text-sm text-gray-300">{drink.alcoholGrams.toFixed(1)}g</p>
                                                <button onClick={() => drink.id && handleDeleteDrink(drink.id)} className="text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    )) : <p className="text-center text-gray-500 py-8">{t('log_empty')}</p>}
                                </div>
                            </div>
                            <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex items-center">
                                        <Star className="text-yellow-400" /><h3 className="text-xl font-bold ml-2">{t('section_title_premium')}</h3>
                                    </div>
                                    <button onClick={handleShareProgress} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded-lg transition-colors flex items-center gap-1">
                                        <Share2 size={16} /> {t('share_progress_button')}
                                    </button>
                                </div>
                                <div className="space-y-4">
                                    <PremiumFeature title={t('premium_feature_trends_title') as string} description={t('premium_feature_trends_desc') as string} icon={<BarChart3 className="text-gray-400" />} onUpgrade={() => setIsPremiumModalOpen(true)} isAuthReady={isAuthReady} />
                                    <PremiumFeature title={t('premium_feature_insights_title') as string} description={t('premium_feature_insights_desc') as string} icon={<TrendingUp className="text-gray-400" />} onUpgrade={() => setIsPremiumModalOpen(true)} isAuthReady={isAuthReady} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
            {showReminder && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-blue-800 p-4 rounded-lg shadow-xl flex items-center gap-4 z-50 animate-bounce-subtle">
                    <BellRing className="text-blue-200" size={24} />
                    <div>
                        <h4 className="font-bold text-white">{t('reminder_title')}</h4>
                        <p className="text-sm text-blue-100">{t('reminder_text')}</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={openModalFromReminder} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded-md">
                            {t('reminder_log_button')}
                        </button>
                        <button onClick={dismissReminder} className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-3 py-1 rounded-md">
                            {t('reminder_dismiss_button')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

const AuthScreen: FC<{ auth: Auth | null; }> = ({ auth }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [error, setError] = useState('');

    const handleAuthAction = async () => {
        if (!auth) return;
        setError('');
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
            }
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-sm mx-auto">
                <div className="flex items-center justify-center gap-3 mb-8">
                    <Brain className="text-blue-400" size={48} />
                    <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">LumenDose</h1>
                </div>
                <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700">
                    <h2 className="text-2xl font-bold text-center mb-6">{isLogin ? 'Log In' : 'Sign Up'}</h2>
                    {error && <p className="bg-red-500/20 text-red-400 text-sm p-3 rounded-lg mb-4">{error}</p>}
                    <div className="space-y-4">
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Email"
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password"
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                        <button
                            onClick={handleAuthAction}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-300"
                        >
                            {isLogin ? 'Log In' : 'Sign Up'}
                        </button>
                    </div>
                    <p className="text-center text-sm text-gray-400 mt-6">
                        {isLogin ? "Don't have an account?" : "Already have an account?"}
                        <button onClick={() => setIsLogin(!isLogin)} className="font-semibold text-blue-400 hover:text-blue-300 ml-1">
                            {isLogin ? 'Sign Up' : 'Log In'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

const AlertModal: FC<{ isOpen: boolean; message: string; onClose: () => void; }> = ({ isOpen, message, onClose }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-gray-700 text-center">
                <div className="flex justify-center mb-4">
                    <AlertTriangle className="text-yellow-400" size={40} />
                </div>
                <p className="text-gray-300 mb-6">{message}</p>
                <button onClick={onClose} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                    OK
                </button>
            </div>
        </div>
    );
};

export default function App() {
    useEffect(() => {
        const scriptId = 'canvas-confetti-script';
        if (document.getElementById(scriptId)) {
            return;
        }
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js";
        script.async = true;
        document.head.appendChild(script);

        return () => {
            const existingScript = document.getElementById(scriptId);
            if (existingScript) {
                document.head.removeChild(existingScript);
            }
        };
    }, []);

    return (
        <LanguageProvider>
            <AppContent />
        </LanguageProvider>
    );
}
