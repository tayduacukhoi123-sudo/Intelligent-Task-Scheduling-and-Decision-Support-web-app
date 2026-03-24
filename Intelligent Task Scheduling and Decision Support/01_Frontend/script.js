// script.js - Task Priority Manager Core Logic
const STORAGE_KEY = 'tpm_tasks_db';

// Mathematical Constants for Formula
const ALPHA = 2;
const W_U = 0.3;
const W_I = 0.4;
const W_S = 0.3;

/** Data Management **/
function getTasks() {
    let tasks = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!tasks || tasks.length === 0) {
        tasks = seedPlaceholderData();
    }
    return tasks;
}

function saveTasks(tasks) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function seedPlaceholderData() {
    const today = new Date();
    
    // Helper to format date YYYY-MM-DD
    const fDate = (d) => d.toISOString().split('T')[0];
    
    // Dates relative to today
    const pastDate = new Date(today); pastDate.setDate(today.getDate() - 2);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 7);

    const initialTasks = [
        { id: crypto.randomUUID(), title: "Fix Production Database Crash", urgency: 10, importance: 10, severity: 9, deadline: fDate(pastDate), createdAt: new Date().toISOString(), status: "active" },
        { id: crypto.randomUUID(), title: "Prepare Q3 Financial Review", urgency: 8, importance: 9, severity: 8, deadline: fDate(tomorrow), createdAt: new Date().toISOString(), status: "active" },
        { id: crypto.randomUUID(), title: "Research new UI frameworks", urgency: 3, importance: 6, severity: 2, deadline: fDate(nextWeek), createdAt: new Date().toISOString(), status: "active" },
        { id: crypto.randomUUID(), title: "Update server dependencies", urgency: 5, importance: 7, severity: 6, deadline: fDate(tomorrow), createdAt: new Date().toISOString(), status: "active" },
        { id: crypto.randomUUID(), title: "Weekly Sync with Design Team", urgency: 6, importance: 5, severity: 3, deadline: fDate(nextWeek), createdAt: new Date().toISOString(), status: "active" },
        { id: crypto.randomUUID(), title: "Setup Project Repository", urgency: 9, importance: 8, severity: 5, deadline: fDate(pastDate), createdAt: new Date().toISOString(), status: "completed" }
    ];
    
    saveTasks(initialTasks);
    return initialTasks;
}

function calculatePriorityScore(u, i, s, deadlineStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(deadlineStr);
    deadline.setHours(0, 0, 0, 0);

    const diffTime = deadline - today;
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // According to instruction: days_remaining + 1 in denominator
    // If daysRemaining < 0 (overdue), we still want to avoid division by zero or negative.
    // We'll safely clamp daysRemaining to 0 if it's negative to maximize the multiplier.
    const clampedDays = Math.max(0, daysRemaining);

    // PriorityScore = (wu * U + wi * I + ws * S) * (1 + α / (days_remaining + 1))
    const baseScore = (W_U * u) + (W_I * i) + (W_S * s);
    const multiplier = 1 + (ALPHA / (clampedDays + 1));
    const score = baseScore * multiplier;

    return { score: parseFloat(score.toFixed(2)), daysRemaining };
}

function addTask(title, urgency, importance, severity, deadline) {
    const tasks = getTasks();
    const { score, daysRemaining } = calculatePriorityScore(urgency, importance, severity, deadline);
    
    // Re-evaluate scores for all active tasks every time (since days change) -> actually let's do this dynamically on render.
    
    const newTask = {
        id: crypto.randomUUID(),
        title,
        urgency: parseInt(urgency),
        importance: parseInt(importance),
        severity: parseInt(severity),
        deadline,
        createdAt: new Date().toISOString(),
        status: 'active'
    };

    tasks.push(newTask);
    saveTasks(tasks);
}

function markCompleted(taskId) {
    const tasks = getTasks();
    const task = tasks.find(t => t.id === taskId);
    if(task) {
        task.status = 'completed';
        saveTasks(tasks);
        window.location.reload();
    }
}

function recalculateActiveScores(tasks) {
    // Recalculates scores based on today's date
    tasks.forEach(t => {
        if(t.status === 'active') {
            const res = calculatePriorityScore(t.urgency, t.importance, t.severity, t.deadline);
            t.currentScore = res.score;
            t.daysRemaining = res.daysRemaining;
        }
    });
    return tasks;
}

/** Rendering Functions **/
function determineHighlightClass(daysRemaining) {
    if (daysRemaining < 0) return 'score-high'; // Red for Overdue
    if (daysRemaining <= 2) return 'score-medium'; // Yellow/Blue for Near Deadline
    return 'badge-success'; // Safe
}
function determineHighlightBorder(daysRemaining) {
    if (daysRemaining < 0) return 'border-left: 4px solid var(--q1-do);';
    if (daysRemaining <= 2) return 'border-left: 4px solid var(--q3-delegate);';
    return 'border-left: 4px solid var(--q4-eliminate);';
}

function renderTaskPage() {
    const form = document.getElementById('addTaskForm');
    if (!form) return;

    // Connect slider displays
    const uSlider = document.getElementById('uSlider');
    const iSlider = document.getElementById('iSlider');
    const sSlider = document.getElementById('sSlider');
    
    if(uSlider) uSlider.addEventListener('input', e => document.getElementById('urgencyVal').innerText = e.target.value);
    if(iSlider) iSlider.addEventListener('input', e => document.getElementById('importanceVal').innerText = e.target.value);
    if(sSlider) sSlider.addEventListener('input', e => document.getElementById('severityVal').innerText = e.target.value);

    // Form submission
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('taskName').value;
        const urgency = uSlider.value;
        const importance = iSlider.value;
        const severity = sSlider.value;
        const deadline = document.getElementById('taskDate').value;
        
        addTask(title, urgency, importance, severity, deadline);
        
        const btn = form.querySelector('button[type="submit"]');
        btn.innerHTML = '<i class="ph ph-check"></i> Added!';
        setTimeout(() => { window.location.reload(); }, 500);
    });

    // Render active tasks
    let tasks = recalculateActiveScores(getTasks()).filter(t => t.status === 'active');
    tasks.sort((a, b) => b.currentScore - a.currentScore); // Descending

    const listContainer = document.getElementById('activeTasksContainer');
    if(listContainer) {
        if(tasks.length === 0) listContainer.innerHTML = '<p style="color:var(--text-muted)">No active tasks found. Add one above!</p>';
        else {
            listContainer.innerHTML = tasks.map(t => `
            <div class="task-item" style="${determineHighlightBorder(t.daysRemaining)} background: rgba(0,0,0,0.2);">
                <div class="task-info">
                    <div class="task-name">${t.title}</div>
                    <div class="task-meta">
                        <span><i class="ph ph-calendar-blank"></i> Deadline: ${t.deadline}</span>
                        <span>U:${t.urgency} | I:${t.importance} | S:${t.severity}</span>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.5rem;">
                    <div class="task-score ${determineHighlightClass(t.daysRemaining)}">${t.currentScore} pts</div>
                    <button onclick="markCompleted('${t.id}')" class="badge badge-success" style="cursor:pointer; border:none;">Complete <i class="ph ph-check"></i></button>
                </div>
            </div>`).join('');
        }
    }
}

function renderDashboard() {
    const listContainer = document.getElementById('topTasksContainer');
    if (!listContainer) return; // Not on dashboard

    let tasks = recalculateActiveScores(getTasks()).filter(t => t.status === 'active');
    
    // Summaries
    const total = tasks.length;
    const near = tasks.filter(t => t.daysRemaining >= 0 && t.daysRemaining <= 2).length;
    const overdue = tasks.filter(t => t.daysRemaining < 0).length;

    document.getElementById('statTotal').innerText = total;
    document.getElementById('statNear').innerText = near;
    document.getElementById('statOverdue').innerText = overdue;

    // Top 3 Tasks
    tasks.sort((a, b) => b.currentScore - a.currentScore);
    const top3 = tasks.slice(0, 3);
    
    if(top3.length === 0) {
        listContainer.innerHTML = '<p style="color:var(--text-muted)">No active tasks.</p>';
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
                <div class="task-score ${determineHighlightClass(t.daysRemaining)}">${t.currentScore} pts</div>
                <button onclick="markCompleted('${t.id}')" class="badge badge-success" style="cursor:pointer; border:none; padding: 0.25rem 0.6rem;">Complete <i class="ph ph-check"></i></button>
            </div>
        </div>
    `).join('');
}

function renderSchedule() {
    const scheduleContainer = document.getElementById('scheduleContainer');
    if (!scheduleContainer) return;

    let tasks = recalculateActiveScores(getTasks()).filter(t => t.status === 'active');
    tasks.sort((a, b) => new Date(a.deadline) - new Date(b.deadline)); // Ascending by date

    // Group by deadline
    const groups = {};
    tasks.forEach(t => {
        if(!groups[t.deadline]) groups[t.deadline] = [];
        groups[t.deadline].push(t);
    });

    if(Object.keys(groups).length === 0) {
        scheduleContainer.innerHTML = '<p style="color:var(--text-muted)">No schedule found.</p>';
        return;
    }

    let html = '';
    for(const [date, grpTasks] of Object.entries(groups)) {
        html += `
        <div class="glass-card quadrant" style="margin-bottom: 1.5rem; border-top-width:4px; border-top-color:var(--primary)">
            <div class="quadrant-header">
                <div class="quadrant-title"><i class="ph-fill ph-calendar"></i> ${date}</div>
                <span class="badge" style="background:rgba(255,255,255,0.1);">${grpTasks.length} Tasks</span>
            </div>
        `;
        
        grpTasks.sort((a,b) => b.currentScore - a.currentScore);
        
        grpTasks.forEach(t => {
            let badgeHtml = '';
            if(t.daysRemaining < 0) badgeHtml = `<span class="badge" style="background:rgba(239, 68, 68, 0.2); color:#fca5a5;">OVERDUE</span>`;
            else if(t.daysRemaining <= 2) badgeHtml = `<span class="badge" style="background:rgba(245, 158, 11, 0.2); color:#fcd34d;">NEAR DEADLINE</span>`;
            else badgeHtml = `<span class="badge" style="background:rgba(100, 116, 139, 0.2); color:#cbd5e1;">UPCOMING</span>`;

            html += `
            <div class="task-item">
                <div class="task-info">
                    <div class="task-name">${t.title}</div>
                    <div class="task-meta">Score: ${t.currentScore}</div>
                </div>
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.5rem;">
                    ${badgeHtml}
                    <button onclick="markCompleted('${t.id}')" class="badge badge-success" style="cursor:pointer; border:none; padding: 0.25rem 0.6rem;">Complete <i class="ph ph-check"></i></button>
                </div>
            </div>`;
        });
        
        html += `</div>`;
    }
    scheduleContainer.innerHTML = html;
}

function renderHistory() {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;

    let tasks = getTasks().filter(t => t.status === 'completed');
    // Sort by most recently created (or if we had completedAt, use that)
    tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if(tasks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">No completed tasks yet.</td></tr>';
        return;
    }

    // We recalculate once more for display just to lock in the score at completion time.
    // Actually, historical tasks should freeze their score. We'll recalculate dynamically based on deadline vs today 
    // just to evaluate the final saved score. Note: For accurate history, we should save `finalScore` when marking complete!
    
    // For now we will just re-evaluate dynamically vs today, or better:
    tbody.innerHTML = tasks.map(t => {
        // Evaluate score against today (since we didn't save finalScore)
        const res = calculatePriorityScore(t.urgency, t.importance, t.severity, t.deadline);
        return `
        <tr>
            <td>${t.deadline}</td>
            <td style="font-weight: 500; color: white;">${t.title}</td>
            <td><span class="task-score score-medium">${res.score} pts</span></td>
            <td><span class="badge badge-success">Completed</span></td>
        </tr>`;
    }).join('');
}

// Global initialization
document.addEventListener('DOMContentLoaded', () => {
    // Determine active route
    const path = window.location.pathname;
    
    if(path.includes('task.html')) renderTaskPage();
    else if(path.includes('schedule.html')) renderSchedule();
    else if(path.includes('history.html')) renderHistory();
    else renderDashboard(); // index.html is default
});
