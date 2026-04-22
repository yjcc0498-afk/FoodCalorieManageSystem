const TOKEN_STORAGE_KEY = 'food-calorie-token';

type StatusType = 'idle' | 'success' | 'error';
type AuthMode = 'login' | 'register';

type SafeUser = {
  _id?: string;
  username?: string;
  email?: string;
  role?: 'user' | 'admin' | string;
  createdAt?: string;
};

type FoodRecord = {
  _id: string;
  name: string;
  calories: number;
  createdAt?: string;
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

type SessionPayload = {
  token: string;
  safeUser: SafeUser;
};

type FoodCreatePayload = {
  name: string;
  calories?: number;
};

const getElement = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Required DOM element #${id} was not found.`);
  }

  return element as T;
};

const getRequiredDescendant = <T extends Element>(parent: ParentNode, selector: string): T => {
  const element = parent.querySelector(selector);

  if (!element) {
    throw new Error(`Required DOM selector ${selector} was not found.`);
  }

  return element as T;
};

const authView = getElement<HTMLElement>('authView');
const appView = getElement<HTMLElement>('appView');
const showLoginButton = getElement<HTMLButtonElement>('showLoginButton');
const showRegisterButton = getElement<HTMLButtonElement>('showRegisterButton');
const loginForm = getElement<HTMLFormElement>('loginForm');
const registerForm = getElement<HTMLFormElement>('registerForm');
const authStatusBox = getElement<HTMLElement>('authStatusBox');
const logoutButton = getElement<HTMLButtonElement>('logoutButton');
const currentUsername = getElement<HTMLElement>('currentUsername');
const currentUserEmail = getElement<HTMLElement>('currentUserEmail');
const currentUserRole = getElement<HTMLElement>('currentUserRole');
const adminPanel = getElement<HTMLElement>('adminPanel');
const refreshUsersButton = getElement<HTMLButtonElement>('refreshUsersButton');
const userTableBody = getElement<HTMLTableSectionElement>('userTableBody');

const foodForm = getElement<HTMLFormElement>('foodForm');
const refreshButton = getElement<HTMLButtonElement>('refreshButton');
const searchForm = getElement<HTMLFormElement>('searchForm');
const searchInput = getElement<HTMLInputElement>('searchInput');
const clearSearchButton = getElement<HTMLButtonElement>('clearSearchButton');
const statusBox = getElement<HTMLElement>('statusBox');
const foodTableBody = getElement<HTMLTableSectionElement>('foodTableBody');
const foodCount = getElement<HTMLElement>('foodCount');
const calorieTotal = getElement<HTMLElement>('calorieTotal');
const calorieAverage = getElement<HTMLElement>('calorieAverage');
const foodRowTemplate = getElement<HTMLTemplateElement>('foodRowTemplate');

const listState = {
  keyword: ''
};

let authToken: string | null = window.localStorage.getItem(TOKEN_STORAGE_KEY);
let currentUser: SafeUser | null = null;

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

const setStatusBox = (element: HTMLElement, message: string, type: StatusType = 'idle') => {
  element.textContent = message;
  element.className = `status-box status-${type}`;
};

const setStatus = (message: string, type: StatusType = 'idle') => {
  setStatusBox(statusBox, message, type);
};

const setAuthStatus = (message: string, type: StatusType = 'idle') => {
  setStatusBox(authStatusBox, message, type);
};

const setLoadingState = (
  button: HTMLButtonElement | null,
  loading: boolean,
  loadingText: string,
  idleText: string
) => {
  if (!button) {
    return;
  }

  button.disabled = loading;
  button.textContent = loading ? loadingText : idleText;
};

const formatDate = (value?: string) => {
  if (!value) {
    return 'N/A';
  }

  return new Date(value).toLocaleString();
};

const showAuthView = () => {
  authView.classList.remove('hidden');
  appView.classList.add('hidden');
};

const showAppView = () => {
  authView.classList.add('hidden');
  appView.classList.remove('hidden');
};

const setAuthMode = (mode: AuthMode) => {
  const isLoginMode = mode === 'login';

  loginForm.classList.toggle('hidden', !isLoginMode);
  registerForm.classList.toggle('hidden', isLoginMode);
  showLoginButton.classList.toggle('active', isLoginMode);
  showRegisterButton.classList.toggle('active', !isLoginMode);
  setAuthStatus(isLoginMode ? 'Please login to continue.' : 'Create a new account to continue.', 'idle');
};

const saveSession = ({ token, safeUser }: SessionPayload) => {
  authToken = token;
  currentUser = safeUser;
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
};

const clearSession = () => {
  authToken = null;
  currentUser = null;
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
};

const renderCurrentUser = () => {
  if (!currentUser) {
    currentUsername.textContent = 'Not signed in';
    currentUserEmail.textContent = '';
    currentUserRole.textContent = '';
    return;
  }

  currentUsername.textContent = currentUser.username || 'Unknown user';
  currentUserEmail.textContent = currentUser.email || '';
  currentUserRole.textContent = `Role: ${currentUser.role || 'user'}`;
  adminPanel.classList.toggle('hidden', currentUser.role !== 'admin');
};

const renderStats = (foods: FoodRecord[]) => {
  const totalFoods = foods.length;
  const totalCalories = foods.reduce((sum, food) => sum + Number(food.calories || 0), 0);
  const averageCalories = totalFoods ? Math.round(totalCalories / totalFoods) : 0;

  foodCount.textContent = String(totalFoods);
  calorieTotal.textContent = String(totalCalories);
  calorieAverage.textContent = String(averageCalories);
};

const renderFoods = (foods: FoodRecord[]) => {
  renderStats(foods);

  if (!foods.length) {
    foodTableBody.innerHTML = '<tr><td colspan="5" class="table-empty">No foods saved yet. Create your first record above.</td></tr>';
    return;
  }

  foodTableBody.innerHTML = '';

  foods.forEach((food) => {
    const firstElement = foodRowTemplate.content.firstElementChild;

    if (!firstElement) {
      throw new Error('Food row template is empty.');
    }

    const row = firstElement.cloneNode(true) as HTMLTableRowElement;
    row.dataset.id = food._id;

    getRequiredDescendant<HTMLElement>(row, '[data-cell="name"]').textContent = food.name;
    getRequiredDescendant<HTMLElement>(row, '[data-cell="calories"]').textContent = String(food.calories);
    getRequiredDescendant<HTMLElement>(row, '[data-cell="id"]').textContent = food._id;
    getRequiredDescendant<HTMLElement>(row, '[data-cell="createdAt"]').textContent = formatDate(food.createdAt);

    const updateForm = getRequiredDescendant<HTMLFormElement>(row, '.inline-update-form');
    const deleteButton = getRequiredDescendant<HTMLButtonElement>(row, '.delete-button');

    updateForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(updateForm);
      const calories = formData.get('calories');
      const submitButton = updateForm.querySelector<HTMLButtonElement>('button[type="submit"]');

      setLoadingState(submitButton, true, 'Updating...', 'Update');

      try {
        await updateFood(food._id, calories);
        updateForm.reset();
      } finally {
        setLoadingState(submitButton, false, 'Updating...', 'Update');
      }
    });

    deleteButton.addEventListener('click', async () => {
      const confirmed = window.confirm(`Delete "${food.name}" from your account?`);

      if (!confirmed) {
        return;
      }

      setLoadingState(deleteButton, true, 'Deleting...', 'Delete');

      try {
        await deleteFood(food._id);
      } finally {
        setLoadingState(deleteButton, false, 'Deleting...', 'Delete');
      }
    });

    foodTableBody.appendChild(row);
  });
};

const renderUsers = (users: SafeUser[]) => {
  if (!users.length) {
    userTableBody.innerHTML = '<tr><td colspan="5" class="table-empty">No users found.</td></tr>';
    return;
  }

  userTableBody.innerHTML = '';

  users.forEach((user) => {
    const row = document.createElement('tr');
    const usernameCell = document.createElement('td');
    const emailCell = document.createElement('td');
    const roleCell = document.createElement('td');
    const idCell = document.createElement('td');
    const createdCell = document.createElement('td');

    usernameCell.textContent = user.username || '';
    emailCell.textContent = user.email || '';
    roleCell.textContent = user.role || 'user';
    idCell.textContent = user._id || '';
    idCell.className = 'mono small-text';
    createdCell.textContent = formatDate(user.createdAt);

    row.append(usernameCell, emailCell, roleCell, idCell, createdCell);
    userTableBody.appendChild(row);
  });
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

  const data = await response.json().catch(() => ({})) as ApiResponse<T>;

  if (response.status === 401 && authToken) {
    clearSession();
    showAuthView();
    setAuthStatus('Your session expired. Please login again.', 'error');
  }

  if (!response.ok) {
    const message = data.message || 'Request failed.';
    const detail = data.error ? ` ${data.error}` : '';
    throw new Error(`${message}${detail}`);
  }

  return data;
};

const buildFoodsUrl = () => {
  const params = new URLSearchParams();

  if (listState.keyword) {
    params.set('keyword', listState.keyword);
  }

  const queryString = params.toString();
  return queryString ? `/foods?${queryString}` : '/foods';
};

const loadFoods = async () => {
  const url = buildFoodsUrl();
  setStatus(`Loading foods from GET ${url} ...`, 'idle');

  try {
    const result = await request<FoodRecord[]>(url);
    renderFoods(result.data || []);
    if (listState.keyword) {
      setStatus(`Found ${result.count || 0} food record(s) for keyword "${listState.keyword}".`, 'success');
    } else {
      setStatus(`Loaded ${result.count || 0} private food record(s).`, 'success');
    }
  } catch (error) {
    renderFoods([]);
    setStatus(getErrorMessage(error), 'error');
  }
};

const loadUsersIfAdmin = async () => {
  if (!currentUser || currentUser.role !== 'admin') {
    return;
  }

  userTableBody.innerHTML = '<tr><td colspan="5" class="table-empty">Loading users...</td></tr>';

  try {
    const result = await request<SafeUser[]>('/users');
    renderUsers(result.data || []);
  } catch (error) {
    userTableBody.innerHTML = `<tr><td colspan="5" class="table-empty">${getErrorMessage(error)}</td></tr>`;
  }
};

const createFood = async (payload: FoodCreatePayload) => {
  const result = await request<FoodRecord>('/food', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (result.data) {
    setStatus(`Created "${result.data.name}" successfully.`, 'success');
  }

  await loadFoods();
};

const updateFood = async (id: string, calories: FormDataEntryValue | null) => {
  const result = await request<FoodRecord>(`/food/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ calories: Number(calories) })
  });

  if (result.data) {
    setStatus(`Updated calories for "${result.data.name}".`, 'success');
  }

  await loadFoods();
};

const deleteFood = async (id: string) => {
  const result = await request<FoodRecord>(`/food/${id}`, {
    method: 'DELETE'
  });

  if (result.data) {
    setStatus(`Deleted "${result.data.name}".`, 'success');
  }

  await loadFoods();
};

const enterDashboard = async (session: SessionPayload) => {
  saveSession(session);
  renderCurrentUser();
  showAppView();
  await loadFoods();
  await loadUsersIfAdmin();
};

const initializeAuthView = () => {
  if (authToken) {
    clearSession();
    setAuthStatus('Please login again to continue.', 'idle');
  } else {
    setAuthStatus('Please login or register to continue.', 'idle');
  }

  renderCurrentUser();
  adminPanel.classList.add('hidden');
  showAuthView();
};

showLoginButton.addEventListener('click', () => {
  setAuthMode('login');
});

showRegisterButton.addEventListener('click', () => {
  setAuthMode('register');
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = loginForm.querySelector<HTMLButtonElement>('button[type="submit"]');
  const formData = new FormData(loginForm);

  setLoadingState(submitButton, true, 'Logging in...', 'Login');
  setAuthStatus('Logging in with POST /auth/login ...', 'idle');

  try {
    const result = await request<unknown>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: String(formData.get('identifier') || '').trim(),
        password: String(formData.get('password') || '')
      })
    });

    if (!result.token || !result.safeUser) {
      throw new Error('Login response did not include a session.');
    }

    setAuthStatus('Login successful.', 'success');
    await enterDashboard({
      token: result.token,
      safeUser: result.safeUser
    });
    loginForm.reset();
  } catch (error) {
    setAuthStatus(getErrorMessage(error), 'error');
  } finally {
    setLoadingState(submitButton, false, 'Logging in...', 'Login');
  }
});

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = registerForm.querySelector<HTMLButtonElement>('button[type="submit"]');
  const formData = new FormData(registerForm);

  setLoadingState(submitButton, true, 'Registering...', 'Register and Enter');
  setAuthStatus('Creating account with POST /auth/register ...', 'idle');

  try {
    const result = await request<unknown>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: String(formData.get('username') || '').trim(),
        email: String(formData.get('email') || '').trim(),
        password: String(formData.get('password') || '')
      })
    });

    if (!result.token || !result.safeUser) {
      throw new Error('Registration response did not include a session.');
    }

    setAuthStatus('Registration successful.', 'success');
    await enterDashboard({
      token: result.token,
      safeUser: result.safeUser
    });
    registerForm.reset();
  } catch (error) {
    setAuthStatus(getErrorMessage(error), 'error');
  } finally {
    setLoadingState(submitButton, false, 'Registering...', 'Register and Enter');
  }
});

logoutButton.addEventListener('click', () => {
  clearSession();
  renderFoods([]);
  renderCurrentUser();
  adminPanel.classList.add('hidden');
  showAuthView();
  setAuthStatus('You have logged out.', 'idle');
});

refreshUsersButton.addEventListener('click', async () => {
  setLoadingState(refreshUsersButton, true, 'Refreshing...', 'Refresh Users');

  try {
    await loadUsersIfAdmin();
  } finally {
    setLoadingState(refreshUsersButton, false, 'Refreshing...', 'Refresh Users');
  }
});

foodForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const submitButton = foodForm.querySelector<HTMLButtonElement>('button[type="submit"]');
  const formData = new FormData(foodForm);
  const name = String(formData.get('name') || '').trim();
  const calories = formData.get('calories');
  const payload: FoodCreatePayload = { name };

  if (calories !== '') {
    payload.calories = Number(calories);
  }

  setLoadingState(submitButton, true, 'Saving...', 'Save Food');

  try {
    await createFood(payload);
    foodForm.reset();
  } catch (error) {
    setStatus(getErrorMessage(error), 'error');
  } finally {
    setLoadingState(submitButton, false, 'Saving...', 'Save Food');
  }
});

refreshButton.addEventListener('click', async () => {
  setLoadingState(refreshButton, true, 'Refreshing...', 'Refresh Data');

  try {
    await loadFoods();
  } finally {
    setLoadingState(refreshButton, false, 'Refreshing...', 'Refresh Data');
  }
});

searchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  listState.keyword = searchInput.value.trim();
  await loadFoods();
});

clearSearchButton.addEventListener('click', async () => {
  searchInput.value = '';
  listState.keyword = '';
  await loadFoods();
});

initializeAuthView();
