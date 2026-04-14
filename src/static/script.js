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

async function createTaskAPI(title, urgency, importance, severity, deadline, duration_minutes = null) {
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
            duration_minutes
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

    return `
    <div class="task-item" style="${determineHighlightBorder(t.daysRemaining)} background: rgba(0,0,0,0.2);">
        <div class="task-info">
            <div class="task-name">${t.title}</div>
            <div class="task-meta">
                <span><i class="ph ph-calendar-blank"></i> ${formatDeadline(t.deadline)}</span>
                <span>U:${t.urgency} | I:${t.importance} | S:${t.severity}</span>
            </div>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.5rem;">
            <div class="task-score ${determineHighlightClass(t.daysRemaining)}" style="display:flex; align-items:center; gap:0.5rem;">
                <span onclick="editTask(${t.id})" title="Edit" style="cursor:pointer; opacity:0.6; transition:opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6"><i class="ph ph-pencil-simple"></i></span>
                <span onclick="deleteTask(${t.id})" title="Delete" style="cursor:pointer; opacity:0.6; color:var(--q1-do); transition:opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6"><i class="ph ph-trash"></i></span>
                ${t.currentScore} pts
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
    if (window.location.pathname.includes('task.html')) {
        clearAllFieldErrors();
        await loadTaskForEdit(taskId);
        showToast('warning', 'Editing Task', 'Modify the fields above and click Update Task.');
    } else {
        window.location.href = `/task.html?edit=${taskId}`;
    }
};

// ---------------------------------------------------------------------------
// Page renderers
// ---------------------------------------------------------------------------
async function renderDashboard() {
    const listContainer = document.getElementById('topTasksContainer');
    if (!listContainer) return;

    try {
        let tasks = recalculateActiveScores(await fetchTasks()).filter(t => t.status === 'active');

        document.getElementById('statTotal').innerText = tasks.length;
        document.getElementById('statNear').innerText = tasks.filter(t => t.daysRemaining >= 0 && t.daysRemaining <= 2).length;
        document.getElementById('statOverdue').innerText = tasks.filter(t => t.daysRemaining < 0).length;

        tasks.sort((a, b) => b.currentScore - a.currentScore);
        const top3 = tasks.slice(0, 3);

        if (top3.length === 0) {
            listContainer.innerHTML = '<p style="color:var(--text-muted)">No active tasks. <a href="/task.html" style="color:var(--primary)">Add one!</a></p>';
            return;
        }
        listContainer.innerHTML = top3.map(t => `
            <div class="task-item" style="${determineHighlightBorder(t.daysRemaining)}; display:flex;">
                <div class="task-info">
                    <div class="task-name">${t.title}</div>
                    <div class="task-meta">
                        <span>${formatDeadline(t.deadline)}</span>
                        <span style="color:${t.daysRemaining < 0 ? 'var(--q1-do)' : 'inherit'}">
                            ${t.daysRemaining < 0 ? 'Overdue!' : (isNaN(t.totalHours) ? 'Invalid Date' : (Math.max(0, Math.floor(t.totalHours)) + ' hours left'))}
                        </span>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.5rem;">
                    <div class="task-score ${determineHighlightClass(t.daysRemaining)}" style="display:flex; align-items:center; gap:0.5rem;">
                        <span onclick="editTask(${t.id})" title="Edit" style="cursor:pointer; opacity:0.6;"><i class="ph ph-pencil-simple"></i></span>
                        <span onclick="deleteTask(${t.id})" title="Delete" style="cursor:pointer; opacity:0.6; color:var(--q1-do);"><i class="ph ph-trash"></i></span>
                        ${t.currentScore} pts
                    </div>
                    <button onclick="markCompleted(${t.id})" class="badge badge-success" style="cursor:pointer; border:none; padding: 0.25rem 0.6rem;">Complete <i class="ph ph-check"></i></button>
                </div>
            </div>`).join('');
    } catch (err) {
        listContainer.innerHTML = `<p style="color:#fca5a5"><i class="ph ph-warning-circle"></i> Could not load tasks: ${err.message}</p>`;
    }
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
            deadline: document.getElementById('taskDate').value
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
                    taskData.deadline
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

    // Clear previous contents
    Object.values(qContainers).forEach(c => { if (c) c.innerHTML = '<p class="loading-mini">Loading...</p>'; });

    try {
        let tasks = recalculateActiveScores(await fetchTasks()).filter(t => t.status === 'active');
        
        // Clear containers again for rendering
        Object.values(qContainers).forEach(c => { if (c) c.innerHTML = ''; });

        if (tasks.length === 0) {
            Object.values(qContainers).forEach(c => { if (c) c.innerHTML = '<div style="color:var(--text-muted); font-size:0.8rem; padding:1rem; text-align:center;">No tasks</div>'; });
            return;
        }

        tasks.sort((a, b) => b.currentScore - a.currentScore);

        tasks.forEach(t => {
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
                qContainers[id].innerHTML = '<div style="color:var(--text-muted); font-size:0.8rem; padding:1rem; text-align:center; border:1px dashed rgba(255,255,255,0.05); border-radius:8px;">Empty</div>';
            }
        });

    } catch (err) {
        matrixContainer.innerHTML = `<p style="color:#fca5a5; padding:2rem;"><i class="ph ph-warning-circle"></i> Error: ${err.message}</p>`;
    }
}

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
            return `
            <tr>
                <td>${formatDeadline(t.deadline)}</td>
                <td style="font-weight: 500; color: white;">${t.title}</td>
                <td><span class="task-score score-medium">${res.score} pts</span></td>
                <td><span class="badge badge-success">Completed</span></td>
            </tr>`;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4" style="color:#fca5a5"><i class="ph ph-warning-circle"></i> Could not load history: ${err.message}</td></tr>`;
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

    btn.addEventListener('click', async () => {
        const text = input.value.trim();
        if (!text) return;

        // UI Loading State
        box.classList.add('shimmer', 'loading-state');
        btn.disabled = true;
        btn.innerHTML = '<span>Parsing...</span> <i class="ph ph-spinner"></i>';
        card.classList.remove('active');

        try {
            // Fetch current tasks for context
            const existingTasks = (await fetchTasks())
                .filter(t => t.status === 'active')
                .map(t => ({
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
            document.getElementById('vPriority').innerText = data.priority || '2';

            // Handle Conflicts
            const conflictEl = document.getElementById('vConflict');
            if (data.conflict_note) {
                document.getElementById('vConflictNote').innerText = data.conflict_note;
                document.getElementById('vConflictSuggestion').innerText = data.suggested_time ? `Pro-tip: ${data.suggested_time}` : '';
                conflictEl.style.display = 'block';
            } else {
                conflictEl.style.display = 'none';
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

        // READ VALUES FROM EDITABLE FIELDS (User might have corrected them)
        const correctedTitle = document.getElementById('vName').innerText.trim();
        const correctedTime = document.getElementById('vTime').innerText.trim();
        const correctedDuration = parseInt(document.getElementById('vDuration').innerText) || 30;
        const correctedPriority = parseInt(document.getElementById('vPriority').innerText) || 2;

        const confirmBtn = document.getElementById('vConfirm');
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="ph ph-spinner"></i> Adding...';

        try {
            // Map AI priority (1-3) to U/I/S (1-10) for the scoring algorithm
            const map = { 1: 3, 2: 6, 3: 9 };
            const p = Math.min(3, Math.max(1, correctedPriority));
            const scoreVal = map[p];

            await createTaskAPI(
                correctedTitle,
                scoreVal, // Urgency
                scoreVal, // Importance
                scoreVal, // Severity
                correctedTime,
                correctedDuration
            );

            showToast('success', 'Task Created', `"${correctedTitle}" added successfully.`);
            
            card.classList.remove('active');
            input.value = '';
            currentParsedTask = null;
            if (typeof renderDashboard === 'function') renderDashboard();
            
        } catch (err) {
            showToast('error', 'Add Failed', err.message);
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = 'Confirm & Add';
        }
    });
}

// ---------------------------------------------------------------------------
// Global initialization
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    if (!requireAuth()) return;

    const path = window.location.pathname;
    if (path.includes('task.html')) renderTaskPage();
    else if (path.includes('schedule.html')) renderSchedule();
    else if (path.includes('history.html')) renderHistory();
    else {
        renderDashboard();
        initQuickAdd();
    }
});
