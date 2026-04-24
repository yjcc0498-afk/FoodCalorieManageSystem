type Role = 'user' | 'admin';

type SafeUser = {
  _id: string;
  username: string;
  email: string;
  role: Role;
  avatarType?: string;
  avatarSeed?: string;
  avatarUrl?: string;
  bio?: string;
  height?: number;
  age?: number;
  weight?: number;
  targetWeight?: number;
  dailyCalorieGoal?: number;
  lastLoginAt?: string;
  passwordChangedAt?: string;
  foodCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

type FoodOwner = {
  _id?: string;
  username?: string;
  email?: string;
};

type FoodRecord = {
  _id: string;
  name: string;
  calories: number;
  owner?: string | FoodOwner;
  createdAt?: string;
  updatedAt?: string;
};

type GoalCycleRecord = {
  _id: string;
  owner?: string;
  startDate: string;
  endDate: string;
  startWeight: number;
  targetWeight: number;
  dailyCalorieGoal: number;
  status: 'active' | 'completed' | 'archived';
  createdAt?: string;
  updatedAt?: string;
};

type DailyLogRecord = {
  _id: string;
  owner?: string;
  date: string;
  weight?: number | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type JournalEntryRecord = {
  _id: string;
  owner?: string;
  date: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  foodName: string;
  calories: number;
  quantity: number;
  foodId?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type GoalDayWeightProgress = {
  expectedWeight?: number | null;
  actualWeight?: number | null;
  variance?: number | null;
  progressRatio?: number | null;
  actualProgressRatio?: number | null;
};

type GoalDaySummary = {
  date: string;
  goalCycle: GoalCycleRecord | null;
  dailyLog: DailyLogRecord | null;
  journalEntries: JournalEntryRecord[];
  monthIndicators?: Array<{
    date: string;
    hasDailyLog?: boolean;
    hasJournalEntries?: boolean;
    actualCalories?: number;
    overGoal?: boolean;
  }>;
  summary: {
    actualCalories: number;
    targetCalories: number;
    remainingCalories: number;
    weightProgress?: GoalDayWeightProgress | null;
  };
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
};

type ApiResponse<T = unknown> = {
  message?: string;
  error?: string;
  token?: string;
  safeUser?: SafeUser;
  data?: T | { user?: T; items?: T };
  pagination?: Pagination;
  count?: number;
  total?: number;
  [key: string]: unknown;
};

type InspirationQuote = {
  text: string;
  source?: string;
};

type AdminOverviewActivity = {
  type?: string;
  title?: string;
  detail?: string;
  timestamp?: string;
};

type AdminOverviewPayload = {
  counts?: Record<string, unknown>;
  security?: Record<string, unknown>;
  system?: Record<string, unknown>;
  health?: Record<string, unknown>;
  recentActivity?: AdminOverviewActivity[];
  recentUsers?: SafeUser[];
  recentFoods?: FoodRecord[];
  [key: string]: unknown;
};

type StatusTone = 'success' | 'error' | 'info';

const SESSION_TOKEN_KEY = 'food-calorie-session-token';
const LOCAL_TOKEN_KEY = 'food-calorie-local-token';
const PAGE = document.body.dataset.page || 'unknown';

let authToken: string | null = null;
let currentUser: SafeUser | null = null;
let inspirationQuotesPromise: Promise<InspirationQuote[]> | null = null;

const FALLBACK_QUOTES: InspirationQuote[] = [
  { text: '照顾好今天的一餐，就是照顾好明天的自己。', source: '健康日签' },
  { text: '先把生活过稳，再让状态慢慢变好。', source: '健康日签' },
  { text: '每一次认真吃饭，都是在认真支持自己。', source: '健康日签' }
];

const byId = <T extends HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;

const qs = <T extends Element>(selector: string, root: ParentNode = document): T | null => root.querySelector(selector) as T | null;

const qsa = <T extends Element>(selector: string, root: ParentNode = document): T[] => Array.from(root.querySelectorAll(selector)) as T[];

const sleepFrame = () => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

const escapeHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const getStoredToken = () => {
  return window.sessionStorage.getItem(SESSION_TOKEN_KEY) || window.localStorage.getItem(LOCAL_TOKEN_KEY);
};

const persistToken = (token: string, sessionOnly: boolean) => {
  window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
  window.localStorage.removeItem(LOCAL_TOKEN_KEY);

  if (sessionOnly) {
    window.sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    return;
  }

  window.localStorage.setItem(LOCAL_TOKEN_KEY, token);
};

const clearAuth = () => {
  authToken = null;
  currentUser = null;
  window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
  window.localStorage.removeItem(LOCAL_TOKEN_KEY);
};

const toRole = (value: unknown): Role => value === 'admin' ? 'admin' : 'user';

const initialsFromSeed = (source: string) => {
  const cleaned = source.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase();
  return cleaned || 'FC';
};

const formatDate = (value?: string) => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};

const formatShortDate = (value?: string) => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
};

const numberValue = (value: unknown, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const nullableNumberValue = (value: unknown) => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeQuote = (value: unknown): InspirationQuote | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const text = String(candidate.text || '').trim();
  const source = String(candidate.source || '').trim();

  if (!text) {
    return null;
  }

  return {
    text,
    source: source || '鍋ュ悍鏃ョ'
  };
};

const loadInspirationQuotes = async () => {
  if (!inspirationQuotesPromise) {
    inspirationQuotesPromise = fetch('./health-quotes.json')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load quotes: ${response.status}`);
        }

        return await response.json() as unknown;
      })
      .then((payload) => Array.isArray(payload) ? payload.map(normalizeQuote).filter(Boolean) as InspirationQuote[] : [])
      .then((quotes) => quotes.length ? quotes : FALLBACK_QUOTES)
      .catch(() => FALLBACK_QUOTES);
  }

  return await inspirationQuotesPromise;
};

const nextRandomIndex = (length: number, currentIndex = -1) => {
  if (length <= 1) {
    return 0;
  }

  let nextIndex = Math.floor(Math.random() * length);

  while (nextIndex === currentIndex) {
    nextIndex = Math.floor(Math.random() * length);
  }

  return nextIndex;
};

const initAuthQuotePanel = async () => {
  const quoteText = byId<HTMLElement>('auth-quote-text');
  const quoteSource = byId<HTMLElement>('auth-quote-source');
  const nextButton = byId<HTMLButtonElement>('auth-quote-next');
  const quotePanel = qs<HTMLElement>('.login-copy');

  if (!quoteText || !quoteSource || !nextButton || !quotePanel) {
    return;
  }

  const quotes = await loadInspirationQuotes();
  let currentIndex = -1;

  const renderQuote = async (index: number) => {
    const quote = quotes[index];
    quotePanel.classList.remove('is-refreshing');
    void quotePanel.offsetWidth;
    quoteText.textContent = quote.text;
    quoteSource.textContent = quote.source || '鍋ュ悍鏃ョ';
    quotePanel.classList.add('is-refreshing');
    await sleepFrame();
  };

  currentIndex = nextRandomIndex(quotes.length, currentIndex);
  await renderQuote(currentIndex);

  nextButton.addEventListener('click', async () => {
    currentIndex = nextRandomIndex(quotes.length, currentIndex);
    await renderQuote(currentIndex);
  });
};

const formatDateKey = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 10);
};

const formatMonthKey = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 7);
};

const formatHumanDate = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
};

const shiftMonth = (value: Date, offset: number) => {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + offset, 1));
};

const buildAvatarText = (user: Partial<SafeUser> | null) => {
  if (!user) {
    return 'FC';
  }

  return initialsFromSeed(String(user.avatarSeed || user.username || user.email || 'fc'));
};

const resolveAvatarUrl = (user: Partial<SafeUser> | null) => {
  const avatarUrl = String(user?.avatarUrl || '').trim();

  if (!avatarUrl) {
    return '';
  }

  if (/^https?:\/\//i.test(avatarUrl) || avatarUrl.startsWith('/')) {
    return avatarUrl;
  }

  return `/${avatarUrl.replace(/^\.?\//, '')}`;
};

const applyAvatarElement = (element: HTMLElement | null, user: Partial<SafeUser> | null) => {
  if (!element) {
    return;
  }

  const avatarUrl = user?.avatarType === 'uploaded' ? resolveAvatarUrl(user) : '';

  if (avatarUrl) {
    element.textContent = '';
    element.classList.add('has-image');
    element.style.setProperty('--avatar-image', `url("${avatarUrl.replaceAll('"', '\\"')}")`);
    return;
  }

  element.textContent = buildAvatarText(user);
  element.classList.remove('has-image');
  element.style.removeProperty('--avatar-image');
};

const readFileAsDataUrl = (file: File) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Failed to read avatar file.'));
    reader.readAsDataURL(file);
  });
};

const setStatus = (element: HTMLElement | null, message: string, tone: StatusTone) => {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.classList.remove('is-success', 'is-error', 'is-info');
  element.classList.add(`is-${tone}`);
};

const clearStatus = (element: HTMLElement | null) => {
  if (!element) {
    return;
  }

  element.textContent = '';
  element.classList.remove('is-success', 'is-error', 'is-info');
};

const extractUser = (payload: ApiResponse<any> | any): SafeUser | null => {
  const candidate = payload?.safeUser || payload?.data?.user || payload?.data || payload?.user;

  if (!candidate || typeof candidate !== 'object' || !candidate._id) {
    return null;
  }

  return {
    ...candidate,
    role: toRole(candidate.role)
  } as SafeUser;
};

const extractItems = <T>(payload: ApiResponse<T[]> | any): T[] => {
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.data?.items)) {
    return payload.data.items;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  return [];
};

const extractPagination = (payload: ApiResponse<any>, fallbackCount: number): Pagination => {
  const raw = payload.pagination;

  if (raw) {
    return {
      page: numberValue(raw.page, 1),
      limit: numberValue(raw.limit, fallbackCount || 10),
      total: numberValue(raw.total, fallbackCount),
      totalPages: numberValue(raw.totalPages, 1),
      hasNextPage: Boolean(raw.hasNextPage),
      hasPrevPage: Boolean(raw.hasPrevPage)
    };
  }

  return {
    page: 1,
    limit: fallbackCount || 10,
    total: fallbackCount,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false
  };
};

const extractData = <T>(payload: ApiResponse<T> | any): T | null => {
  if (payload && payload.data !== undefined) {
    return payload.data as T;
  }

  return null;
};

const request = async <T = unknown>(url: string, options: RequestInit = {}) => {
  const headers = new Headers(options.headers);
  const body = options.body;

  if (body && !(body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  const payload = await response.json().catch(() => ({})) as ApiResponse<T>;

  if (response.status === 401 && PAGE !== 'login' && PAGE !== 'register') {
    clearAuth();
    window.location.href = '/login';
    throw new Error(payload.message || '鉴权entication expired.');
  }

  if (!response.ok) {
    throw new Error(payload.error || payload.message || `Request failed with status ${response.status}.`);
  }

  return payload;
};

const loadCurrentUser = async () => {
  try {
    const profileResponse = await request<SafeUser>('/profile');
    const user = extractUser(profileResponse);
    if (user) {
      currentUser = user;
      return user;
    }
  } catch {}

  const authResponse = await request<SafeUser>('/auth/me');
  const user = extractUser(authResponse);

  if (!user) {
    throw new Error('Unable to resolve current user.');
  }

  currentUser = user;
  return user;
};

const ensureAuthenticated = async () => {
  authToken = getStoredToken();

  if (!authToken) {
    return null;
  }

  if (currentUser) {
    return currentUser;
  }

  try {
    return await loadCurrentUser();
  } catch {
    clearAuth();
    return null;
  }
};

const navigate = (path: string) => {
  window.location.href = path;
};

const applyNavViews = () => {
  const navItems = qsa<HTMLButtonElement>('.nav-item[data-view]');
  const views = qsa<HTMLElement>('.view[id]');

  if (!navItems.length || !views.length) {
    return;
  }

  const showView = (viewId: string) => {
    views.forEach((view) => {
      view.classList.toggle('is-visible', view.id === viewId);
    });

    navItems.forEach((item) => {
      item.classList.toggle('is-active', item.dataset.view === viewId);
    });

    window.history.replaceState(null, '', `${window.location.pathname}#${viewId}`);
  };

  navItems.forEach((item) => {
    item.addEventListener('click', () => {
      const nextView = item.dataset.view;
      if (nextView) {
        showView(nextView);
      }
    });
  });

  qsa<HTMLElement>('[data-view-target]').forEach((item) => {
    item.addEventListener('click', () => {
      const nextView = item.getAttribute('data-view-target');
      if (nextView) {
        showView(nextView);
      }
    });
  });

  const initialView = window.location.hash.replace('#', '');
  if (initialView && byId(initialView)) {
    showView(initialView);
  }
};

const bindLogout = (element: HTMLElement | null) => {
  if (!element) {
    return;
  }

  element.addEventListener('click', (event) => {
    event.preventDefault();
    clearAuth();
    navigate('/login');
  });
};

const populateUserShell = (user: SafeUser) => {
  const goalText = `${numberValue(user.dailyCalorieGoal)} kcal`;

  const shellAvatar = byId<HTMLElement>('user-shell-avatar');
  const shellName = byId<HTMLElement>('user-shell-name');
  const shellGoal = byId<HTMLElement>('user-shell-goal');
  const profileAvatar = byId<HTMLElement>('profile-avatar');
  const profileTitleName = byId<HTMLElement>('profile-title-name');
  const switchAdminLink = byId<HTMLAnchorElement>('switch-admin-link');

  applyAvatarElement(shellAvatar, user);
  if (shellName) shellName.textContent = user.username;
  if (shellGoal) shellGoal.textContent = `目标 ${goalText}`;
  applyAvatarElement(profileAvatar, user);
  if (profileTitleName) profileTitleName.textContent = user.username;
  if (switchAdminLink) {
    switchAdminLink.style.display = user.role === 'admin' ? '' : 'none';
  }
};

const populateProfileForms = (user: SafeUser) => {
  const fields: Array<[string, string | number]> = [
    ['profile-username', user.username || ''],
    ['profile-email', user.email || ''],
    ['profile-height', user.height || ''],
    ['profile-age', user.age || ''],
    ['profile-weight', user.weight || ''],
    ['profile-target-weight', user.targetWeight || '']
  ];

  fields.forEach(([id, value]) => {
    const input = byId<HTMLInputElement>(id);
    if (input) {
      input.value = String(value);
    }
  });

  const bio = byId<HTMLTextAreaElement>('profile-bio');
  if (bio) {
    bio.value = user.bio || '';
  }

  const profileSummary = byId<HTMLElement>('profile-summary');
  if (profileSummary) {
    profileSummary.innerHTML = `
      <div><span>头像类型</span><strong>${user.avatarType || 'default'}</strong></div>
      <div><span>头像来源</span><strong>${user.avatarType === 'uploaded' ? 'uploaded file' : 'generated'}</strong></div>
      <div><span>角色</span><strong>${user.role}</strong></div>
      <div><span>目标热量</span><strong>${numberValue(user.dailyCalorieGoal)} kcal</strong></div>
      <div><span>当前体重</span><strong>${numberValue(user.weight)} kg</strong></div>
    `;
  }

  const goalsSummary = byId<HTMLElement>('goals-summary');
  if (goalsSummary) {
    const heightMeters = numberValue(user.height) > 0 ? numberValue(user.height) / 100 : 0;
    const bmi = heightMeters > 0 ? (numberValue(user.weight) / (heightMeters * heightMeters)) : 0;

    goalsSummary.innerHTML = `
      <div><span>每日目标</span><strong>${numberValue(user.dailyCalorieGoal)} kcal</strong></div>
      <div><span>当前体重</span><strong>${numberValue(user.weight)} kg</strong></div>
      <div><span>目标体重</span><strong>${numberValue(user.targetWeight)} kg</strong></div>
      <div><span>BMI</span><strong>${bmi ? bmi.toFixed(1) : '-'}</strong></div>
    `;
  }

  const securitySummary = byId<HTMLElement>('security-summary');
  if (securitySummary) {
    securitySummary.innerHTML = `
      <div><strong>最近登录</strong><span>${formatDate(user.lastLoginAt)}</span></div>
      <div><strong>角色</strong><span>${user.role}</span></div>
      <div><strong>令牌时效</strong><span>7d</span></div>
      <div><strong>密码更新时间</strong><span>${formatDate(user.passwordChangedAt)}</span></div>
    `;
  }
};

const createFoodPayload = async () => {
  const name = window.prompt('请输入食物名称');
  if (!name) {
    return null;
  }

  const caloriesInput = window.prompt('请输入热量', '0');
  if (caloriesInput === null) {
    return null;
  }

  return {
    name: name.trim(),
    calories: numberValue(caloriesInput)
  };
};

const initLoginPage = async () => {
  void initAuthQuotePanel();

  const authed = await ensureAuthenticated();
  if (authed) {
    navigate(authed.role === 'admin' ? '/admin' : '/app');
    return;
  }

  const form = byId<HTMLFormElement>('login-form');
  const status = byId<HTMLElement>('login-status');
  const usernameInput = byId<HTMLInputElement>('login-identifier');
  const passwordInput = byId<HTMLInputElement>('login-password');
  const sessionOnlyInput = byId<HTMLInputElement>('login-session-only');
  const submitButton = byId<HTMLButtonElement>('login-submit');

  if (!form || !usernameInput || !passwordInput || !sessionOnlyInput || !submitButton) {
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearStatus(status);
    submitButton.disabled = true;

    try {
      const response = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: usernameInput.value.trim(),
          password: passwordInput.value
        })
      });

      if (!response.token) {
        throw new Error('Login response did not include a token.');
      }

      const user = extractUser(response);
      authToken = response.token;
      currentUser = user;
      persistToken(response.token, sessionOnlyInput.checked);
      setStatus(status, 'Login successful, redirecting...', 'success');

      navigate(user?.role === 'admin' ? '/admin' : '/app');
    } catch (error) {
      setStatus(status, getErrorMessage(error), 'error');
    } finally {
      submitButton.disabled = false;
    }
  });
};

const initRegisterPage = async () => {
  void initAuthQuotePanel();

  const authed = await ensureAuthenticated();
  if (authed) {
    navigate(authed.role === 'admin' ? '/admin' : '/app');
    return;
  }

  const form = byId<HTMLFormElement>('register-form');
  const status = byId<HTMLElement>('register-status');
  const username = byId<HTMLInputElement>('register-username');
  const email = byId<HTMLInputElement>('register-email');
  const password = byId<HTMLInputElement>('register-password');
  const passwordConfirm = byId<HTMLInputElement>('register-password-confirm');
  const goal = byId<HTMLInputElement>('register-goal');
  const weight = byId<HTMLInputElement>('register-weight');
  const avatarPreview = byId<HTMLElement>('register-avatar-preview');
  const submitButton = byId<HTMLButtonElement>('register-submit');

  if (!form || !username || !email || !password || !passwordConfirm || !goal || !weight || !submitButton) {
    return;
  }

  const syncAvatarPreview = () => {
    if (avatarPreview) {
      avatarPreview.textContent = initialsFromSeed(username.value);
    }
  };

  syncAvatarPreview();
  username.addEventListener('input', syncAvatarPreview);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearStatus(status);

    if (password.value !== passwordConfirm.value) {
      setStatus(status, 'Passwords do not match.', 'error');
      return;
    }

    submitButton.disabled = true;

    try {
      const response = await request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: username.value.trim(),
          email: email.value.trim(),
          password: password.value,
          dailyCalorieGoal: numberValue(goal.value),
          weight: numberValue(weight.value)
        })
      });

      if (!response.token) {
        throw new Error('Register response did not include a token.');
      }

      const user = extractUser(response);
      authToken = response.token;
      currentUser = user;
      persistToken(response.token, true);
      setStatus(status, 'Registration successful, redirecting...', 'success');
      navigate('/app');
    } catch (error) {
      setStatus(status, getErrorMessage(error), 'error');
    } finally {
      submitButton.disabled = false;
    }
  });
};

const initUserPage = async () => {
  const user = await ensureAuthenticated();

  if (!user) {
    navigate('/login');
    return;
  }

  applyNavViews();
  bindLogout(byId('logout-link'));
  populateUserShell(user);
  populateProfileForms(user);

  const todayKey = formatDateKey(new Date());
  const mealTypeLabels: Record<JournalEntryRecord['mealType'], string> = {
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    snack: 'Snack'
  };
  const mealTypeOrder: JournalEntryRecord['mealType'][] = ['breakfast', 'lunch', 'dinner', 'snack'];

  const parseDateKeyUtc = (value: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    if (!match) {
      return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year
      || date.getUTCMonth() !== month - 1
      || date.getUTCDate() !== day
    ) {
      return null;
    }

    return date;
  };

  const parseMonthKeyUtc = (value: string) => {
    const match = /^(\d{4})-(\d{2})$/.exec(value);

    if (!match) {
      return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const date = new Date(Date.UTC(year, month - 1, 1));

    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1) {
      return null;
    }

    return date;
  };

  const formatMetric = (value: unknown, suffix = '') => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? `${numeric}${suffix}` : '-';
  };

  const formatMonthLabel = (monthKey: string) => {
    const monthDate = parseMonthKeyUtc(monthKey);

    if (!monthDate) {
      return monthKey;
    }

    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'long',
      timeZone: 'UTC'
    }).format(monthDate);
  };

  const moveDateByMonth = (dateKey: string, offset: number) => {
    const date = parseDateKeyUtc(dateKey);

    if (!date) {
      return todayKey;
    }

    const targetMonthStart = shiftMonth(
      new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)),
      offset
    );
    const lastDay = new Date(
      Date.UTC(targetMonthStart.getUTCFullYear(), targetMonthStart.getUTCMonth() + 1, 0)
    ).getUTCDate();
    const nextDate = new Date(
      Date.UTC(
        targetMonthStart.getUTCFullYear(),
        targetMonthStart.getUTCMonth(),
        Math.min(date.getUTCDate(), lastDay)
      )
    );

    return formatDateKey(nextDate);
  };

  const sumJournalCalories = (entries: JournalEntryRecord[]) => {
    return entries.reduce((total, entry) => total + numberValue(entry.calories), 0);
  };

  const pageState = {
    selectedDateKey: todayKey,
    calendarMonthKey: todayKey.slice(0, 7),
    activeGoalCycle: null as GoalCycleRecord | null,
    dailyLog: null as DailyLogRecord | null,
    journalEntries: [] as JournalEntryRecord[],
    daySummary: null as GoalDaySummary | null
  };

  const dashboardHeadline = byId<HTMLElement>('dashboard-headline');
  const dashboardCopy = byId<HTMLElement>('dashboard-copy');
  const dashboardGoalCard = byId<HTMLElement>('dashboard-goal-card');
  const dashboardActualCard = byId<HTMLElement>('dashboard-actual-card');
  const dashboardRemainingCard = byId<HTMLElement>('dashboard-remaining-card');
  const dashboard选择edDate = byId<HTMLElement>('dashboard-selected-date');
  const dashboardSummaryList = byId<HTMLElement>('dashboard-summary-list');
  const dashboardFoodCount = byId<HTMLElement>('dashboard-food-count');
  const dashboardProgress = byId<HTMLElement>('dashboard-progress');
  const dashboardMacros = byId<HTMLElement>('dashboard-macros');
  const workspaceSearch = byId<HTMLInputElement>('workspace-search');
  const foodsAddButton = byId<HTMLButtonElement>('foods-add');
  const foodsRefreshButton = byId<HTMLButtonElement>('foods-refresh');
  const foodsTbody = byId<HTMLElement>('foods-tbody');
  const foodsPaginationLabel = byId<HTMLElement>('foods-pagination-label');
  const foodsPageIndicator = byId<HTMLElement>('foods-page-indicator');
  const foodsPrev = byId<HTMLButtonElement>('foods-prev');
  const foodsNext = byId<HTMLButtonElement>('foods-next');
  const foodsKeyword = byId<HTMLInputElement>('foods-keyword');
  const foodsRange = byId<HTMLSelectElement>('foods-calories-range');
  const foodsSort = byId<HTMLSelectElement>('foods-sort');
  const foodsLimit = byId<HTMLSelectElement>('foods-limit');
  const foodsFilterForm = byId<HTMLFormElement>('foods-filter-form');
  const journalDate = byId<HTMLInputElement>('journal-date');
  const journalList = byId<HTMLElement>('journal-list');
  const journalTotalCalories = byId<HTMLElement>('journal-total-calories');
  const journalFoodPicker = byId<HTMLElement>('journal-food-picker');
  const journalEntryId = byId<HTMLInputElement>('journal-entry-id');
  const journalFoodId = byId<HTMLInputElement>('journal-food-id');
  const journalFoodName = byId<HTMLInputElement>('journal-food-name');
  const journalMealType = byId<HTMLSelectElement>('journal-meal-type');
  const journalQuantity = byId<HTMLInputElement>('journal-quantity');
  const journal请输入热量 = byId<HTMLInputElement>('journal-calories');
  const journalNotes = byId<HTMLTextAreaElement>('journal-notes');
  const goalsCalendarMonthLabel = byId<HTMLElement>('goals-calendar-month-label');
  const goalsCalendarPrev = byId<HTMLButtonElement>('goals-calendar-prev');
  const goalsCalendarNext = byId<HTMLButtonElement>('goals-calendar-next');
  const goalsCalendarGrid = byId<HTMLElement>('goals-calendar-grid');
  const goals选择edDateLabel = byId<HTMLElement>('goals-selected-date-label');
  const goalsSummary = byId<HTMLElement>('goals-summary');
  const goalCycleStatusLabel = byId<HTMLElement>('goal-cycle-status-label');
  const dailyLogStatusLabel = byId<HTMLElement>('daily-log-status');
  const goalCycleForm = byId<HTMLFormElement>('goal-cycle-form');
  const goalCycleId = byId<HTMLInputElement>('goal-cycle-id');
  const goalCycleStartDate = byId<HTMLInputElement>('goal-cycle-start-date');
  const goalCycleEndDate = byId<HTMLInputElement>('goal-cycle-end-date');
  const goalCycleStart体重 = byId<HTMLInputElement>('goal-cycle-start-weight');
  const goalCycleTarget体重 = byId<HTMLInputElement>('goal-cycle-target-weight');
  const goalCycleDaily请输入热量 = byId<HTMLInputElement>('goal-cycle-daily-calorie-goal');
  const goalCycleStatus = byId<HTMLSelectElement>('goal-cycle-status');
  const dailyLogForm = byId<HTMLFormElement>('daily-log-form');
  const dailyLogDate = byId<HTMLInputElement>('daily-log-date');
  const dailyLog体重 = byId<HTMLInputElement>('daily-log-weight');
  const dailyLogNotes = byId<HTMLTextAreaElement>('daily-log-notes');
  const profileStatus = byId<HTMLElement>('profile-status');
  const goalsStatus = byId<HTMLElement>('goals-status');
  const securityStatus = byId<HTMLElement>('security-status');
  const journalStatus = byId<HTMLElement>('journal-status');
  const profileForm = byId<HTMLFormElement>('profile-form');
  const securityForm = byId<HTMLFormElement>('security-form');
  const journalForm = byId<HTMLFormElement>('journal-form');
  const avatarSeedButton = byId<HTMLButtonElement>('avatar-seed-button');
  const avatarResetButton = byId<HTMLButtonElement>('avatar-reset-button');
  const avatarUploadButton = byId<HTMLButtonElement>('avatar-upload-button');
  const avatarUploadInput = byId<HTMLInputElement>('avatar-upload-input');

  const foodsState = {
    page: 1,
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false
    } as Pagination,
    items: [] as FoodRecord[]
  };

  const buildFallbackGoalDaySummary = (): GoalDaySummary => {
    const actualCalories = sumJournalCalories(pageState.journalEntries);
    const targetCalories = numberValue(pageState.activeGoalCycle?.dailyCalorieGoal ?? currentUser?.dailyCalorieGoal);

    return {
      date: pageState.selectedDateKey,
      goalCycle: pageState.activeGoalCycle,
      dailyLog: pageState.dailyLog,
      journalEntries: pageState.journalEntries,
      monthIndicators: [],
      summary: {
        actualCalories,
        targetCalories,
        remainingCalories: targetCalories - actualCalories,
        weightProgress: null
      }
    };
  };

  const getTargetCalories = () => {
    return numberValue(
      pageState.daySummary?.summary.targetCalories
      ?? pageState.activeGoalCycle?.dailyCalorieGoal
      ?? currentUser?.dailyCalorieGoal
    );
  };

  const resetJournalComposer = (entry?: JournalEntryRecord) => {
    if (journalEntryId) {
      journalEntryId.value = entry?._id || '';
    }

    if (journalFoodId) {
      journalFoodId.value = entry?.foodId || '';
    }

    if (journalFoodName) {
      journalFoodName.value = entry?.foodName || '';
    }

    if (journalMealType) {
      journalMealType.value = entry?.mealType || 'breakfast';
    }

    if (journalQuantity) {
      journalQuantity.value = entry ? String(entry.quantity) : '1';
    }

    if (journal请输入热量) {
      journal请输入热量.value = entry ? String(entry.calories) : '';
    }

    if (journalNotes) {
      journalNotes.value = entry?.notes || '';
    }
  };

  const sync选择edDateUi = () => {
    if (journalDate) {
      journalDate.value = pageState.selectedDateKey;
    }

    if (dailyLogDate) {
      dailyLogDate.value = pageState.selectedDateKey;
    }

    if (goals选择edDateLabel) {
      goals选择edDateLabel.textContent = formatHumanDate(pageState.selectedDateKey);
    }

    if (dashboard选择edDate) {
      dashboard选择edDate.textContent = formatHumanDate(pageState.selectedDateKey);
    }

    if (goalsCalendarMonthLabel) {
      goalsCalendarMonthLabel.textContent = formatMonthLabel(pageState.calendarMonthKey);
    }
  };
  const renderDashboard = () => {
    const actualCalories = numberValue(pageState.daySummary?.summary.actualCalories ?? sumJournalCalories(pageState.journalEntries));
    const targetCalories = getTargetCalories();
    const remainingCalories = numberValue(pageState.daySummary?.summary.remainingCalories ?? targetCalories - actualCalories);
    const progress = targetCalories > 0 ? Math.min(100, Math.max(0, Math.round((actualCalories / targetCalories) * 100))) : 0;
    const weightProgress = pageState.daySummary?.summary.weightProgress;
    const current体重 = pageState.dailyLog?.weight ?? currentUser?.weight ?? null;
    const targetWeight = pageState.activeGoalCycle?.targetWeight ?? currentUser?.targetWeight ?? null;

    if (dashboardHeadline) {
      dashboardHeadline.textContent = `${actualCalories} / ${targetCalories} kcal`;
    }

    if (dashboardCopy) {
      dashboardCopy.textContent = `${formatHumanDate(pageState.selectedDateKey)}，你的食物库中共有 ${foodsState.pagination.total} 条记录。`;
    }

    if (dashboardGoalCard) {
      dashboardGoalCard.textContent = `${targetCalories} kcal`;
    }

    if (dashboardActualCard) {
      dashboardActualCard.textContent = `${actualCalories} kcal`;
    }

    if (dashboardRemainingCard) {
      dashboardRemainingCard.textContent = `${remainingCalories} kcal`;
    }

    if (dashboardFoodCount) {
      dashboardFoodCount.textContent = String(foodsState.pagination.total);
    }

    if (dashboardProgress) {
      dashboardProgress.style.width = `${progress}%`;
    }

    if (dashboardMacros) {
      dashboardMacros.innerHTML = `
        <div><strong>${formatMetric(weightProgress?.expectedWeight, 'kg')}</strong><span>预期</span></div>
        <div><strong>${formatMetric(weightProgress?.actualWeight, 'kg')}</strong><span>实际</span></div>
        <div><strong>${weightProgress?.variance !== undefined && weightProgress?.variance !== null ? `${weightProgress.variance > 0 ? '+' : ''}${weightProgress.variance}kg` : '-'}</strong><span>差值</span></div>
      `;
    }

    if (dashboardSummaryList) {
      dashboardSummaryList.innerHTML = `
        <div><span>食物总数</span><strong>${foodsState.pagination.total}</strong></div>
        <div><span>当前体重</span><strong>${formatMetric(current体重, ' kg')}</strong></div>
        <div><span>目标体重</span><strong>${formatMetric(targetWeight, ' kg')}</strong></div>
        <div><span>周期进度</span><strong>${weightProgress?.progressRatio !== undefined && weightProgress?.progressRatio !== null ? `${Math.round(weightProgress.progressRatio * 100)}%` : '-'}</strong></div>
      `;
    }
  };

  const renderGoalCycleForm = () => {
    const activeGoalCycle = pageState.activeGoalCycle;

    if (goalCycleId) {
      goalCycleId.value = activeGoalCycle?._id || '';
    }

    if (goalCycleStartDate) {
      goalCycleStartDate.value = activeGoalCycle ? formatDateKey(activeGoalCycle.startDate) : pageState.selectedDateKey;
    }

    if (goalCycleEndDate) {
      goalCycleEndDate.value = activeGoalCycle ? formatDateKey(activeGoalCycle.endDate) : moveDateByMonth(pageState.selectedDateKey, 2);
    }

    if (goalCycleStart体重) {
      goalCycleStart体重.value = activeGoalCycle?.startWeight !== undefined ? String(activeGoalCycle.startWeight) : (currentUser?.weight !== undefined && currentUser?.weight !== null ? String(currentUser.weight) : '');
    }

    if (goalCycleTarget体重) {
      goalCycleTarget体重.value = activeGoalCycle?.targetWeight !== undefined ? String(activeGoalCycle.targetWeight) : (currentUser?.targetWeight !== undefined && currentUser?.targetWeight !== null ? String(currentUser.targetWeight) : '');
    }

    if (goalCycleDaily请输入热量) {
      goalCycleDaily请输入热量.value = activeGoalCycle?.dailyCalorieGoal !== undefined ? String(activeGoalCycle.dailyCalorieGoal) : (currentUser?.dailyCalorieGoal !== undefined && currentUser?.dailyCalorieGoal !== null ? String(currentUser.dailyCalorieGoal) : '');
    }

    if (goalCycleStatus) {
      goalCycleStatus.value = activeGoalCycle?.status || 'active';
    }

    if (goalCycleStatusLabel) {
      goalCycleStatusLabel.textContent = activeGoalCycle
        ? `${activeGoalCycle.status}  ${formatDateKey(activeGoalCycle.startDate)}  ${formatDateKey(activeGoalCycle.endDate)}`
        : '暂无进行中的周期';
    }
  };

  const renderDailyLogForm = () => {
    if (dailyLogDate) {
      dailyLogDate.value = pageState.selectedDateKey;
    }

    if (dailyLog体重) {
      dailyLog体重.value = pageState.dailyLog?.weight !== undefined && pageState.dailyLog?.weight !== null
        ? String(pageState.dailyLog.weight)
        : '';
    }

    if (dailyLogNotes) {
      dailyLogNotes.value = pageState.dailyLog?.notes || '';
    }

    if (dailyLogStatusLabel) {
      dailyLogStatusLabel.textContent = pageState.dailyLog
        ? `已保存 ${formatHumanDate(pageState.selectedDateKey)}`
        : '未保存';
    }
  };

  const renderGoalsSummary = () => {
    if (!goalsSummary) {
      return;
    }

    const summary = pageState.daySummary?.summary;
    const weightProgress = summary?.weightProgress;
    const actualWeightProgress = weightProgress?.actualProgressRatio;

    goalsSummary.innerHTML = `
      <div><span>目标热量</span><strong>${numberValue(summary?.targetCalories)} kcal</strong></div>
      <div><span>实际摄入</span><strong>${numberValue(summary?.actualCalories)} kcal</strong></div>
      <div><span>剩余热量</span><strong>${numberValue(summary?.remainingCalories)} kcal</strong></div>
      <div><span>体重进度</span><strong>${actualWeightProgress !== undefined && actualWeightProgress !== null ? `${Math.round(actualWeightProgress * 100)}%` : '-'}</strong></div>
      <div><span>预期体重</span><strong>${formatMetric(weightProgress?.expectedWeight, ' kg')}</strong></div>
      <div><span>实际体重</span><strong>${formatMetric(weightProgress?.actualWeight, ' kg')}</strong></div>
    `;
  };

  const renderQuickPick食物 = () => {
    if (!journalFoodPicker) {
      return;
    }

    if (!foodsState.items.length) {
      journalFoodPicker.innerHTML = '<button class="quick-pick-chip" type="button" disabled>暂无食物</button>';
      return;
    }

    journalFoodPicker.innerHTML = foodsState.items.slice(0, 12).map((food) => `
      <button class="quick-pick-chip" type="button" data-food-id="${food._id}">
        ${escapeHtml(food.name)}  ${numberValue(food.calories)} kcal
      </button>
    `).join('');

    qsa<HTMLButtonElement>('.quick-pick-chip[data-food-id]', journalFoodPicker).forEach((button) => {
      button.addEventListener('click', () => {
        const foodId = button.getAttribute('data-food-id');
        const food = foodsState.items.find((item) => item._id === foodId);

        if (!food) {
          return;
        }

        if (journalEntryId) {
          journalEntryId.value = '';
        }

        if (journalFoodId) {
          journalFoodId.value = food._id;
        }

        if (journalFoodName) {
          journalFoodName.value = food.name;
        }

        if (journal请输入热量) {
          journal请输入热量.value = String(food.calories);
        }

        if (journalQuantity && !journalQuantity.value) {
          journalQuantity.value = '1';
        }

        setStatus(journalStatus, `已将 ${food.name} 填入记录表单。`, 'info');
      });
    });
  };
  const renderJournalEntries = () => {
    if (journalTotalCalories) {
      journalTotalCalories.textContent = `${numberValue(pageState.daySummary?.summary.actualCalories ?? sumJournalCalories(pageState.journalEntries))} kcal`;
    }

    if (!journalList) {
      return;
    }

    if (!pageState.journalEntries.length) {
      journalList.innerHTML = `
        <div class="meal-block empty-block">
          <div class="meal-title"><strong>还没有记录</strong><span>可使用表单或快捷选择添加</span></div>
          <p>${escapeHtml(formatHumanDate(pageState.selectedDateKey))} 的记录会显示在这里。</p>
        </div>
      `;
      return;
    }

    const groupedEntries = mealTypeOrder
      .map((mealType) => ({
        mealType,
        entries: pageState.journalEntries.filter((entry) => entry.mealType === mealType)
      }))
      .filter((group) => group.entries.length > 0);

    journalList.innerHTML = groupedEntries.map((group) => {
      const calories = sumJournalCalories(group.entries);

      return `
        <div class="meal-block">
          <div class="meal-title">
            <strong>${mealTypeLabels[group.mealType]}</strong>
            <span>${group.entries.length} entries</span>
            <strong>${calories} kcal</strong>
          </div>
          ${group.entries.map((entry) => `
            <div class="meal-item" data-entry-id="${entry._id}">
              <div>
                <strong>${escapeHtml(entry.foodName)}</strong>
                <small>${escapeHtml(`${entry.quantity}  serving`)}${entry.notes ? `  ${escapeHtml(entry.notes)}` : ''}</small>
              </div>
              <strong>${numberValue(entry.calories)} kcal</strong>
              <div>
                <button class="button small journal-edit" type="button">Edit</button>
                <button class="button danger small journal-delete" type="button">删除</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }).join('');

    qsa<HTMLButtonElement>('.journal-edit', journalList).forEach((button) => {
      button.addEventListener('click', () => {
        const container = button.closest<HTMLElement>('[data-entry-id]');
        const entryId = container?.getAttribute('data-entry-id');
        const entry = pageState.journalEntries.find((item) => item._id === entryId);

        if (!entry) {
          return;
        }

        resetJournalComposer(entry);
        setStatus(journalStatus, `正在编辑：${entry.foodName}`, 'info');
      });
    });

    qsa<HTMLButtonElement>('.journal-delete', journalList).forEach((button) => {
      button.addEventListener('click', async () => {
        const container = button.closest<HTMLElement>('[data-entry-id]');
        const entryId = container?.getAttribute('data-entry-id');
        const entry = pageState.journalEntries.find((item) => item._id === entryId);

        if (!entryId || !entry || !window.confirm(`确认删除 ${formatHumanDate(pageState.selectedDateKey)} 的“${entry.foodName}”吗？`)) {
          return;
        }

        try {
          await request(`/journal/${entryId}`, {
            method: 'DELETE'
          });
          resetJournalComposer();
          await refresh选择edDateData();
          setStatus(journalStatus, '记录已删除。', 'success');
        } catch (error) {
          setStatus(journalStatus, getErrorMessage(error), 'error');
        }
      });
    });
  };

  const renderCalendar = () => {
    sync选择edDateUi();

    if (!goalsCalendarGrid) {
      return;
    }

    const monthStart = parseMonthKeyUtc(pageState.calendarMonthKey);

    if (!monthStart) {
      goalsCalendarGrid.innerHTML = '';
      return;
    }

    const firstWeekday = (monthStart.getUTCDay() + 6) % 7;
    const dayCount = new Date(
      Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)
    ).getUTCDate();
    const indicatorMap = new Map(
      (pageState.daySummary?.monthIndicators || []).map((indicator) => [indicator.date, indicator])
    );
    const calendarCells: string[] = [];

    for (let index = 0; index < firstWeekday; index += 1) {
      calendarCells.push('<div aria-hidden="true"></div>');
    }

    for (let day = 1; day <= dayCount; day += 1) {
      const dateKey = formatDateKey(new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), day)));
      const indicator = indicatorMap.get(dateKey);
      const classes = ['calendar-day'];

      if (indicator?.overGoal) {
        classes.push('warn');
      } else if (indicator?.hasDailyLog || indicator?.hasJournalEntries) {
        classes.push('good');
      }

      if (dateKey === todayKey) {
        classes.push('today');
      }

      if (dateKey === pageState.selectedDateKey) {
        classes.push('is-selected');
      }

      calendarCells.push(`
        <button class="${classes.join(' ')}" type="button" data-date="${dateKey}">
          <span class="calendar-day-number">${day}</span>
        </button>
      `);
    }

    goalsCalendarGrid.innerHTML = calendarCells.join('');

    qsa<HTMLButtonElement>('button[data-date]', goalsCalendarGrid).forEach((button) => {
      button.addEventListener('click', async () => {
        const dateKey = button.getAttribute('data-date');

        if (!dateKey) {
          return;
        }

        await selectDate(dateKey);
      });
    });
  };

  const render食物 = () => {
    if (!foodsTbody) {
      return;
    }

    if (!foodsState.items.length) {
      foodsTbody.innerHTML = '<tr><td colspan="6">当前筛选条件下没有食物。</td></tr>';
    } else {
      foodsTbody.innerHTML = foodsState.items.map((food, index) => `
        <tr data-food-id="${food._id}">
          <td>${(foodsState.pagination.page - 1) * foodsState.pagination.limit + index + 1}</td>
          <td><strong>${food.name}</strong></td>
          <td>${food.calories} kcal</td>
          <td>${formatShortDate(food.createdAt)}</td>
          <td>${formatShortDate(food.updatedAt)}</td>
          <td>
            <button class="button small food-edit" type="button">修改热量</button>
            <button class="button small food-delete" type="button">删除</button>
          </td>
        </tr>
      `).join('');
    }

    if (foodsPaginationLabel) {
      foodsPaginationLabel.textContent = `共 ${foodsState.pagination.total} 条，第 ${foodsState.pagination.page} / ${foodsState.pagination.totalPages} 页`;
    }

    if (foodsPageIndicator) {
      foodsPageIndicator.textContent = String(foodsState.pagination.page);
    }

    if (foodsPrev) {
      foodsPrev.disabled = foodsState.pagination.page <= 1;
    }

    if (foodsNext) {
      foodsNext.disabled = foodsState.pagination.page >= foodsState.pagination.totalPages;
    }

    renderDashboard();
    renderQuickPick食物();

    qsa<HTMLButtonElement>('.food-edit', foodsTbody).forEach((button) => {
      button.addEventListener('click', async () => {
        const row = button.closest('tr');
        const foodId = row?.getAttribute('data-food-id');
        const food = foodsState.items.find((item) => item._id === foodId);

        if (!foodId || !food) {
          return;
        }

        const next请输入热量 = window.prompt('新的热量', String(food.calories));
        if (next请输入热量 === null) {
          return;
        }

        try {
          await request(`/food/${foodId}`, {
            method: 'PATCH',
            body: JSON.stringify({ calories: numberValue(next请输入热量) })
          });
          await load食物(foodsState.page);
        } catch (error) {
          window.alert(getErrorMessage(error));
        }
      });
    });

    qsa<HTMLButtonElement>('.food-delete', foodsTbody).forEach((button) => {
      button.addEventListener('click', async () => {
        const row = button.closest('tr');
        const foodId = row?.getAttribute('data-food-id');

        if (!foodId || !window.confirm('删除 this food?')) {
          return;
        }

        try {
          await request(`/food/${foodId}`, { method: 'DELETE' });
          await load食物(Math.max(1, Math.min(foodsState.page, foodsState.pagination.totalPages)));
        } catch (error) {
          window.alert(getErrorMessage(error));
        }
      });
    });
  };

  const load食物 = async (page = 1) => {
    foodsState.page = page;

    if (foodsTbody) {
      foodsTbody.innerHTML = '<tr><td colspan="6">加载中...</td></tr>';
    }

    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', foodsLimit?.value || '10');

    if (foodsKeyword?.value.trim()) {
      params.set('keyword', foodsKeyword.value.trim());
    }

    if (foodsSort?.value) {
      const [sortBy, order] = foodsSort.value.split(':');
      params.set('sortBy', sortBy);
      params.set('order', order || 'desc');
    }

    if (foodsRange?.value) {
      const [min, max] = foodsRange.value.split('-');
      params.set('caloriesMin', min);
      params.set('caloriesMax', max);
    }

    try {
      const response = await request<FoodRecord[]>(`/foods?${params.toString()}`);
      foodsState.items = extractItems<FoodRecord>(response);
      foodsState.pagination = extractPagination(response, foodsState.items.length);
      render食物();
    } catch (error) {
      foodsState.items = [];
      renderQuickPick食物();

      if (foodsTbody) {
        foodsTbody.innerHTML = `<tr><td colspan="6">${getErrorMessage(error)}</td></tr>`;
      }
    }
  };
  const loadActiveGoalCycle = async () => {
    const response = await request<GoalCycleRecord | null>('/goals/active');
    pageState.activeGoalCycle = extractData<GoalCycleRecord | null>(response);
    renderGoalCycleForm();
    renderDashboard();
  };

  const refresh选择edDateData = async () => {
    sync选择edDateUi();

    if (goalsSummary) {
      goalsSummary.innerHTML = '<div><span>加载中</span><strong>正在获取所选日期数据...</strong></div>';
    }

    if (journalList) {
      journalList.innerHTML = '<div class="meal-block empty-block"><div class="meal-title"><strong>加载中 entries</strong><span>请稍候</span></div><p>正在读取所选日期的数据。</p></div>';
    }

    const dateQuery = encodeURIComponent(pageState.selectedDateKey);
    const monthQuery = encodeURIComponent(pageState.calendarMonthKey);

    const [goalDayResponse, dailyLogResponse, journalResponse] = await Promise.all([
      request<GoalDaySummary>(`/goals/day?date=${dateQuery}&month=${monthQuery}`),
      request<DailyLogRecord | null>(`/daily-log?date=${dateQuery}`),
      request<JournalEntryRecord[]>(`/journal?date=${dateQuery}`)
    ]);

    const goalDaySummary = extractData<GoalDaySummary>(goalDayResponse);
    const dailyLog = extractData<DailyLogRecord | null>(dailyLogResponse);
    const journalEntries = extractItems<JournalEntryRecord>(journalResponse);

    if (goalDaySummary?.goalCycle) {
      pageState.activeGoalCycle = goalDaySummary.goalCycle;
    }

    pageState.dailyLog = dailyLog ?? goalDaySummary?.dailyLog ?? null;
    pageState.journalEntries = journalEntries.length ? journalEntries : (goalDaySummary?.journalEntries || []);
    pageState.daySummary = goalDaySummary || buildFallbackGoalDaySummary();

    renderGoalCycleForm();
    renderDailyLogForm();
    renderGoalsSummary();
    renderJournalEntries();
    renderCalendar();
    renderDashboard();
  };

  const selectDate = async (dateKey: string) => {
    if (!parseDateKeyUtc(dateKey)) {
      return;
    }

    pageState.selectedDateKey = dateKey;
    pageState.calendarMonthKey = dateKey.slice(0, 7);
    clearStatus(goalsStatus);
    clearStatus(journalStatus);
    await refresh选择edDateData();
  };

  foodsFilterForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await load食物(1);
  });

  foodsPrev?.addEventListener('click', async () => {
    await load食物(Math.max(1, foodsState.pagination.page - 1));
  });

  foodsNext?.addEventListener('click', async () => {
    await load食物(Math.min(foodsState.pagination.totalPages, foodsState.pagination.page + 1));
  });

  foodsRefreshButton?.addEventListener('click', async () => {
    await load食物(foodsState.page);
  });

  foodsLimit?.addEventListener('change', async () => {
    await load食物(1);
  });

  foodsAddButton?.addEventListener('click', async () => {
    const payload = await createFoodPayload();
    if (!payload) {
      return;
    }

    try {
      await request('/food', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      await load食物(1);
    } catch (error) {
      window.alert(getErrorMessage(error));
    }
  });

  workspaceSearch?.addEventListener('keydown', async (event) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    if (foodsKeyword) {
      foodsKeyword.value = workspaceSearch.value;
    }

    qs<HTMLButtonElement>('.nav-item[data-view="foods"]')?.click();
    await load食物(1);
  });

  const refreshProfile = async () => {
    currentUser = await loadCurrentUser();
    populateUserShell(currentUser);
    populateProfileForms(currentUser);
    renderGoalCycleForm();
    renderDailyLogForm();
    renderGoalsSummary();
    renderDashboard();
  };

  profileForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearStatus(profileStatus);

    try {
      const response = await request<SafeUser>('/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          username: byId<HTMLInputElement>('profile-username')?.value.trim(),
          email: byId<HTMLInputElement>('profile-email')?.value.trim(),
          height: numberValue(byId<HTMLInputElement>('profile-height')?.value),
          age: numberValue(byId<HTMLInputElement>('profile-age')?.value),
          weight: numberValue(byId<HTMLInputElement>('profile-weight')?.value),
          targetWeight: numberValue(byId<HTMLInputElement>('profile-target-weight')?.value),
          bio: byId<HTMLTextAreaElement>('profile-bio')?.value.trim()
        })
      });

      currentUser = extractUser(response) || currentUser;
      if (currentUser) {
        populateUserShell(currentUser);
        populateProfileForms(currentUser);
      }
      renderGoalCycleForm();
      renderDailyLogForm();
      renderGoalsSummary();
      renderDashboard();
      setStatus(profileStatus, '资料已更新。', 'success');
    } catch (error) {
      setStatus(profileStatus, getErrorMessage(error), 'error');
    }
  });

  goalCycleForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearStatus(goalsStatus);

    const cycleId = goalCycleId?.value.trim() || '';

    try {
      await request<GoalCycleRecord>(cycleId ? `/goals/cycle/${cycleId}` : '/goals/cycle', {
        method: cycleId ? 'PATCH' : 'POST',
        body: JSON.stringify({
          startDate: goalCycleStartDate?.value || pageState.selectedDateKey,
          endDate: goalCycleEndDate?.value || moveDateByMonth(pageState.selectedDateKey, 2),
          startWeight: numberValue(goalCycleStart体重?.value),
          targetWeight: numberValue(goalCycleTarget体重?.value),
          dailyCalorieGoal: numberValue(goalCycleDaily请输入热量?.value),
          ...(cycleId ? { status: goalCycleStatus?.value || 'active' } : {})
        })
      });
      await loadActiveGoalCycle();
      await refreshProfile();
      await refresh选择edDateData();
      setStatus(goalsStatus, cycleId ? '目标周期已更新。' : '目标周期已创建。', 'success');
    } catch (error) {
      setStatus(goalsStatus, getErrorMessage(error), 'error');
    }
  });

  dailyLogForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearStatus(goalsStatus);

    const weight = nullableNumberValue(dailyLog体重?.value);
    const notes = dailyLogNotes?.value.trim() || null;

    if (weight === null && !notes) {
      setStatus(goalsStatus, '请至少填写体重或备注后再保存。', 'error');
      return;
    }

    try {
      await request<DailyLogRecord>(`/daily-log?date=${encodeURIComponent(pageState.selectedDateKey)}`, {
        method: 'PUT',
        body: JSON.stringify({
          weight,
          notes
        })
      });
      await refreshProfile();
      await refresh选择edDateData();
      setStatus(goalsStatus, '每日记录已保存。', 'success');
    } catch (error) {
      setStatus(goalsStatus, getErrorMessage(error), 'error');
    }
  });
  securityForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearStatus(securityStatus);

    const currentPassword = byId<HTMLInputElement>('security-current-password')?.value || '';
    const newPassword = byId<HTMLInputElement>('security-new-password')?.value || '';
    const confirmPassword = byId<HTMLInputElement>('security-confirm-password')?.value || '';

    if (!currentPassword || !newPassword) {
      setStatus(securityStatus, '请填写完整的密码信息。', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatus(securityStatus, '两次输入的新密码不一致。', 'error');
      return;
    }

    try {
      await request('/profile/password', {
        method: 'PATCH',
        body: JSON.stringify({
          currentPassword,
          oldPassword: currentPassword,
          newPassword
        })
      });

      const securityInputs = qsa<HTMLInputElement>('#security-form input');
      securityInputs.forEach((input) => {
        input.value = '';
      });
      await refreshProfile();
      setStatus(securityStatus, '密码已更新。', 'success');
    } catch (error) {
      setStatus(securityStatus, getErrorMessage(error), 'error');
    }
  });

  journalForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearStatus(journalStatus);

    const entryId = journalEntryId?.value.trim() || '';
    const foodName = journalFoodName?.value.trim() || '';

    if (!foodName) {
      setStatus(journalStatus, '食物名称不能为空。', 'error');
      return;
    }

    try {
      await request<JournalEntryRecord>(entryId ? `/journal/${entryId}` : '/journal', {
        method: entryId ? 'PATCH' : 'POST',
        body: JSON.stringify({
          date: pageState.selectedDateKey,
          mealType: journalMealType?.value || 'breakfast',
          foodName,
          calories: numberValue(journal请输入热量?.value),
          quantity: numberValue(journalQuantity?.value || 1, 1),
          foodId: journalFoodId?.value.trim() || null,
          notes: journalNotes?.value.trim() || null
        })
      });
      resetJournalComposer();
      await refresh选择edDateData();
      setStatus(journalStatus, entryId ? '记录已更新。' : '记录已创建。', 'success');
    } catch (error) {
      setStatus(journalStatus, getErrorMessage(error), 'error');
    }
  });

  journalDate?.addEventListener('change', async () => {
    if (journalDate.value) {
      await selectDate(journalDate.value);
    }
  });

  dailyLogDate?.addEventListener('change', async () => {
    if (dailyLogDate.value) {
      await selectDate(dailyLogDate.value);
    }
  });

  goalsCalendarPrev?.addEventListener('click', async () => {
    await selectDate(moveDateByMonth(pageState.selectedDateKey, -1));
  });

  goalsCalendarNext?.addEventListener('click', async () => {
    await selectDate(moveDateByMonth(pageState.selectedDateKey, 1));
  });

  avatarSeedButton?.addEventListener('click', async () => {
    try {
      await request('/profile/avatar', {
        method: 'PATCH',
        body: JSON.stringify({
          avatarType: 'default',
          avatarSeed: `${currentUser?.username || 'user'}-${Date.now()}`
        })
      });
      await refreshProfile();
      setStatus(profileStatus, '默认头像已更新。', 'success');
    } catch (error) {
      setStatus(profileStatus, getErrorMessage(error), 'error');
    }
  });

  avatarUploadButton?.addEventListener('click', () => {
    avatarUploadInput?.click();
  });

  avatarUploadInput?.addEventListener('change', async () => {
    clearStatus(profileStatus);
    const file = avatarUploadInput.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setStatus(profileStatus, '请选择图片文件。', 'error');
      avatarUploadInput.value = '';
      return;
    }

    try {
      const avatarDataUrl = await readFileAsDataUrl(file);
      await request('/profile/avatar', {
        method: 'PATCH',
        body: JSON.stringify({
          avatarType: 'uploaded',
          avatarDataUrl
        })
      });
      avatarUploadInput.value = '';
      await refreshProfile();
      setStatus(profileStatus, '头像上传成功。', 'success');
    } catch (error) {
      avatarUploadInput.value = '';
      setStatus(profileStatus, getErrorMessage(error), 'error');
    }
  });

  avatarResetButton?.addEventListener('click', async () => {
    try {
      await request('/profile/avatar', {
        method: 'DELETE'
      });
      await refreshProfile();
      setStatus(profileStatus, '已恢复默认头像。', 'success');
    } catch (error) {
      setStatus(profileStatus, getErrorMessage(error), 'error');
    }
  });

  resetJournalComposer();
  sync选择edDateUi();
  renderGoalCycleForm();
  renderDailyLogForm();
  renderGoalsSummary();
  renderJournalEntries();
  renderQuickPick食物();

  await load食物(1);
  await loadActiveGoalCycle();
  await refresh选择edDateData();
};

const initAdminPage = async () => {
  const user = await ensureAuthenticated();

  if (!user) {
    navigate('/login');
    return;
  }

  if (user.role !== 'admin') {
    navigate('/app');
    return;
  }

  applyNavViews();
  bindLogout(byId('admin-logout-link'));

  const shellAvatar = byId<HTMLElement>('admin-shell-avatar');
  const shellName = byId<HTMLElement>('admin-shell-name');
  const shell角色 = byId<HTMLElement>('admin-shell-role');

  applyAvatarElement(shellAvatar, user);
  if (shellName) shellName.textContent = user.username;
  if (shell角色) shell角色.textContent = user.role;

  const overviewMacros = byId<HTMLElement>('overview-macros');
  const overviewRegistrations = byId<HTMLElement>('overview-registrations');
  const overviewFoodCreations = byId<HTMLElement>('overview-food-creations');
  const overviewRecentActions = byId<HTMLElement>('overview-recent-actions');
  const adminSecurityEvents = byId<HTMLElement>('admin-security-events');
  const adminSecuritySummary = byId<HTMLElement>('admin-security-summary');
  const systemSummary = byId<HTMLElement>('system-summary');
  const systemHealthList = byId<HTMLElement>('system-health-list');

  const apply总览 = (payload: Record<string, any>) => {
    const source = ((payload.data && !Array.isArray(payload.data) ? payload.data : payload) || {}) as AdminOverviewPayload;
    const summary = ((source.summary && typeof source.summary === 'object') ? source.summary : source) as AdminOverviewPayload;
    const counts = (summary.counts || {}) as Record<string, unknown>;
    const security = (summary.security || {}) as Record<string, unknown>;
    const system = (summary.system || {}) as Record<string, unknown>;
    const health = (summary.health || {}) as Record<string, unknown>;
    const total用户 = numberValue(summary.total用户 ?? counts.total用户 ?? summary.userCount);
    const total食物 = numberValue(summary.total食物 ?? counts.total食物 ?? summary.foodCount);
    const total管理员 = numberValue(summary.total管理员 ?? counts.total管理员 ?? summary.adminCount);
    const registrations7d = numberValue(summary.recentRegistrations ?? counts.recentRegistrations ?? summary.registrationsLast7Days);
    const foodCreations7d = numberValue(summary.recentFoods ?? counts.recentFoods ?? summary.foodCreationsLast7Days);
    const recentActions = Array.isArray(summary.recentActivity)
      ? summary.recentActivity
      : Array.isArray(summary.recentActions)
        ? summary.recentActions
        : Array.isArray(summary.recentUsers)
          ? summary.recentUsers.map((item: any) => ({
            title: item.username || 'User',
            detail: `注册于 ${formatDate(item.createdAt)}`,
            timestamp: item.createdAt
          }))
          : [];
    const auditStatus = String(security.auditStatus || 'summary-only');
    const rateLimitWindow = String(security.loginRateLimitWindowMs || '-');
    const maxAttempts = String(security.loginRateLimitMaxAttempts || '-');
    const jwtExpiresIn = String(security.jwtExpiresIn || '7d');

    if (overviewMacros) {
      overviewMacros.innerHTML = `
        <div><strong>${total用户}</strong><span>用户</span></div>
        <div><strong>${total食物}</strong><span>食物</span></div>
        <div><strong>${total管理员}</strong><span>管理员</span></div>
      `;
    }

    if (overviewRegistrations) {
      overviewRegistrations.textContent = String(registrations7d);
    }

    if (overviewFoodCreations) {
      overviewFoodCreations.textContent = String(foodCreations7d);
    }

    if (overviewRecentActions) {
      overviewRecentActions.innerHTML = recentActions.length
        ? recentActions.map((item: any) => `
          <div>
            <strong>${escapeHtml(item.title || item.action || '事件')}</strong>
            <span>${escapeHtml(item.detail || item.message || '-')} · ${escapeHtml(formatDate(item.timestamp))}</span>
          </div>
        `).join('')
        : '<div><strong>总览</strong><span>暂无近期活动。</span></div>';
    }

    if (adminSecurityEvents) {
      adminSecurityEvents.innerHTML = `
        <div><strong>登录限流</strong><span>${escapeHtml(`${rateLimitWindow} 窗口 / ${maxAttempts} 次尝试`)}</span></div>
        <div><strong>JWT 鉴权</strong><span>${escapeHtml(`Bearer 路由已启用，时效 ${jwtExpiresIn}`)}</span></div>
        <div><strong>审计摘要</strong><span>${escapeHtml(auditStatus)}</span></div>
      `;
    }

    if (adminSecuritySummary) {
      adminSecuritySummary.innerHTML = `
        <div><span>窗口</span><strong>${escapeHtml(rateLimitWindow)}</strong></div>
        <div><span>最大尝试次数</span><strong>${escapeHtml(maxAttempts)}</strong></div>
        <div><span>JWT 时效</span><strong>${escapeHtml(jwtExpiresIn)}</strong></div>
        <div><span>审计</span><strong>${escapeHtml(auditStatus)}</strong></div>
      `;
    }

    if (systemSummary) {
      systemSummary.innerHTML = `
        <div><span>运行环境</span><strong>${escapeHtml(system.runtime || 'Node.js + Express 5')}</strong></div>
        <div><span>数据库</span><strong>${escapeHtml(system.database || 'MongoDB')}</strong></div>
        <div><span>ODM</span><strong>${escapeHtml(system.odm || 'Mongoose')}</strong></div>
        <div><span>鉴权</span><strong>${escapeHtml(system.auth || 'JWT + bcryptjs')}</strong></div>
        <div><span>管理员初始化</span><strong>${escapeHtml(system.adminBootstrapEnabled ? '已启用' : '未启用')}</strong></div>
        <div><span>环境来源</span><strong>${escapeHtml(system.envSource || '.env / process.env')}</strong></div>
      `;
    }

    if (systemHealthList) {
      const healthItems = [
        {
          label: '接口可用',
          value: health.apiReady,
          text: health.apiReady ? '正常' : '未就绪'
        },
        {
          label: 'MongoDB 本地连接',
          value: health.mongoExpectedLocal,
          text: health.mongoExpectedLocal ? '是' : '自定义连接'
        },
        {
          label: '管理员初始化已启用',
          value: health.adminBootstrapEnabled,
          text: health.adminBootstrapEnabled ? '已启用' : '未启用'
        },
        {
          label: '当前版本',
          value: true,
          text: String(health.demoVersion || 'Food Calorie Management System v3')
        }
      ];

      systemHealthList.innerHTML = healthItems.map((item) => `
        <div>
          <span style="background:${item.value ? 'var(--success)' : 'var(--warning)'}"></span>
          ${escapeHtml(item.label)} · ${escapeHtml(item.text)}
        </div>
      `).join('');
    }
  };

  try {
    const overviewResponse = await request<Record<string, unknown>>('/admin/overview');
    apply总览(overviewResponse as Record<string, any>);
  } catch {}

  const usersState = {
    page: 1,
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false
    } as Pagination,
    items: [] as SafeUser[],
    selectedId: ''
  };

  const usersTbody = byId<HTMLElement>('admin-users-tbody');
  const usersPaginationLabel = byId<HTMLElement>('admin-users-pagination-label');
  const usersPageIndicator = byId<HTMLElement>('admin-users-page-indicator');
  const usersPrev = byId<HTMLButtonElement>('admin-users-prev');
  const usersNext = byId<HTMLButtonElement>('admin-users-next');
  const usersFilterForm = byId<HTMLFormElement>('admin-users-filter-form');
  const usersKeyword = byId<HTMLInputElement>('admin-users-keyword');
  const users角色 = byId<HTMLSelectElement>('admin-users-role');
  const usersSort = byId<HTMLSelectElement>('admin-users-sort');
  const usersLimit = byId<HTMLSelectElement>('admin-users-limit');
  const usersRefresh = byId<HTMLButtonElement>('admin-users-refresh');
  const usersClear = byId<HTMLButtonElement>('admin-users-clear');

  const detailName = byId<HTMLElement>('admin-user-detail-name');
  const detailAvatar = byId<HTMLElement>('admin-user-detail-avatar');
  const detailSummary = byId<HTMLElement>('admin-user-detail-summary');
  const detailEmail = byId<HTMLInputElement>('admin-user-detail-email');
  const detail角色 = byId<HTMLSelectElement>('admin-user-detail-role');
  const detailForm = byId<HTMLFormElement>('admin-user-detail-form');
  const detail删除 = byId<HTMLButtonElement>('admin-user-delete');
  const detailStatus = byId<HTMLElement>('admin-user-detail-status');

  const apply选择edUser = (selected: SafeUser | null) => {
    if (!selected) {
      usersState.selectedId = '';
      if (detailName) detailName.textContent = '选择 a user';
      if (detailAvatar) {
        detailAvatar.textContent = '--';
        detailAvatar.classList.remove('has-image');
        detailAvatar.style.removeProperty('--avatar-image');
      }
      if (detailSummary) {
        detailSummary.innerHTML = `
          <div><span>角色</span><strong>-</strong></div>
          <div><span>食物数</span><strong>-</strong></div>
          <div><span>最近登录</span><strong>-</strong></div>
        `;
      }
      if (detailEmail) detailEmail.value = '';
      if (detail角色) detail角色.value = 'user';
      return;
    }

    usersState.selectedId = selected._id;
    if (detailName) detailName.textContent = selected.username;
    applyAvatarElement(detailAvatar, selected);
    if (detailSummary) {
      detailSummary.innerHTML = `
        <div><span>角色</span><strong>${selected.role}</strong></div>
        <div><span>食物数</span><strong>${numberValue(selected.foodCount)}</strong></div>
        <div><span>最近登录</span><strong>${formatDate(selected.lastLoginAt)}</strong></div>
      `;
    }
    if (detailEmail) detailEmail.value = selected.email;
    if (detail角色) detail角色.value = selected.role;
  };

  const render用户 = () => {
    if (!usersTbody) {
      return;
    }

    if (!usersState.items.length) {
      usersTbody.innerHTML = '<tr><td colspan="6">没有找到用户。</td></tr>';
    } else {
      usersTbody.innerHTML = usersState.items.map((item) => `
        <tr data-user-id="${item._id}" class="${usersState.selectedId === item._id ? 'selected-row' : ''}">
          <td><strong>${item.username}</strong></td>
          <td>${item.email}</td>
          <td>${item.role}</td>
          <td>${numberValue(item.foodCount)}</td>
          <td>${formatShortDate(item.lastLoginAt)}</td>
          <td>${formatShortDate(item.createdAt)}</td>
        </tr>
      `).join('');
    }

    if (usersPaginationLabel) {
      usersPaginationLabel.textContent = `共 ${usersState.pagination.total} 位用户，第 ${usersState.pagination.page} / ${usersState.pagination.totalPages} 页`;
    }

    if (usersPageIndicator) {
      usersPageIndicator.textContent = String(usersState.pagination.page);
    }

    if (usersPrev) {
      usersPrev.disabled = usersState.pagination.page <= 1;
    }

    if (usersNext) {
      usersNext.disabled = usersState.pagination.page >= usersState.pagination.totalPages;
    }

    qsa<HTMLTableRowElement>('tr[data-user-id]', usersTbody).forEach((row) => {
      row.addEventListener('click', async () => {
        const userId = row.getAttribute('data-user-id') || '';
        if (!userId) {
          return;
        }

        try {
          const response = await request<SafeUser>(`/users/${userId}`);
          const selected = extractUser(response);
          apply选择edUser(selected);
          render用户();
        } catch (error) {
          setStatus(detailStatus, getErrorMessage(error), 'error');
        }
      });
    });
  };

  const loadUsers = async (page = 1) => {
    usersState.page = page;

    if (usersTbody) {
      usersTbody.innerHTML = '<tr><td colspan="6">加载中 users...</td></tr>';
    }

    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', usersLimit?.value || '10');
    if (usersKeyword?.value.trim()) params.set('keyword', usersKeyword.value.trim());
    if (users角色?.value) params.set('role', users角色.value);
    if (usersSort?.value) {
      const [sortBy, order] = usersSort.value.split(':');
      params.set('sortBy', sortBy);
      params.set('order', order || 'desc');
    }

    try {
      const response = await request<SafeUser[]>(`/users?${params.toString()}`);
      usersState.items = extractItems<SafeUser>(response).map((item) => ({ ...item, role: toRole(item.role) }));
      usersState.pagination = extractPagination(response, usersState.items.length);
      render用户();
    } catch (error) {
      if (usersTbody) {
        usersTbody.innerHTML = `<tr><td colspan="6">${getErrorMessage(error)}</td></tr>`;
      }
    }
  };

  usersFilterForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await loadUsers(1);
  });

  usersPrev?.addEventListener('click', async () => {
    await loadUsers(Math.max(1, usersState.pagination.page - 1));
  });

  usersNext?.addEventListener('click', async () => {
    await loadUsers(Math.min(usersState.pagination.totalPages, usersState.pagination.page + 1));
  });

  usersLimit?.addEventListener('change', async () => {
    await loadUsers(1);
  });

  usersRefresh?.addEventListener('click', async () => {
    await loadUsers(usersState.page);
  });

  usersClear?.addEventListener('click', () => {
    clearStatus(detailStatus);
    apply选择edUser(null);
    render用户();
  });

  detailForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearStatus(detailStatus);

    if (!usersState.selectedId) {
      setStatus(detailStatus, '选择 a user first.', 'error');
      return;
    }

    try {
      const response = await request<SafeUser>(`/users/${usersState.selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          email: detailEmail?.value.trim(),
          role: detail角色?.value
        })
      });

      const updated = extractUser(response);
      apply选择edUser(updated);
      await loadUsers(usersState.page);
      setStatus(detailStatus, '用户信息已更新。', 'success');
    } catch (error) {
      setStatus(detailStatus, getErrorMessage(error), 'error');
    }
  });

  detail删除?.addEventListener('click', async () => {
    clearStatus(detailStatus);

    if (!usersState.selectedId) {
      setStatus(detailStatus, '选择 a user first.', 'error');
      return;
    }

    if (!window.confirm('删除 this user and all owned foods?')) {
      return;
    }

    try {
      await request(`/users/${usersState.selectedId}`, {
        method: 'DELETE'
      });
      apply选择edUser(null);
      await loadUsers(Math.max(1, usersState.page));
      setStatus(detailStatus, '用户已删除。', 'success');
    } catch (error) {
      setStatus(detailStatus, getErrorMessage(error), 'error');
    }
  });

  const adminFoodsState = {
    page: 1,
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false
    } as Pagination,
    items: [] as FoodRecord[]
  };

  const adminFoodsTbody = byId<HTMLElement>('admin-foods-tbody');
  const adminFoodsPaginationLabel = byId<HTMLElement>('admin-foods-pagination-label');
  const adminFoodsPageIndicator = byId<HTMLElement>('admin-foods-page-indicator');
  const adminFoodsPrev = byId<HTMLButtonElement>('admin-foods-prev');
  const adminFoodsNext = byId<HTMLButtonElement>('admin-foods-next');
  const adminFoodsFilterForm = byId<HTMLFormElement>('admin-foods-filter-form');
  const adminFoodsKeyword = byId<HTMLInputElement>('admin-foods-keyword');
  const adminFoodsOwner = byId<HTMLInputElement>('admin-foods-owner');
  const adminFoodsRange = byId<HTMLSelectElement>('admin-foods-range');
  const adminFoodsSort = byId<HTMLSelectElement>('admin-foods-sort');
  const adminFoodsLimit = byId<HTMLSelectElement>('admin-foods-limit');
  const adminFoodsRefresh = byId<HTMLButtonElement>('admin-foods-refresh');

  const renderAdminFoods = () => {
    if (!adminFoodsTbody) {
      return;
    }

    if (!adminFoodsState.items.length) {
      adminFoodsTbody.innerHTML = '<tr><td colspan="5">没有找到食物。</td></tr>';
    } else {
      adminFoodsTbody.innerHTML = adminFoodsState.items.map((item) => {
        const owner = typeof item.owner === 'string' ? item.owner : item.owner?.username || item.owner?.email || '-';
        return `
          <tr>
            <td><strong>${item.name}</strong></td>
            <td>${owner}</td>
            <td>${item.calories} kcal</td>
            <td>${formatShortDate(item.createdAt)}</td>
            <td>${formatShortDate(item.updatedAt)}</td>
          </tr>
        `;
      }).join('');
    }

    if (adminFoodsPaginationLabel) {
      adminFoodsPaginationLabel.textContent = `共 ${adminFoodsState.pagination.total} 条食物，第 ${adminFoodsState.pagination.page} / ${adminFoodsState.pagination.totalPages} 页`;
    }

    if (adminFoodsPageIndicator) {
      adminFoodsPageIndicator.textContent = String(adminFoodsState.pagination.page);
    }

    if (adminFoodsPrev) {
      adminFoodsPrev.disabled = adminFoodsState.pagination.page <= 1;
    }

    if (adminFoodsNext) {
      adminFoodsNext.disabled = adminFoodsState.pagination.page >= adminFoodsState.pagination.totalPages;
    }
  };

  const loadAdminFoods = async (page = 1) => {
    adminFoodsState.page = page;

    if (adminFoodsTbody) {
      adminFoodsTbody.innerHTML = '<tr><td colspan="5">加载中...</td></tr>';
    }

    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', adminFoodsLimit?.value || '20');
    if (adminFoodsKeyword?.value.trim()) params.set('keyword', adminFoodsKeyword.value.trim());
    if (adminFoodsOwner?.value.trim()) params.set('owner', adminFoodsOwner.value.trim());
    if (adminFoodsSort?.value) {
      const [sortBy, order] = adminFoodsSort.value.split(':');
      params.set('sortBy', sortBy);
      params.set('order', order || 'desc');
    }
    if (adminFoodsRange?.value) {
      const [min, max] = adminFoodsRange.value.split('-');
      params.set('caloriesMin', min);
      params.set('caloriesMax', max);
    }

    try {
      const response = await request<FoodRecord[]>(`/admin/foods?${params.toString()}`);
      adminFoodsState.items = extractItems<FoodRecord>(response);
      adminFoodsState.pagination = extractPagination(response, adminFoodsState.items.length);
      renderAdminFoods();
    } catch (error) {
      if (adminFoodsTbody) {
        adminFoodsTbody.innerHTML = `<tr><td colspan="5">${getErrorMessage(error)}</td></tr>`;
      }
    }
  };

  adminFoodsFilterForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await loadAdminFoods(1);
  });

  adminFoodsPrev?.addEventListener('click', async () => {
    await loadAdminFoods(Math.max(1, adminFoodsState.pagination.page - 1));
  });

  adminFoodsNext?.addEventListener('click', async () => {
    await loadAdminFoods(Math.min(adminFoodsState.pagination.totalPages, adminFoodsState.pagination.page + 1));
  });

  adminFoodsLimit?.addEventListener('change', async () => {
    await loadAdminFoods(1);
  });

  adminFoodsRefresh?.addEventListener('click', async () => {
    await loadAdminFoods(adminFoodsState.page);
  });

  const adminGlobalSearch = byId<HTMLInputElement>('admin-global-search');
  adminGlobalSearch?.addEventListener('keydown', async (event) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    const value = adminGlobalSearch.value.trim();

    if (usersKeyword) {
      usersKeyword.value = value;
    }

    if (adminFoodsKeyword) {
      adminFoodsKeyword.value = value;
    }

    const currentView = window.location.hash.replace('#', '');
    if (currentView === 'admin-foods') {
      await loadAdminFoods(1);
      return;
    }

    qs<HTMLButtonElement>('.nav-item[data-view="users"]')?.click();
    await loadUsers(1);
  });

  await Promise.all([
    loadUsers(1),
    loadAdminFoods(1)
  ]);
};

const boot = async () => {
  authToken = getStoredToken();

  if (PAGE === 'login') {
    await initLoginPage();
    return;
  }

  if (PAGE === 'register') {
    await initRegisterPage();
    return;
  }

  if (PAGE === 'user') {
    await initUserPage();
    return;
  }

  if (PAGE === 'admin') {
    await initAdminPage();
  }
};

void boot();




