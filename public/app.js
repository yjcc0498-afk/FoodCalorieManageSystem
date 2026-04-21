const TOKEN_STORAGE_KEY = 'food-calorie-token';

const authView = document.getElementById('authView');
const appView = document.getElementById('appView');
const showLoginButton = document.getElementById('showLoginButton');
const showRegisterButton = document.getElementById('showRegisterButton');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const authStatusBox = document.getElementById('authStatusBox');
const logoutButton = document.getElementById('logoutButton');
const currentUsername = document.getElementById('currentUsername');
const currentUserEmail = document.getElementById('currentUserEmail');
const currentUserRole = document.getElementById('currentUserRole');
const adminPanel = document.getElementById('adminPanel');
const refreshUsersButton = document.getElementById('refreshUsersButton');
const userTableBody = document.getElementById('userTableBody');

const foodForm = document.getElementById('foodForm');
const refreshButton = document.getElementById('refreshButton');
const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const clearSearchButton = document.getElementById('clearSearchButton');
const statusBox = document.getElementById('statusBox');
const foodTableBody = document.getElementById('foodTableBody');
const foodCount = document.getElementById('foodCount');
const calorieTotal = document.getElementById('calorieTotal');
const calorieAverage = document.getElementById('calorieAverage');
const foodRowTemplate = document.getElementById('foodRowTemplate');

const listState = {
  keyword: ''
};

let authToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
let currentUser = null;

const setStatusBox = (element, message, type = 'idle') => {
  element.textContent = message;
  element.className = `status-box status-${type}`;
};

const setStatus = (message, type = 'idle') => {
  setStatusBox(statusBox, message, type);
};

const setAuthStatus = (message, type = 'idle') => {
  setStatusBox(authStatusBox, message, type);
};

const setLoadingState = (button, loading, loadingText, idleText) => {
  if (!button) {
    return;
  }

  button.disabled = loading;
  button.textContent = loading ? loadingText : idleText;
};

const formatDate = (value) => {
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

const setAuthMode = (mode) => {
  const isLoginMode = mode === 'login';

  loginForm.classList.toggle('hidden', !isLoginMode);
  registerForm.classList.toggle('hidden', isLoginMode);
  showLoginButton.classList.toggle('active', isLoginMode);
  showRegisterButton.classList.toggle('active', !isLoginMode);
  setAuthStatus(isLoginMode ? 'Please login to continue.' : 'Create a new account to continue.', 'idle');
};

const saveSession = ({ token, safeUser }) => {
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

const renderStats = (foods) => {
  const totalFoods = foods.length;
  const totalCalories = foods.reduce((sum, food) => sum + Number(food.calories || 0), 0);
  const averageCalories = totalFoods ? Math.round(totalCalories / totalFoods) : 0;

  foodCount.textContent = totalFoods;
  calorieTotal.textContent = totalCalories;
  calorieAverage.textContent = averageCalories;
};

const renderFoods = (foods) => {
  renderStats(foods);

  if (!foods.length) {
    foodTableBody.innerHTML = '<tr><td colspan="5" class="table-empty">No foods saved yet. Create your first record above.</td></tr>';
    return;
  }

  foodTableBody.innerHTML = '';

  foods.forEach((food) => {
    const row = foodRowTemplate.content.firstElementChild.cloneNode(true);
    row.dataset.id = food._id;

    row.querySelector('[data-cell="name"]').textContent = food.name;
    row.querySelector('[data-cell="calories"]').textContent = String(food.calories);
    row.querySelector('[data-cell="id"]').textContent = food._id;
    row.querySelector('[data-cell="createdAt"]').textContent = formatDate(food.createdAt);

    const updateForm = row.querySelector('.inline-update-form');
    const deleteButton = row.querySelector('.delete-button');

    updateForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(updateForm);
      const calories = formData.get('calories');
      const submitButton = updateForm.querySelector('button[type="submit"]');

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

const renderUsers = (users) => {
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

const request = async (url, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

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
    const result = await request(url);
    renderFoods(result.data || []);
    if (listState.keyword) {
      setStatus(`Found ${result.count || 0} food record(s) for keyword "${listState.keyword}".`, 'success');
    } else {
      setStatus(`Loaded ${result.count || 0} private food record(s).`, 'success');
    }
  } catch (error) {
    renderFoods([]);
    setStatus(error.message, 'error');
  }
};

const loadUsersIfAdmin = async () => {
  if (!currentUser || currentUser.role !== 'admin') {
    return;
  }

  userTableBody.innerHTML = '<tr><td colspan="5" class="table-empty">Loading users...</td></tr>';

  try {
    const result = await request('/users');
    renderUsers(result.data || []);
  } catch (error) {
    userTableBody.innerHTML = `<tr><td colspan="5" class="table-empty">${error.message}</td></tr>`;
  }
};

const createFood = async (payload) => {
  const result = await request('/food', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  setStatus(`Created "${result.data.name}" successfully.`, 'success');
  await loadFoods();
};

const updateFood = async (id, calories) => {
  const result = await request(`/food/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ calories: Number(calories) })
  });

  setStatus(`Updated calories for "${result.data.name}".`, 'success');
  await loadFoods();
};

const deleteFood = async (id) => {
  const result = await request(`/food/${id}`, {
    method: 'DELETE'
  });

  setStatus(`Deleted "${result.data.name}".`, 'success');
  await loadFoods();
};

const enterDashboard = async (session) => {
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
  const submitButton = loginForm.querySelector('button[type="submit"]');
  const formData = new FormData(loginForm);

  setLoadingState(submitButton, true, 'Logging in...', 'Login');
  setAuthStatus('Logging in with POST /auth/login ...', 'idle');

  try {
    const result = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: String(formData.get('identifier') || '').trim(),
        password: String(formData.get('password') || '')
      })
    });

    setAuthStatus('Login successful.', 'success');
    await enterDashboard(result);
    loginForm.reset();
  } catch (error) {
    setAuthStatus(error.message, 'error');
  } finally {
    setLoadingState(submitButton, false, 'Logging in...', 'Login');
  }
});

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = registerForm.querySelector('button[type="submit"]');
  const formData = new FormData(registerForm);

  setLoadingState(submitButton, true, 'Registering...', 'Register and Enter');
  setAuthStatus('Creating account with POST /auth/register ...', 'idle');

  try {
    const result = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: String(formData.get('username') || '').trim(),
        email: String(formData.get('email') || '').trim(),
        password: String(formData.get('password') || '')
      })
    });

    setAuthStatus('Registration successful.', 'success');
    await enterDashboard(result);
    registerForm.reset();
  } catch (error) {
    setAuthStatus(error.message, 'error');
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

  const submitButton = foodForm.querySelector('button[type="submit"]');
  const formData = new FormData(foodForm);
  const name = String(formData.get('name') || '').trim();
  const calories = formData.get('calories');
  const payload = { name };

  if (calories !== '') {
    payload.calories = Number(calories);
  }

  setLoadingState(submitButton, true, 'Saving...', 'Save Food');

  try {
    await createFood(payload);
    foodForm.reset();
  } catch (error) {
    setStatus(error.message, 'error');
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
