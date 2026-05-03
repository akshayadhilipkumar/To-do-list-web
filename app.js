/**
 * Simple To-Do List App
 * ---------------------
 * - Saves tasks to localStorage (key: "todo-app-tasks")
 * - Dark mode preference: "todo-app-theme"
 * Beginner tips: read from top to bottom; each section has a short comment.
 */

(function () {
  "use strict";

  // --- DOM elements we need ---
  const taskInput = document.getElementById("taskInput");
  const addForm = document.getElementById("addForm");
  const taskList = document.getElementById("taskList");
  const emptyState = document.getElementById("emptyState");
  const totalCountEl = document.getElementById("totalCount");
  const completedCountEl = document.getElementById("completedCount");
  const filterButtons = document.querySelectorAll(".filters__btn");
  const clearAllBtn = document.getElementById("clearAllBtn");
  const themeToggle = document.getElementById("themeToggle");

  // localStorage keys (change here if you want different keys)
  const STORAGE_KEY = "todo-app-tasks";
  const THEME_KEY = "todo-app-theme";

  /** Current filter: "all" | "pending" | "completed" */
  let currentFilter = "all";

  /** @type {{ id: string, text: string, completed: boolean, createdAt: string }[]} */
  let tasks = [];

  // ========== Theme (dark / light) ==========

  function applyTheme(isDark) {
    document.documentElement.classList.toggle("dark", isDark);
    try {
      localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
    } catch (e) {
      // localStorage might be disabled in some browsers / private mode
      console.warn("Could not save theme preference", e);
    }
  }

  function loadTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "dark" || saved === "light") {
        applyTheme(saved === "dark");
        return;
      }
    } catch (e) {
      /* ignore */
    }
    // No saved preference: follow system
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(prefersDark);
  }

  function toggleTheme() {
    const isDark = !document.documentElement.classList.contains("dark");
    applyTheme(isDark);
  }

  // ========== Persistence ==========

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
      console.warn("Could not save tasks", e);
    }
  }

  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        tasks = [];
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        tasks = [];
        return;
      }
      // Basic validation so broken data doesn't crash the app
      tasks = parsed.filter(
        (t) =>
          t &&
          typeof t.id === "string" &&
          typeof t.text === "string" &&
          typeof t.completed === "boolean"
      );
    } catch (e) {
      console.warn("Could not load tasks", e);
      tasks = [];
    }
  }

  // ========== Helpers ==========

  /** Create a unique id (good enough for this app; not for cryptography) */
  function makeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }

  /** Format ISO date string for display (locale + short time) */
  function formatDateTime(isoString) {
    try {
      const d = new Date(isoString);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  function getTaskById(id) {
    return tasks.find((t) => t.id === id);
  }

  // ========== Stats & empty state ==========

  function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.completed).length;
    totalCountEl.textContent = String(total);
    completedCountEl.textContent = String(completed);
  }

  function updateEmptyState() {
    const visible = taskList.querySelectorAll(".task-item:not(.task-item--hidden)");
    emptyState.hidden = visible.length > 0;
  }

  // ========== Filter UI ==========

  function setFilter(filter) {
    currentFilter = filter;
    filterButtons.forEach((btn) => {
      const isActive = btn.dataset.filter === filter;
      btn.classList.toggle("filters__btn--active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    applyFilterToDom();
    updateEmptyState();
  }

  /** Show/hide list items based on currentFilter (does not remove from tasks array) */
  function applyFilterToDom() {
    const items = taskList.querySelectorAll(".task-item");
    items.forEach((li) => {
      const id = li.dataset.id;
      const task = getTaskById(id);
      if (!task) return;
      let show = true;
      if (currentFilter === "completed") show = task.completed;
      else if (currentFilter === "pending") show = !task.completed;
      li.classList.toggle("task-item--hidden", !show);
    });
  }

  // ========== Render one task row ==========

  function createTaskElement(task) {
    const li = document.createElement("li");
    li.className = "task-item" + (task.completed ? " task-item--done" : "");
    li.dataset.id = task.id;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-item__check";
    checkbox.checked = task.completed;
    checkbox.setAttribute("aria-label", "Mark as completed");
    checkbox.addEventListener("change", () => onToggleComplete(task.id, checkbox.checked));

    const body = document.createElement("div");
    body.className = "task-item__body";

    const textEl = document.createElement("p");
    textEl.className = "task-item__text";
    textEl.textContent = task.text;
    textEl.setAttribute("title", "Double-click or use Edit to change text");

    const meta = document.createElement("span");
    meta.className = "task-item__meta";
    meta.textContent = task.createdAt ? formatDateTime(task.createdAt) : "";

    body.appendChild(textEl);
    body.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "task-item__actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "task-item__btn task-item__btn--edit";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => startEdit(textEl, task.id));

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "task-item__btn task-item__btn--delete";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => removeTask(task.id));

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    li.appendChild(checkbox);
    li.appendChild(body);
    li.appendChild(actions);

    // Double-click paragraph to edit inline (optional UX)
    textEl.addEventListener("dblclick", () => startEdit(textEl, task.id));

    return li;
  }

  function renderAllTasks() {
    taskList.innerHTML = "";
    tasks.forEach((task) => {
      taskList.appendChild(createTaskElement(task));
    });
    applyFilterToDom();
    updateStats();
    updateEmptyState();
  }

  // ========== Add / edit / delete ==========

  function addTask(text) {
    const trimmed = text.trim();
    if (!trimmed) return;

    const task = {
      id: makeId(),
      text: trimmed,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    tasks.unshift(task); // newest first
    saveTasks();

    const li = createTaskElement(task);
    taskList.prepend(li);
    applyFilterToDom();
    updateStats();
    updateEmptyState();
    taskInput.value = "";
    taskInput.focus();
  }

  function onToggleComplete(id, completed) {
    const task = getTaskById(id);
    if (!task) return;
    task.completed = completed;
    saveTasks();

    // IDs from makeId() are alphanumeric — safe inside attribute selector
    const li = taskList.querySelector(`[data-id="${id}"]`);
    if (li) {
      li.classList.toggle("task-item--done", completed);
      applyFilterToDom();
    }
    updateStats();
    updateEmptyState();
  }

  /** Turn the text into an editable field; save on blur or Enter */
  function startEdit(textEl, taskId) {
    const task = getTaskById(taskId);
    if (!task) return;

    textEl.contentEditable = "true";
    textEl.focus();

    // Select all text for quick replace
    const range = document.createRange();
    range.selectNodeContents(textEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    function cleanup() {
      textEl.removeEventListener("blur", onBlur);
      textEl.removeEventListener("keydown", onKeyDown);
    }

    function finishEdit() {
      cleanup();
      textEl.contentEditable = "false";
      const newText = textEl.textContent.trim();
      if (!newText) {
        // Empty after edit → delete task
        removeTask(taskId);
        return;
      }
      task.text = newText;
      saveTasks();
    }

    function onKeyDown(e) {
      if (e.key === "Enter") {
        e.preventDefault();
        textEl.blur();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        textEl.textContent = task.text;
        textEl.contentEditable = "false";
        cleanup();
      }
    }

    function onBlur() {
      finishEdit();
    }

    textEl.addEventListener("keydown", onKeyDown);
    textEl.addEventListener("blur", onBlur);
  }

  /** Remove task with a short exit animation */
  function removeTask(id) {
    // IDs from makeId() are alphanumeric — safe inside attribute selector
    const li = taskList.querySelector(`[data-id="${id}"]`);
    if (!li) {
      tasks = tasks.filter((t) => t.id !== id);
      saveTasks();
      updateStats();
      updateEmptyState();
      return;
    }

    li.classList.add("task-item--exiting");
    li.addEventListener(
      "animationend",
      () => {
        tasks = tasks.filter((t) => t.id !== id);
        saveTasks();
        li.remove();
        updateStats();
        updateEmptyState();
      },
      { once: true }
    );
  }

  function clearAllTasks() {
    if (tasks.length === 0) return;
    const ok = window.confirm("Delete all tasks? This cannot be undone.");
    if (!ok) return;
    tasks = [];
    saveTasks();
    renderAllTasks();
  }

  // ========== Event wiring ==========

  addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    addTask(taskInput.value);
  });

  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => setFilter(btn.dataset.filter));
  });

  clearAllBtn.addEventListener("click", clearAllTasks);
  themeToggle.addEventListener("click", toggleTheme);

  // ========== Boot ==========
  loadTheme();
  loadTasks();
  renderAllTasks();
})();
