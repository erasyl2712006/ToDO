
const taskForm = document.getElementById('taskForm');
const taskList = document.getElementById('tasksByDay');
const statusFilter = document.getElementById('statusFilter');
const tagFilter = document.getElementById('tagFilter');
const dateFilter = document.getElementById('dateFilter');
const exportBtn = document.getElementById('exportBtn');
const importInput = document.getElementById('importInput');
const todayBtn = document.getElementById('todayBtn');
const sortToggle = document.getElementById('sortToggle');

let tasks = [];
let reminders = new Map();
let isSortEnabled = true;


function loadTasks() {
  const stored = localStorage.getItem('tasks');
  tasks = stored ? JSON.parse(stored) : [];
}

function saveTasks() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

function formatDate(dateStr, timeStr = '') {
  const date = new Date(dateStr + (timeStr ? 'T' + timeStr : ''));
  const options = { day: '2-digit', month: 'short', year: 'numeric' };
  const dateFormatted = date.toLocaleDateString('ru-RU', options);
  const timeFormatted = timeStr ? ` ${timeStr}` : '';
  return `${dateFormatted}${timeFormatted}`;
}

function getDaysLeft(dateStr) {
  const now = new Date();
  const due = new Date(dateStr);
  const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  if (diff < 0) return 'Просрочено';
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return '1 день';
  if (diff >= 2 && diff <= 4) return `${diff} дня`;
  return `${diff} дней`;
}

function isToday(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

function getFullDateKey(dateStr) {
  const date = new Date(dateStr);
  return date.toISOString().split('T')[0];
}

function getWeekDay(dateStr) {
  const days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  return days[new Date(dateStr).getDay()];
}

function renderTasks() {
  taskList.innerHTML = '';
  let filtered = tasks.filter(task => {
    const matchStatus = statusFilter.value === 'all' ||
      (statusFilter.value === 'completed' && task.completed) ||
      (statusFilter.value === 'pending' && !task.completed) ||
      statusFilter.value === task.status;

    const matchTags = tagFilter.value.trim() === '' || task.tags.some(tag => tag.includes(tagFilter.value.trim()));

    const diffDays = getDaysLeft(task.dueDate);
    const matchDate = dateFilter.value === 'all' ||
      (dateFilter.value === 'overdue' && diffDays === 'Просрочено') ||
      (dateFilter.value === 'upcoming' && diffDays !== 'Просрочено' && diffDays !== 'Сегодня') ||
      (dateFilter.value === 'today' && isToday(task.dueDate));

    return matchStatus && matchTags && matchDate;
  });

  if (isSortEnabled) {
    filtered.sort((a, b) => new Date(a.dueDate + 'T' + (a.time || '00:00')) - new Date(b.dueDate + 'T' + (b.time || '00:00')));
  }

  const grouped = {};
  filtered.forEach(task => {
    const fullKey = getFullDateKey(task.dueDate);
    if (!grouped[fullKey]) grouped[fullKey] = [];
    grouped[fullKey].push(task);
  });

  Object.entries(grouped).forEach(([dateKey, taskGroup]) => {
    const section = document.createElement('div');
    section.className = 'day-group';
    const weekDay = getWeekDay(dateKey);
    section.innerHTML = `<h3>${formatDate(dateKey)} (${weekDay})</h3>`;

    taskGroup.forEach(task => {
      const el = document.createElement('div');
      el.className = 'task' + (task.completed ? ' completed' : '');
      el.innerHTML = `
        <h4>${task.title}</h4>
        <p>${task.description}</p>
        <div class="tags">Теги: ${task.tags.join(', ')}</div>
        <div class="deadline">${formatDate(task.dueDate, task.time)} — ${getDaysLeft(task.dueDate)}</div>
        <div class="actions">
          <button onclick="toggleComplete(${task.id})">✔</button>
          <button onclick="editTask(${task.id})">✏</button>
          <button onclick="deleteTask(${task.id})">🗑</button>
        </div>
      `;
      section.appendChild(el);
    });

    taskList.appendChild(section);
  });
}


function addTask(e) {
  e.preventDefault();
  const title = taskForm.title.value.trim();
  const description = taskForm.description.value.trim();
  const dueDate = taskForm.date.value;
  const time = taskForm.time.value;
  const tags = taskForm.tags.value.split(',').map(t => t.trim()).filter(Boolean);
  const status = taskForm.status.value;

  if (!title || !dueDate || !status) return alert('Пожалуйста, заполните все обязательные поля.');

  const newTask = {
    id: Date.now(),
    title,
    description,
    dueDate,
    time,
    tags,
    completed: status === 'выполнено',
    status
  };

  tasks.push(newTask);
  scheduleReminder(newTask);
  saveTasks();
  renderTasks();
  taskForm.reset();
}

function editTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  const title = prompt('Новое название:', task.title);
  if (title === null) return;

  const description = prompt('Новое описание:', task.description);
  if (description === null) return;

  const dueDate = prompt('Новая дата (YYYY-MM-DD):', task.dueDate);
  if (!dueDate) return;

  const time = prompt('Новое время (HH:MM):', task.time);
  const tags = prompt('Новые теги через запятую:', task.tags.join(', '));
  const status = confirm('Задача выполнена?') ? 'выполнено' : 'ожидает';

  Object.assign(task, {
    title,
    description,
    dueDate,
    time,
    tags: tags.split(',').map(t => t.trim()),
    completed: status === 'выполнено',
    status
  });

  saveTasks();
  renderTasks();
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  if (reminders.has(id)) {
    clearTimeout(reminders.get(id));
    reminders.delete(id);
  }
  saveTasks();
  renderTasks();
}

function toggleComplete(id) {
  const task = tasks.find(t => t.id === id);
  if (task) {
    task.completed = !task.completed;
    task.status = task.completed ? 'выполнено' : 'ожидает';
  }
  saveTasks();
  renderTasks();
}

function scheduleReminder(task) {
  if (!task.time) return;
  const targetTime = new Date(task.dueDate + 'T' + task.time).getTime();
  const oneHourBefore = targetTime - 60 * 60 * 1000;
  const now = Date.now();
  if (oneHourBefore > now) {
    const timeoutId = setTimeout(() => {
      if (Notification.permission === 'granted') {
        new Notification(`Напоминание`, {
          body: `Задача "${task.title}" через 1 час.`
        });
      } else {
        alert(`Напоминание: задача "${task.title}" через 1 час!`);
      }
    }, oneHourBefore - now);
    reminders.set(task.id, timeoutId);
  }
}


function exportTasks() {
  const blob = new Blob([JSON.stringify(tasks)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tasks.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importTasks(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (Array.isArray(imported)) {
        tasks = imported;
        saveTasks();
        renderTasks();
        tasks.forEach(scheduleReminder);
      } else {
        alert('Файл не содержит задачи');
      }
    } catch {
      alert('Ошибка чтения файла');
    }
  };
  reader.readAsText(file);
}

function filterToday() {
  dateFilter.value = 'today';
  renderTasks();
}

function toggleSort() {
  isSortEnabled = !isSortEnabled;
  sortToggle.textContent = isSortEnabled ? 'Отключить сортировку по дате' : 'Включить сортировку по дате';
  renderTasks();
}

if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
  Notification.requestPermission();
}

loadTasks();
tasks.forEach(scheduleReminder);
renderTasks();
sortToggle.textContent = isSortEnabled ? 'Отключить сортировку по дате' : 'Включить сортировку по дате';

taskForm.addEventListener('submit', addTask);
statusFilter.addEventListener('change', renderTasks);
tagFilter.addEventListener('input', renderTasks);
dateFilter.addEventListener('change', renderTasks);
exportBtn.addEventListener('click', exportTasks);
importInput.addEventListener('change', importTasks);
todayBtn.addEventListener('click', filterToday);
sortToggle.addEventListener('click', toggleSort);