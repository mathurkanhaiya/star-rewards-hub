import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type AppLanguage = 'en'|'hi'|'ru'|'es'|'zh'|'bn'|'id'|'tr'|'uk'|'pt'|'fr'|'de';
export type AppTheme = 'dark'|'light';

export const LANGUAGES: Array<{code:AppLanguage;label:string;flag:string}> = [
  {code:'en',label:'English',flag:'🇬🇧'},{code:'hi',label:'हिन्दी',flag:'🇮🇳'},{code:'ru',label:'Русский',flag:'🇷🇺'},
  {code:'es',label:'Español',flag:'🇪🇸'},{code:'zh',label:'中文',flag:'🇨🇳'},{code:'bn',label:'বাংলা',flag:'🇧🇩'},
  {code:'id',label:'Indonesia',flag:'🇮🇩'},{code:'tr',label:'Türkçe',flag:'🇹🇷'},{code:'uk',label:'Українська',flag:'🇺🇦'},
  {code:'pt',label:'Português',flag:'🇵🇹'},{code:'fr',label:'Français',flag:'🇫🇷'},{code:'de',label:'Deutsch',flag:'🇩🇪'},
];

const EN: Record<string,string> = {
  settings:'Settings',language:'Language',theme:'Theme',dark:'Dark',light:'Light',guide:'How to Earn',close:'Close',
  home:'Home',tasks:'Tasks',games:'Games',refer:'Refer',wallet:'Wallet',alerts:'Alerts',admin:'Admin',leaderboard:'Leaderboard',
  live:'Live',points:'Points',watchAds:'Watch Ads',dailyDrop:'Daily Drop',farming:'Farming',history:'History',earn:'Earn',claimedToday:'Claimed Today',claim:'Claim',
  availableBalance:'Available Balance',readyWithdraw:'Points · Ready to withdraw',withdraw:'Withdraw',withdrawGuide:'Withdrawal requirements',dailyAdsProgress:'Daily Ads Progress',
  requirementMet:'Requirement met — withdrawals unlocked',moreAds:'more ads to unlock withdrawals',selectAmount:'Select Amount',minimum:'Minimum',rate:'Rate',network:'Network',
  gram:'GRAM (Ex TON)',usdtPolygon:'USDT · Polygon',inrUpi:'INR · UPI',walletAddress:'Wallet Address',upiId:'UPI ID',confirmWithdraw:'Confirm Withdraw',cancel:'Cancel',
  howEarnTitle:'How to Earn',howEarnSub:'Complete these activities to grow your points safely.',adsGuide:'Watch verified rewarded ads. Points are credited by Backend V2 after the ad completes.',
  farmGuide:'Start Farming, wait for the live timer, then claim the reward when it is ready.',dropGuide:'Claim Daily Drop once per UTC day. Keep the streak for larger rewards.',taskGuide:'Complete Telegram/web tasks from the Tasks tab. Rewards are verified before crediting.',
  referralGuide:'Invite real users with your referral link. Referral rules and rewards are controlled by Admin Settings.',gameGuide:'Play the available reward games within the daily limits configured by Admin.',promoGuide:'Claim active promo codes before their claim limit is reached.',
  withdrawGuideText:'Meet the minimum point balance and required daily ad count, then choose GRAM, USDT Polygon, or INR UPI.',securityGuide:'Never use fake traffic, self-referrals or automation. Invalid activity can be rejected or banned.',
};

const OVERRIDES: Record<AppLanguage,Record<string,string>> = {
  en:{},
  hi:{settings:'सेटिंग्स',language:'भाषा',theme:'थीम',dark:'डार्क',light:'लाइट',guide:'कमाई गाइड',home:'होम',tasks:'टास्क',games:'गेम्स',refer:'रेफर',wallet:'वॉलेट',alerts:'अलर्ट',leaderboard:'लीडरबोर्ड',watchAds:'विज्ञापन देखें',dailyDrop:'डेली ड्रॉप',farming:'फार्मिंग',history:'इतिहास',earn:'कमाएँ',claimedToday:'आज क्लेम हो चुका',claim:'क्लेम',availableBalance:'उपलब्ध बैलेंस',withdraw:'निकासी',dailyAdsProgress:'आज के विज्ञापन',requirementMet:'शर्त पूरी — निकासी अनलॉक',selectAmount:'राशि चुनें',minimum:'न्यूनतम',rate:'रेट',network:'नेटवर्क',walletAddress:'वॉलेट एड्रेस',upiId:'UPI ID',confirmWithdraw:'निकासी कन्फर्म करें',cancel:'रद्द करें',howEarnTitle:'कमाई कैसे करें',howEarnSub:'सुरक्षित तरीके से पॉइंट कमाने के सभी तरीके।'},
  ru:{settings:'Настройки',language:'Язык',theme:'Тема',dark:'Тёмная',light:'Светлая',guide:'Как заработать',home:'Главная',tasks:'Задания',games:'Игры',refer:'Рефералы',wallet:'Кошелёк',alerts:'Уведомления',leaderboard:'Рейтинг',watchAds:'Смотреть рекламу',dailyDrop:'Ежедневный бонус',farming:'Фарминг',history:'История',earn:'Заработок',claimedToday:'Уже получено',claim:'Получить',availableBalance:'Доступный баланс',withdraw:'Вывод',selectAmount:'Выберите сумму',confirmWithdraw:'Подтвердить вывод',cancel:'Отмена',howEarnTitle:'Как заработать'},
  es:{settings:'Ajustes',language:'Idioma',theme:'Tema',dark:'Oscuro',light:'Claro',guide:'Cómo ganar',home:'Inicio',tasks:'Tareas',games:'Juegos',refer:'Referidos',wallet:'Billetera',alerts:'Alertas',leaderboard:'Clasificación',watchAds:'Ver anuncios',dailyDrop:'Recompensa diaria',farming:'Farming',history:'Historial',earn:'Ganar',claimedToday:'Reclamado hoy',claim:'Reclamar',availableBalance:'Saldo disponible',withdraw:'Retirar',selectAmount:'Seleccionar cantidad',confirmWithdraw:'Confirmar retiro',cancel:'Cancelar',howEarnTitle:'Cómo ganar'},
  zh:{settings:'设置',language:'语言',theme:'主题',dark:'深色',light:'浅色',guide:'赚取指南',home:'首页',tasks:'任务',games:'游戏',refer:'邀请',wallet:'钱包',alerts:'通知',leaderboard:'排行榜',watchAds:'观看广告',dailyDrop:'每日奖励',farming:'挂机收益',history:'记录',earn:'赚取',claimedToday:'今日已领取',claim:'领取',availableBalance:'可用余额',withdraw:'提现',selectAmount:'选择金额',confirmWithdraw:'确认提现',cancel:'取消',howEarnTitle:'如何赚取'},
  bn:{settings:'সেটিংস',language:'ভাষা',theme:'থিম',dark:'ডার্ক',light:'লাইট',guide:'আয় করার গাইড',home:'হোম',tasks:'টাস্ক',games:'গেমস',refer:'রেফার',wallet:'ওয়ালেট',alerts:'অ্যালার্ট',leaderboard:'লিডারবোর্ড',watchAds:'বিজ্ঞাপন দেখুন',dailyDrop:'ডেইলি ড্রপ',farming:'ফার্মিং',history:'ইতিহাস',earn:'আয়',claimedToday:'আজ ক্লেইম হয়েছে',claim:'ক্লেইম',availableBalance:'উপলব্ধ ব্যালেন্স',withdraw:'উইথড্র',selectAmount:'পরিমাণ বাছুন',confirmWithdraw:'উইথড্র নিশ্চিত করুন',cancel:'বাতিল',howEarnTitle:'কীভাবে আয় করবেন'},
  id:{settings:'Pengaturan',language:'Bahasa',theme:'Tema',dark:'Gelap',light:'Terang',guide:'Cara Menghasilkan',home:'Beranda',tasks:'Tugas',games:'Game',refer:'Referral',wallet:'Dompet',alerts:'Notifikasi',leaderboard:'Peringkat',watchAds:'Tonton Iklan',dailyDrop:'Hadiah Harian',farming:'Farming',history:'Riwayat',earn:'Hasilkan',claimedToday:'Sudah diklaim',claim:'Klaim',availableBalance:'Saldo Tersedia',withdraw:'Tarik',selectAmount:'Pilih Jumlah',confirmWithdraw:'Konfirmasi Penarikan',cancel:'Batal',howEarnTitle:'Cara Menghasilkan'},
  tr:{settings:'Ayarlar',language:'Dil',theme:'Tema',dark:'Koyu',light:'Açık',guide:'Kazanma Rehberi',home:'Ana Sayfa',tasks:'Görevler',games:'Oyunlar',refer:'Davet',wallet:'Cüzdan',alerts:'Bildirimler',leaderboard:'Liderlik',watchAds:'Reklam İzle',dailyDrop:'Günlük Ödül',farming:'Farming',history:'Geçmiş',earn:'Kazan',claimedToday:'Bugün alındı',claim:'Al',availableBalance:'Kullanılabilir Bakiye',withdraw:'Çekim',selectAmount:'Tutar Seç',confirmWithdraw:'Çekimi Onayla',cancel:'İptal',howEarnTitle:'Nasıl Kazanılır'},
  uk:{settings:'Налаштування',language:'Мова',theme:'Тема',dark:'Темна',light:'Світла',guide:'Як заробляти',home:'Головна',tasks:'Завдання',games:'Ігри',refer:'Реферали',wallet:'Гаманець',alerts:'Сповіщення',leaderboard:'Рейтинг',watchAds:'Дивитися рекламу',dailyDrop:'Щоденна нагорода',history:'Історія',earn:'Заробити',claimedToday:'Сьогодні отримано',claim:'Отримати',availableBalance:'Доступний баланс',withdraw:'Вивести',confirmWithdraw:'Підтвердити',cancel:'Скасувати',howEarnTitle:'Як заробляти'},
  pt:{settings:'Configurações',language:'Idioma',theme:'Tema',dark:'Escuro',light:'Claro',guide:'Como Ganhar',home:'Início',tasks:'Tarefas',games:'Jogos',refer:'Indicar',wallet:'Carteira',alerts:'Alertas',leaderboard:'Ranking',watchAds:'Ver Anúncios',dailyDrop:'Bônus Diário',history:'Histórico',earn:'Ganhar',claimedToday:'Resgatado hoje',claim:'Resgatar',availableBalance:'Saldo Disponível',withdraw:'Sacar',selectAmount:'Selecionar valor',confirmWithdraw:'Confirmar saque',cancel:'Cancelar',howEarnTitle:'Como Ganhar'},
  fr:{settings:'Paramètres',language:'Langue',theme:'Thème',dark:'Sombre',light:'Clair',guide:'Comment gagner',home:'Accueil',tasks:'Tâches',games:'Jeux',refer:'Parrainage',wallet:'Portefeuille',alerts:'Alertes',leaderboard:'Classement',watchAds:'Voir les pubs',dailyDrop:'Bonus quotidien',history:'Historique',earn:'Gagner',claimedToday:'Réclamé aujourd’hui',claim:'Réclamer',availableBalance:'Solde disponible',withdraw:'Retirer',selectAmount:'Choisir le montant',confirmWithdraw:'Confirmer le retrait',cancel:'Annuler',howEarnTitle:'Comment gagner'},
  de:{settings:'Einstellungen',language:'Sprache',theme:'Design',dark:'Dunkel',light:'Hell',guide:'So verdienst du',home:'Start',tasks:'Aufgaben',games:'Spiele',refer:'Empfehlen',wallet:'Wallet',alerts:'Hinweise',leaderboard:'Rangliste',watchAds:'Werbung ansehen',dailyDrop:'Täglicher Bonus',history:'Verlauf',earn:'Verdienen',claimedToday:'Heute abgeholt',claim:'Abholen',availableBalance:'Verfügbares Guthaben',withdraw:'Auszahlen',selectAmount:'Betrag wählen',confirmWithdraw:'Auszahlung bestätigen',cancel:'Abbrechen',howEarnTitle:'So verdienst du'},
};

type Ctx={language:AppLanguage;setLanguage:(v:AppLanguage)=>void;theme:AppTheme;setTheme:(v:AppTheme)=>void;t:(key:string)=>string};
const PreferencesContext=createContext<Ctx|undefined>(undefined);

export function PreferencesProvider({children}:{children:React.ReactNode}){
  const [language,setLanguage]=useState<AppLanguage>(()=>(localStorage.getItem('app_language') as AppLanguage)||'en');
  const [theme,setTheme]=useState<AppTheme>(()=>(localStorage.getItem('app_theme') as AppTheme)||'dark');
  useEffect(()=>{localStorage.setItem('app_language',language);document.documentElement.lang=language;},[language]);
  useEffect(()=>{localStorage.setItem('app_theme',theme);document.documentElement.dataset.theme=theme;},[theme]);
  const value=useMemo<Ctx>(()=>({language,setLanguage,theme,setTheme,t:(key)=>OVERRIDES[language]?.[key]||EN[key]||key}),[language,theme]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(){const c=useContext(PreferencesContext);if(!c)throw new Error('usePreferences must be used inside PreferencesProvider');return c;}
