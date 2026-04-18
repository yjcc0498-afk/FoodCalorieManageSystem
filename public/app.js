// This file handles frontend interactions and talks to the backend CRUD API.
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

const setStatus = (message, type = 'idle') => {
  statusBox.textContent = message;
  statusBox.className = `status-box status-${type}`;
};

const formatDate = (value) => {
  if (!value) {
    return 'N/A';
  }

  return new Date(value).toLocaleString();
};

const setLoadingState = (button, loading, loadingText, idleText) => {
  if (!button) {
    return;
  }

  button.disabled = loading;
  button.textContent = loading ? loadingText : idleText;
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
      const confirmed = window.confirm(`Delete "${food.name}" from the database?`);

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

const request = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json'
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));

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
      setStatus(`Loaded ${result.count || 0} food record(s) from the backend successfully.`, 'success');
    }
  } catch (error) {
    renderFoods([]);
    setStatus(error.message, 'error');
  }
};

const createFood = async (payload) => {
  const result = await request('/food', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  setStatus(`Created "${result.data.name}" successfully through POST /food.`, 'success');
  await loadFoods();
};

const updateFood = async (id, calories) => {
  const result = await request(`/food/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ calories: Number(calories) })
  });

  setStatus(`Updated calories for "${result.data.name}" through PATCH /food/:id.`, 'success');
  await loadFoods();
};

const deleteFood = async (id) => {
  const result = await request(`/food/${id}`, {
    method: 'DELETE'
  });

  setStatus(`Deleted "${result.data.name}" through DELETE /food/:id.`, 'success');
  await loadFoods();
};

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

loadFoods();
