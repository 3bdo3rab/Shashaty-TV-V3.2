import { Mode, Watchlist, Session, ModeConfig } from './types';

export const MODE_LIBRARY_TITLES: Record<Mode, string> = {
  kids: 'مكتبة أطفالي',
  night: 'مكتبة عائلتي',
  family: 'مكتبة المسلسلات',
  cinema: 'مكتبة الأفلام',
  docs: 'الوثائقيات',
  quran: 'مكتبة القرآن',
  music: 'الموسيقى',
};

export const MODES: Record<Mode, ModeConfig> = {
  kids: { title: 'أطفالي', gradient: 'from-sky-400 via-fuchsia-400 to-amber-300', themeColor: 'text-fuchsia-100', bgImage: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&q=80&w=1600', bgOpacity: 40 },
  night: { title: 'عائلتي', gradient: 'from-slate-900 via-indigo-950 to-blue-950', themeColor: 'text-indigo-100', bgImage: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&q=80&w=1600', bgOpacity: 50 },
  family: { title: 'المسلسلات', gradient: 'from-orange-500 via-rose-500 to-purple-600', themeColor: 'text-orange-100', bgImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=1600', bgOpacity: 50 },
  cinema: { title: 'الأفلام', gradient: 'from-zinc-950 via-black to-zinc-900', themeColor: 'text-zinc-300', bgImage: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&q=80&w=1600', bgOpacity: 45 },
  docs: { title: 'الوثائقيات', gradient: 'from-stone-800 via-emerald-900 to-stone-900', themeColor: 'text-emerald-100', bgImage: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=1600', bgOpacity: 50 },
  quran: { title: 'القرآن الكريم', gradient: 'from-emerald-800 via-teal-900 to-cyan-900', themeColor: 'text-teal-100', bgImage: 'https://images.unsplash.com/photo-1564769625905-50e93615e769?auto=format&fit=crop&q=80&w=1600', bgOpacity: 45 },
  music: { title: 'الموسيقى', gradient: 'from-violet-600 via-fuchsia-700 to-orange-600', themeColor: 'text-violet-100', bgImage: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=1600', bgOpacity: 50 },
};

export interface BackgroundPreset {
  id: string;
  name: string;
  url: string;
}

export const MODE_BACKGROUND_PRESETS: Record<Mode, BackgroundPreset[]> = {
  kids: [
    { id: 'kids_grad', name: 'تدرج ألوان فقط (بدون صورة)', url: '' },
    { id: 'kids_space', name: 'فضاء الكرتون والأنيميشن 🚀', url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&q=80&w=1600' },
    { id: 'kids_balloons', name: 'عالم البالونات والألعاب 🎈', url: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&q=80&w=1600' },
    { id: 'kids_fantasy', name: 'غابة الألوان والمغامرات 🌈', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=1600' },
  ],
  family: [
    { id: 'family_grad', name: 'تدرج الشفق الدافئ (بدون صورة)', url: '' },
    { id: 'family_cozy', name: 'سينما عائلية دافئة 🍿', url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&q=80&w=1600' },
    { id: 'family_sunset', name: 'أفق السهرة العائلية 🌅', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=1600' },
    { id: 'family_lights', name: 'أضواء دافئة ومريحة ✨', url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&q=80&w=1600' },
  ],
  night: [
    { id: 'night_grad', name: 'تدرج ليل داكن (بدون صورة)', url: '' },
    { id: 'night_sky', name: 'سماء الليل والنجوم 🌌', url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&q=80&w=1600' },
    { id: 'night_city', name: 'أضواء المدينة الهادئة 🌃', url: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&q=80&w=1600' },
    { id: 'night_aurora', name: 'الشفق القطبي 🎆', url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&q=80&w=1600' },
  ],
  cinema: [
    { id: 'cinema_grad', name: 'أسود سينمائي (بدون صورة)', url: '' },
    { id: 'cinema_hall', name: 'قاعة السينما الفاخرة 🎬', url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&q=80&w=1600' },
    { id: 'cinema_curtains', name: 'الستارة المخملية الحمراء 🎭', url: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&q=80&w=1600' },
    { id: 'cinema_projector', name: 'ضوء البروجكتور 📽️', url: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&q=80&w=1600' },
  ],
  docs: [
    { id: 'docs_grad', name: 'زمرد الطبيعة (بدون صورة)', url: '' },
    { id: 'docs_space', name: 'أعماق الفضاء والكون 🪐', url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=1600' },
    { id: 'docs_nature', name: 'الجبال والغابات 🏔️', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=1600' },
    { id: 'docs_ocean', name: 'أعماق المحيط 🌊', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=1600' },
  ],
  quran: [
    { id: 'quran_grad', name: 'زمرد إسلامي (بدون صورة)', url: '' },
    { id: 'quran_mosque', name: 'عمارة إسلامية ومسجد 🕌', url: 'https://images.unsplash.com/photo-1542810634-71277d95dcbb?auto=format&fit=crop&q=80&w=1600' },
    { id: 'quran_nature', name: 'سكينة الطبيعة والغروب 🌅', url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&q=80&w=1600' },
    { id: 'quran_arch', name: 'أنوار وأقواس المسجد ✨', url: 'https://images.unsplash.com/photo-1564769625905-50e93615e769?auto=format&fit=crop&q=80&w=1600' },
  ],
  music: [
    { id: 'music_grad', name: 'تدرج موسيقي (بدون صورة)', url: '' },
    { id: 'music_stage', name: 'مسرح الأضواء والموسيقى 🎸', url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=1600' },
    { id: 'music_studio', name: 'استوديو الموسيقى 🎧', url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=1600' },
    { id: 'music_lights', name: 'أضواء وأمواج الصوت 🎶', url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=1600' },
  ],
};

export const SECTIONS = [
  'مسلسلات',
  'أفلام',
  'وثائقيات',
  'أنمي',
  'أطفال',
  'الموسيقى',
  'القرآن الكريم'
];

export const KIDS_SECTIONS = [
  'الكل',
  'عربي',
  'إسلامي',
  'أجنبي معرّب',
  'أجنبي',
  'تعليمي',
  'أغاني'
];

export const MODE_SECTIONS: Record<Mode, string[]> = {
  kids: ['الكل', 'كرتون عربي', 'كرتون مترجم ومعدل', 'أغاني وأناشيد أطفال', 'تعليمي ومرح', 'قصص وحكايات', 'إسلامي للأطفال'],
  family: ['الكل', 'مسلسلات عربية', 'مسلسلات أجنبية', 'مسلسلات تاريخية', 'أنمي وكرتون عائلي', 'برامج تلفزيونية', 'مسلسلات تركية'],
  cinema: ['الكل', 'أفلام هوليود', 'أفلام عربية', 'أفلام أكشن وإثارة', 'أفلام دراما ورومانسية', 'أفلام خيال علمي', 'أفلام أنيميشن', 'سلسلة أفلام'],
  docs: ['الكل', 'عالم الطبيعة والحيوان', 'تاريخ وحضارات', 'فضاء وتكنولوجيا', 'وثائقيات علمية', 'سير ذاتية وستوديو', 'جرائم وتحقيقات'],
  quran: ['الكل', 'تلاوات خاشعة', 'القرآن كاملاً', 'تفسير ودروس', 'أدعية وأذكار', 'قصص الأنبياء', 'أناشيد إسلامية'],
  music: ['الكل', 'أغاني عربية', 'موسيقى كلاسيكية وهادئة', 'حفلات مباشرة', 'معزوفات سينمائية', 'أغاني طرب'],
  night: ['الكل', 'أفلام سهرة هادئة', 'مسلسلات غموض وإثارة', 'موسيقى الاسترخاء', 'برامج حوارية'],
};

export interface CartoonCharacter {
  id: string;
  name: string;
  titleAr: string;
  avatar: string;
  bgColor: string;
  episodesCount: number;
  description: string;
  tag: string;
}

export const KIDS_CHARACTERS: CartoonCharacter[] = [
  {
    id: 'spongebob',
    name: 'SpongeBob',
    titleAr: 'سبونج بوب',
    avatar: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&q=80&w=500',
    bgColor: 'from-yellow-400 to-amber-500',
    episodesCount: 45,
    description: 'مغامرات قاع الهامور الممتعة مع سبونج بوب وبسيط!',
    tag: 'سبونج بوب'
  },
  {
    id: 'tom_jerry',
    name: 'Tom & Jerry',
    titleAr: 'توم وجيري',
    avatar: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&q=80&w=500',
    bgColor: 'from-blue-400 to-indigo-600',
    episodesCount: 60,
    description: 'المطاردات الكوميدية الكلاسيكية بين القط توم والفأر جيري.',
    tag: 'توم وجيري'
  },
  {
    id: 'masha',
    name: 'Masha & Bear',
    titleAr: 'ماشا والدب',
    avatar: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=500',
    bgColor: 'from-pink-400 to-rose-500',
    episodesCount: 30,
    description: 'شغف ومغامرات الطفلة ماشا مع صديقها الدب اللطيف.',
    tag: 'ماشا والدب'
  },
  {
    id: 'mickey',
    name: 'Mickey Mouse',
    titleAr: 'ميكي ماوس',
    avatar: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&q=80&w=500',
    bgColor: 'from-red-500 to-zinc-900',
    episodesCount: 50,
    description: 'نادي ميكي ماوس المليء بالألغاز والأغاني والضحك!',
    tag: 'ميكي ماوس'
  }
];

// Default libraries deleted as requested by user ("احذف كل المكتبات الافتراضية")
export const MOCK_WATCHLISTS: Watchlist[] = [];

export const MOCK_SESSIONS: Session[] = [];

