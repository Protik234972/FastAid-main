const state = {
  sessionRole: 'Admin',
  activeView: 'certifications',
  certifications: [
    {
      id: 'vp_101',
      name: 'Ayesha Rahman',
      email: 'ayesha.rahman@example.com',
      phone: '+8801711002200',
      certificationUrl: 'uploads/cert-ayesha.pdf',
      reliabilityScore: 91,
      verificationStatus: 'Pending',
    },
    {
      id: 'vp_102',
      name: 'Farhan Karim',
      email: 'farhan.karim@example.com',
      phone: '+8801812453344',
      certificationUrl: 'uploads/cert-farhan.pdf',
      reliabilityScore: 83,
      verificationStatus: 'Pending',
    },
    {
      id: 'vp_103',
      name: 'Nusrat Jahan',
      email: 'nusrat.jahan@example.com',
      phone: '+8801912347788',
      certificationUrl: 'uploads/cert-nusrat.pdf',
      reliabilityScore: 74,
      verificationStatus: 'Verified',
    },
  ],
  services: [
    { name: 'Emergency API', uptime: '99.99%', latencyMs: 112, status: 'OK' },
    { name: 'Volunteer matching', uptime: '99.95%', latencyMs: 186, status: 'OK' },
    { name: 'Push notifications', uptime: '99.72%', latencyMs: 430, status: 'Warning' },
    { name: 'Payment gateway', uptime: '99.91%', latencyMs: 221, status: 'OK' },
  ],
  alerts: [
    { level: 'Warning', title: 'Push latency elevated', detail: 'p95 response time above 400ms for 8 minutes.' },
    { level: 'Critical', title: 'Failed SMS fallback spike', detail: 'Nagad district gateway retries above threshold.' },
  ],
  users: [
    {
      name: 'Sadia Akter',
      role: 'Victim',
      phone: '+8801700001111',
      email: 'sadia.akter@example.com',
      verificationStatus: 'Verified',
    },
    {
      name: 'Ayesha Rahman',
      role: 'Volunteer',
      phone: '+8801711002200',
      email: 'ayesha.rahman@example.com',
      verificationStatus: 'Pending',
    },
    {
      name: 'Mahmud Hasan',
      role: 'Admin',
      phone: '+8801611112222',
      email: 'mahmud.hasan@example.com',
      verificationStatus: 'Verified',
    },
  ],
  logs: [
    '[2026-05-15T05:21:04Z] INFO emergency.create victimId=6645f1 status=Pending',
    '[2026-05-15T05:21:06Z] INFO matching.nearby responders=7 radius=5000ms=311',
    '[2026-05-15T05:21:07Z] WARN push.timeout volunteerId=6630b4 fallback=sms',
    '[2026-05-15T05:22:44Z] AUDIT admin.approveCertification profileId=vp_103',
    '[2026-05-15T05:23:09Z] SECURITY rbac.denied role=Volunteer resource=/admin/logs',
  ],
  liveResponders: [],
  liveEmergencies: [],
  pastEmergencies: [],
  replayMap: null,
  socket: null,
};

const viewTitles = {
  certifications: 'Volunteer certifications',
  monitoring: 'System monitoring',
  logs: 'System logs',
  replay: 'Incident Replay',
  users: 'Sensitive user records',
};

const roleSelect = document.querySelector('#roleSelect');
const sessionRole = document.querySelector('#sessionRole');
const viewTitle = document.querySelector('#viewTitle');
const accessDenied = document.querySelector('#accessDenied');
const certSearch = document.querySelector('#certSearch');

function isAdmin() {
  return state.sessionRole === 'Admin';
}

function canView(viewName) {
  return !['logs', 'users', 'replay'].includes(viewName) || isAdmin();
}

function setActiveView(viewName) {
  if (!canView(viewName)) {
    accessDenied.hidden = false;
    return;
  }

  accessDenied.hidden = true;
  state.activeView = viewName;
  viewTitle.textContent = viewTitles[viewName];

  document.querySelectorAll('.view').forEach((view) => view.classList.remove('active'));
  document.querySelector(`#${viewName}View`).classList.add('active');

  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.view === viewName);
  });

  if (viewName === 'replay') {
    if (!state.replayMap) initReplayMap();
    if (state.pastEmergencies.length === 0) fetchPastEmergencies();
  }
}

function renderAccessState() {
  sessionRole.textContent = state.sessionRole;
  document.querySelectorAll('.admin-only').forEach((element) => {
    element.classList.toggle('locked', !isAdmin());
    element.setAttribute('aria-disabled', String(!isAdmin()));
  });

  if (!canView(state.activeView)) {
    setActiveView('certifications');
  }
}

function renderMetrics() {
  const pendingCount = state.certifications.filter((item) => item.verificationStatus === 'Pending').length;
  const openAlerts = state.alerts.length + state.liveEmergencies.length;
  const averageLatency = Math.round(
    state.services.reduce((sum, service) => sum + service.latencyMs, 0) / state.services.length
  );

  document.querySelector('#pendingCount').textContent = pendingCount;
  document.querySelector('#uptimeValue').textContent = '99.94%';
  document.querySelector('#cpuValue').textContent = `${Math.min(96, 41 + openAlerts * 8)}%`;
  document.querySelector('#alertCount').textContent = openAlerts;
  document.querySelector('#cpuValue').title = `Average API latency ${averageLatency}ms`;
}

function renderCertifications() {
  const query = certSearch.value.trim().toLowerCase();
  const rows = state.certifications.filter((item) =>
    [item.name, item.email, item.phone].some((value) => value.toLowerCase().includes(query))
  );

  document.querySelector('#certificationRows').innerHTML = rows
    .map(
      (item) => `
        <tr>
          <td>
            <div class="person">
              <strong>${item.name}</strong>
              <span>${item.email}</span>
            </div>
          </td>
          <td>${item.phone}</td>
          <td><a href="${item.certificationUrl}" target="_blank" rel="noreferrer">Open upload</a></td>
          <td>${item.reliabilityScore}</td>
          <td><span class="status-pill ${item.verificationStatus.toLowerCase()}">${item.verificationStatus}</span></td>
          <td>
            <div class="row-actions">
              <button class="action-button approve" type="button" data-action="approve" data-id="${item.id}">Approve</button>
              <button class="action-button reject" type="button" data-action="reject" data-id="${item.id}">Reject</button>
            </div>
          </td>
        </tr>
      `
    )
    .join('');
}

function renderMonitoring() {
  document.querySelector('#serviceList').innerHTML = state.services
    .map(
      (service) => `
        <article class="service-item">
          <div>
            <strong>${service.name}</strong>
            <span>Uptime ${service.uptime} · p95 ${service.latencyMs}ms</span>
          </div>
          <span class="status-pill ${service.status.toLowerCase()}">${service.status}</span>
        </article>
      `
    )
    .join('');

  document.querySelector('#alertList').innerHTML = state.alerts
    .map(
      (alert) => `
        <article class="alert-item">
          <div>
            <strong>${alert.title}</strong>
            <span>${alert.detail}</span>
          </div>
          <span class="status-pill ${alert.level.toLowerCase()}">${alert.level}</span>
        </article>
      `
    )
    .join('');

  document.querySelector('#liveResponderList').innerHTML =
    state.liveResponders.length === 0
      ? '<article class="service-item"><div><strong>No live responders</strong><span>Open Volunteer Phone and start GPS sharing.</span></div><span class="status-pill warning">Waiting</span></article>'
      : state.liveResponders
          .map(
            (responder) => `
              <article class="service-item">
                <div>
                  <strong>${responder.displayName}</strong>
                  <span>ID ${responder.volunteerUserId} - ${Number(responder.latitude).toFixed(5)}, ${Number(responder.longitude).toFixed(5)}</span>
                </div>
                <span class="status-pill ok">Live</span>
              </article>
            `
          )
          .join('');

  document.querySelector('#liveEmergencyList').innerHTML =
    state.liveEmergencies.length === 0
      ? '<article class="alert-item"><div><strong>No live requests</strong><span>Victim requests will appear here.</span></div><span class="status-pill ok">Clear</span></article>'
      : state.liveEmergencies
          .map(
            (emergency) => `
              <article class="alert-item">
                <div>
                  <strong>${emergency.victimName || 'Victim'} - ${emergency.type || 'Emergency'}</strong>
                  <span>${emergency.description || emergency.note || 'Emergency assistance needed.'}</span>
                </div>
                <span class="status-pill critical">Live</span>
              </article>
            `
          )
          .join('');
}

function renderSensitiveUsers() {
  if (!isAdmin()) {
    document.querySelector('#userRows').innerHTML = '';
    return;
  }

  document.querySelector('#userRows').innerHTML = state.users
    .map(
      (user) => `
        <tr>
          <td>${user.name}</td>
          <td>${user.role}</td>
          <td>${user.phone}</td>
          <td>${user.email}</td>
          <td><span class="status-pill ${user.verificationStatus.toLowerCase()}">${user.verificationStatus}</span></td>
        </tr>
      `
    )
    .join('');
}

function renderLogs() {
  document.querySelector('#logStream').textContent = isAdmin()
    ? state.logs.join('\n')
    : 'Access denied: Admin role required.';
}

function renderAll() {
  renderAccessState();
  renderMetrics();
  renderCertifications();
  renderMonitoring();
  renderSensitiveUsers();
  renderLogs();
  renderReplayList();
}

function renderReplayList() {
  if (!isAdmin() || state.activeView !== 'replay') return;
  const list = document.querySelector('#incidentList');
  if (state.pastEmergencies.length === 0) {
    list.innerHTML = '<li style="padding: 15px; color: var(--text-muted); text-align: center;">No incidents found</li>';
    return;
  }
  
  list.innerHTML = state.pastEmergencies.map(inc => `
    <li class="incident-item" data-id="${inc._id}" style="padding: 15px; border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.2s;">
      <strong style="display: block; color: var(--text-color);">${inc.victimName || 'Unknown Victim'} - ${inc.type || 'Emergency'}</strong>
      <span style="font-size: 0.85rem; color: var(--text-muted);">${new Date(inc.createdAt).toLocaleString()}</span>
    </li>
  `).join('');
}

function initReplayMap() {
  if (!window.L) return;
  state.replayMap = L.map('replayMap', { zoomControl: false, attributionControl: false }).setView([23.8103, 90.4125], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(state.replayMap);
}

async function fetchPastEmergencies() {
  try {
    const res = await fetch('/api/emergencies', { headers: getAuthHeaders() });
    if (res.ok) {
      const result = await res.json();
      state.pastEmergencies = result.data.emergencies.filter(e => e.location && e.location.coordinates && e.location.coordinates.length === 2);
      renderReplayList();
    }
  } catch (err) {
    console.error('Failed to load past emergencies', err);
  }
}

async function playIncident(id) {
  const incident = state.pastEmergencies.find(e => e._id === id);
  if (!incident || !state.replayMap) return;

  // Clear map layers
  state.replayMap.eachLayer(layer => {
    if (layer instanceof L.Marker || layer instanceof L.Routing.Control) {
      state.replayMap.removeLayer(layer);
    }
  });

  const vLng = incident.location.coordinates[0];
  const vLat = incident.location.coordinates[1];

  L.marker([vLat, vLng], {
    icon: L.divIcon({ html: '<div style="background: red; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white;"></div>', className: '' })
  }).addTo(state.replayMap).bindPopup('Victim Location').openPopup();

  state.replayMap.setView([vLat, vLng], 14);

  // Render Timeline
  const timeline = document.querySelector('#timelineEvents');
  const responder = incident.assignedVolunteerId ? (incident.assignedVolunteerId.name || incident.assignedVolunteerId) : 'None';
  
  timeline.innerHTML = `
    <div style="margin-bottom: 10px;"><strong>[${new Date(incident.createdAt).toLocaleTimeString()}]</strong> Request Created</div>
    <div style="margin-bottom: 10px;"><strong>Status:</strong> ${incident.status}</div>
    <div style="margin-bottom: 10px;"><strong>Details:</strong> ${incident.description}</div>
    <div style="margin-bottom: 10px;"><strong>Primary Responder:</strong> ${responder}</div>
  `;

  // Draw simulated responder path if resolved
  if (incident.status === 'Resolved' && incident.assignedVolunteerId) {
    // Simulated responder origin slightly away from victim
    const rLat = vLat + (Math.random() - 0.5) * 0.05;
    const rLng = vLng + (Math.random() - 0.5) * 0.05;
    L.Routing.control({
      waypoints: [ L.latLng(rLat, rLng), L.latLng(vLat, vLng) ],
      routeWhileDragging: false,
      addWaypoints: false,
      show: false,
      lineOptions: { styles: [{ color: '#10b981', weight: 4 }] },
      createMarker: () => null
    }).addTo(state.replayMap);
    timeline.innerHTML += `<div style="margin-bottom: 10px; color: #10b981;"><strong>[Resolved]</strong> Responder Reached Victim</div>`;
  }
}

document.querySelector('#incidentList').addEventListener('click', e => {
  const item = e.target.closest('.incident-item');
  if (item) {
    document.querySelectorAll('.incident-item').forEach(el => el.style.background = 'transparent');
    item.style.background = 'rgba(255,255,255,0.1)';
    playIncident(item.dataset.id);
  }
});

document.querySelector('#refreshReplayBtn').addEventListener('click', fetchPastEmergencies);

async function loadDashboardData() {
  if (!isAdmin()) {
    return;
  }

  try {
    const response = await fetch('/api/admin/dashboard-data', {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      return;
    }

    const result = await response.json();
    state.certifications = result.data.certifications;
    state.users = result.data.users;
    state.logs.unshift(`[${new Date().toISOString()}] INFO admin.dashboardDataLoaded`);
    renderAll();
  } catch (error) {
    state.logs.unshift(`[${new Date().toISOString()}] WARN admin.dashboardDataLoadFailed ${error.message}`);
    renderAll();
  }
}

function connectAdminRealtime() {
  if (!window.io) {
    state.logs.unshift(`[${new Date().toISOString()}] WARN socket.unavailable`);
    renderAll();
    return;
  }

  state.socket = io();

  state.socket.on('connect', () => {
    state.logs.unshift(`[${new Date().toISOString()}] INFO socket.connected id=${state.socket.id}`);
    if (isAdmin()) {
      state.socket.emit('admin:join');
    }
    renderAll();
  });

  state.socket.on('tracking:snapshot', (responders) => {
    state.liveResponders = responders;
    renderAll();
  });

  state.socket.on('responder:location', (responder) => {
    const existingIndex = state.liveResponders.findIndex(
      (item) => item.volunteerUserId === responder.volunteerUserId
    );

    if (existingIndex >= 0) {
      state.liveResponders[existingIndex] = responder;
    } else {
      state.liveResponders.unshift(responder);
    }

    state.logs.unshift(
      `[${new Date().toISOString()}] INFO responder.location volunteerId=${responder.volunteerUserId}`
    );
    renderAll();
  });

  state.socket.on('emergency:live', (emergency) => {
    state.liveEmergencies.unshift(emergency);
    state.liveEmergencies = state.liveEmergencies.slice(0, 10);
    state.logs.unshift(
      `[${new Date().toISOString()}] INFO emergency.live victim=${emergency.victimName || 'Victim'}`
    );
    renderAll();
  });
}

async function reviewCertification(profileId, action) {
  if (!isAdmin()) {
    accessDenied.hidden = false;
    return;
  }

  const profile = state.certifications.find((item) => item.id === profileId);

  if (!profile) {
    return;
  }

  try {
    const response = await fetch(`/api/admin/certifications/${profileId}/review`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ decision: action }),
    });

    if (response.ok) {
      profile.verificationStatus = action === 'approve' ? 'Verified' : 'Rejected';
      state.logs.unshift(
        `[${new Date().toISOString()}] AUDIT admin.${action}Certification profileId=${profileId}`
      );
      renderAll();
    } else {
      const errorData = await response.json();
      state.logs.unshift(`[${new Date().toISOString()}] ERROR admin.${action}Failed: ${errorData.error || 'Unknown error'}`);
      renderAll();
    }
  } catch (error) {
    state.logs.unshift(`[${new Date().toISOString()}] ERROR admin.${action}NetworkError: ${error.message}`);
    renderAll();
  }
}

document.querySelectorAll('.nav-tab').forEach((tab) => {
  tab.addEventListener('click', () => setActiveView(tab.dataset.view));
});

roleSelect.addEventListener('change', () => {
  state.sessionRole = roleSelect.value;
  renderAll();
});

certSearch.addEventListener('input', renderCertifications);

document.querySelector('#certificationRows').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');

  if (!button) {
    return;
  }

  reviewCertification(button.dataset.id, button.dataset.action);
});

document.querySelector('#refreshMetricsButton').addEventListener('click', () => {
  state.services = state.services.map((service) => ({
    ...service,
    latencyMs: Math.max(80, service.latencyMs + Math.round(Math.random() * 80 - 28)),
  }));

  renderAll();
});

renderAll();
loadDashboardData();
connectAdminRealtime();
