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
// API calls
// ---------------------------------------------------------------------------
async function fetchTasks() {
    const res = await fetch(`${API_BASE}/api/tasks?user_id=${getUserId()}`);
    if (!res.ok) throw new Error('Failed to fetch tasks');
    return res.json();
}

async function createTaskAPI(title, urgency, importance, severity, deadline) {
    const res = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: getUserId(),
            title,
            urgency: parseInt(urgency),
            importance: parseInt(importance),
            severity: parseInt(severity),
            deadline
        })
    });
    if (!res.ok) throw new Error('Failed to create task');
    return res.json();
}

async function updateTaskAPI(taskId, data) {
    const res = await fetch(`${API_BASE}/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update task');
    return res.json();
}

async function deleteTaskAPI(taskId) {
    const res = await fetch(`${API_BASE}/api/tasks/${taskId}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete task');
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

// ---------------------------------------------------------------------------
// Priority calculation (client-side, used for display only)
// ---------------------------------------------------------------------------
function calculatePriorityScore(u, i, s, deadlineStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(deadlineStr + 'T00:00:00'); // Force local midnight
    const diffTime = deadline - today;
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const clampedDays = Math.max(0, daysRemaining);
    const baseScore = (W_U * u) + (W_I * i) + (W_S * s);
    const multiplier = 1 + (ALPHA / (clampedDays + 1));
    return { score: parseFloat((baseScore * multiplier).toFixed(2)), daysRemaining };
}

function recalculateActiveScores(tasks) {
    tasks.forEach(t => {
        if (t.status === 'active') {
            const res = calculatePriorityScore(t.urgency, t.importance, t.severity, t.deadline);
            t.currentScore = res.score;
            t.daysRemaining = res.daysRemaining;
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
                <span><i class="ph ph-calendar-blank"></i> Deadline: ${t.deadline}</span>
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
                        <span>Deadline: ${t.deadline}</span>
                        <span style="color:${t.daysRemaining < 0 ? 'var(--q1-do)' : 'inherit'}">${t.daysRemaining < 0 ? 'Overdue!' : (t.daysRemaining + ' days left')}</span>
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

    // State for editing
    let editingTaskId = null;

    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('submitBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="ph ph-spinner"></i> Saving…';

        const taskData = {
            title: document.getElementById('taskName').value,
            urgency: document.getElementById('uSlider').value,
            importance: document.getElementById('iSlider').value,
            severity: document.getElementById('sSlider').value,
            deadline: document.getElementById('taskDate').value
        };

        try {
            if (editingTaskId) {
                await updateTaskAPI(editingTaskId, taskData);
                btn.innerHTML = '<i class="ph ph-check"></i> Updated!';
            } else {
                await createTaskAPI(
                    taskData.title,
                    taskData.urgency,
                    taskData.importance,
                    taskData.severity,
                    taskData.deadline
                );
                btn.innerHTML = '<i class="ph ph-check"></i> Added!';
            }
            setTimeout(() => window.location.reload(), 600);
        } catch (err) {
            btn.disabled = false;
            btn.innerHTML = '<i class="ph ph-magic-wand"></i> Calculate &amp; Add Task';
            alert('Failed to save task: ' + err.message);
        }
    });

    // Handle Edit Task Action
    window.editTask = async (taskId) => {
        try {
            const tasks = await fetchTasks();
            const task = tasks.find(t => t.id === taskId);
            if (!task) return;

            editingTaskId = taskId;
            document.getElementById('taskName').value = task.title;
            document.getElementById('uSlider').value = task.urgency;
            document.getElementById('urgencyVal').innerText = task.urgency;
            document.getElementById('iSlider').value = task.importance;
            document.getElementById('importanceVal').innerText = task.importance;
            document.getElementById('sSlider').value = task.severity;
            document.getElementById('severityVal').innerText = task.severity;
            document.getElementById('taskDate').value = task.deadline;

            const btn = document.getElementById('submitBtn');
            btn.innerHTML = '<i class="ph ph-pencil-simple"></i> Update Task';
            
            const cancelBtn = document.getElementById('cancelEditBtn');
            if (cancelBtn) cancelBtn.style.display = 'inline-block';
            
            document.querySelector('.container-main').scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            alert('Error loading task for edit: ' + err.message);
        }
    };

    window.deleteTask = async (taskId) => {
        if (!confirm('Are you sure you want to delete this task?')) return;
        try {
            await deleteTaskAPI(taskId);
            window.location.reload();
        } catch (err) {
            alert('Error deleting task: ' + err.message);
        }
    };

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
    const scheduleContainer = document.getElementById('scheduleContainer');
    if (!scheduleContainer) return;

    try {
        let tasks = recalculateActiveScores(await fetchTasks()).filter(t => t.status === 'active');
        tasks.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

        const groups = {};
        tasks.forEach(t => {
            if (!groups[t.deadline]) groups[t.deadline] = [];
            groups[t.deadline].push(t);
        });

        if (Object.keys(groups).length === 0) {
            scheduleContainer.innerHTML = '<p style="color:var(--text-muted)">No active tasks scheduled.</p>';
            return;
        }

        let html = '';
        for (const [date, grpTasks] of Object.entries(groups)) {
            html += `
            <div class="glass-card quadrant" style="margin-bottom: 1.5rem; border-top-width:4px; border-top-color:var(--primary)">
                <div class="quadrant-header">
                    <div class="quadrant-title"><i class="ph-fill ph-calendar"></i> ${date}</div>
                    <span class="badge" style="background:rgba(255,255,255,0.1);">${grpTasks.length} Tasks</span>
                </div>`;

            grpTasks.sort((a, b) => b.currentScore - a.currentScore).forEach(t => {
                let badgeHtml = '';
                if (t.daysRemaining < 0) badgeHtml = `<span class="badge" style="background:rgba(239,68,68,0.2); color:#fca5a5;">OVERDUE</span>`;
                else if (t.daysRemaining <= 2) badgeHtml = `<span class="badge" style="background:rgba(245,158,11,0.2); color:#fcd34d;">NEAR DEADLINE</span>`;
                else badgeHtml = `<span class="badge" style="background:rgba(100,116,139,0.2); color:#cbd5e1;">UPCOMING</span>`;

                html += `
                <div class="task-item">
                    <div class="task-info">
                        <div class="task-name">${t.title}</div>
                        <div class="task-meta">Score: ${t.currentScore}</div>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.5rem;">
                        ${badgeHtml}
                        <button onclick="markCompleted(${t.id})" class="badge badge-success" style="cursor:pointer; border:none; padding: 0.25rem 0.6rem;">Complete <i class="ph ph-check"></i></button>
                    </div>
                </div>`;
            });
            html += `</div>`;
        }
        scheduleContainer.innerHTML = html;
    } catch (err) {
        scheduleContainer.innerHTML = `<p style="color:#fca5a5"><i class="ph ph-warning-circle"></i> Could not load schedule: ${err.message}</p>`;
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
                <td>${t.deadline}</td>
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
        window.location.reload();
    } catch (err) {
        alert('Failed to complete task: ' + err.message);
    }
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
    else renderDashboard();
});
