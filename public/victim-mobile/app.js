const DEFAULT_LOCATION = {
  lat: 23.8103,
  lng: 90.4125,
};

const FALLBACK_RESPONDER_LOCATION = {
  lat: 23.8176,
  lng: 90.4219,
};

const state = {
  selectedType: 'Medical',
  victimLocation: DEFAULT_LOCATION,
  responderLocation: FALLBACK_RESPONDER_LOCATION,
  map: null,
  victimMarker: null,
  responderMarker: null,
  routeLine: null,
  socket: null,
  requestSent: false,
  status: 'Pending',
  responders: new Map(),
  poiLayer: null,
  poisLoaded: false
};

const gpsStatus = document.querySelector('#gpsStatus');
const addressText = document.querySelector('#addressText');
const emergencyButton = document.querySelector('#emergencyButton');
const noteInput = document.querySelector('#noteInput');
const victimNameInput = document.querySelector('#victimNameInput');
const victimIdInput = document.querySelector('#victimIdInput');
const responderName = document.querySelector('#responderName');
const etaText = document.querySelector('#etaText');
const mapFallback = document.querySelector('#mapFallback');

const bloodTypeInput = document.querySelector('#bloodTypeInput');
const allergiesInput = document.querySelector('#allergiesInput');
const conditionsInput = document.querySelector('#conditionsInput');
const emergencyContactNameInput = document.querySelector('#emergencyContactNameInput');
const emergencyContactPhoneInput = document.querySelector('#emergencyContactPhoneInput');
const saveMedicalProfileBtn = document.querySelector('#saveMedicalProfileBtn');

const chatPanel = document.querySelector('#chatPanel');
const chatMessages = document.querySelector('#chatMessages');
const chatInput = document.querySelector('#chatInput');
const sendChatBtn = document.querySelector('#sendChatBtn');
const togglePoiBtn = document.querySelector('#togglePoiBtn');
const micButton = document.querySelector('#micButton');

let peerConnection = null;
let dataChannel = null;
let speechRecognition = null;
let isRecording = false;

// Initialize Speech Recognition if supported
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  speechRecognition = new SpeechRecognition();
  speechRecognition.continuous = true;
  speechRecognition.interimResults = true;
  speechRecognition.lang = 'en-US';

  speechRecognition.onresult = (event) => {
    let finalTranscript = '';
    let interimTranscript = '';
    
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }
    
    if (finalTranscript) {
      const currentVal = noteInput.value.trim();
      noteInput.value = currentVal ? `${currentVal} ${finalTranscript.trim()}` : finalTranscript.trim();
    }
  };

  speechRecognition.onerror = (event) => {
    console.error('Speech recognition error', event.error);
    stopRecording();
  };

  speechRecognition.onend = () => {
    if (isRecording) {
      // Auto-restart if it disconnected while we still want to record
      try { speechRecognition.start(); } catch(e){}
    }
  };
} else {
  if (micButton) {
    micButton.style.display = 'none';
  }
}

function startRecording() {
  if (!speechRecognition) return;
  isRecording = true;
  micButton.classList.add('recording');
  try { speechRecognition.start(); } catch(e) {}
}

function stopRecording() {
  if (!speechRecognition) return;
  isRecording = false;
  micButton.classList.remove('recording');
  try { speechRecognition.stop(); } catch(e) {}
}

if (micButton) {
  micButton.addEventListener('click', () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  });
}

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

function initWebRTC() {
  chatPanel.style.display = 'block';

  peerConnection = new RTCPeerConnection(rtcConfig);
  
  dataChannel = peerConnection.createDataChannel('emergency-chat');
  
  dataChannel.onopen = () => {
    appendChatMessage('Secure P2P connection established.', false);
  };
  
  dataChannel.onmessage = (event) => {
    appendChatMessage(event.data, false);
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate && state.socket) {
      state.socket.emit('webrtc:candidate', {
        emergencyId: state.emergencyId,
        candidate: event.candidate
      });
    }
  };

  peerConnection.createOffer()
    .then(offer => peerConnection.setLocalDescription(offer))
    .then(() => {
      if (state.socket) {
        state.socket.emit('webrtc:offer', {
          emergencyId: state.emergencyId,
          offer: peerConnection.localDescription
        });
      }
    })
    .catch(console.error);
}

function handleWebRTCAnswer(answer) {
  if (peerConnection) {
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer)).catch(console.error);
  }
}

function handleWebRTCCandidate(candidate) {
  if (peerConnection) {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
  }
}

sendChatBtn.addEventListener('click', () => {
  const text = chatInput.value.trim();
  if (text && dataChannel && dataChannel.readyState === 'open') {
    dataChannel.send(text);
    appendChatMessage(text, true);
    chatInput.value = '';
  }
});

chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendChatBtn.click();
});

function setStatus(message, detail) {
  gpsStatus.textContent = message;
  addressText.textContent = detail;
}

function updateSteps(nextStatus) {
  state.status = nextStatus;
  document.querySelectorAll('.step').forEach((step) => {
    const stepName = step.dataset.step;
    const order = ['Pending', 'Assigned', 'On the Way', 'Help Arrived'];
    step.classList.toggle('active', order.indexOf(stepName) <= order.indexOf(nextStatus));
  });
}

function haversineKm(a, b) {
  const radiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  return 2 * radiusKm * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function toRad(value) {
  return (value * Math.PI) / 180;
}

function updateEta() {
  const km = haversineKm(state.victimLocation, state.responderLocation);
  const minutes = Math.max(1, Math.round((km / 28) * 60));
  etaText.textContent = km < 0.08 ? 'Here' : `${minutes} min`;
}

function initLeafletMap() {
  if (!window.L) {
    mapFallback.querySelector('strong').textContent = 'Map unavailable';
    mapFallback.querySelector('span').textContent = 'Leaflet could not load. Check your internet connection.';
    return;
  }

  mapFallback.classList.add('hidden');
  state.map = L.map('map', {
    zoomControl: false,
    attributionControl: true,
  }).setView(state.victimLocation, 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(state.map);

  state.victimMarker = L.marker(state.victimLocation).addTo(state.map).bindPopup('You are here');

  state.poiLayer = L.layerGroup().addTo(state.map);

  const group = new L.featureGroup([state.victimMarker]);
  state.map.fitBounds(group.getBounds(), { maxZoom: 16, padding: [20, 20] });
  refreshMap();
}

function refreshMap() {
  if (!state.map) {
    updateEta();
    return;
  }

  state.victimMarker.setLatLng(state.victimLocation);
  
  state.map.fitBounds([state.victimLocation, state.responderLocation], {
    padding: [42, 42],
    maxZoom: 16,
  });
  updateEta();
}

function captureGps() {
  if (!navigator.geolocation) {
    setStatus('GPS unavailable', 'Using your last known service area.');
    return;
  }

  setStatus('Getting your location...', 'GPS will attach automatically.');

  navigator.geolocation.getCurrentPosition(
    (position) => {
      state.victimLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      setStatus('Location ready', 'Your emergency request will include GPS.');
      refreshMap();
    },
    () => {
      setStatus('Location permission needed', 'Tap the location button or call 999 now.');
    },
    {
      enableHighAccuracy: true,
      timeout: 6000,
      maximumAge: 10000,
    }
  );
}

function connectRealtimeTracking() {
  if (!window.io) {
    responderName.textContent = 'Realtime connection unavailable';
    return;
  }

  state.socket = io();

  state.socket.on('connect', () => {
    responderName.textContent = 'Waiting for live responder GPS';
  });

  state.socket.on('tracking:snapshot', (responders) => {
    if (responders.length > 0) {
      applyResponderLocation(responders[responders.length - 1]);
    }
  });

  state.socket.on('responder:location', applyResponderLocation);

  state.socket.on('responder:offline', (payload) => {
    if (state.responders.has(payload.volunteerUserId)) {
      const responder = state.responders.get(payload.volunteerUserId);
      if (responder.marker) state.map.removeLayer(responder.marker);
      if (responder.routeControl) state.map.removeControl(responder.routeControl);
      state.responders.delete(payload.volunteerUserId);
    }
  });

  state.socket.on('webrtc:answer', (payload) => handleWebRTCAnswer(payload.answer));
  state.socket.on('webrtc:candidate', (payload) => handleWebRTCCandidate(payload.candidate));
}

function applyResponderLocation(payload) {
  const volunteerId = payload.volunteerUserId;
  const lat = Number(payload.latitude || payload.location?.coordinates[1]);
  const lng = Number(payload.longitude || payload.location?.coordinates[0]);

  if (!state.map) return;

  if (!state.responders.has(volunteerId)) {
    const marker = L.marker([lat, lng])
      .addTo(state.map)
      .bindPopup(payload.displayName || 'Responder');
    
    const routeControl = L.Routing.control({
      waypoints: [
        L.latLng(lat, lng),
        L.latLng(state.victimLocation.lat, state.victimLocation.lng)
      ],
      routeWhileDragging: false,
      addWaypoints: false,
      show: false,
      lineOptions: {
        styles: [{ color: '#10b981', weight: 5, opacity: 0.8 }]
      },
      createMarker: () => null,
      fitSelectedRoutes: false
    }).addTo(state.map);

    routeControl.on('routesfound', (e) => {
      const routes = e.routes;
      if (routes && routes.length > 0) {
        const timeMinutes = Math.round(routes[0].summary.totalTime / 60);
        updateSteps('On the Way');
        responderName.textContent = payload.displayName
          ? `${payload.displayName} (ETA: ${timeMinutes} min)`
          : `Responder (ETA: ${timeMinutes} min)`;
      }
    });

    state.responders.set(volunteerId, { marker, routeControl, lastLat: lat, lastLng: lng });
  } else {
    const responder = state.responders.get(volunteerId);
    const lastLat = responder.lastLat;
    const lastLng = responder.lastLng;
    
    responder.marker.setLatLng([lat, lng]);
    responder.lastLat = lat;
    responder.lastLng = lng;

    if (haversineKm({ lat: lastLat, lng: lastLng }, { lat, lng }) > 0.01) {
      responder.routeControl.setWaypoints([
        L.latLng(lat, lng),
        L.latLng(state.victimLocation.lat, state.victimLocation.lng)
      ]);
    }
  }

  if (!peerConnection) {
    initWebRTC();
  }

  if (haversineKm(state.victimLocation, { lat, lng }) < 0.08) {
    updateSteps('Help Arrived');
    responderName.textContent = 'Help has arrived';
  }
}

async function sendEmergencyRequest() {
  if (state.requestSent) {
    return;
  }

  state.requestSent = true;
  emergencyButton.classList.add('armed');
  emergencyButton.querySelector('span').textContent = 'Request sent';
  emergencyButton.querySelector('small').textContent = 'Stay where responders can find you';
  emergencyButton.disabled = true;

  const payload = {
    victimName: victimNameInput.value.trim(),
    victimId: victimIdInput.value.trim(),
    type: state.selectedType,
    note: noteInput.value.trim(),
    description: `${state.selectedType}: ${noteInput.value.trim() || 'Emergency assistance needed.'}`,
    autoGps: {
      latitude: state.victimLocation.lat,
      longitude: state.victimLocation.lng,
    },
    requestedAt: new Date().toISOString(),
  };

  // Offline-First SMS Fallback
  if (!navigator.onLine || (state.socket && !state.socket.connected)) {
    console.warn("Offline mode detected. Falling back to SMS Dispatch.");
    
    const lat = state.victimLocation.lat.toFixed(5);
    const lng = state.victimLocation.lng.toFixed(5);
    const smsBody = `EMERGENCY [${payload.type}]: ${payload.note}. My location is GPS: ${lat},${lng}. Please send help.`;
    
    setStatus('Offline mode', 'Opening SMS to dispatch emergency...');
    updateSteps('Assigned'); // Fast-forward UI
    
    // Redirect to native SMS app
    window.location.href = `sms:999?body=${encodeURIComponent(smsBody)}`;
    return;
  }

  try {
    const response = await fetch('/api/emergencies/requests', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        description: payload.description,
        autoGps: payload.autoGps,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      payload.emergencyId = result.data.emergency._id;
      state.emergencyId = payload.emergencyId; // Save for cancel
      
      // Start polling for AI advice
      pollForAiAnalysis(state.emergencyId);
    } else {
      payload.apiWarning = await response.json();
    }
  } catch (error) {
    payload.apiWarning = {
      error: error.message,
    };
  }

  if (state.socket) {
    // The backend now gets the room ID from the payload (or we can just emit it)
    state.socket.emit('victim:join', { emergencyId: payload.emergencyId });
    state.socket.emit('emergency:requested', payload);
  }

  console.info('FastAid emergency payload', payload);
  setStatus('Emergency request sent', 'Waiting for a live responder location.');
  updateSteps('Assigned');
}

function shareLocation() {
  const locationUrl = `https://www.openstreetmap.org/?mlat=${state.victimLocation.lat}&mlon=${state.victimLocation.lng}#map=17/${state.victimLocation.lat}/${state.victimLocation.lng}`;

  if (navigator.share) {
    navigator.share({
      title: 'FastAid location',
      text: 'My emergency location',
      url: locationUrl,
    });
    return;
  }

  navigator.clipboard.writeText(locationUrl);
  setStatus('Location copied', 'Share it with a responder or trusted contact.');
}

document.querySelectorAll('.chip').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach((chip) => chip.classList.remove('active'));
    button.classList.add('active');
    state.selectedType = button.dataset.type;
  });
});

document.querySelector('#locateButton').addEventListener('click', captureGps);
document.querySelector('#shareButton').addEventListener('click', shareLocation);
document.querySelector('#cancelButton').addEventListener('click', async () => {
  if (state.requestSent && state.status !== 'Closed' && state.status !== 'Cancelled') {
    try {
      // state.liveResponderId is not the emergency ID, we need emergencyId
      // We saved it in state implicitly in sendEmergencyRequest? No, it's local there.
      // Let's store it in state
      if (!state.emergencyId) return;
      await fetch(`/api/emergencies/${state.emergencyId}/cancel`, {
        method: 'PATCH',
        headers: getAuthHeaders()
      });
      setStatus('Emergency cancelled', 'Your request has been safely closed.');
      updateSteps('Cancelled');
      emergencyButton.classList.remove('armed');
      emergencyButton.querySelector('span').textContent = 'Hold for emergency';
      emergencyButton.disabled = false;
      state.requestSent = false;
    } catch (e) {
      console.error(e);
    }
  }
});

let pressTimer;

emergencyButton.addEventListener('pointerdown', () => {
  if (state.requestSent) {
    return;
  }

  emergencyButton.classList.add('armed');
  emergencyButton.querySelector('small').textContent = 'Keep holding...';
  pressTimer = window.setTimeout(sendEmergencyRequest, 700);
});

['pointerup', 'pointercancel', 'pointerleave'].forEach((eventName) => {
  emergencyButton.addEventListener(eventName, () => {
    if (state.requestSent) {
      return;
    }

    window.clearTimeout(pressTimer);
    emergencyButton.classList.remove('armed');
    emergencyButton.querySelector('small').textContent = 'GPS and request sent together';
  });
});

function loadUserIdentity() {
  try {
    const userStr = localStorage.getItem('fastaid_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.name) victimNameInput.value = user.name;
      if (user._id || user.id) victimIdInput.value = user._id || user.id;
    }
  } catch (e) {
    console.error('Error loading user identity', e);
  }
}

async function loadMedicalProfile() {
  try {
    const response = await fetch('/api/auth/medical-profile', {
      headers: getAuthHeaders(),
    });
    if (response.ok) {
      const { data } = await response.json();
      if (data.bloodType) bloodTypeInput.value = data.bloodType;
      if (data.allergies) allergiesInput.value = data.allergies;
      if (data.preExistingConditions) conditionsInput.value = data.preExistingConditions;
      if (data.emergencyContactName) emergencyContactNameInput.value = data.emergencyContactName;
      if (data.emergencyContactPhone) emergencyContactPhoneInput.value = data.emergencyContactPhone;
    }
  } catch (error) {
    console.error('Error loading medical profile:', error);
  }
}

async function saveMedicalProfile() {
  const originalText = saveMedicalProfileBtn.textContent;
  saveMedicalProfileBtn.textContent = 'Saving...';
  saveMedicalProfileBtn.disabled = true;

  try {
    const response = await fetch('/api/auth/medical-profile', {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        bloodType: bloodTypeInput.value,
        allergies: allergiesInput.value,
        preExistingConditions: conditionsInput.value,
        emergencyContactName: emergencyContactNameInput.value,
        emergencyContactPhone: emergencyContactPhoneInput.value,
      }),
    });

    if (response.ok) {
      saveMedicalProfileBtn.textContent = 'Saved!';
      setTimeout(() => {
        saveMedicalProfileBtn.textContent = originalText;
        saveMedicalProfileBtn.disabled = false;
      }, 2000);
    } else {
      throw new Error('Failed to save');
    }
  } catch (error) {
    console.error('Error saving medical profile:', error);
    saveMedicalProfileBtn.textContent = 'Error';
    setTimeout(() => {
      saveMedicalProfileBtn.textContent = originalText;
      saveMedicalProfileBtn.disabled = false;
    }, 2000);
  }
}

saveMedicalProfileBtn.addEventListener('click', saveMedicalProfile);

const hospitalIcon = L.divIcon({
  html: '<div style="background-color: #ef4444; color: white; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); font-weight: bold; font-size: 14px;">H</div>',
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

const policeIcon = L.divIcon({
  html: '<div style="background-color: #3b82f6; color: white; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); font-weight: bold; font-size: 14px;">P</div>',
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

const pharmacyIcon = L.divIcon({
  html: '<div style="background-color: #10b981; color: white; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); font-weight: bold; font-size: 14px;">Rx</div>',
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

async function fetchSafeZones() {
  if (state.poisLoaded) {
    if (state.map.hasLayer(state.poiLayer)) {
      state.map.removeLayer(state.poiLayer);
      togglePoiBtn.textContent = 'Show Safe Zones';
    } else {
      state.map.addLayer(state.poiLayer);
      togglePoiBtn.textContent = 'Hide Safe Zones';
    }
    return;
  }

  togglePoiBtn.textContent = 'Loading...';
  togglePoiBtn.disabled = true;

  try {
    const lat = state.victimLocation.lat;
    const lng = state.victimLocation.lng;
    const query = `[out:json];(node["amenity"~"hospital|police|pharmacy"](around:3000,${lat},${lng}););out;`;
    
    const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
    const data = await response.json();

    if (data && data.elements) {
      data.elements.forEach(el => {
        let icon = pharmacyIcon;
        let typeName = 'Pharmacy';
        
        if (el.tags.amenity === 'hospital') {
          icon = hospitalIcon;
          typeName = 'Hospital';
        } else if (el.tags.amenity === 'police') {
          icon = policeIcon;
          typeName = 'Police Station';
        }

        const name = el.tags.name || `Unnamed ${typeName}`;
        
        L.marker([el.lat, el.lon], { icon })
          .bindPopup(`<strong>${name}</strong><br/>${typeName}`)
          .addTo(state.poiLayer);
      });
    }

    state.poisLoaded = true;
    togglePoiBtn.textContent = 'Hide Safe Zones';
  } catch (err) {
    console.error('Failed to fetch POIs from Overpass', err);
    togglePoiBtn.textContent = 'Error';
    setTimeout(() => togglePoiBtn.textContent = 'Show Safe Zones', 3000);
  } finally {
    togglePoiBtn.disabled = false;
  }
}

togglePoiBtn.addEventListener('click', fetchSafeZones);

async function pollForAiAnalysis(emergencyId) {
  const panel = document.getElementById('aiDispatcherPanel');
  const list = document.getElementById('aiVictimAdviceList');
  if (panel) panel.style.display = 'block';

  let attempts = 0;
  const interval = setInterval(async () => {
    attempts++;
    try {
      const res = await fetch(`/api/emergencies/${emergencyId}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const { data } = await res.json();
        if (data && data.aiAnalysis && data.aiAnalysis.victimAdvice && data.aiAnalysis.victimAdvice.length > 0) {
          clearInterval(interval);
          list.innerHTML = '';
          data.aiAnalysis.victimAdvice.forEach(advice => {
            const li = document.createElement('li');
            li.textContent = advice;
            li.style.marginBottom = '6px';
            list.appendChild(li);
          });
          return;
        }
      }
    } catch (e) {
      console.error('Error polling AI analysis:', e);
    }

    if (attempts > 15) {
      clearInterval(interval);
      if (list.innerHTML.includes('Analyzing')) {
         list.innerHTML = '<li>Stay calm. Help is on the way. Keep your phone nearby.</li>';
      }
    }
  }, 2000);
}

initLeafletMap();
connectRealtimeTracking();
captureGps();
updateEta();
loadUserIdentity();
loadMedicalProfile();

