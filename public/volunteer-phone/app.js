const connectionState = document.querySelector('#connectionState');
const trackingState = document.querySelector('#trackingState');
const lastSent = document.querySelector('#lastSent');
const startButton = document.querySelector('#startButton');
const stopButton = document.querySelector('#stopButton');
const displayNameInput = document.querySelector('#displayName');
const phoneInput = document.querySelector('#phone');
const volunteerUserIdInput = document.querySelector('#volunteerUserId');
const emergencyIdInput = document.querySelector('#emergencyId');

const victimMedicalPanel = document.querySelector('#victimMedicalPanel');
const displayBloodType = document.querySelector('#displayBloodType');
const displayAllergies = document.querySelector('#displayAllergies');
const displayConditions = document.querySelector('#displayConditions');
const displayEmergencyContact = document.querySelector('#displayEmergencyContact');
const enablePushBtn = document.querySelector('#enablePushBtn');
const pushStatus = document.querySelector('#pushStatus');

const chatPanel = document.querySelector('#chatPanel');
const chatMessages = document.querySelector('#chatMessages');
const chatInput = document.querySelector('#chatInput');
const sendChatBtn = document.querySelector('#sendChatBtn');
const droneBtn = document.querySelector('#droneBtn');

const state = {
  socket: null,
  watchId: null,
  map: null,
  myMarker: null,
  victimMarker: null,
  victimLocation: null,
  responders: new Map(),
  droneMarker: null,
  isDroneDeployed: false,
};

function initLeafletMap(victimLat, victimLng) {
  if (!window.L || state.map) return;

  document.querySelector('#mapFallback').style.display = 'none';

  state.victimLocation = L.latLng(victimLat, victimLng);
  
  state.map = L.map('map', { zoomControl: false, attributionControl: false }).setView(state.victimLocation, 15);
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(state.map);

  state.victimMarker = L.marker(state.victimLocation, {
    icon: L.divIcon({
      html: '<div style="background: red; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>',
      className: ''
    })
  }).addTo(state.map).bindPopup('Victim');
}

function applyResponderLocation(payload) {
  const volunteerId = payload.volunteerUserId;
  const lat = Number(payload.latitude);
  const lng = Number(payload.longitude);

  if (!state.map) return;
  
  // Self tracking
  if (volunteerId === getVolunteerPayload().volunteerUserId) {
    if (!state.myMarker) {
      state.myMarker = L.marker([lat, lng]).addTo(state.map).bindPopup('Me');
      
      L.Routing.control({
        waypoints: [L.latLng(lat, lng), state.victimLocation],
        routeWhileDragging: false,
        addWaypoints: false,
        show: false,
        lineOptions: { styles: [{ color: '#3b82f6', weight: 5 }] },
        createMarker: () => null,
      }).addTo(state.map);
    } else {
      state.myMarker.setLatLng([lat, lng]);
    }
    return;
  }

  // Other responders (Swarm)
  if (!state.responders.has(volunteerId)) {
    const marker = L.marker([lat, lng], {
      icon: L.divIcon({
        html: '<div style="background: #10b981; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white;"></div>',
        className: ''
      })
    }).addTo(state.map).bindPopup(payload.displayName || 'Backup Responder');
    
    state.responders.set(volunteerId, { marker });
  } else {
    state.responders.get(volunteerId).marker.setLatLng([lat, lng]);
  }
}

function setTrackingState(title, detail) {
  trackingState.textContent = title;
  lastSent.textContent = detail;
}

function getVolunteerPayload() {
  const userStr = localStorage.getItem('fastaid_user');
  let vId = volunteerUserIdInput.value.trim() || `demo-${state.socket.id}`;
  let vName = displayNameInput.value.trim() || 'Volunteer';
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      vId = user.id || vId;
      vName = user.name || vName;
    } catch(e){}
  }
  return {
    volunteerUserId: vId,
    displayName: vName,
    phone: phoneInput.value.trim(),
    emergencyId: emergencyIdInput.value.trim() || null,
  };
}

function connectSocket() {
  if (!window.io) {
    connectionState.textContent = 'Socket.IO unavailable';
    return;
  }

  const userStr = localStorage.getItem('fastaid_user');
  let vId = '665000000000000000000101';
  let vName = 'John Responder';
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      vId = user.id || vId;
      vName = user.name || vName;
    } catch(e){}
  }

  state.socket = io();

  state.socket.on('connect', () => {
    connectionState.textContent = 'Connected to FastAid server';
    state.socket.emit('volunteer:join', {
      volunteerUserId: vId,
      displayName: vName,
      phone: '01700000000',
    });
  });

  state.socket.on('disconnect', () => {
    connectionState.textContent = 'Disconnected';
  });

  state.socket.on('tracking:ready', () => {
    trackingState.textContent = 'Ready to send GPS';
  });

  state.socket.on('emergency:live', (payload) => {
    emergencyIdInput.value = payload.emergencyId || '';
    
    if (payload.medicalProfile) {
      victimMedicalPanel.style.display = 'block';
      displayBloodType.textContent = payload.medicalProfile.bloodType || 'Unknown';
      displayAllergies.textContent = payload.medicalProfile.allergies || 'None listed';
      displayConditions.textContent = payload.medicalProfile.preExistingConditions || 'None listed';
      
      if (payload.medicalProfile.emergencyContactName && payload.medicalProfile.emergencyContactPhone) {
        displayEmergencyContact.textContent = `${payload.medicalProfile.emergencyContactName} (${payload.medicalProfile.emergencyContactPhone})`;
      } else {
        displayEmergencyContact.textContent = 'Not provided';
      }
    } else {
      victimMedicalPanel.style.display = 'none';
    }
    
    if (typeof pollForResponderAiAnalysis === 'function') {
      pollForResponderAiAnalysis(payload.emergencyId);
    }
    
    if (payload.autoGps) {
      initLeafletMap(payload.autoGps.latitude, payload.autoGps.longitude);
    }
    
    if (payload.emergencyId) {
      state.socket.emit('volunteer:join_emergency', { emergencyId: payload.emergencyId });
    }
  });

  state.socket.on('tracking:snapshot', (responders) => {
    responders.forEach(applyResponderLocation);
  });
  state.socket.on('responder:location', applyResponderLocation);
  state.socket.on('responder:offline', (payload) => {
    if (state.responders.has(payload.volunteerUserId)) {
      state.map.removeLayer(state.responders.get(payload.volunteerUserId).marker);
      state.responders.delete(payload.volunteerUserId);
    }
  });

  state.socket.on('webrtc:offer', (payload) => handleWebRTCOffer(payload));
  state.socket.on('webrtc:candidate', (payload) => handleWebRTCCandidate(payload.candidate));
}

let peerConnection = null;
let dataChannel = null;
let iceCandidateQueue = [];

const rtcConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

function appendChatMessage(text, isSelf) {
  const div = document.createElement('div');
  div.textContent = text;
  div.style.padding = '8px 12px';
  div.style.borderRadius = '12px';
  div.style.maxWidth = '80%';
  div.style.wordBreak = 'break-word';
  
  if (isSelf) {
    div.style.background = '#0f766e';
    div.style.color = 'white';
    div.style.alignSelf = 'flex-end';
  } else {
    div.style.background = 'rgba(255,255,255,0.1)';
    div.style.color = 'white';
    div.style.alignSelf = 'flex-start';
  }
  
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function handleWebRTCOffer(payload) {
  chatPanel.style.display = 'block';

  peerConnection = new RTCPeerConnection(rtcConfig);
  
  peerConnection.ondatachannel = (event) => {
    dataChannel = event.channel;
    dataChannel.onopen = () => {
      appendChatMessage('Secure P2P connection established.', false);
    };
    dataChannel.onmessage = (e) => {
      appendChatMessage(e.data, false);
    };
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate && state.socket) {
      state.socket.emit('webrtc:candidate', {
        emergencyId: emergencyIdInput.value.trim(),
        candidate: event.candidate
      });
    }
  };

  peerConnection.setRemoteDescription(new RTCSessionDescription(payload.offer))
    .then(() => peerConnection.createAnswer())
    .then(answer => peerConnection.setLocalDescription(answer))
    .then(() => {
      iceCandidateQueue.forEach(c => peerConnection.addIceCandidate(new RTCIceCandidate(c)).catch(console.error));
      iceCandidateQueue = [];
      if (state.socket) {
        state.socket.emit('webrtc:answer', {
          emergencyId: emergencyIdInput.value.trim(),
          answer: peerConnection.localDescription
        });
      }
    })
    .catch(console.error);
}

function handleWebRTCCandidate(candidate) {
  if (peerConnection) {
    if (!peerConnection.remoteDescription) {
      iceCandidateQueue.push(candidate);
    } else {
      peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
    }
  }
}

sendChatBtn.addEventListener('click', () => {
  const text = chatInput.value.trim();
  if (text) {
    if (dataChannel && dataChannel.readyState === 'open') {
      dataChannel.send(text);
      appendChatMessage(text, true);
      chatInput.value = '';
    } else {
      appendChatMessage('System: Connection not ready. Please wait...', true);
    }
  }
});

chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendChatBtn.click();
});

async function startSharing() {
  if (!navigator.geolocation) {
    setTrackingState('GPS unavailable', 'This phone browser does not support geolocation.');
    return;
  }

  if (!state.socket || !state.socket.connected) {
    setTrackingState('Server unavailable', 'Socket connection is not ready.');
    return;
  }

  const volunteer = getVolunteerPayload();
  
  if (volunteer.emergencyId) {
    try {
      await fetch(`/api/emergencies/${volunteer.emergencyId}/accept`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      state.socket.emit('volunteer:join_emergency', { emergencyId: volunteer.emergencyId });
    } catch (e) {
      console.error("Failed to accept emergency", e);
    }
  }

  state.socket.emit('volunteer:join', volunteer);

  state.watchId = navigator.geolocation.watchPosition(
    (position) => {
      const latestVolunteer = getVolunteerPayload();
      const payload = {
        ...latestVolunteer,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed,
        heading: position.coords.heading,
      };

      state.socket.emit('volunteer:location', payload, (response) => {
        if (!response || !response.ok) {
          setTrackingState('Location rejected', response ? response.error : 'No server response.');
          return;
        }

        const lat = payload.latitude.toFixed(5);
        const lng = payload.longitude.toFixed(5);
        const saved = response.persisted ? 'saved to MongoDB' : 'broadcast only';
        setTrackingState('GPS sharing live', `${lat}, ${lng} - ${saved}`);
      });
    },
    () => {
      setTrackingState('Location permission needed', 'Allow GPS permission and try again.');
    },
    {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 8000,
    }
  );

  startButton.disabled = true;
  stopButton.disabled = false;
  setTrackingState('Starting GPS sharing', 'Waiting for first location...');
}

function stopSharing() {
  if (state.watchId !== null) {
    navigator.geolocation.clearWatch(state.watchId);
  }

  state.watchId = null;
  startButton.disabled = false;
  stopButton.disabled = true;
  setTrackingState('GPS sharing stopped', 'No live location is being sent.');
}

function loadUserIdentity() {
  try {
    const userStr = localStorage.getItem('fastaid_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.name) displayNameInput.value = user.name;
      if (user.phone) phoneInput.value = user.phone;
      if (user._id || user.id) volunteerUserIdInput.value = user._id || user.id;
    }
  } catch (e) {
    console.error('Error loading user identity', e);
  }
}

// Convert VAPID public key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function initPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    pushStatus.textContent = 'Not supported by browser';
    enablePushBtn.style.display = 'none';
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      pushStatus.textContent = 'Enabled';
      pushStatus.style.color = '#34d399';
      enablePushBtn.style.display = 'none';
    } else {
      pushStatus.textContent = 'Not enabled';
    }
  } catch (error) {
    console.error('Service Worker Registration Failed:', error);
  }
}

async function subscribeToPush() {
  enablePushBtn.textContent = 'Enabling...';
  enablePushBtn.disabled = true;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Permission denied');
    }

    const reg = await navigator.serviceWorker.ready;

    // Fetch VAPID key
    const res = await fetch('/api/push/public-key');
    const { publicKey } = await res.json();
    
    if (!publicKey) {
      throw new Error('VAPID public key not found');
    }

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    // Send subscription to server
    const subRes = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(subscription)
    });

    if (subRes.ok) {
      pushStatus.textContent = 'Enabled';
      pushStatus.style.color = '#34d399';
      enablePushBtn.style.display = 'none';
    } else {
      throw new Error('Failed to save subscription');
    }
  } catch (err) {
    console.error(err);
    pushStatus.textContent = 'Error';
    enablePushBtn.textContent = 'Enable';
    enablePushBtn.disabled = false;
  }
}

function dispatchDrone() {
  if (!state.map || !state.victimLocation || state.isDroneDeployed) return;
  state.isDroneDeployed = true;

  droneBtn.innerHTML = 'Drone En Route...';
  droneBtn.style.background = '#4f46e5';
  droneBtn.disabled = true;

  // Spawn drone 1.5km to the North-East
  const startLat = state.victimLocation.lat + 0.015;
  const startLng = state.victimLocation.lng + 0.015;
  
  const droneIcon = L.divIcon({
    html: '<div style="background: #4f46e5; width: 24px; height: 24px; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.5);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path><circle cx="12" cy="12" r="4"></circle></svg></div>',
    className: ''
  });

  state.droneMarker = L.marker([startLat, startLng], { icon: droneIcon, zIndexOffset: 1000 }).addTo(state.map);
  
  const flightPath = L.polyline([ [startLat, startLng], state.victimLocation ], { color: '#6366f1', dashArray: '5, 10', weight: 3 }).addTo(state.map);

  let progress = 0;
  const duration = 4000; // 4 seconds flight time
  const startTime = performance.now();

  function animateDrone(time) {
    progress = (time - startTime) / duration;
    if (progress < 1) {
      const currentLat = startLat + (state.victimLocation.lat - startLat) * progress;
      const currentLng = startLng + (state.victimLocation.lng - startLng) * progress;
      state.droneMarker.setLatLng([currentLat, currentLng]);
      requestAnimationFrame(animateDrone);
    } else {
      // Arrived
      state.droneMarker.setLatLng(state.victimLocation);
      
      // Drop AED icon
      const aedIcon = L.divIcon({
        html: '<div style="background: #ef4444; color: white; font-weight: bold; padding: 2px 6px; border-radius: 4px; border: 2px solid white; font-size: 10px; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.4);">AED</div>',
        className: ''
      });
      L.marker(state.victimLocation, { icon: aedIcon }).addTo(state.map);
      
      droneBtn.innerHTML = 'AED Delivered Successfully';
      droneBtn.style.background = '#10b981';
      droneBtn.style.borderColor = '#34d399';
    }
  }
  
  requestAnimationFrame(animateDrone);
}

if (droneBtn) {
  droneBtn.addEventListener('click', dispatchDrone);
}

async function pollForResponderAiAnalysis(emergencyId) {
  const panel = document.getElementById('aiResponderPanel');
  const severityEl = document.getElementById('aiSeverity');
  const injuriesEl = document.getElementById('aiInjuries');
  const adviceList = document.getElementById('aiResponderAdviceList');
  
  if (panel) panel.style.display = 'block';

  let attempts = 0;
  const interval = setInterval(async () => {
    attempts++;
    try {
      const res = await fetch(`/api/emergencies/${emergencyId}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const { data } = await res.json();
        if (data && data.aiAnalysis && data.aiAnalysis.responderAdvice && data.aiAnalysis.responderAdvice.length > 0) {
          clearInterval(interval);
          
          severityEl.textContent = data.aiAnalysis.severity || 'Unknown';
          const colorMap = { 'Low': '#34d399', 'Medium': '#fbbf24', 'High': '#f97316', 'Critical': '#ef4444' };
          severityEl.style.color = colorMap[data.aiAnalysis.severity] || 'white';
          
          injuriesEl.textContent = (data.aiAnalysis.keyInjuries || []).join(', ') || 'None specified';
          
          adviceList.innerHTML = '';
          data.aiAnalysis.responderAdvice.forEach(advice => {
            const li = document.createElement('li');
            li.textContent = advice;
            li.style.marginBottom = '6px';
            adviceList.appendChild(li);
          });
          return;
        }
      }
    } catch (e) {
      console.error(e);
    }
    
    if (attempts > 15) {
      clearInterval(interval);
      if (severityEl.textContent.includes('Analyzing')) {
        severityEl.textContent = 'Analysis timeout';
        adviceList.innerHTML = '<li>Proceed with standard caution and protocols.</li>';
      }
    }
  }, 2000);
}

enablePushBtn.addEventListener('click', subscribeToPush);
startButton.addEventListener('click', startSharing);
stopButton.addEventListener('click', stopSharing);
connectSocket();
loadUserIdentity();
initPush();

