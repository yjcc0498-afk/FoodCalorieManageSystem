const TOKEN_STORAGE_KEY = 'food-calorie-token';
const LEGACY_TOKEN_STORAGE_KEY = 'food-calorie-token';

type Role = 'user' | 'admin';

type SafeUser = {
  _id: string;
  username: string;
  email: string;
  role: Role;
  createdAt?: string;
  updatedAt?: string;
};

type FoodRecord = {
  _id: string;
  name: string;
  calories: number;
  owner?: string;
  createdAt?: string;
  updatedAt?: string;
};

type ApiResponse<T = unknown> = {
  message?: string;
  error?: string;
  token?: string;
  safeUser?: SafeUser;
  keyword?: string;
  count?: number;
  data?: T;
};

type ToastType = 'success' | 'error' | 'info';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element #root was not found.');
}

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

const formatDate = (value?: string): string => {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString();
};

const formatKcal = (value: number): string => {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe}`;
};

const toRole = (value: unknown): Role => {
  return value === 'admin' ? 'admin' : 'user';
};

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: {
    className?: string;
    text?: string;
    attrs?: Record<string, string>;
  } = {}
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.attrs) {
    Object.entries(options.attrs).forEach(([k, v]) => node.setAttribute(k, v));
  }
  return node;
};

const setChildren = (parent: HTMLElement, children: Array<Node | null | undefined>) => {
  parent.replaceChildren(...children.filter(Boolean) as Node[]);
};

const toastHost = (() => {
  const host = el('div', { className: 'toast-host' });
  document.body.appendChild(host);
  return host;
})();

const toast = (message: string, type: ToastType = 'info') => {
  const node = el('div', { className: `toast toast-${type}` });
  node.textContent = message;
  toastHost.appendChild(node);
  window.setTimeout(() => {
    node.remove();
  }, 3200);
};

let authToken: string | null = null;
let currentUser: SafeUser | null = null;

const getStoredToken = (): string | null => {
  const session = window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
  if (session) return session;
  const legacy = window.localStorage.getItem(LEGACY_TOKEN_STORAGE_KEY);
  if (legacy) {
    window.localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
    window.sessionStorage.setItem(TOKEN_STORAGE_KEY, legacy);
    return legacy;
  }
  return null;
};

const setStoredToken = (token: string | null) => {
  if (!token) {
    window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    return;
  }
  window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
};

const clearSession = () => {
  authToken = null;
  currentUser = null;
  setStoredToken(null);
};

const request = async <T = unknown>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> => {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = (await response.json().catch(() => ({}))) as ApiResponse<T>;

  if (response.status === 401) {
    if (authToken) {
      clearSession();
      navigate('/login', true);
      toast('登录已失效，请重新登录。', 'error');
    }
  }

  if (!response.ok) {
    const message = data.message || '请求失败。';
    const detail = data.error ? ` ${data.error}` : '';
    const statusHint = response.status === 429 ? ' 登录尝试次数过多，请稍后再试。' : '';
    throw new Error(`${message}${detail}${statusHint}`);
  }

  return data;
};

const loadMe = async (): Promise<SafeUser> => {
  const result = await request('/auth/me');
  if (!result.safeUser) {
    throw new Error('无法获取当前用户信息。');
  }
  const safeUser = {
    ...result.safeUser,
    role: toRole(result.safeUser.role)
  };
  currentUser = safeUser;
  return safeUser;
};

const ensureAuthed = async (): Promise<SafeUser | null> => {
  const token = getStoredToken();
  if (!token) return null;
  if (authToken === token && currentUser) {
    return currentUser;
  }
  authToken = token;
  try {
    return await loadMe();
  } catch {
    return null;
  }
};

const navigate = (path: string, replace = false) => {
  if (replace) {
    window.history.replaceState({}, '', path);
  } else {
    window.history.pushState({}, '', path);
  }
  void renderRoute();
};

const link = (label: string, href: string, className?: string) => {
  const a = el('a', { className: className || '', text: label, attrs: { href } });
  a.addEventListener('click', (e) => {
    const url = new URL(href, window.location.origin);
    if (url.origin === window.location.origin) {
      e.preventDefault();
      navigate(url.pathname);
    }
  });
  return a;
};

const renderTopbar = (options: {
  center?: HTMLElement;
  right?: HTMLElement;
  leftHref?: string;
  leftLabel?: string;
}) => {
  const bar = el('header', { className: 'topbar' });
  const inner = el('div', { className: 'container topbar-inner' });

  const left = el('div');
  const brandHref = options.leftHref || '/app';
  const brandLabel = options.leftLabel || '热量管理';
  const brand = link('', brandHref, 'brand');
  const badge = el('span', { className: 'brand-badge' });
  const text = el('span', { text: brandLabel });
  brand.append(badge, text);
  left.appendChild(brand);

  const center = el('div');
  if (options.center) center.appendChild(options.center);

  const right = el('div');
  right.style.justifySelf = 'end';
  if (options.right) right.appendChild(options.right);

  inner.append(left, center, right);
  bar.appendChild(inner);
  return bar;
};

const userPill = (user: SafeUser) => {
  const pill = el('div', { className: 'pill' });
  const name = el('span', { text: user.username });
  const role = el('span', { className: `role-pill role-${user.role}`, text: user.role });
  pill.append(name, role);
  return pill;
};

const skeletonTableRows = (columns: number, rows = 3) => {
  return Array.from({ length: rows }, () => {
    const row = el('tr');
    const cell = el('td', { attrs: { colspan: `${columns}` } });
    cell.appendChild(el('div', { className: 'skeleton' }));
    row.appendChild(cell);
    return row;
  });
};

const emptyTableRow = (columns: number, title: string, message: string) => {
  const row = el('tr');
  const cell = el('td', { attrs: { colspan: `${columns}` } });
  const state = el('div', { className: 'empty-state' });
  state.append(el('strong', { text: title }), el('span', { text: message }));
  cell.appendChild(state);
  row.appendChild(cell);
  return row;
};

const renderLoginPage = () => {
  document.title = '热量管理系统｜登录';

  const container = el('div', { className: 'grid-auth' });
  const shell = el('div', { className: 'container auth-shell' });

  const leftCard = el('section', { className: 'card' });
  const leftInner = el('div', { className: 'card-inner' });
  leftInner.append(
    el('div', { className: 'kicker', text: 'Food Calorie Management' }),
    el('h1', { className: 'h1', text: '安静记录每一次摄入' }),
    el('p', { className: 'p', text: '登录后按用户隔离食物数据，管理自己的 kcal 列表；管理员可维护账号与权限。' })
  );

  const valueGrid = el('div', { className: 'value-grid' });
  const m1 = el('div', { className: 'metric-row' });
  m1.append(el('div', { className: 'muted', text: '记录入口' }), el('strong', { text: '3' }));
  const m2 = el('div', { className: 'metric-row' });
  m2.append(el('div', { className: 'muted', text: '权限层级' }), el('strong', { text: '2' }));
  const m3 = el('div', { className: 'metric-row' });
  m3.append(el('div', { className: 'muted', text: '接口保护' }), el('strong', { text: 'JWT' }));
  valueGrid.append(m1, m2, m3);
  leftInner.appendChild(valueGrid);
  leftCard.appendChild(leftInner);

  const rightCard = el('section', { className: 'card' });
  const rightInner = el('div', { className: 'card-inner' });
  const tabs = el('div', { className: 'tabs', attrs: { role: 'tablist', 'aria-label': '认证' } });
  const tabLogin = el('button', { className: 'tab active', text: '登录', attrs: { type: 'button' } });
  const tabRegister = el('button', { className: 'tab', text: '注册', attrs: { type: 'button' } });
  tabs.append(tabLogin, tabRegister);

  const status = el('div', { className: 'status', text: '请登录或注册后继续。' });
  const setStatus = (message: string, kind: 'idle' | 'success' | 'error') => {
    status.textContent = message;
    status.className = `status${kind === 'idle' ? '' : ` status-${kind}`}`;
  };

  const formLogin = el('form', { className: 'form' });
  const loginTitle = el('div', { className: 'card-title' });
  loginTitle.append(el('div', { className: 'kicker', text: 'JWT 登录' }), el('h2', { className: 'h2', text: '进入工作台' }));
  const loginIdentifierLabel = el('label');
  loginIdentifierLabel.append(el('span', { className: 'muted', text: '用户名或邮箱' }));
  const loginIdentifier = el('input', { className: 'input', attrs: { name: 'identifier', type: 'text', placeholder: 'admin 或 admin@example.com', required: 'true', autocomplete: 'username' } });
  loginIdentifierLabel.appendChild(loginIdentifier);
  const loginPasswordLabel = el('label');
  loginPasswordLabel.append(el('span', { className: 'muted', text: '密码' }));
  const loginPassword = el('input', { className: 'input', attrs: { name: 'password', type: 'password', placeholder: '输入你的密码', required: 'true', autocomplete: 'current-password' } });
  loginPasswordLabel.appendChild(loginPassword);
  const loginBtn = el('button', { className: 'btn btn-primary btn-block', text: '安全登录', attrs: { type: 'submit' } });
  formLogin.append(loginTitle, loginIdentifierLabel, loginPasswordLabel, loginBtn);

  const formRegister = el('form', { className: 'form hidden' });
  const regTitle = el('div', { className: 'card-title' });
  regTitle.append(el('div', { className: 'kicker', text: '创建账号' }), el('h2', { className: 'h2', text: '开始记录' }), el('p', { className: 'p', text: '密码至少 6 位，注册后直接进入普通用户工作台。' }));
  const regUsernameLabel = el('label');
  regUsernameLabel.append(el('span', { className: 'muted', text: '用户名' }));
  const regUsername = el('input', { className: 'input', attrs: { name: 'username', type: 'text', placeholder: 'alice', required: 'true', autocomplete: 'username' } });
  regUsernameLabel.appendChild(regUsername);
  const regEmailLabel = el('label');
  regEmailLabel.append(el('span', { className: 'muted', text: '邮箱' }));
  const regEmail = el('input', { className: 'input', attrs: { name: 'email', type: 'email', placeholder: 'alice@example.com', required: 'true', autocomplete: 'email' } });
  regEmailLabel.appendChild(regEmail);
  const regPasswordLabel = el('label');
  regPasswordLabel.append(el('span', { className: 'muted', text: '密码' }));
  const regPassword = el('input', { className: 'input', attrs: { name: 'password', type: 'password', placeholder: '至少 6 位', required: 'true', minlength: '6', autocomplete: 'new-password' } });
  regPasswordLabel.appendChild(regPassword);
  const regBtn = el('button', { className: 'btn btn-primary btn-block', text: '创建并进入', attrs: { type: 'submit' } });
  formRegister.append(regTitle, regUsernameLabel, regEmailLabel, regPasswordLabel, regBtn);

  const setMode = (mode: 'login' | 'register') => {
    const isLogin = mode === 'login';
    tabLogin.classList.toggle('active', isLogin);
    tabRegister.classList.toggle('active', !isLogin);
    formLogin.classList.toggle('hidden', !isLogin);
    formRegister.classList.toggle('hidden', isLogin);
    setStatus(isLogin ? '请输入账号信息继续。' : '创建普通用户账号后即可开始记录 kcal。', 'idle');
  };

  tabLogin.addEventListener('click', () => setMode('login'));
  tabRegister.addEventListener('click', () => setMode('register'));

  const setBtnLoading = (button: HTMLButtonElement, loading: boolean, loadingText: string, idleText: string) => {
    button.disabled = loading;
    button.textContent = loading ? loadingText : idleText;
  };

  formLogin.addEventListener('submit', async (event) => {
    event.preventDefault();
    setBtnLoading(loginBtn, true, '正在登录…', '安全登录');
    setStatus('正在登录（POST /auth/login）…', 'idle');
    try {
      const payload = {
        identifier: loginIdentifier.value.trim(),
        password: loginPassword.value
      };
      const result = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (!result.token || !result.safeUser) {
        throw new Error('登录响应缺少会话信息。');
      }
      authToken = result.token;
      setStoredToken(result.token);
      currentUser = { ...result.safeUser, role: toRole(result.safeUser.role) };
      setStatus('登录成功。', 'success');
      toast('欢迎回来。', 'success');
      navigate('/app', true);
    } catch (error) {
      setStatus(getErrorMessage(error), 'error');
    } finally {
      setBtnLoading(loginBtn, false, '正在登录…', '安全登录');
    }
  });

  formRegister.addEventListener('submit', async (event) => {
    event.preventDefault();
    setBtnLoading(regBtn, true, '正在注册…', '创建并进入');
    setStatus('正在注册（POST /auth/register）…', 'idle');
    try {
      const payload = {
        username: regUsername.value.trim(),
        email: regEmail.value.trim(),
        password: regPassword.value
      };
      const result = await request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (!result.token || !result.safeUser) {
        throw new Error('注册响应缺少会话信息。');
      }
      authToken = result.token;
      setStoredToken(result.token);
      currentUser = { ...result.safeUser, role: toRole(result.safeUser.role) };
      setStatus('注册成功。', 'success');
      toast('账号已创建。', 'success');
      navigate('/app', true);
    } catch (error) {
      setStatus(getErrorMessage(error), 'error');
    } finally {
      setBtnLoading(regBtn, false, '正在注册…', '创建并进入');
    }
  });

  rightInner.append(tabs, formLogin, formRegister, status);
  rightCard.appendChild(rightInner);
  shell.append(leftCard, rightCard);
  container.appendChild(shell);
  return container;
};

const renderAppPage = (user: SafeUser) => {
  document.title = '热量管理｜我的记录';

  const keywordState = { keyword: '' };
  const foodsState: { loading: boolean; foods: FoodRecord[] } = { loading: true, foods: [] };

  const searchBox = el('div', { className: 'search' });
  const searchInput = el('input', { className: 'input', attrs: { type: 'text', placeholder: '搜索食物名称（keyword）…', value: '' } });
  const searchBtn = el('button', { className: 'btn btn-primary', text: '搜索', attrs: { type: 'button' } });
  searchBox.append(searchInput, searchBtn);

  const right = el('div', { className: 'pill' });
  right.appendChild(userPill(user));

  const adminBtn = user.role === 'admin' ? el('button', { className: 'btn btn-ghost btn-sm', text: '管理员', attrs: { type: 'button' } }) : null;
  if (adminBtn) {
    adminBtn.addEventListener('click', () => navigate('/admin'));
    right.appendChild(adminBtn);
  }
  const logoutBtn = el('button', { className: 'btn btn-danger btn-sm', text: '退出', attrs: { type: 'button' } });
  logoutBtn.addEventListener('click', () => {
    clearSession();
    toast('已退出登录。', 'info');
    navigate('/login', true);
  });
  right.appendChild(logoutBtn);

  const topbar = renderTopbar({ center: searchBox, right });

  const page = el('main', { className: 'container page' });
  const layout = el('div', { className: 'layout' });
  const leftCol = el('div', { className: 'col-8 stack' });
  const rightCol = el('div', { className: 'col-4 stack' });

  const overviewCard = el('section', { className: 'card' });
  const overviewInner = el('div', { className: 'card-inner' });
  const overviewTitle = el('div', { className: 'card-title' });
  overviewTitle.append(el('div', { className: 'kicker', text: '热量总览' }), el('h2', { className: 'h2', text: '当前视图' }), el('p', { className: 'p', text: '统计会跟随搜索结果同步变化。' }));
  const ovA = el('div', { className: 'metric-row' });
  const ovB = el('div', { className: 'metric-row' });
  const ovC = el('div', { className: 'metric-row' });
  const ovCount = el('strong', { text: '—' });
  const ovTotal = el('strong', { text: '—' });
  const ovMax = el('strong', { text: '—' });
  ovA.append(el('div', { className: 'muted', text: '记录数' }), ovCount);
  ovB.append(el('div', { className: 'muted', text: '合计 kcal' }), ovTotal);
  ovC.append(el('div', { className: 'muted', text: '最高 kcal' }), ovMax);
  overviewInner.append(overviewTitle, ovA, ovB, ovC);
  overviewCard.appendChild(overviewInner);

  const accountCard = el('section', { className: 'card' });
  const accountInner = el('div', { className: 'card-inner' });
  const accountTitle = el('div', { className: 'card-title' });
  accountTitle.append(el('div', { className: 'kicker', text: '我的账号' }), el('h2', { className: 'h2', text: user.username }), el('p', { className: 'p', text: user.email }));
  const accountMeta = el('div', { className: 'metric-row' });
  accountMeta.append(el('div', { className: 'muted', text: '角色' }), el('strong', { text: user.role }));
  accountInner.append(accountTitle, accountMeta);
  accountCard.appendChild(accountInner);

  rightCol.append(overviewCard, accountCard);

  const createCard = el('section', { className: 'card' });
  const createInner = el('div', { className: 'card-inner' });
  const createTitle = el('div', { className: 'card-title' });
  createTitle.append(el('div', { className: 'kicker', text: '新增记录' }), el('h2', { className: 'h2', text: '添加食物热量' }), el('p', { className: 'p', text: '名称会自动 trim 并转为小写，数据仅归属当前用户。' }));
  const createForm = el('form', { className: 'form' });
  const nameLabel = el('label');
  nameLabel.append(el('span', { className: 'muted', text: '食物名称' }));
  const nameInput = el('input', { className: 'input', attrs: { name: 'name', type: 'text', placeholder: '例如 chicken breast', required: 'true' } });
  nameLabel.appendChild(nameInput);
  const kcalLabel = el('label');
  kcalLabel.append(el('span', { className: 'muted', text: '热量（kcal）' }));
  const kcalInput = el('input', { className: 'input', attrs: { name: 'calories', type: 'number', min: '0', step: '1', placeholder: '例如 165' } });
  kcalLabel.appendChild(kcalInput);
  const createBtn = el('button', { className: 'btn btn-primary btn-block', text: '添加到列表', attrs: { type: 'submit' } });
  createForm.append(nameLabel, kcalLabel, createBtn);
  createInner.append(createTitle, createForm);
  createCard.appendChild(createInner);

  const listCard = el('section', { className: 'card' });
  const listInner = el('div', { className: 'card-inner' });
  const listTitle = el('div', { className: 'card-title' });
  listTitle.append(el('div', { className: 'kicker', text: '记录列表' }), el('h2', { className: 'h2', text: '食物与 kcal' }), el('p', { className: 'p', text: '支持搜索、修改热量和删除记录。' }));
  const tableShell = el('div', { className: 'table-shell' });
  const table = el('table');
  const thead = el('thead');
  const headRow = el('tr');
  ['食物', 'kcal', '更新时间', '操作'].forEach((t) => headRow.appendChild(el('th', { text: t })));
  thead.appendChild(headRow);
  const tbody = el('tbody');
  table.append(thead, tbody);
  tableShell.appendChild(table);
  listInner.append(listTitle, tableShell);
  listCard.appendChild(listInner);

  const updateOverview = (foods: FoodRecord[]) => {
    const count = foods.length;
    const total = foods.reduce((sum, f) => sum + Number(f.calories || 0), 0);
    const max = foods.reduce((m, f) => Math.max(m, Number(f.calories || 0)), 0);
    ovCount.textContent = `${count}`;
    ovTotal.textContent = formatKcal(total);
    ovMax.textContent = formatKcal(max);
  };

  const renderFoods = () => {
    if (foodsState.loading) {
      tbody.replaceChildren(...skeletonTableRows(4, 3));
      return;
    }

    const foods = foodsState.foods;
    updateOverview(foods);
    if (!foods.length) {
      tbody.replaceChildren(emptyTableRow(4, '暂无食物记录', '先在上方添加一条食物热量，列表会自动刷新。'));
      return;
    }

    const rows: HTMLTableRowElement[] = foods.map((food) => {
      const row = el('tr') as HTMLTableRowElement;
      const c1 = el('td');
      c1.append(el('div', { text: food.name }));
      if (food.calories >= 600) {
        c1.appendChild(el('span', { className: 'tag-hot', text: 'high kcal' }));
      }
      const c2 = el('td', { className: 'cell-kcal', text: formatKcal(food.calories) });
      const c3 = el('td', { className: 'subtle', text: formatDate(food.updatedAt || food.createdAt) });
      const c4 = el('td');

      const actions = el('div', { className: 'row-actions' });
      const editBtn = el('button', { className: 'btn btn-ghost btn-sm', text: '修改', attrs: { type: 'button' } });
      const delBtn = el('button', { className: 'btn btn-danger btn-sm', text: '删除', attrs: { type: 'button' } });
      actions.append(editBtn, delBtn);
      c4.appendChild(actions);

      editBtn.addEventListener('click', async () => {
        const next = window.prompt(`为「${food.name}」输入新的 kcal：`, `${food.calories}`);
        if (next === null) return;
        const value = Number(next);
        if (!Number.isFinite(value) || value < 0) {
          toast('kcal 必须是非负数字。', 'error');
          return;
        }
        editBtn.setAttribute('disabled', 'true');
        try {
          await request(`/food/${food._id}`, { method: 'PATCH', body: JSON.stringify({ calories: value }) });
          toast('已更新热量。', 'success');
          await loadFoods();
        } catch (error) {
          toast(getErrorMessage(error), 'error');
        } finally {
          editBtn.removeAttribute('disabled');
        }
      });

      delBtn.addEventListener('click', async () => {
        const ok = window.confirm(`确定删除「${food.name}」？此操作不可恢复。`);
        if (!ok) return;
        delBtn.setAttribute('disabled', 'true');
        try {
          await request(`/food/${food._id}`, { method: 'DELETE' });
          toast('已删除记录。', 'success');
          await loadFoods();
        } catch (error) {
          toast(getErrorMessage(error), 'error');
        } finally {
          delBtn.removeAttribute('disabled');
        }
      });

      row.append(c1, c2, c3, c4);
      return row;
    });

    tbody.replaceChildren(...rows);
  };

  const loadFoods = async () => {
    foodsState.loading = true;
    renderFoods();
    const params = new URLSearchParams();
    if (keywordState.keyword) params.set('keyword', keywordState.keyword);
    const url = params.toString() ? `/foods?${params.toString()}` : '/foods';
    try {
      const result = await request<FoodRecord[]>(url);
      foodsState.foods = result.data || [];
      foodsState.loading = false;
      renderFoods();
    } catch (error) {
      foodsState.foods = [];
      foodsState.loading = false;
      renderFoods();
      toast(getErrorMessage(error), 'error');
    }
  };

  searchBtn.addEventListener('click', async () => {
    keywordState.keyword = searchInput.value.trim();
    await loadFoods();
  });
  searchInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      keywordState.keyword = searchInput.value.trim();
      await loadFoods();
    }
  });

  createForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    createBtn.setAttribute('disabled', 'true');
    createBtn.textContent = '正在添加…';
    try {
      const name = nameInput.value.trim();
      const calories = kcalInput.value.trim();
      const payload: { name: string; calories?: number } = { name };
      if (calories) payload.calories = Number(calories);
      await request('/food', { method: 'POST', body: JSON.stringify(payload) });
      nameInput.value = '';
      kcalInput.value = '';
      toast('已新增记录。', 'success');
      await loadFoods();
    } catch (error) {
      toast(getErrorMessage(error), 'error');
    } finally {
      createBtn.removeAttribute('disabled');
      createBtn.textContent = '添加到列表';
    }
  });

  leftCol.append(createCard, listCard);
  layout.append(leftCol, rightCol);
  page.appendChild(layout);

  const wrapper = el('div');
  wrapper.append(topbar, page);
  void loadFoods();
  return wrapper;
};

const renderAdminPage = (user: SafeUser) => {
  document.title = '管理员｜用户管理';

  if (user.role !== 'admin') {
    const topbar = renderTopbar({ leftHref: '/app', leftLabel: '热量管理', right: userPill(user) });
    const page = el('main', { className: 'container page' });
    const card = el('section', { className: 'card' });
    const inner = el('div', { className: 'card-inner' });
    inner.append(el('div', { className: 'kicker', text: '403' }), el('h2', { className: 'h2', text: '无权限访问管理员页' }), el('p', { className: 'p', text: '当前账号不是管理员。' }));
    const back = el('button', { className: 'btn btn-primary', text: '返回我的记录', attrs: { type: 'button' } });
    back.addEventListener('click', () => navigate('/app'));
    inner.appendChild(back);
    card.appendChild(inner);
    page.appendChild(card);
    const wrap = el('div');
    wrap.append(topbar, page);
    return wrap;
  }

  const right = el('div', { className: 'pill' });
  right.appendChild(userPill(user));
  const backBtn = el('button', { className: 'btn btn-ghost btn-sm', text: '返回', attrs: { type: 'button' } });
  backBtn.addEventListener('click', () => navigate('/app'));
  right.appendChild(backBtn);
  const logoutBtn = el('button', { className: 'btn btn-danger btn-sm', text: '退出', attrs: { type: 'button' } });
  logoutBtn.addEventListener('click', () => {
    clearSession();
    toast('已退出登录。', 'info');
    navigate('/login', true);
  });
  right.appendChild(logoutBtn);

  const topbar = renderTopbar({ leftHref: '/admin', leftLabel: '用户管理', right });

  const page = el('main', { className: 'container page' });
  const layout = el('div', { className: 'layout' });
  const leftCol = el('div', { className: 'col-8 stack' });
  const rightCol = el('div', { className: 'col-4 stack' });

  const usersState: { loading: boolean; users: SafeUser[]; selectedId: string | null } = {
    loading: true,
    users: [],
    selectedId: null
  };

  const adminSummaryCard = el('section', { className: 'card' });
  const adminSummaryInner = el('div', { className: 'card-inner' });
  const adminSummaryTitle = el('div', { className: 'card-title' });
  adminSummaryTitle.append(el('div', { className: 'kicker', text: '系统概览' }), el('h2', { className: 'h2', text: '账号结构' }), el('p', { className: 'p', text: '统计来自当前用户列表。' }));
  const totalUserRow = el('div', { className: 'metric-row' });
  const adminUserRow = el('div', { className: 'metric-row' });
  const normalUserRow = el('div', { className: 'metric-row' });
  const totalUserCount = el('strong', { text: '—' });
  const adminUserCount = el('strong', { text: '—' });
  const normalUserCount = el('strong', { text: '—' });
  totalUserRow.append(el('div', { className: 'muted', text: '总账号' }), totalUserCount);
  adminUserRow.append(el('div', { className: 'muted', text: '管理员' }), adminUserCount);
  normalUserRow.append(el('div', { className: 'muted', text: '普通用户' }), normalUserCount);
  adminSummaryInner.append(adminSummaryTitle, totalUserRow, adminUserRow, normalUserRow);
  adminSummaryCard.appendChild(adminSummaryInner);

  const userListCard = el('section', { className: 'card' });
  const userListInner = el('div', { className: 'card-inner' });
  const userListTitle = el('div', { className: 'card-title' });
  userListTitle.append(el('div', { className: 'kicker', text: '用户列表' }), el('h2', { className: 'h2', text: '账号管理' }), el('p', { className: 'p', text: '点击一行查看详情、更新角色或重置密码。' }));
  const filterBox = el('div', { className: 'search' });
  const filterInput = el('input', { className: 'input', attrs: { type: 'text', placeholder: '按 username / email 过滤…' } });
  const refreshBtn = el('button', { className: 'btn btn-primary', text: '刷新', attrs: { type: 'button' } });
  filterBox.append(filterInput, refreshBtn);
  const listShell = el('div', { className: 'table-shell' });
  const table = el('table');
  const thead = el('thead');
  const headRow = el('tr');
  ['username', 'email', 'role', 'created'].forEach((t) => headRow.appendChild(el('th', { text: t })));
  thead.appendChild(headRow);
  const tbody = el('tbody');
  table.append(thead, tbody);
  listShell.appendChild(table);
  userListInner.append(userListTitle, filterBox, listShell);
  userListCard.appendChild(userListInner);

  const detailCard = el('section', { className: 'card' });
  const detailInner = el('div', { className: 'card-inner' });
  detailCard.appendChild(detailInner);

  const updateAdminSummary = () => {
    const admins = usersState.users.filter((u) => u.role === 'admin').length;
    totalUserCount.textContent = `${usersState.users.length}`;
    adminUserCount.textContent = `${admins}`;
    normalUserCount.textContent = `${Math.max(usersState.users.length - admins, 0)}`;
  };

  const renderUsers = () => {
    if (usersState.loading) {
      tbody.replaceChildren(...skeletonTableRows(4, 4));
      return;
    }
    updateAdminSummary();
    const keyword = filterInput.value.trim().toLowerCase();
    const users = keyword
      ? usersState.users.filter((u) => (u.username || '').toLowerCase().includes(keyword) || (u.email || '').toLowerCase().includes(keyword))
      : usersState.users;

    if (!users.length) {
      tbody.replaceChildren(emptyTableRow(4, '没有匹配用户', '换一个 username 或 email 关键词再试。'));
      return;
    }

    const rows = users.map((u) => {
      const row = el('tr') as HTMLTableRowElement;
      row.style.cursor = 'pointer';
      if (usersState.selectedId === u._id) {
        row.style.background = 'rgba(111, 132, 111, 0.11)';
      }
      row.append(
        el('td', { text: u.username }),
        el('td', { className: 'subtle', text: u.email }),
        el('td', { text: u.role }),
        el('td', { className: 'subtle', text: formatDate(u.createdAt) })
      );
      row.addEventListener('click', async () => {
        usersState.selectedId = u._id;
        renderUsers();
        await loadUserDetail(u._id);
      });
      return row;
    });
    tbody.replaceChildren(...rows);
  };

  const renderDetail = (payload: { user: SafeUser | null; loading: boolean; error: string | null }) => {
    detailInner.replaceChildren();
    if (payload.loading) {
      detailInner.append(el('div', { className: 'kicker', text: '详情' }), el('div', { className: 'skeleton' }), el('div', { className: 'skeleton' }));
      return;
    }
    if (payload.error) {
      detailInner.append(el('div', { className: 'kicker', text: '错误' }), el('p', { className: 'p', text: payload.error }));
      return;
    }
    if (!payload.user) {
      const state = el('div', { className: 'empty-state' });
      state.append(el('strong', { text: '选择一个账号' }), el('span', { text: '从左侧用户列表选择一行，详情与编辑表单会显示在这里。' }));
      detailInner.append(el('div', { className: 'kicker', text: '详情' }), state);
      return;
    }

    const u = payload.user;

    const title = el('div', { className: 'card-title' });
    title.append(el('div', { className: 'kicker', text: '用户详情' }), el('h2', { className: 'h2', text: u.username }), el('p', { className: 'p', text: u.email }));
    const meta = el('div', { className: 'metric-row' });
    meta.append(el('div', { className: 'muted', text: 'User ID' }), el('strong', { className: 'mono', text: u._id }));

    const form = el('form', { className: 'form' });
    const usernameLabel = el('label');
    usernameLabel.append(el('span', { className: 'muted', text: '用户名' }));
    const usernameInput = el('input', { className: 'input', attrs: { type: 'text', value: u.username, name: 'username' } });
    usernameLabel.appendChild(usernameInput);

    const emailLabel = el('label');
    emailLabel.append(el('span', { className: 'muted', text: '邮箱' }));
    const emailInput = el('input', { className: 'input', attrs: { type: 'email', value: u.email, name: 'email' } });
    emailLabel.appendChild(emailInput);

    const roleLabel = el('label');
    roleLabel.append(el('span', { className: 'muted', text: '角色' }));
    const roleSelect = el('select', { className: 'select', attrs: { name: 'role' } }) as HTMLSelectElement;
    const optUser = el('option', { text: 'user', attrs: { value: 'user' } }) as HTMLOptionElement;
    const optAdmin = el('option', { text: 'admin', attrs: { value: 'admin' } }) as HTMLOptionElement;
    roleSelect.append(optUser, optAdmin);
    roleSelect.value = u.role;
    roleLabel.appendChild(roleSelect);

    const passwordLabel = el('label');
    passwordLabel.append(el('span', { className: 'muted', text: '重置密码（可选）' }));
    const passwordInput = el('input', { className: 'input', attrs: { type: 'password', placeholder: '留空则不修改', name: 'password' } });
    passwordLabel.appendChild(passwordInput);

    const saveBtn = el('button', { className: 'btn btn-primary btn-block', text: '保存修改', attrs: { type: 'submit' } });
    form.append(usernameLabel, emailLabel, roleLabel, passwordLabel, saveBtn);

    const dz = el('div', { className: 'danger-zone' });
    dz.append(el('div', { className: 'kicker', text: '危险操作' }), el('p', { className: 'p', text: '删除用户将同步删除其所有食物记录，管理员不能删除自己。' }));
    const delBtn = el('button', { className: 'btn btn-danger btn-block', text: '删除用户', attrs: { type: 'button' } });
    if (u._id === user._id) {
      delBtn.setAttribute('disabled', 'true');
      delBtn.textContent = '管理员不能删除自己';
    }
    dz.appendChild(delBtn);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      saveBtn.setAttribute('disabled', 'true');
      saveBtn.textContent = '保存中…';
      try {
        const updates: Record<string, unknown> = {};
        const nextUsername = usernameInput.value.trim().toLowerCase();
        const nextEmail = emailInput.value.trim().toLowerCase();
        const nextRole = roleSelect.value;
        const nextPassword = passwordInput.value;
        if (nextUsername && nextUsername !== u.username) updates.username = nextUsername;
        if (nextEmail && nextEmail !== u.email) updates.email = nextEmail;
        if (nextRole && nextRole !== u.role) updates.role = nextRole;
        if (nextPassword.trim()) updates.password = nextPassword;
        if (!Object.keys(updates).length) {
          toast('没有需要保存的修改。', 'info');
          return;
        }
        const result = await request<SafeUser>(`/users/${u._id}`, { method: 'PATCH', body: JSON.stringify(updates) });
        const safe = result.data ? ({ ...result.data, role: toRole((result.data as any).role) } as SafeUser) : u;
        toast('用户已更新。', 'success');
        await loadUsers();
        await loadUserDetail(safe._id);
      } catch (error) {
        toast(getErrorMessage(error), 'error');
      } finally {
        saveBtn.removeAttribute('disabled');
        saveBtn.textContent = '保存修改';
      }
    });

    delBtn.addEventListener('click', async () => {
      if (u._id === user._id) return;
      const input = window.prompt('输入要删除的 username 以确认：', '');
      if (!input) return;
      if (input.trim().toLowerCase() !== u.username.toLowerCase()) {
        toast('确认失败：用户名不匹配。', 'error');
        return;
      }
      delBtn.setAttribute('disabled', 'true');
      try {
        await request(`/users/${u._id}`, { method: 'DELETE' });
        toast('用户已删除。', 'success');
        usersState.selectedId = null;
        await loadUsers();
        renderDetail({ user: null, loading: false, error: null });
      } catch (error) {
        toast(getErrorMessage(error), 'error');
      } finally {
        delBtn.removeAttribute('disabled');
      }
    });

    detailInner.append(title, meta, form, dz);
  };

  const detailState: { loading: boolean; user: SafeUser | null; error: string | null } = {
    loading: false,
    user: null,
    error: null
  };

  const loadUsers = async () => {
    usersState.loading = true;
    renderUsers();
    try {
      const result = await request<SafeUser[]>('/users');
      usersState.users = (result.data || []).map((u) => ({ ...u, role: toRole(u.role) }));
      usersState.loading = false;
      renderUsers();
    } catch (error) {
      usersState.users = [];
      usersState.loading = false;
      renderUsers();
      toast(getErrorMessage(error), 'error');
    }
  };

  const loadUserDetail = async (id: string) => {
    detailState.loading = true;
    detailState.error = null;
    renderDetail(detailState);
    try {
      const result = await request<SafeUser>(`/users/${id}`);
      if (!result.data) {
        throw new Error('用户详情为空。');
      }
      detailState.user = { ...result.data, role: toRole(result.data.role) };
      detailState.loading = false;
      renderDetail(detailState);
    } catch (error) {
      detailState.user = null;
      detailState.loading = false;
      detailState.error = getErrorMessage(error);
      renderDetail(detailState);
    }
  };

  refreshBtn.addEventListener('click', async () => {
    refreshBtn.setAttribute('disabled', 'true');
    try {
      await loadUsers();
    } finally {
      refreshBtn.removeAttribute('disabled');
    }
  });
  filterInput.addEventListener('input', () => renderUsers());

  leftCol.appendChild(userListCard);
  rightCol.append(adminSummaryCard, detailCard);
  layout.append(leftCol, rightCol);
  page.appendChild(layout);

  const wrapper = el('div');
  wrapper.append(topbar, page);

  renderUsers();
  renderDetail({ user: null, loading: false, error: null });
  void loadUsers();
  return wrapper;
};

const renderRoute = async () => {
  const path = window.location.pathname;
  const authed = await ensureAuthed();

  if (path === '/' || path === '') {
    if (authed) {
      navigate('/app', true);
      return;
    }
    navigate('/login', true);
    return;
  }

  if (path === '/login') {
    if (authed) {
      navigate('/app', true);
      return;
    }
    setChildren(root, [renderLoginPage()]);
    return;
  }

  if (path === '/app') {
    if (!authed) {
      navigate('/login', true);
      return;
    }
    setChildren(root, [renderAppPage(authed)]);
    return;
  }

  if (path === '/admin') {
    if (!authed) {
      navigate('/login', true);
      return;
    }
    setChildren(root, [renderAdminPage(authed)]);
    return;
  }

  navigate('/login', true);
};

window.addEventListener('popstate', () => {
  void renderRoute();
});

void renderRoute();
