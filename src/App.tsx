import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Map as MapIcon, 
  Car, 
  Flag, 
  Globe, 
  Mountain, 
  Landmark, 
  Utensils, 
  BookOpen, 
  Music, 
  Trophy, 
  Star, 
  Cpu,
  ChevronRight,
  Search,
  Info,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Menu,
  X,
  User as UserIcon,
  Zap,
  Award,
  Target,
  Flame,
  Shield,
  Compass,
  LogOut,
  LogIn,
  Play
} from 'lucide-react';
import { regionsData, Region } from './data/regions';
import { quizzesData, Quiz, QuizQuestion } from './data/quizzes';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot,
  User
} from './firebase';

type View = 'home' | 'regions' | 'region-detail' | 'quizzes' | 'quiz-play' | 'profile';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  unlocked: boolean;
  xpReward: number;
}

interface UserStats {
  xp: number;
  level: number;
  quizzesCompleted: number;
  perfectScores: number;
  streak: number;
  unlockedAchievements: string[];
  lastQuizDate: string | null;
}

const IconMap = {
  Map: MapIcon,
  Car,
  Flag,
  Globe,
  Mountain,
  Landmark,
  Utensils,
  BookOpen,
  Music,
  Trophy,
  Star,
  Cpu
};

import { MapComponent } from './components/MapComponent';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('home');
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [previewRegion, setPreviewRegion] = useState<Region | null>(null);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [quizState, setQuizState] = useState<{
    currentQuestionIndex: number;
    score: number;
    showResult: boolean;
    answers: (number | number[] | null)[];
    isFinished: boolean;
  }>({
    currentQuestionIndex: 0,
    score: 0,
    showResult: false,
    answers: [],
    isFinished: false,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Gamification State
  const [userStats, setUserStats] = useState<UserStats>({
    xp: 0,
    level: 1,
    quizzesCompleted: 0,
    perfectScores: 0,
    streak: 0,
    unlockedAchievements: [],
    lastQuizDate: null,
  });

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Sync
  useEffect(() => {
    if (!currentUser) {
      // Load local stats if not logged in
      const saved = localStorage.getItem('qazaqgeo_stats');
      if (saved) setUserStats(JSON.parse(saved));
      return;
    }

    const userDocRef = doc(db, 'users', currentUser.uid);
    
    // Initial fetch/create
    const syncUser = async () => {
      const snap = await getDoc(userDocRef);
      if (!snap.exists()) {
        const initialStats: UserStats = {
          xp: 0,
          level: 1,
          quizzesCompleted: 0,
          perfectScores: 0,
          streak: 0,
          unlockedAchievements: [],
          lastQuizDate: null,
        };
        await setDoc(userDocRef, {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          ...initialStats
        });
      }
    };
    syncUser();

    // Real-time listener
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserStats({
          xp: data.xp,
          level: data.level,
          quizzesCompleted: data.quizzesCompleted || 0,
          perfectScores: data.perfectScores || 0,
          streak: data.streak || 0,
          unlockedAchievements: data.unlockedAchievements || [],
          lastQuizDate: data.lastQuizDate || null,
        });
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentView('home');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const achievements: Achievement[] = [
    { id: 'first_quiz', title: 'Первый шаг', description: 'Пройдите свой первый квиз', icon: <Zap size={20} />, unlocked: userStats.quizzesCompleted > 0, xpReward: 100 },
    { id: 'perfect_score', title: 'Отличник', description: 'Ответьте правильно на все вопросы в квизе', icon: <Star size={20} />, unlocked: userStats.perfectScores > 0, xpReward: 250 },
    { id: 'level_5', title: 'Исследователь', description: 'Достигните 5 уровня', icon: <Compass size={20} />, unlocked: userStats.level >= 5, xpReward: 500 },
    { id: 'all_regions', title: 'Знаток регионов', description: 'Пройдите квиз по географии без ошибок', icon: <MapIcon size={20} />, unlocked: userStats.unlockedAchievements.includes('all_regions'), xpReward: 300 },
    { id: 'streak_3', title: 'В ударе', description: 'Пройдите 3 квиза за один день', icon: <Flame size={20} />, unlocked: userStats.streak >= 3, xpReward: 400 },
  ];

  const calculateLevel = (xp: number) => Math.floor(xp / 1000) + 1;

  const updateStats = async (quizScore: number, totalQuestions: number, quizId: string) => {
    const isPerfect = quizScore === totalQuestions;
    const xpGained = quizScore * 50 + (isPerfect ? 100 : 0);
    
    const newXp = userStats.xp + xpGained;
    const newLevel = calculateLevel(newXp);
    const newQuizzesCompleted = userStats.quizzesCompleted + 1;
    const newPerfectScores = isPerfect ? userStats.perfectScores + 1 : userStats.perfectScores;
    
    const newAchievements = [...userStats.unlockedAchievements];
    if (newQuizzesCompleted === 1 && !newAchievements.includes('first_quiz')) {
      newAchievements.push('first_quiz');
    }
    if (isPerfect && !newAchievements.includes('perfect_score')) {
      newAchievements.push('perfect_score');
    }
    if (newLevel >= 5 && !newAchievements.includes('level_5')) {
      newAchievements.push('level_5');
    }

    const updatedStats = {
      xp: newXp,
      level: newLevel,
      quizzesCompleted: newQuizzesCompleted,
      perfectScores: newPerfectScores,
      unlockedAchievements: newAchievements,
      lastQuizDate: new Date().toISOString(),
    };

    if (currentUser) {
      const userDocRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userDocRef, updatedStats);
    } else {
      setUserStats(prev => ({ ...prev, ...updatedStats }));
      localStorage.setItem('qazaqgeo_stats', JSON.stringify({ ...userStats, ...updatedStats }));
    }
  };

  const chartData = useMemo(() => {
    return regionsData
      .map(r => ({
        name: r.name.replace(' область', '').replace(' (город)', ''),
        population: parseInt(r.population.replace(/\s/g, ''), 10),
        fullName: r.name
      }))
      .sort((a, b) => b.population - a.population)
      .slice(0, 10);
  }, []);

  const filteredRegions = useMemo(() => {
    return regionsData.filter(r => 
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.capital.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const handleRegionClick = (region: Region) => {
    setSelectedRegion(region);
    setCurrentView('region-detail');
    window.scrollTo(0, 0);
  };

  const regionMapping: Record<string, string> = {
    'Almaty': 'almaty',
    'Almaty (Alma-Ata)': 'almaty-city',
    'Aqmola': 'akmola',
    'Abay': 'abai',
    'Aqtöbe': 'aktobe',
    'Atyrau': 'atyrau',
    'East Kazakhstan': 'east-kazakhstan',
    'Zhambyl': 'jambyl',
    'Jetisu': 'jetisu',
    'Qaraghandy': 'karaganda',
    'Karaganda': 'karaganda',
    'Qostanay': 'kostanay',
    'Kostanay': 'kostanay',
    'Qyzylorda': 'kyzylorda',
    'Kyzylorda': 'kyzylorda',
    'Kyzyl-Orda': 'kyzylorda',
    'Mangghystau': 'mangystau',
    'Mangystau': 'mangystau',
    'North Kazakhstan': 'north-kazakhstan',
    'Pavlodar': 'pavlodar',
    'Turkistan': 'turkistan',
    'South Kazakhstan': 'turkistan',
    'Ulytau': 'ulytau',
    'West Kazakhstan': 'west-kazakhstan',
    'Astana': 'astana',
    'Nur-Sultan': 'astana',
    'Almaty City': 'almaty-city',
    'Shymkent': 'shymkent'
  };

  const handleMapRegionClick = (regionName: string) => {
    console.log('Map clicked region:', regionName);
    
    // Try exact match in mapping
    const regionId = regionMapping[regionName];
    let region = regionId ? regionsData.find(r => r.id === regionId) : null;
    
    // Fallback to fuzzy matching if not found in mapping
    if (!region) {
      region = regionsData.find(r => 
        r.name.toLowerCase().includes(regionName.toLowerCase()) || 
        regionName.toLowerCase().includes(r.name.toLowerCase()) ||
        r.id.toLowerCase().includes(regionName.toLowerCase())
      ) || null;
    }

    if (region) {
      console.log('Matched region:', region.name);
      if (currentView === 'regions') {
        setPreviewRegion(region);
      } else {
        handleRegionClick(region);
      }
    } else {
      console.warn('No region matched for:', regionName);
    }
  };

  const startQuiz = (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setQuizState({
      currentQuestionIndex: 0,
      score: 0,
      showResult: false,
      answers: new Array(quiz.questions.length).fill(null),
      isFinished: false,
    });
    setCurrentView('quiz-play');
    window.scrollTo(0, 0);
  };

  const handleAnswer = (optionIndex: number) => {
    if (quizState.showResult) return;

    const currentQuestion = selectedQuiz!.questions[quizState.currentQuestionIndex];
    const isMultiple = currentQuestion.type === 'multiple-choice';
    
    if (isMultiple) {
      const currentAnswers = (quizState.answers[quizState.currentQuestionIndex] as number[]) || [];
      const newAnswers = [...quizState.answers];
      
      if (currentAnswers.includes(optionIndex)) {
        newAnswers[quizState.currentQuestionIndex] = currentAnswers.filter(i => i !== optionIndex);
      } else {
        newAnswers[quizState.currentQuestionIndex] = [...currentAnswers, optionIndex];
      }
      
      setQuizState(prev => ({
        ...prev,
        answers: newAnswers,
      }));
    } else {
      const isCorrect = optionIndex === currentQuestion.correctAnswer;
      const newAnswers = [...quizState.answers];
      newAnswers[quizState.currentQuestionIndex] = optionIndex;

      setQuizState(prev => ({
        ...prev,
        score: isCorrect ? prev.score + 1 : prev.score,
        showResult: true,
        answers: newAnswers,
      }));
    }
  };

  const submitMultipleChoice = () => {
    const currentQuestion = selectedQuiz!.questions[quizState.currentQuestionIndex];
    const userAnswers = (quizState.answers[quizState.currentQuestionIndex] as number[]) || [];
    const correctAnswers = currentQuestion.correctAnswer as number[];
    
    const isCorrect = userAnswers.length === correctAnswers.length && 
                      userAnswers.every(val => correctAnswers.includes(val));
    
    setQuizState(prev => ({
      ...prev,
      score: isCorrect ? prev.score + 1 : prev.score,
      showResult: true,
    }));
  };

  const nextQuestion = () => {
    if (quizState.currentQuestionIndex < selectedQuiz!.questions.length - 1) {
      setQuizState(prev => ({
        ...prev,
        currentQuestionIndex: prev.currentQuestionIndex + 1,
        showResult: false,
      }));
    } else {
      setQuizState(prev => ({
        ...prev,
        isFinished: true,
      }));
      updateStats(quizState.score, selectedQuiz!.questions.length, selectedQuiz!.id);
    }
  };

  const renderHome = () => (
    <div className="space-y-12 pb-20">
      <section className="relative h-[60vh] flex items-center justify-center overflow-hidden rounded-3xl mt-4 mx-4 bg-zinc-900 text-white">
        <div className="absolute inset-0 opacity-40">
          <img 
            src="https://images.unsplash.com/photo-1528660493888-ab6f4761e036?auto=format&fit=crop&q=80&w=2000" 
            alt="Kazakhstan Landscape" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="relative z-10 text-center px-6 max-w-4xl">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-bold mb-6 tracking-tight"
          >
            QazaqGeo Learn
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl md:text-2xl text-zinc-300 mb-8 font-light"
          >
            Исследуйте регионы Казахстана, изучайте историю и проверяйте свои знания в интерактивных квизах.
          </motion.p>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap justify-center gap-4"
          >
            <button 
              onClick={() => setCurrentView('regions')}
              className="px-8 py-4 bg-white text-black rounded-full font-semibold hover:bg-zinc-200 transition-colors"
            >
              Начать исследование
            </button>
            <button 
              onClick={() => setCurrentView('quizzes')}
              className="px-8 py-4 bg-zinc-800 text-white rounded-full font-semibold border border-zinc-700 hover:bg-zinc-700 transition-colors"
            >
              Пройти квиз
            </button>
          </motion.div>
        </div>
      </section>

      <section className="px-6 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div>
            <h2 className="text-4xl font-bold tracking-tight mb-2">Популярные направления</h2>
            <p className="text-zinc-500">Самые посещаемые и интересные регионы нашей страны.</p>
          </div>
          <button 
            onClick={() => setCurrentView('regions')}
            className="px-6 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-full font-bold flex items-center gap-2 transition-all"
          >
            Все регионы <ChevronRight size={18} />
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {regionsData.slice(0, 3).map((region, idx) => (
            <motion.div 
              key={region.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ y: -12 }}
              onClick={() => handleRegionClick(region)}
              className="group relative h-[500px] rounded-[3rem] overflow-hidden cursor-pointer shadow-xl"
            >
              <img 
                src={`https://picsum.photos/seed/${region.id}/800/1200`} 
                alt={region.name}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-70 group-hover:opacity-80 transition-opacity" />
              
              <div className="absolute inset-0 p-10 flex flex-col justify-end">
                <div className="mb-4 overflow-hidden">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-8 h-[1px] bg-white/50" />
                    <span className="text-xs font-bold text-white/70 uppercase tracking-[0.2em]">{region.capital}</span>
                  </div>
                  <h3 className="text-4xl font-bold text-white leading-tight mb-4 group-hover:text-zinc-200 transition-colors">
                    {region.name}
                  </h3>
                </div>
                
                <div className="flex items-center gap-4 text-white/50 text-sm font-medium mb-6">
                  <div className="flex items-center gap-1.5">
                    <Mountain size={14} /> {region.area}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <UserIcon size={14} /> {region.population}
                  </div>
                </div>

                <div className="h-12 w-12 bg-white rounded-full flex items-center justify-center text-black scale-0 group-hover:scale-100 transition-transform duration-500 shadow-2xl">
                  <ChevronRight size={24} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="px-6 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row gap-12 items-center">
          <div className="md:w-1/2">
            <h2 className="text-3xl font-bold tracking-tight mb-6">Демография регионов</h2>
            <p className="text-zinc-500 mb-8">
              Казахстан — страна с динамично растущим населением. На графике представлены 10 наиболее населенных регионов и городов страны. 
              Алматы и Туркестанская область лидируют по количеству жителей.
            </p>
            <div className="space-y-4">
              {chartData.slice(0, 3).map((item, i) => (
                <div key={item.name} className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-zinc-900 text-white rounded-lg flex items-center justify-center font-bold text-sm">
                      {i + 1}
                    </div>
                    <span className="font-bold">{item.fullName}</span>
                  </div>
                  <span className="text-zinc-500 font-medium">{item.population.toLocaleString()} чел.</span>
                </div>
              ))}
            </div>
          </div>
          <div className="md:w-1/2 h-[400px] w-full bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f4f4f5" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fontWeight: 600, fill: '#18181b' }}
                  width={100}
                />
                <Tooltip 
                  cursor={{ fill: '#f4f4f5' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [value.toLocaleString() + ' чел.', 'Население']}
                />
                <Bar dataKey="population" radius={[0, 10, 10, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#18181b' : '#71717a'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="px-6 max-w-7xl mx-auto bg-zinc-50 py-16 rounded-3xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight mb-4">Проверьте свои знания</h2>
          <p className="text-zinc-500 max-w-2xl mx-auto">Выберите одну из тем и узнайте, насколько хорошо вы знаете Казахстан и мир.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quizzesData.slice(0, 4).map((quiz) => {
            const Icon = IconMap[quiz.iconName] || Globe;
            return (
              <motion.div 
                key={quiz.id}
                whileHover={{ scale: 1.02 }}
                onClick={() => startQuiz(quiz)}
                className="p-6 bg-white border border-zinc-200 rounded-2xl cursor-pointer hover:border-zinc-400 transition-colors"
              >
                <div className="w-12 h-12 bg-zinc-900 text-white rounded-xl flex items-center justify-center mb-4">
                  <Icon size={24} />
                </div>
                <h3 className="font-bold mb-1">{quiz.title}</h3>
                <p className="text-xs text-zinc-500 mb-4">{quiz.description}</p>
                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  {quiz.questions.length} вопросов
                </div>
              </motion.div>
            );
          })}
        </div>
        <div className="text-center mt-10">
          <button 
            onClick={() => setCurrentView('quizzes')}
            className="px-6 py-3 bg-zinc-900 text-white rounded-full font-medium hover:bg-black transition-colors"
          >
            Все квизы
          </button>
        </div>
      </section>
    </div>
  );

  const renderRegions = () => (
    <div className="px-6 max-w-7xl mx-auto py-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Регионы Казахстана</h1>
          <p className="text-zinc-500">Познакомьтесь с административно-территориальным устройством страны.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
          <input 
            type="text" 
            placeholder="Поиск региона или города..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 pr-6 py-3 bg-white border border-zinc-200 rounded-full w-full md:w-80 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-12">
        <div className="lg:col-span-2 h-[600px]">
          <MapComponent 
            onRegionClick={handleMapRegionClick} 
            selectedRegionName={previewRegion?.name}
          />
        </div>
        <div className="h-[600px]">
          <AnimatePresence mode="wait">
            {previewRegion ? (
              <motion.div 
                key="preview"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm flex flex-col h-full"
              >
                <div className="h-48 bg-zinc-100 rounded-2xl overflow-hidden mb-6">
                  <img 
                    src={`https://picsum.photos/seed/${previewRegion.id}/800/600`} 
                    alt={previewRegion.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <h3 className="text-2xl font-bold mb-2">{previewRegion.name}</h3>
                <p className="text-zinc-500 text-sm mb-6 line-clamp-4">{previewRegion.description}</p>
                
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-zinc-50 p-3 rounded-xl">
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Центр</div>
                    <div className="text-sm font-bold">{previewRegion.capital}</div>
                  </div>
                  <div className="bg-zinc-50 p-3 rounded-xl">
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Площадь</div>
                    <div className="text-sm font-bold">{previewRegion.area}</div>
                  </div>
                </div>

                <div className="mt-auto space-y-3">
                  <button 
                    onClick={() => handleRegionClick(previewRegion)}
                    className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-black transition-colors flex items-center justify-center gap-2"
                  >
                    Подробнее <ChevronRight size={18} />
                  </button>
                  <button 
                    onClick={() => setPreviewRegion(null)}
                    className="w-full py-4 bg-white border border-zinc-200 text-zinc-500 rounded-2xl font-bold hover:bg-zinc-50 transition-colors"
                  >
                    К списку
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="list"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4 overflow-y-auto h-full pr-2 custom-scrollbar"
              >
                <h3 className="font-bold text-xl mb-4">Выберите регион на карте</h3>
                {regionsData.map(region => (
                  <div 
                    key={region.id}
                    onClick={() => setPreviewRegion(region)}
                    className="p-4 border border-zinc-100 rounded-xl hover:border-zinc-900 cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-bold">{region.name}</div>
                      <div className="text-xs text-zinc-400 uppercase tracking-widest">{region.capital}</div>
                    </div>
                    <ChevronRight size={16} className="text-zinc-300 group-hover:text-zinc-900 transition-colors" />
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 auto-rows-[240px]">
        {filteredRegions.map((region, index) => {
          // Create a dynamic bento pattern
          const isLarge = index % 7 === 0 || index % 7 === 3;
          return (
            <motion.div 
              layout
              key={region.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ y: -5 }}
              onClick={() => {
                setPreviewRegion(region);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`group relative overflow-hidden rounded-[2rem] cursor-pointer shadow-sm hover:shadow-2xl transition-all duration-500 ${
                isLarge ? 'md:col-span-2 md:row-span-2' : 'md:col-span-1 md:row-span-1'
              } ${previewRegion?.id === region.id ? 'ring-4 ring-zinc-900 ring-offset-4' : ''}`}
            >
              <img 
                src={`https://picsum.photos/seed/${region.id}/1200/800`} 
                alt={region.name}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500" />
              
              <div className="absolute inset-0 p-6 flex flex-col justify-end">
                <div className="translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-bold text-white uppercase tracking-wider">
                      {region.capital}
                    </span>
                  </div>
                  <h3 className={`font-bold text-white leading-tight ${isLarge ? 'text-3xl' : 'text-xl'}`}>
                    {region.name}
                  </h3>
                  {isLarge && (
                    <p className="text-white/70 text-sm mt-3 line-clamp-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
                      {region.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Decorative element */}
              <div className="absolute top-6 right-6 w-10 h-10 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 rotate-45 group-hover:rotate-0">
                <ChevronRight className="text-white" size={20} />
              </div>
            </motion.div>
          );
        })}
      </div>
      
      {filteredRegions.length === 0 && (
        <div className="text-center py-20">
          <p className="text-zinc-500 text-lg">Ничего не найдено по вашему запросу.</p>
        </div>
      )}
    </div>
  );

  const renderRegionDetail = () => {
    if (!selectedRegion) return null;
    return (
      <div className="pb-20">
        <div className="relative h-[50vh] w-full">
          <img 
            src={`https://picsum.photos/seed/${selectedRegion.id}/1920/1080`} 
            alt={selectedRegion.name}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 w-full p-8 md:p-16">
            <div className="max-w-7xl mx-auto">
              <button 
                onClick={() => setCurrentView('regions')}
                className="flex items-center gap-2 text-white/70 hover:text-white mb-6 transition-colors"
              >
                <ArrowLeft size={20} /> Назад к списку
              </button>
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 tracking-tight">{selectedRegion.name}</h1>
              <div className="flex flex-wrap gap-6 text-white/80 font-medium">
                <div className="flex items-center gap-2">
                  <Landmark size={18} className="text-zinc-400" />
                  <span>Столица: {selectedRegion.capital}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapIcon size={18} className="text-zinc-400" />
                  <span>Площадь: {selectedRegion.area}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe size={18} className="text-zinc-400" />
                  <span>Население: {selectedRegion.population}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-16">
          <div className="prose prose-zinc lg:prose-xl">
            <h2 className="text-3xl font-bold mb-6">О регионе</h2>
            <p className="text-zinc-600 leading-relaxed text-lg mb-12">
              {selectedRegion.description}
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
              <div className="p-8 bg-zinc-50 rounded-3xl border border-zinc-100">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Info size={20} /> География
                </h3>
                <p className="text-zinc-600 text-sm">
                  Координаты центра: {selectedRegion.coordinates[1]}° N, {selectedRegion.coordinates[0]}° E. 
                  Регион обладает уникальным ландшафтом и климатическими особенностями, характерными для данной части Казахстана.
                </p>
              </div>
              <div className="p-8 bg-zinc-50 rounded-3xl border border-zinc-100">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Star size={20} /> Интересный факт
                </h3>
                <p className="text-zinc-600 text-sm">
                  Каждый регион Казахстана вносит свой неповторимый вклад в культурное и экономическое разнообразие страны, 
                  сохраняя при этом общие национальные традиции и ценности.
                </p>
              </div>
            </div>

            <div className="h-96 w-full mb-12">
              <MapComponent 
                onRegionClick={handleMapRegionClick} 
                selectedRegionName={selectedRegion.name} 
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderProfile = () => {
    const nextLevelXp = userStats.level * 1000;
    const currentLevelXp = userStats.xp % 1000;
    const progress = (currentLevelXp / 1000) * 100;

    return (
      <div className="px-6 max-w-4xl mx-auto py-12">
          <div className="bg-zinc-900 text-white rounded-3xl p-8 md:p-12 mb-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <UserIcon size={200} />
          </div>
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 bg-white text-zinc-900 rounded-3xl flex items-center justify-center text-4xl font-black">
                  {userStats.level}
                </div>
                <div>
                  <h1 className="text-3xl font-bold mb-1">{currentUser?.displayName || 'Исследователь'}</h1>
                  <p className="text-zinc-400">{currentUser?.email || 'Гостевой режим'}</p>
                </div>
              </div>
              
              {currentUser ? (
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-colors text-sm font-bold"
                >
                  <LogOut size={18} /> Выйти
                </button>
              ) : (
                <button 
                  onClick={handleLogin}
                  className="flex items-center gap-2 px-6 py-3 bg-white text-zinc-900 hover:bg-zinc-200 rounded-2xl transition-colors text-sm font-bold"
                >
                  <LogIn size={18} /> Войти через Google
                </button>
              )}
            </div>

            <div className="space-y-2 mb-8">
              <div className="flex justify-between text-sm font-bold uppercase tracking-widest">
                <span>Опыт: {userStats.xp} XP</span>
                <span>{nextLevelXp} XP</span>
              </div>
              <div className="h-4 bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <div className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-1">Квизы</div>
                <div className="text-2xl font-bold">{userStats.quizzesCompleted}</div>
              </div>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <div className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-1">Рекорды</div>
                <div className="text-2xl font-bold">{userStats.perfectScores}</div>
              </div>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <div className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-1">Серия</div>
                <div className="text-2xl font-bold">{userStats.streak}</div>
              </div>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <div className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-1">Ранг</div>
                <div className="text-2xl font-bold">#12</div>
              </div>
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-8">Достижения</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {achievements.map((achievement) => (
            <div 
              key={achievement.id}
              className={`p-6 rounded-3xl border-2 transition-all flex items-center gap-6 ${
                achievement.unlocked 
                  ? 'border-zinc-900 bg-white' 
                  : 'border-zinc-100 bg-zinc-50 opacity-60'
              }`}
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                achievement.unlocked ? 'bg-zinc-900 text-white' : 'bg-zinc-200 text-zinc-400'
              }`}>
                {achievement.icon}
              </div>
              <div>
                <h3 className="font-bold text-lg">{achievement.title}</h3>
                <p className="text-zinc-500 text-sm">{achievement.description}</p>
                {achievement.unlocked && (
                  <div className="mt-2 text-xs font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                    <CheckCircle2 size={12} /> Разблокировано (+{achievement.xpReward} XP)
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderQuizzes = () => (
    <div className="px-6 max-w-7xl mx-auto py-12">
      <div className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Интерактивные квизы</h1>
        <p className="text-zinc-500">Проверьте свои знания и узнайте новые факты о Казахстане.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {quizzesData.map((quiz, idx) => {
          const Icon = IconMap[quiz.iconName] || Globe;
          return (
            <motion.div 
              key={quiz.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ y: -10 }}
              onClick={() => startQuiz(quiz)}
              className="group cursor-pointer relative h-[450px] rounded-[3rem] overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500"
            >
              <div className="absolute inset-0 bg-zinc-100">
                 <img 
                  src={`https://picsum.photos/seed/${quiz.id}/800/1200`} 
                  alt={quiz.title}
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />
              
              <div className="absolute inset-0 p-10 flex flex-col justify-end">
                <div className="w-16 h-16 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center mb-6 border border-white/20 group-hover:bg-white group-hover:text-black transition-all duration-500">
                  <Icon size={32} />
                </div>
                <h3 className="text-3xl font-bold text-white mb-4 leading-tight">{quiz.title}</h3>
                <p className="text-white/60 text-sm mb-8 line-clamp-2 group-hover:text-white/80 transition-colors">
                  {quiz.description}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white/50 text-xs font-bold uppercase tracking-widest">
                    <Target size={16} /> {quiz.questions.length} вопросов
                  </div>
                  <div className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center scale-0 group-hover:scale-100 transition-transform duration-500 shadow-2xl">
                    <Play size={24} fill="currentColor" />
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );

  const renderQuizPlay = () => {
    if (!selectedQuiz) return null;
    
    const currentQuestion = selectedQuiz.questions[quizState.currentQuestionIndex];
    const progress = ((quizState.currentQuestionIndex + 1) / selectedQuiz.questions.length) * 100;

    if (quizState.isFinished) {
      const percentage = Math.round((quizState.score / selectedQuiz.questions.length) * 100);
      return (
        <div className="max-w-2xl mx-auto px-6 py-20 text-center">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mb-8 inline-flex items-center justify-center w-24 h-24 bg-zinc-900 text-white rounded-full"
          >
            <Trophy size={40} />
          </motion.div>
          <h1 className="text-4xl font-bold mb-4">Квиз завершен!</h1>
          <p className="text-xl text-zinc-500 mb-12">
            Ваш результат: <span className="text-black font-bold">{quizState.score}</span> из {selectedQuiz.questions.length} ({percentage}%)
          </p>
          
          <div className="grid grid-cols-1 gap-4 mb-12">
            <button 
              onClick={() => startQuiz(selectedQuiz)}
              className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-black transition-colors"
            >
              Попробовать снова
            </button>
            <button 
              onClick={() => setCurrentView('quizzes')}
              className="w-full py-4 bg-white border border-zinc-200 text-zinc-900 rounded-2xl font-bold hover:bg-zinc-50 transition-colors"
            >
              К списку квизов
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <button 
              onClick={() => setCurrentView('quizzes')}
              className="text-zinc-400 hover:text-black transition-colors"
            >
              <X size={24} />
            </button>
            <span className="text-sm font-bold text-zinc-400 uppercase tracking-widest">
              Вопрос {quizState.currentQuestionIndex + 1} из {selectedQuiz.questions.length}
            </span>
          </div>
          <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-zinc-900"
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div 
            key={quizState.currentQuestionIndex}
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            className="space-y-8"
          >
            {currentQuestion.visual && (
              <div className="text-8xl text-center py-8 bg-zinc-50 rounded-3xl border border-zinc-100">
                {currentQuestion.visual}
              </div>
            )}
            <h2 className="text-3xl font-bold leading-tight text-center">
              {currentQuestion.question}
            </h2>

            <div className="grid grid-cols-1 gap-4">
              {currentQuestion.options.map((option, index) => {
                const isMultiple = currentQuestion.type === 'multiple-choice';
                const currentAnswers = quizState.answers[quizState.currentQuestionIndex];
                
                const isSelected = isMultiple 
                  ? (currentAnswers as number[] || []).includes(index)
                  : currentAnswers === index;
                
                const isCorrect = isMultiple
                  ? (currentQuestion.correctAnswer as number[]).includes(index)
                  : index === currentQuestion.correctAnswer;
                
                const showResult = quizState.showResult;

                let buttonClass = "w-full p-6 text-left rounded-2xl border-2 transition-all duration-300 font-medium text-lg flex items-center justify-between ";
                if (!showResult) {
                  if (isSelected) {
                    buttonClass += "border-zinc-900 bg-zinc-50";
                  } else {
                    buttonClass += "border-zinc-100 bg-white hover:border-zinc-900 hover:bg-zinc-50";
                  }
                } else {
                  if (isCorrect) {
                    buttonClass += "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-[0_0_15px_rgba(16,185,129,0.1)]";
                  } else if (isSelected) {
                    buttonClass += "border-rose-500 bg-rose-50 text-rose-900 shadow-[0_0_15px_rgba(244,63,94,0.1)]";
                  } else {
                    buttonClass += "border-zinc-100 bg-white opacity-40 grayscale-[0.5]";
                  }
                }

                return (
                  <motion.button 
                    key={index}
                    disabled={showResult}
                    onClick={() => handleAnswer(index)}
                    className={buttonClass}
                    whileTap={!showResult ? { scale: 0.98 } : {}}
                    initial={false}
                    animate={showResult && isSelected ? { x: isCorrect ? [0, -2, 2, -2, 2, 0] : [0, -5, 5, -5, 5, 0] } : {}}
                  >
                    <div className="flex items-center gap-4">
                      {isMultiple && (
                        <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-zinc-900 border-zinc-900' : 'border-zinc-200'}`}>
                          {isSelected && <CheckCircle2 size={16} className="text-white" />}
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-sm text-zinc-400 mb-1 font-bold uppercase tracking-tighter">
                          {currentQuestion.type === 'true-false' ? (index === 0 ? 'Вариант А' : 'Вариант Б') : `Вариант ${String.fromCharCode(65 + index)}`}
                        </span>
                        <span>{option}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {showResult && isCorrect && (
                        <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                          <span>Верно</span>
                          <CheckCircle2 size={24} />
                        </div>
                      )}
                      {showResult && isSelected && !isCorrect && (
                        <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
                          <span>Неверно</span>
                          <XCircle size={24} />
                        </div>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {currentQuestion.type === 'multiple-choice' && !quizState.showResult && (
              <button 
                onClick={submitMultipleChoice}
                disabled={(quizState.answers[quizState.currentQuestionIndex] as number[] || []).length === 0}
                className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Подтвердить выбор
              </button>
            )}

            {quizState.showResult && (
              <motion.div 
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="p-8 bg-zinc-900 text-white rounded-3xl"
              >
                <h4 className="font-bold mb-2 flex items-center gap-2">
                  <Info size={18} /> Объяснение
                </h4>
                <p className="text-zinc-300 mb-6">{currentQuestion.explanation}</p>
                <button 
                  onClick={nextQuestion}
                  className="w-full py-4 bg-white text-black rounded-xl font-bold hover:bg-zinc-200 transition-colors"
                >
                  {quizState.currentQuestionIndex === selectedQuiz.questions.length - 1 ? 'Завершить' : 'Следующий вопрос'}
                </button>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-zinc-900 selection:text-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-zinc-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div 
            onClick={() => setCurrentView('home')}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-10 h-10 bg-zinc-900 text-white rounded-xl flex items-center justify-center group-hover:rotate-12 transition-transform">
              <Globe size={20} />
            </div>
            <span className="text-xl font-bold tracking-tighter">QazaqGeo</span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <button 
              onClick={() => setCurrentView('regions')}
              className={`text-sm font-bold uppercase tracking-widest transition-colors ${currentView === 'regions' ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-900'}`}
            >
              Регионы
            </button>
            <button 
              onClick={() => setCurrentView('quizzes')}
              className={`text-sm font-bold uppercase tracking-widest transition-colors ${currentView === 'quizzes' ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-900'}`}
            >
              Квизы
            </button>
            
            <div 
              onClick={() => setCurrentView('profile')}
              className="flex items-center gap-3 bg-zinc-50 hover:bg-zinc-100 p-1.5 pr-4 rounded-full cursor-pointer transition-colors border border-zinc-200"
            >
              {currentUser?.photoURL ? (
                <img src={currentUser.photoURL} alt="" className="w-8 h-8 rounded-full border border-zinc-200" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-black">
                  {userStats.level}
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 leading-none">
                  {currentUser ? currentUser.displayName?.split(' ')[0] : 'Уровень'}
                </span>
                <span className="text-xs font-bold leading-none mt-1">{userStats.xp} XP</span>
              </div>
            </div>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden text-zinc-900"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* Mobile Nav */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-t border-zinc-100 overflow-hidden"
            >
              <div className="px-6 py-8 flex flex-col gap-6">
                <button 
                  onClick={() => { setCurrentView('regions'); setIsMenuOpen(false); }}
                  className="text-2xl font-bold text-left"
                >
                  Регионы
                </button>
                <button 
                  onClick={() => { setCurrentView('quizzes'); setIsMenuOpen(false); }}
                  className="text-2xl font-bold text-left"
                >
                  Квизы
                </button>
                <button className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold">
                  Войти
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Main Content */}
      <main>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView + (selectedRegion?.id || '') + (selectedQuiz?.id || '')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {currentView === 'home' && renderHome()}
            {currentView === 'regions' && renderRegions()}
            {currentView === 'region-detail' && renderRegionDetail()}
            {currentView === 'quizzes' && renderQuizzes()}
            {currentView === 'quiz-play' && renderQuizPlay()}
            {currentView === 'profile' && renderProfile()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-zinc-50 border-t border-zinc-200 py-20 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-zinc-900 text-white rounded-lg flex items-center justify-center">
                <Globe size={16} />
              </div>
              <span className="text-lg font-bold tracking-tighter">QazaqGeo Learn</span>
            </div>
            <p className="text-zinc-500 max-w-sm mb-8">
              Образовательная платформа для изучения географии, истории и культуры Казахстана в интерактивном формате.
            </p>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-zinc-400 hover:text-zinc-900 cursor-pointer transition-colors">
                <Globe size={20} />
              </div>
              <div className="w-10 h-10 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-zinc-400 hover:text-zinc-900 cursor-pointer transition-colors">
                <Info size={20} />
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-bold mb-6 uppercase tracking-widest text-xs text-zinc-400">Навигация</h4>
            <ul className="space-y-4 font-medium">
              <li><button onClick={() => setCurrentView('home')} className="hover:text-zinc-500 transition-colors">Главная</button></li>
              <li><button onClick={() => setCurrentView('regions')} className="hover:text-zinc-500 transition-colors">Регионы</button></li>
              <li><button onClick={() => setCurrentView('quizzes')} className="hover:text-zinc-500 transition-colors">Квизы</button></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-6 uppercase tracking-widest text-xs text-zinc-400">О проекте</h4>
            <ul className="space-y-4 font-medium">
              <li><button className="hover:text-zinc-500 transition-colors">О нас</button></li>
              <li><button className="hover:text-zinc-500 transition-colors">Контакты</button></li>
              <li><button className="hover:text-zinc-500 transition-colors">Политика конфиденциальности</button></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-zinc-200 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-zinc-400">
          <p>© 2024 QazaqGeo Learn. Все права защищены.</p>
          <p>Сделано с любовью к Казахстану 🇰🇿</p>
        </div>
      </footer>
    </div>
  );
}
