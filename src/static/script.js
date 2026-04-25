// script.js — Task Priority Manager (API-backed)
// All data operations now use fetch() against the Flask REST API.

const API_BASE = '';   // Same-origin: Flask serves both frontend & API

// Mathematical Constants for Priority Formula
const ALPHA = 2;
const W_U = 0.3;
const W_I = 0.4;
const W_S = 0.3;

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
function getUserId() {
    return localStorage.getItem('user_id');
}

function logout() {
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_email');
    window.location.href = '/login.html';
}

function requireAuth() {
    if (!getUserId()) {
        window.location.href = '/login.html';
        return false;
    }
    // Populate sidebar user info if element exists
    const userInfoEl = document.getElementById('userInfo');
    if (userInfoEl) {
        const name = localStorage.getItem('user_name') || '';
        const email = localStorage.getItem('user_email') || '';
        userInfoEl.innerHTML = `<i class="ph ph-user-circle"></i> <strong>${name}</strong><br><span style="font-size:0.75rem">${email}</span>`;
    }
    return true;
}

// ---------------------------------------------------------------------------
// Toast Notification System
// ---------------------------------------------------------------------------
function showToast(type, title, message, duration = 4000) {
    const container = document.getElementById('toastContainer');
    if (!container) { alert(message); return; }

    const icons = {
        success: 'ph-fill ph-check-circle',
        error: 'ph-fill ph-x-circle',
        warning: 'ph-fill ph-warning'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="toast-icon ${icons[type] || icons.warning}"></i>
        <div class="toast-body">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.classList.add('toast-removing'); setTimeout(() => this.parentElement.remove(), 300)">
            <i class="ph ph-x"></i>
        </button>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('toast-removing');
            setTimeout(() => toast.remove(), 300);
        }
    }, duration);
}

// Helper to format deadline for display
function formatDeadline(deadlineStr) {
    if (!deadlineStr) return 'N/A';
    // If it's the old YYYY-MM-DD format, or the new YYYY-MM-DDTHH:MM
    const date = new Date(deadlineStr);
    if (isNaN(date.getTime())) return deadlineStr;

    const options = { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    };
    return date.toLocaleDateString('en-US', options);
}

// Helper to format deadline for datetime-local input (YYYY-MM-DDTHH:MM)
function formatDateForInput(deadlineStr) {
    if (!deadlineStr) return '';
    const date = new Date(deadlineStr);
    if (isNaN(date.getTime())) return '';
    
    const pad = (num) => String(num).padStart(2, '0');
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    return `${y}-${m}-${d}T${hh}:${mm}`;
}

// ---------------------------------------------------------------------------
// Form Validation Helpers
// ---------------------------------------------------------------------------
function showFieldError(fieldId, errorId, msg) {
    const field = document.getElementById(fieldId);
    const errEl = document.getElementById(errorId);
    if (field) field.classList.add('is-invalid');
    if (errEl) {
        errEl.querySelector('span').textContent = msg;
        errEl.classList.add('visible');
    }
}

function clearFieldError(fieldId, errorId) {
    const field = document.getElementById(fieldId);
    const errEl = document.getElementById(errorId);
    if (field) field.classList.remove('is-invalid');
    if (errEl) errEl.classList.remove('visible');
}

function clearAllFieldErrors() {
    clearFieldError('taskName', 'taskNameError');
    clearFieldError('taskDate', 'taskDateError');
}

function validateTaskForm() {
    clearAllFieldErrors();
    let valid = true;

    const title = (document.getElementById('taskName')?.value || '').trim();
    if (!title) {
        showFieldError('taskName', 'taskNameError', 'Task name is required.');
        valid = false;
    } else if (title.length < 3) {
        showFieldError('taskName', 'taskNameError', 'Task name must be at least 3 characters.');
        valid = false;
    } else if (title.length > 200) {
        showFieldError('taskName', 'taskNameError', 'Task name must be at most 200 characters.');
        valid = false;
    }

    const deadline = document.getElementById('taskDate')?.value || '';
    if (!deadline) {
        showFieldError('taskDate', 'taskDateError', 'Please select a deadline date.');
        valid = false;
    }

    return valid;
}

/**
 * Premium Confirmation Modal (Custom UI Replacement for confirm())
 * @param {string} title 
 * @param {string} message 
 * @returns {Promise<boolean>}
 */
function showConfirmModal(title, message) {
    return new Promise((resolve) => {
        // Create modal if it doesn't exist
        let overlay = document.getElementById('confirmModal');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'confirmModal';
            overlay.className = 'modal-overlay';
            overlay.innerHTML = `
                <div class="modal-content">
                    <div class="modal-icon"><i class="ph ph-trash"></i></div>
                    <h3 class="modal-title" id="modalTitle"></h3>
                    <p class="modal-message" id="modalMessage"></p>
                    <div class="modal-actions">
                        <button class="modal-btn btn-cancel" id="modalCancel">Cancel</button>
                        <button class="modal-btn btn-confirm-delete" id="modalConfirm">Delete</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
        }

        const titleEl = document.getElementById('modalTitle');
        const msgEl = document.getElementById('modalMessage');
        const cancelBtn = document.getElementById('modalCancel');
        const confirmBtn = document.getElementById('modalConfirm');

        titleEl.innerText = title;
        msgEl.innerText = message;

        const cleanup = (result) => {
            overlay.classList.remove('active');
            cancelBtn.onclick = null;
            confirmBtn.onclick = null;
            setTimeout(() => resolve(result), 300);
        };

        cancelBtn.onclick = () => cleanup(false);
        confirmBtn.onclick = () => cleanup(true);

        // Show with small delay for animation
        setTimeout(() => overlay.classList.add('active'), 10);
    });
}

// Ensure the date/time picker opens on click
document.addEventListener('DOMContentLoaded', () => {
    const taskDate = document.getElementById('taskDate');
    if (taskDate) {
        taskDate.addEventListener('click', function() {
            try { if (this.showPicker) this.showPicker(); } catch (e) { console.warn('showPicker not supported'); }
        });
    }
});

// ---------------------------------------------------------------------------
// API calls (with server error parsing)
// ---------------------------------------------------------------------------
async function fetchTasks() {
    const res = await fetch(`${API_BASE}/api/tasks?user_id=${getUserId()}`);
    if (!res.ok) throw new Error('Failed to fetch tasks');
    return res.json();
}

async function createTaskAPI(title, urgency, importance, severity, deadline, duration_minutes = null, tags = []) {
    const res = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: getUserId(),
            title,
            urgency: parseInt(urgency),
            importance: parseInt(importance),
            severity: parseInt(severity),
            deadline,
            duration_minutes,
            tags: tags
        })
    });
    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create task');
    }
    return res.json();
}

async function updateTaskAPI(taskId, data) {
    const res = await fetch(`${API_BASE}/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to update task');
    }
    return res.json();
}

async function deleteTaskAPI(taskId) {
    const res = await fetch(`${API_BASE}/api/tasks/${taskId}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete task');
    return res.json();
}

async function fetchTask(taskId) {
    const res = await fetch(`${API_BASE}/api/tasks/${taskId}`);
    if (!res.ok) throw new Error('Failed to fetch task details');
    return res.json();
}

async function patchTaskStatus(taskId, status) {
    const res = await fetch(`${API_BASE}/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error('Failed to update task');
    return res.json();
}

async function clearHistoryAPI() {
    const res = await fetch(`${API_BASE}/api/tasks/history?user_id=${getUserId()}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to clear history');
    return res.json();
}

// ---------------------------------------------------------------------------
// Priority calculation (client-side, used for display only)
// ---------------------------------------------------------------------------
function calculatePriorityScore(u, i, s, deadlineStr) {
    if (!deadlineStr) return { score: 0, daysRemaining: 0, totalHours: 0 };

    const now = new Date();
    // Support both YYYY-MM-DD and YYYY-MM-DDTHH:MM
    const deadline = new Date(deadlineStr.includes('T') ? deadlineStr : deadlineStr + 'T00:00:00');
    
    if (isNaN(deadline.getTime())) {
        return { score: 0, daysRemaining: 0, totalHours: 0 };
    }

    const diffTime = deadline - now;
    const hoursRemaining = diffTime / (1000 * 60 * 60);
    const daysRemaining = hoursRemaining / 24;
    
    const clampedDays = Math.max(0, daysRemaining);
    const baseScore = (W_U * u) + (W_I * i) + (W_S * s);
    const multiplier = 1 + (ALPHA / (clampedDays + 1));
    
    return { 
        score: parseFloat((baseScore * multiplier).toFixed(2)), 
        daysRemaining: Math.ceil(daysRemaining),
        totalHours: hoursRemaining
    };
}

/**
 * Normalizes the raw priority score (0-30+) to a 1-10 scale.
 * 10 = Urgent & Important (Immediate)
 * 1  = Low priority (Future)
 */
function getNormalizedPriority(rawScore) {
    const MAX_RAW = 30; // Based on Alpha=2, Max Base=10
    let normalized = 1 + (rawScore / MAX_RAW) * 9;
    return Math.min(10, Math.max(1, parseFloat(normalized.toFixed(1))));
}

function recalculateActiveScores(tasks) {
    tasks.forEach(t => {
        if (t.status === 'active') {
            const res = calculatePriorityScore(t.urgency, t.importance, t.severity, t.deadline);
            t.currentScore = res.score;
            t.daysRemaining = res.daysRemaining;
            t.totalHours = res.totalHours;
        }
    });
    return tasks;
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------
function determineHighlightClass(daysRemaining) {
    if (daysRemaining < 0) return 'score-high';
    if (daysRemaining <= 2) return 'score-medium';
    return 'badge-success';
}
function determineHighlightBorder(daysRemaining) {
    if (daysRemaining < 0) return 'border-left: 4px solid var(--q1-do);';
    if (daysRemaining <= 2) return 'border-left: 4px solid var(--q3-delegate);';
    return 'border-left: 4px solid var(--q4-eliminate);';
}

function taskItemHTML(t, showCompleteBtn = true) {
    const completeBtn = showCompleteBtn
        ? `<button onclick="markCompleted(${t.id})" class="badge badge-success" style="cursor:pointer; border:none; padding: 0.25rem 0.6rem;">Complete <i class="ph ph-check"></i></button>`
        : '';

    const tagsHTML = (t.tags && t.tags.length > 0)
        ? `<div class="task-tags">${t.tags.map(tag => `<span class="tag-chip tag-${tag.color || 'blue'}">${tag.name}</span>`).join('')}</div>`
        : '';

    return `
    <div class="task-item" style="${determineHighlightBorder(t.daysRemaining)} background: rgba(0,0,0,0.2);">
        <div class="task-info">
            <div class="task-name">${t.title}</div>
            <div class="task-meta">
                <span><i class="ph ph-calendar-blank"></i> ${formatDeadline(t.deadline)}</span>
                <span>U:${t.urgency} | I:${t.importance} | S:${t.severity}</span>
            </div>
            ${tagsHTML}
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.5rem;">
            <div class="task-score ${determineHighlightClass(t.daysRemaining)}" style="display:flex; align-items:center; gap:0.5rem;">
                <span onclick="editTask(${t.id})" title="Edit" style="cursor:pointer; opacity:0.6; transition:opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6"><i class="ph ph-pencil-simple"></i></span>
                <span onclick="deleteTask(${t.id})" title="Delete" style="cursor:pointer; opacity:0.6; color:var(--q1-do); transition:opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6"><i class="ph ph-trash"></i></span>
                <i class="ph-fill ph-star" style="color:#fbbf24; font-size:0.8rem;"></i> ${getNormalizedPriority(t.currentScore)}
            </div>
            ${completeBtn}
        </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Action: Load task into form for editing
// ---------------------------------------------------------------------------
let editingTaskId = null;

async function loadTaskForEdit(taskId) {
    try {
        const t = await fetchTask(taskId);
        editingTaskId = taskId;
        
        const form = document.getElementById('addTaskForm');
        if (!form) return;

        document.getElementById('taskName').value = t.title;
        document.getElementById('uSlider').value = t.urgency;
        document.getElementById('urgencyVal').innerText = t.urgency;
        document.getElementById('iSlider').value = t.importance;
        document.getElementById('importanceVal').innerText = t.importance;
        document.getElementById('sSlider').value = t.severity;
        document.getElementById('severityVal').innerText = t.severity;
        document.getElementById('taskDate').value = formatDateForInput(t.deadline);
        document.getElementById('taskDuration').value = t.duration_minutes || '';
        document.getElementById('taskTags').value = t.tags ? t.tags.map(tag => tag.name).join(', ') : '';

        const btn = document.getElementById('submitBtn');
        btn.innerHTML = '<i class="ph ph-check"></i> Update Task';
        
        const cancelBtn = document.getElementById('cancelEditBtn');
        if (cancelBtn) cancelBtn.style.display = 'block';

        // Scroll to form
        form.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
        showToast('error', 'Load Failed', err.message);
    }
}

// Global Edit Handler
window.editTask = async (taskId) => {
    if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
        const manualCard = document.getElementById('manualCard');
        if (!manualCard) return;

        try {
            const t = await fetchTask(taskId);
            editingManualTaskId = taskId;
            
            // Populate and Show Manual Card
            manualCard.classList.add('active');
            manualCard.scrollIntoView({ behavior: 'smooth' });
            
            document.querySelector('#manualCard .verification-header span').innerText = 'Edit Task';
            document.getElementById('mConfirm').innerHTML = 'Update Task <i class="ph ph-check"></i>';
            
            document.getElementById('mName').value = t.title;
            document.getElementById('mUrgency').value = t.urgency;
            document.getElementById('mImportance').value = t.importance;
            document.getElementById('mSeverity').value = t.severity;
            document.getElementById('mDuration').value = t.duration_minutes || '30';
            document.getElementById('mDate').value = formatDateForInput(t.deadline);
            
            showToast('warning', 'Editing Task', `Modifying "${t.title}"...`);
        } catch (err) {
            showToast('error', 'Load Failed', err.message);
        }
    } else {
        window.location.href = `/?edit=${taskId}`;
    }
};

// ---------------------------------------------------------------------------
// Page renderers & State
// ---------------------------------------------------------------------------
let allActiveTasks = [];
let searchQuery = "";
let editingManualTaskId = null;

// Calendar State
let currentViewDate = new Date();
let selectedDate = new Date(); // Defaults to today
selectedDate.setHours(0, 0, 0, 0);

async function renderDashboard() {
    const listContainer = document.getElementById('topTasksContainer');
    if (!listContainer) return;

    try {
        allActiveTasks = recalculateActiveScores(await fetchTasks()).filter(t => t.status === 'active');

        document.getElementById('statTotal').innerText = allActiveTasks.length;
        document.getElementById('statNear').innerText = allActiveTasks.filter(t => t.daysRemaining >= 0 && t.daysRemaining <= 2).length;
        document.getElementById('statOverdue').innerText = allActiveTasks.filter(t => t.daysRemaining < 0).length;

        // Initialize Search Listener
        const searchInput = document.getElementById('taskSearch');
        if (searchInput && !searchInput.dataset.listener) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value;
                updateDashboardUI();
            });
            searchInput.dataset.listener = 'true';
        }

        updateDashboardUI();
        updateProgress();
        renderPerformanceMetrics();
    } catch (err) {
        listContainer.innerHTML = `<p style="color:#fca5a5"><i class="ph ph-warning-circle"></i> Could not load tasks: ${err.message}</p>`;
    }
}

function updateDashboardUI() {
    const listContainer = document.getElementById('topTasksContainer');
    if (!listContainer) return;

    const query = searchQuery.toLowerCase();
    let filtered = allActiveTasks.filter(t => {
        const matchesTitle = t.title.toLowerCase().includes(query);
        const matchesTags = t.tags && t.tags.some(tag => tag.name.toLowerCase().includes(query));
        return matchesTitle || matchesTags;
    });

    filtered.sort((a, b) => b.currentScore - a.currentScore);
    const top3 = filtered.slice(0, 3);

    if (top3.length === 0) {
        listContainer.innerHTML = `<p style="color:var(--text-muted)">${searchQuery ? 'No matching tasks found.' : 'No active tasks. <a href="javascript:void(0)" onclick="document.getElementById(\'manualAddBtn\').click()" style="color:var(--primary)">Add one!</a>'}</p>`;
        return;
    }
    listContainer.innerHTML = top3.map(t => taskItemHTML(t)).join('');
}

async function updateProgress() {
    const progressFill = document.getElementById('progressFill');
    const progressPercent = document.getElementById('progressPercent');
    if (!progressFill || !progressPercent) return;

    try {
        const allTasks = await fetchTasks();
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        const todayTasks = allTasks.filter(t => t.deadline.startsWith(todayStr));
        const completedToday = todayTasks.filter(t => t.status === 'completed').length;
        const totalToday = todayTasks.length;

        const percent = totalToday === 0 ? 0 : Math.round((completedToday / totalToday) * 100);
        
        progressFill.style.width = `${percent}%`;
        progressPercent.innerText = `${percent}%`;
    } catch (err) {
        console.error("Progress update failed:", err);
    }
}

async function renderPerformanceMetrics() {
    const containers = ['completion', 'agility', 'flex'];
    const userId = getUserId();
    if (!userId) return;

    try {
        const res = await fetch(`${API_BASE}/api/performance-metrics?user_id=${userId}`);
        if (!res.ok) throw new Error('Metrics failed');
        const data = await res.json();

        createGaugeChart('completionGauge', data.completion, '#8b5cf6'); // Purple
        document.getElementById('completionValue').innerText = data.completion;

        createGaugeChart('agilityGauge', data.agility, '#06b6d4'); // Cyan
        document.getElementById('agilityValue').innerText = data.agility;

        createGaugeChart('flexGauge', data.flex, '#f59e0b'); // Amber
        document.getElementById('flexValue').innerText = data.flex;

    } catch (err) {
        console.error("Performance metrics failed:", err);
    }
}

function createGaugeChart(containerId, value, color) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Clear existing SVG if any
    const existing = container.querySelector('svg');
    if (existing) existing.remove();

    const size = 140;
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    
    // Normalize value to percentage of 300
    const percentage = Math.min(100, (value / 300) * 100);
    const offset = circumference - (percentage / 100) * circumference;

    const svg = `
        <svg class="gauge-svg" width="${size}" height="${size}">
            <circle class="gauge-bg" cx="${size/2}" cy="${size/2}" r="${radius}" />
            <circle class="gauge-fill" cx="${size/2}" cy="${size/2}" r="${radius}" 
                style="stroke: ${color}; stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset};" />
        </svg>
    `;
    container.insertAdjacentHTML('afterbegin', svg);
}

async function renderTaskPage() {
    const form = document.getElementById('addTaskForm');
    if (!form) return;

    // Slider displays
    const sliders = [
        ['uSlider', 'urgencyVal'],
        ['iSlider', 'importanceVal'],
        ['sSlider', 'severityVal']
    ];
    sliders.forEach(([sliderId, valId]) => {
        const el = document.getElementById(sliderId);
        if (el) el.addEventListener('input', e => document.getElementById(valId).innerText = e.target.value);
    });

    // Form submission with frontend validation
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Frontend validation first
        if (!validateTaskForm()) {
            showToast('warning', 'Validation Error', 'Please fix the highlighted fields before submitting.');
            return;
        }

        const btn = document.getElementById('submitBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="ph ph-spinner"></i> Saving…';

        const taskData = {
            title: document.getElementById('taskName').value.trim(),
            urgency: document.getElementById('uSlider').value,
            importance: document.getElementById('iSlider').value,
            severity: document.getElementById('sSlider').value,
            deadline: document.getElementById('taskDate').value,
            duration_minutes: document.getElementById('taskDuration').value,
            tags: document.getElementById('taskTags').value.split(',').map(s => s.trim()).filter(s => s !== "").map(name => ({
                name,
                color: 'blue' // Manual tags default to blue
            }))
        };

        try {
            if (editingTaskId) {
                await updateTaskAPI(editingTaskId, taskData);
                btn.innerHTML = '<i class="ph ph-check"></i> Updated!';
                showToast('success', 'Task Updated', `"${taskData.title}" has been updated successfully.`);
            } else {
                await createTaskAPI(
                    taskData.title,
                    taskData.urgency,
                    taskData.importance,
                    taskData.severity,
                    taskData.deadline,
                    taskData.duration_minutes,
                    taskData.tags
                );
                btn.innerHTML = '<i class="ph ph-check"></i> Added!';
                showToast('success', 'Task Created', `"${taskData.title}" has been added to your list.`);
            }
            // Clear editing state on success
            editingTaskId = null;
            setTimeout(() => window.location.href = '/task.html', 1200);
        } catch (err) {
            btn.disabled = false;
            btn.innerHTML = '<i class="ph ph-magic-wand"></i> Calculate &amp; Add Task';
            showToast('error', 'Save Failed', err.message);
        }
    });

    // Check if we are in edit mode from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    if (editId) {
        await loadTaskForEdit(editId);
    }

    const cancelEditBtn = document.getElementById('cancelEditBtn');
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => {
            editingTaskId = null;
            form.reset();
            document.getElementById('urgencyVal').innerText = '5';
            document.getElementById('importanceVal').innerText = '5';
            document.getElementById('severityVal').innerText = '5';
            const btn = document.getElementById('submitBtn');
            btn.innerHTML = '<i class="ph ph-magic-wand"></i> Calculate &amp; Add Task';
            cancelEditBtn.style.display = 'none';
            // Also clean up URL if possible without reload (optional)
            window.history.replaceState({}, document.title, window.location.pathname);
        });
    }


    // Render active task list
    const listContainer = document.getElementById('activeTasksContainer');
    try {
        let tasks = recalculateActiveScores(await fetchTasks()).filter(t => t.status === 'active');
        tasks.sort((a, b) => b.currentScore - a.currentScore);
        if (tasks.length === 0) {
            listContainer.innerHTML = '<p style="color:var(--text-muted)">No active tasks found. Add one above!</p>';
        } else {
            listContainer.innerHTML = tasks.map(t => taskItemHTML(t)).join('');
        }
    } catch (err) {
        listContainer.innerHTML = `<p style="color:#fca5a5"><i class="ph ph-warning-circle"></i> Could not load tasks: ${err.message}</p>`;
    }
}

async function renderSchedule() {
    const matrixContainer = document.getElementById('matrixContainer');
    if (!matrixContainer) return;

    // Sub-containers in the matrix
    const qContainers = {
        q1: document.getElementById('q1-tasks'),
        q2: document.getElementById('q2-tasks'),
        q3: document.getElementById('q3-tasks'),
        q4: document.getElementById('q4-tasks')
    };

    // Update Page Header/Title
    const titleEl = document.getElementById('selectedDateTitle');
    if (titleEl) {
        const isToday = selectedDate.toDateString() === new Date().toDateString();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        titleEl.innerText = isToday ? `Tasks for Today` : `Tasks for ${selectedDate.toLocaleDateString('en-US', options)}`;
    }

    // Clear previous contents
    Object.values(qContainers).forEach(c => { if (c) c.innerHTML = '<p class="loading-mini">Loading...</p>'; });

    try {
        const fetchedTasks = await fetchTasks();
        allActiveTasks = recalculateActiveScores(fetchedTasks).filter(t => t.status === 'active');
        
        // Render Calendar first to show dots
        renderCalendar();

        // Filter tasks for the SELECTED day
        const dayStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
        const dayTasks = allActiveTasks.filter(t => t.deadline.startsWith(dayStr));
        
        // Clear containers again for rendering
        Object.values(qContainers).forEach(c => { if (c) c.innerHTML = ''; });

        if (dayTasks.length === 0) {
            Object.values(qContainers).forEach(c => { 
                if (c) c.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem; padding:1.5rem; text-align:center; border:1px dashed rgba(255,255,255,0.05); border-radius:12px;">No tasks for this day</div>'; 
            });
            return;
        }

        dayTasks.sort((a, b) => b.currentScore - a.currentScore);

        dayTasks.forEach(t => {
            const isUrgent = t.urgency >= 6;
            const isImportant = t.importance >= 6;

            let targetId = 'q4';
            if (isUrgent && isImportant) targetId = 'q1';
            else if (!isUrgent && isImportant) targetId = 'q2';
            else if (isUrgent && !isImportant) targetId = 'q3';

            const container = qContainers[targetId];
            if (container) {
                container.innerHTML += taskItemHTML(t);
            }
        });

        // Add empty message if any quadrant is empty after processing
        Object.keys(qContainers).forEach(id => {
            if (qContainers[id] && qContainers[id].innerHTML === '') {
                qContainers[id].innerHTML = '<div style="color:var(--text-muted); font-size:0.8rem; padding:1rem; text-align:center; border:1px dashed rgba(255,255,255,0.02); border-radius:8px;">Empty</div>';
            }
        });

    } catch (err) {
        matrixContainer.innerHTML = `<p style="color:#fca5a5; padding:2rem;"><i class="ph ph-warning-circle"></i> Error: ${err.message}</p>`;
    }
}

// --- Calendar Logic ---

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const monthYearEl = document.getElementById('calendarMonthYear');
    if (!grid || !monthYearEl) return;

    // Preserve the labels
    const labels = `
        <div class="calendar-day-label">Sun</div>
        <div class="calendar-day-label">Mon</div>
        <div class="calendar-day-label">Tue</div>
        <div class="calendar-day-label">Wed</div>
        <div class="calendar-day-label">Thu</div>
        <div class="calendar-day-label">Fri</div>
        <div class="calendar-day-label">Sat</div>
    `;

    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    
    monthYearEl.innerText = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(currentViewDate);

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const prevMonthDays = new Date(year, month, 0).getDate();
    
    let html = labels;

    // Previous month's padding
    for (let i = firstDay; i > 0; i--) {
        html += `<div class="calendar-day other-month"><div class="day-num">${prevMonthDays - i + 1}</div></div>`;
    }

    // Current month's days
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        
        const isToday = date.toDateString() === today.toDateString();
        const isSelected = date.toDateString() === selectedDate.toDateString();
        
        // Find tasks for this day to draw dots
        const dayTasks = allActiveTasks.filter(t => t.deadline.startsWith(dateStr));
        const quadrants = new Set();
        dayTasks.forEach(t => {
            const isUrgent = t.urgency >= 6;
            const isImportant = t.importance >= 6;
            if (isUrgent && isImportant) quadrants.add('q1');
            else if (!isUrgent && isImportant) quadrants.add('q2');
            else if (isUrgent && !isImportant) quadrants.add('q3');
            else quadrants.add('q4');
        });

        let dotsHtml = '<div class="calendar-dots">';
        if (quadrants.has('q1')) dotsHtml += '<div class="dot" style="background:var(--q1-do)"></div>';
        if (quadrants.has('q2')) dotsHtml += '<div class="dot" style="background:var(--q2-schedule)"></div>';
        if (quadrants.has('q3')) dotsHtml += '<div class="dot" style="background:var(--q3-delegate)"></div>';
        if (quadrants.has('q4')) dotsHtml += '<div class="dot" style="background:var(--q4-eliminate)"></div>';
        dotsHtml += '</div>';

        html += `
            <div class="calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'active' : ''}" onclick="selectDate(${year}, ${month}, ${d})">
                <div class="day-num">${d}</div>
                ${dotsHtml}
            </div>
        `;
    }

    // Next month's padding
    const remaining = 42 - (firstDay + daysInMonth); // 6 rows
    for (let i = 1; i <= remaining; i++) {
        html += `<div class="calendar-day other-month"><div class="day-num">${i}</div></div>`;
    }

    grid.innerHTML = html;
}

window.selectDate = (y, m, d) => {
    selectedDate = new Date(y, m, d);
    selectedDate.setHours(0, 0, 0, 0);
    renderSchedule();
};

window.changeMonth = (delta) => {
    currentViewDate.setMonth(currentViewDate.getMonth() + delta);
    renderCalendar();
};

window.goToToday = () => {
    currentViewDate = new Date();
    selectedDate = new Date();
    selectedDate.setHours(0, 0, 0, 0);
    renderSchedule();
};

async function renderHistory() {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;

    try {
        let tasks = (await fetchTasks()).filter(t => t.status === 'completed');
        tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        if (tasks.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">No completed tasks yet.</td></tr>';
            return;
        }
        tbody.innerHTML = tasks.map(t => {
            const res = calculatePriorityScore(t.urgency, t.importance, t.severity, t.deadline);
            const compDate = t.completed_at ? formatDeadline(t.completed_at) : 'N/A';
            return `
            <tr>
                <td>${compDate}</td>
                <td style="font-weight: 500; color: white;">${t.title}</td>
                <td><span class="task-score score-medium">${res.score} pts</span></td>
                <td><span class="badge badge-success">Completed</span></td>
            </tr>`;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4" style="color:#fca5a5"><i class="ph ph-warning-circle"></i> Could not load history: ${err.message}</td></tr>`;
    }
}

async function downloadHistoryXLSX() {
    try {
        const tasks = (await fetchTasks()).filter(t => t.status === 'completed');
        if (tasks.length === 0) {
            showToast('warning', 'Empty Export', 'No completed tasks found to export.');
            return;
        }

        const data = tasks.map(t => {
            const res = calculatePriorityScore(t.urgency, t.importance, t.severity, t.deadline);
            return {
                "Task Title": t.title,
                "Deadline": formatDeadline(t.deadline),
                "Category Tags": t.tags ? t.tags.map(tag => tag.name).join(', ') : '',
                "Urgency": t.urgency,
                "Importance": t.importance,
                "Severity": t.severity,
                "Duration (min)": t.duration_minutes || 'N/A',
                "Final Score": res.score,
                "Status": "Completed"
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Task History");

        const fileName = `Task_History_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(workbook, fileName);
        showToast('success', 'Export Successful', `Downloaded ${fileName}`);
    } catch (err) {
        showToast('error', 'Export Failed', err.message);
    }
}

// ---------------------------------------------------------------------------
// Action: mark task completed (called from inline onclick)
// ---------------------------------------------------------------------------
async function markCompleted(taskId) {
    try {
        await patchTaskStatus(taskId, 'completed');
        showToast('success', 'Task Completed', 'Task moved to history.');
        setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
        showToast('error', 'Status Update Failed', err.message);
    }
}

// ---------------------------------------------------------------------------
// Action: clear all completed task history
// ---------------------------------------------------------------------------
async function clearHistoryAll() {
    const confirmed = await showConfirmModal('Clear All History?', 'Warning: This will permanently delete ALL completed tasks. Are you sure?');
    if (!confirmed) return;
    
    try {
        const res = await clearHistoryAPI();
        showToast('success', 'History Cleared', res.message);
        setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
        showToast('error', 'Clear History Failed', err.message);
    }
}

// ---------------------------------------------------------------------------
// Action: delete task (Global handler)
// ---------------------------------------------------------------------------
async function deleteTask(taskId) {
    const confirmed = await showConfirmModal('Delete Task?', 'Are you sure you want to permanently remove this task? This action cannot be undone.');
    if (!confirmed) return;
    
    try {
        await deleteTaskAPI(taskId);
        showToast('success', 'Task Deleted', 'The task has been permanently removed.');
        setTimeout(() => window.location.reload(), 800);
    } catch (err) {
        showToast('error', 'Delete Failed', err.message);
    }
}
window.deleteTask = deleteTask;

// ---------------------------------------------------------------------------
// AI Quick Add Logic
// ---------------------------------------------------------------------------
let currentParsedTask = null;

async function initQuickAdd() {
    const box = document.getElementById('quickAddBox');
    const input = document.getElementById('quickAddInput');
    const btn = document.getElementById('quickAddBtn');
    const card = document.getElementById('verificationCard');

    if (!box || !input || !btn) return;
    if (btn.dataset.initDone) return; // Prevent double listeners
    btn.dataset.initDone = 'true';

    // Support Enter key for parsing
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            btn.click();
        }
    });

    btn.addEventListener('click', async () => {
        const text = input.value.trim();
        if (!text) return;

        // UI Loading State
        box.classList.add('shimmer', 'loading-state');
        btn.disabled = true;
        btn.innerHTML = '<span>Parsing...</span> <i class="ph ph-spinner"></i>';
        card.classList.remove('active');

        try {
            // Fetch current tasks for context (including ID)
            const existingTasks = (await fetchTasks())
                .filter(t => t.status === 'active')
                .map(t => ({
                    id: t.id,
                    title: t.title,
                    start_time: t.deadline,
                    duration_minutes: t.duration_minutes,
                    urgency: t.urgency,
                    importance: t.importance
                }));

            const res = await fetch(`${API_BASE}/api/parse-task`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, existing_tasks: existingTasks })
            });
            
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to parse task');
            }

            const data = await res.json();
            currentParsedTask = data;

            // Update Verification Card
            document.getElementById('vName').innerText = data.title;
            document.getElementById('vTime').innerText = data.start_time; 
            document.getElementById('vDuration').innerText = data.duration_minutes || '30';
            document.getElementById('vUrgency').innerText = data.urgency || '5';
            document.getElementById('vImportance').innerText = data.importance || '5';

            // Handle Conflicts
            const conflictEl = document.getElementById('vConflict');
            const sugEl = document.getElementById('vConflictSuggestion');
            if (data.conflict_note) {
                document.getElementById('vConflictNote').innerText = data.conflict_note;
                
                if (data.suggested_time) {
                    sugEl.innerText = `Pro-tip: Click to move to ${data.suggested_time}`;
                    sugEl.onclick = () => {
                        document.getElementById('vTime').innerText = data.suggested_time;
                        showToast('success', 'Time Updated', 'New suggested time applied!');
                    };
                    sugEl.style.display = 'inline-block';
                } else {
                    sugEl.style.display = 'none';
                }
                conflictEl.style.display = 'block';
            } else {
                conflictEl.style.display = 'none';
            }

            // Handle Optimization Recommendations
            const optEl = document.getElementById('vOptimization');
            if (data.reschedule_proposal && data.reschedule_proposal.task_id) {
                const rp = data.reschedule_proposal;
                document.getElementById('vOptimizationNote').innerText = `AI suggests moving your existing task "${rp.task_title}" to a different slot to maximize efficiency.`;
                document.getElementById('vOptimizationAction').innerText = `Action: Reschedule to ${rp.new_start_time}`;
                optEl.style.display = 'block';
            } else {
                optEl.style.display = 'none';
            }

            card.classList.add('active');
            card.scrollIntoView({ behavior: 'smooth' });

        } catch (err) {
            showToast('error', 'AI Parsing Failed', err.message);
        } finally {
            box.classList.remove('shimmer', 'loading-state');
            btn.disabled = false;
            btn.innerHTML = '<span>Parse AI</span> <i class="ph ph-sparkle"></i>';
        }
    });

    // Verification Actions
    document.getElementById('vCancel').addEventListener('click', () => {
        card.classList.remove('active');
        currentParsedTask = null;
    });

    document.getElementById('vConfirm').addEventListener('click', async () => {
        if (!currentParsedTask) return;

        // READ VALUES FROM EDITABLE FIELDS
        const correctedTitle = document.getElementById('vName').innerText.trim();
        const correctedTime = document.getElementById('vTime').innerText.trim();
        const correctedDuration = parseInt(document.getElementById('vDuration').innerText) || 30;
        const correctedUrgency = parseInt(document.getElementById('vUrgency').innerText) || 5;
        const correctedImportance = parseInt(document.getElementById('vImportance').innerText) || 5;

        const confirmBtn = document.getElementById('vConfirm');
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="ph ph-spinner"></i> Optimizing...';

        try {
            // STEP 1: Handle Reschedule Proposal if it exists
            const rp = currentParsedTask.reschedule_proposal;
            if (rp && rp.task_id && rp.new_start_time) {
                showToast('warning', 'Rescheduling', `Moving current task: ${rp.task_title}...`);
                await fetch(`${API_BASE}/api/tasks/${rp.task_id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ deadline: rp.new_start_time })
                });
            }

            // STEP 2: Create the NEW task
            await createTaskAPI(
                correctedTitle,
                correctedUrgency,
                correctedImportance,
                correctedImportance, // Severity fallback
                correctedTime,
                correctedDuration,
                currentParsedTask.tags || []
            );

            showToast('success', 'Day Optimized!', 'New task added and schedule updated.');
            card.classList.remove('active');
            document.getElementById('quickAddInput').value = '';
            renderDashboard();

        } catch (err) {
            showToast('error', 'Optimization Failed', err.message);
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = 'Confirm & Add';
        }
    });

    // --- MANUAL ENTRY LOGIC ---
    const manualBtn = document.getElementById('manualAddBtn');
    const manualCard = document.getElementById('manualCard');
    if (manualBtn && manualCard) {
        manualBtn.addEventListener('click', () => {
            // Hide AI card if open
            document.getElementById('verificationCard').classList.remove('active');
            
            manualCard.classList.toggle('active');
            if (manualCard.classList.contains('active')) {
                editingManualTaskId = null; // New task
                document.querySelector('#manualCard .verification-header span').innerText = 'Manual Task Creation';
                document.getElementById('mConfirm').innerHTML = 'Create Task <i class="ph ph-plus"></i>';
                
                manualCard.scrollIntoView({ behavior: 'smooth' });
                // Reset fields
                document.getElementById('mName').value = '';
                document.getElementById('mUrgency').value = '5';
                document.getElementById('mImportance').value = '5';
                document.getElementById('mSeverity').value = '5';
                document.getElementById('mDuration').value = '30';
                
                // Default deadline to 1 hour from now
                const d = new Date();
                d.setHours(d.getHours() + 1);
                document.getElementById('mDate').value = formatDateForInput(d);
            }
        });

        document.getElementById('mCancel').addEventListener('click', () => {
            manualCard.classList.remove('active');
            editingManualTaskId = null;
        });

        document.getElementById('mConfirm').addEventListener('click', async () => {
            const title = document.getElementById('mName').value.trim();
            const urgency = document.getElementById('mUrgency').value;
            const importance = document.getElementById('mImportance').value;
            const severity = document.getElementById('mSeverity').value;
            const duration = document.getElementById('mDuration').value;
            const deadline = document.getElementById('mDate').value;

            if (!title || !deadline) {
                showToast('warning', 'Missing Fields', 'Task Name and Deadline are required.');
                return;
            }

            const confirmBtn = document.getElementById('mConfirm');
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="ph ph-spinner"></i> Saving...';

            try {
                const taskData = {
                    title,
                    urgency: parseInt(urgency),
                    importance: parseInt(importance),
                    severity: parseInt(severity),
                    duration_minutes: parseInt(duration),
                    deadline
                };

                if (editingManualTaskId) {
                    await updateTaskAPI(editingManualTaskId, taskData);
                    showToast('success', 'Task Updated', `"${title}" has been updated.`);
                } else {
                    await createTaskAPI(title, urgency, importance, severity, deadline, duration, []);
                    showToast('success', 'Task Created', `"${title}" has been added.`);
                }
                
                manualCard.classList.remove('active');
                editingManualTaskId = null;
                renderDashboard();
            } catch (err) {
                showToast('error', 'Save Failed', err.message);
            } finally {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = editingManualTaskId ? 'Update Task <i class="ph ph-check"></i>' : 'Create Task <i class="ph ph-plus"></i>';
            }
        });
    }

    // Check for query params (edit or add) on dashboard load
    if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
        const params = new URLSearchParams(window.location.search);
        const editId = params.get('edit');
        const add = params.get('add');
        
        if (editId) {
            // Wait slightly for dashboard to load then trigger edit
            setTimeout(() => window.editTask(editId), 500);
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (add) {
            setTimeout(() => document.getElementById('manualAddBtn')?.click(), 500);
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
}

// ---------------------------------------------------------------------------
// Global initialization
// ---------------------------------------------------------------------------

function showDueModal(tasks) {
    let overlay = document.getElementById('dueTasksModal');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'dueTasksModal';
        overlay.className = 'modal-overlay';
        document.body.appendChild(overlay);
    }

    const quadrantColors = {
        'Q1_DO_FIRST':  'var(--q1-do)',
        'Q2_SCHEDULE':  'var(--q2-schedule)',
        'Q3_DELEGATE':  'var(--q3-delegate)',
        'Q4_ELIMINATE': 'var(--q4-eliminate)',
    };

    const taskItems = tasks.map(task => {
        const color = quadrantColors[task.quadrant] || 'var(--q4-eliminate)';
        const quadrantLabel = (task.quadrant || 'UNKNOWN').replace(/_/g, ' ');
        const score = task.normalized_score != null ? Number(task.normalized_score).toFixed(2) : 'N/A';
        return `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
                <span style="font-weight:600;flex:1;">${task.title}</span>
                <span style="background:${color};color:#fff;border-radius:6px;padding:2px 8px;font-size:0.75rem;white-space:nowrap;">${quadrantLabel}</span>
                <span style="font-size:0.8rem;color:var(--text-secondary);white-space:nowrap;"><i class="ph ph-star"></i> ${score}</span>
            </div>`;
    }).join('');

    overlay.innerHTML = `
        <div class="modal-content">
            <div class="modal-icon"><i class="ph ph-bell-ringing"></i></div>
            <h3 class="modal-title">You have ${tasks.length} task(s) due today!</h3>
            <p class="modal-message" style="margin-bottom:8px;">Don't forget to tackle these:</p>
            <div style="width:100%;max-height:260px;overflow-y:auto;margin-bottom:16px;">
                ${taskItems}
            </div>
            <div class="modal-actions">
                <button class="modal-btn btn-confirm-delete" id="dueModalDismiss">Got it!</button>
            </div>
        </div>
    `;

    document.getElementById('dueModalDismiss').onclick = () => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
    };

    // Show with small delay for animation
    setTimeout(() => overlay.classList.add('active'), 10);
}

async function checkDueNotifications() {
    try {
        const res = await fetch(`${API_BASE}/api/notifications?user_id=${getUserId()}`);
        if (!res.ok) {
            console.warn('Notification check failed: HTTP', res.status);
            return;
        }
        const tasks = await res.json();
        if (tasks.length > 0) {
            showDueModal(tasks);
        }
    } catch (err) {
        console.warn('Notification check failed:', err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (!requireAuth()) return;

    const path = window.location.pathname;
    if (path.includes('task.html')) renderTaskPage();
    else if (path.includes('schedule.html')) renderSchedule();
    else if (path.includes('history.html')) renderHistory();
    else {
        renderDashboard();
        initQuickAdd();
        checkDueNotifications();
    }
});

// --- EMAIL TESTING ---
window.testEmail = async () => {
    const userEmail = localStorage.getItem('user_email');
    if (!userEmail) {
        showToast('error', 'Auth Required', 'Please log in again.');
        return;
    }

    const btn = document.getElementById('testEmailBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="ph ph-spinner"></i> Sending...';
    }

    try {
        const res = await fetch(`${API_BASE}/api/verify-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail })
        });
        
        const data = await res.json();
        if (res.ok) {
            showToast('success', 'Test Sent!', `Check ${userEmail} for the test message.`);
        } else {
            throw new Error(data.error || 'SMTP Error');
        }
    } catch (err) {
        showToast('error', 'Test Failed', err.message);
        console.error('Email Test Failed:', err);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="ph ph-envelope"></i> Test Email';
        }
    }
};
