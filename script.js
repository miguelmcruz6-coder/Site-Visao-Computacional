// =====================================================
// SISTEMA DE CONTROLE POR GESTOS
// GitHub Pages + MediaPipe + HiveMQ Cloud + ESP32
// =====================================================

// =====================================================
// CONFIGURAÇÃO HIVEMQ CLOUD
// =====================================================

import {
  MQTT_HOST,
  MQTT_PORT,
  MQTT_PATH,
  MQTT_USERNAME,
  MQTT_PASSWORD,
  MQTT_TOPIC,
  MQTT_STOP_TOPIC,
} from "./Data/mqttConfig";

// =====================================================
// CONFIGURAÇÕES
// =====================================================

// O ESP32 desliga os outputs depois de 1000 ms
// sem receber mensagem.
//
// Portanto o navegador envia a cada 250 ms.

const MQTT_INTERVAL = 250;

// Quantidade de frames iguais necessários
// para aceitar uma mudança.

const STABILITY_FRAMES = 3;

// =====================================================
// ELEMENTOS DA INTERFACE
// =====================================================

const video = document.getElementById("video");

const canvas = document.getElementById("canvas");

const ctx = canvas.getContext("2d");

const startCameraButton = document.getElementById("startCamera");

const stopCameraButton = document.getElementById("stopCamera");

const connectMqttButton = document.getElementById("connectMqtt");

const emergencyButton = document.getElementById("emergency");

const resetButton = document.getElementById("reset");

const mqttStatus = document.getElementById("mqttStatus");

const cameraStatus = document.getElementById("cameraStatus");

const cameraMessage = document.getElementById("cameraMessage");

const commandElement = document.getElementById("command");

const messageElement = document.getElementById("message");

// =====================================================
// ELEMENTOS DO INTERTRAVAMENTO
// =====================================================

const interlockStatus = document.getElementById("interlockStatus");

const interlockProgress = document.getElementById("interlockProgress");

const interlockCountdown = document.getElementById("interlockCountdown");

const gripperState = document.getElementById("gripperState");

const inspectorState = document.getElementById("inspectorState");

const gripperStateText = document.getElementById("gripperStateText");

const inspectorStateText = document.getElementById("inspectorStateText");

// =====================================================
// ESTADO
// =====================================================

let mqttClient = null;

let cameraStream = null;

let cameraRunning = false;

let processingFrame = false;

let emergencyActive = false;

// =====================================================
// COMANDO ATUAL
// =====================================================

let currentCommand = "00000";

// =====================================================
// ESTABILIZAÇÃO
// =====================================================

let detectedCommand = "";

let stableFrames = 0;

// =====================================================
// INTERTRAVAMENTO VISUAL
// =====================================================
//
// Garra:
// posição 1 do comando
//
// Inspecionador:
// posição 3 do comando
//
// Tempo:
// 2 segundos
//
// IMPORTANTE:
// Este código serve para INDICAR visualmente o intervalo.
// A regra real de segurança continua sendo aplicada
// pelo ESP32.
// =====================================================

const INTERLOCK_TIME = 2000;

let lastGripperState = false;

let lastInspectorState = false;

let gripperOffTime = 0;

let inspectorOffTime = 0;

// =====================================================
// ATUALIZAR INTERTRAVAMENTO VISUAL
// =====================================================

function atualizarIntertravamentoUI(garra, inspecionador) {
  const agora = Date.now();

  // ===================================================
  // DETECTAR DESLIGAMENTO DA GARRA
  // ===================================================

  if (lastGripperState === true && garra === false) {
    gripperOffTime = agora;
  }

  // ===================================================
  // DETECTAR DESLIGAMENTO DO INSPECIONADOR
  // ===================================================

  if (lastInspectorState === true && inspecionador === false) {
    inspectorOffTime = agora;
  }

  // ===================================================
  // ESTADO VISUAL DA GARRA
  // ===================================================

  if (gripperState) {
    gripperState.classList.toggle("active-gripper", garra);
  }

  if (gripperStateText) {
    gripperStateText.textContent = garra ? "🟢 Ativa" : "Desligada";
  }

  // ===================================================
  // ESTADO VISUAL DO INSPECIONADOR
  // ===================================================

  if (inspectorState) {
    inspectorState.classList.toggle("active-inspector", inspecionador);
  }

  if (inspectorStateText) {
    inspectorStateText.textContent = inspecionador ? "🟢 Ativo" : "Desligado";
  }

  // ===================================================
  // GARRA ATIVA
  // ===================================================

  if (garra && !inspecionador) {
    if (interlockStatus) {
      interlockStatus.className = "interlock-status gripper";

      interlockStatus.textContent = "● Garra ativa";
    }

    if (interlockProgress) {
      interlockProgress.style.width = "100%";
    }

    if (interlockCountdown) {
      interlockCountdown.className = "interlock-countdown";

      interlockCountdown.textContent = "Garra ativa — Inspecionador bloqueado.";
    }
  }

  // ===================================================
  // INSPECIONADOR ATIVO
  // ===================================================
  else if (!garra && inspecionador) {
    if (interlockStatus) {
      interlockStatus.className = "interlock-status inspector";

      interlockStatus.textContent = "● Inspecionador ativo";
    }

    if (interlockProgress) {
      interlockProgress.style.width = "100%";
    }

    if (interlockCountdown) {
      interlockCountdown.className = "interlock-countdown";

      interlockCountdown.textContent = "Inspecionador ativo — Garra bloqueada.";
    }
  }

  // ===================================================
  // AMBOS DESLIGADOS
  // ===================================================
  else if (!garra && !inspecionador) {
    const tempoDesdeGarra =
      gripperOffTime > 0 ? agora - gripperOffTime : INTERLOCK_TIME;

    const tempoDesdeInspecionador =
      inspectorOffTime > 0 ? agora - inspectorOffTime : INTERLOCK_TIME;

    // ===============================================
    // GAP APÓS DESLIGAR A GARRA
    // ===============================================

    if (gripperOffTime > 0 && tempoDesdeGarra < INTERLOCK_TIME) {
      const restante = INTERLOCK_TIME - tempoDesdeGarra;

      const progresso = (tempoDesdeGarra / INTERLOCK_TIME) * 100;

      if (interlockStatus) {
        interlockStatus.className = "interlock-status waiting";

        interlockStatus.textContent = "● Intervalo de segurança";
      }

      if (interlockProgress) {
        interlockProgress.style.width = `${progresso}%`;
      }

      if (interlockCountdown) {
        interlockCountdown.className = "interlock-countdown waiting";

        interlockCountdown.textContent = `⏱️ Aguarde ${(
          restante / 1000
        ).toFixed(1)} s antes de ativar o Inspecionador.`;
      }
    }

    // ===============================================
    // GAP APÓS DESLIGAR O INSPECIONADOR
    // ===============================================
    else if (inspectorOffTime > 0 && tempoDesdeInspecionador < INTERLOCK_TIME) {
      const restante = INTERLOCK_TIME - tempoDesdeInspecionador;

      const progresso = (tempoDesdeInspecionador / INTERLOCK_TIME) * 100;

      if (interlockStatus) {
        interlockStatus.className = "interlock-status waiting";

        interlockStatus.textContent = "● Intervalo de segurança";
      }

      if (interlockProgress) {
        interlockProgress.style.width = `${progresso}%`;
      }

      if (interlockCountdown) {
        interlockCountdown.className = "interlock-countdown waiting";

        interlockCountdown.textContent = `⏱️ Aguarde ${(
          restante / 1000
        ).toFixed(1)} s antes de ativar a Garra.`;
      }
    }

    // ===============================================
    // PRONTO
    // ===============================================
    else {
      if (interlockStatus) {
        interlockStatus.className = "interlock-status ready";

        interlockStatus.textContent = "● Pronto";
      }

      if (interlockProgress) {
        interlockProgress.style.width = "100%";
      }

      if (interlockCountdown) {
        interlockCountdown.className = "interlock-countdown";

        interlockCountdown.textContent =
          "Sistema pronto — intervalo de segurança concluído.";
      }
    }
  }

  // ===================================================
  // PROTEÇÃO VISUAL EXTRA
  // ===================================================

  if (garra && inspecionador) {
    if (interlockStatus) {
      interlockStatus.className = "interlock-status blocked";

      interlockStatus.textContent = "● BLOQUEIO";
    }

    if (interlockProgress) {
      interlockProgress.style.width = "0%";
    }

    if (interlockCountdown) {
      interlockCountdown.className = "interlock-countdown waiting";

      interlockCountdown.textContent =
        "⚠️ Garra e Inspecionador não podem estar ativos simultaneamente.";
    }
  }

  // ===================================================
  // SALVAR ESTADOS
  // ===================================================

  lastGripperState = garra;

  lastInspectorState = inspecionador;
}

// =====================================================
// ATUALIZAÇÃO CONTÍNUA DO CONTADOR
// =====================================================

setInterval(() => {
  atualizarIntertravamentoUI(lastGripperState, lastInspectorState);
}, 100);

// =====================================================
// STATUS MQTT
// =====================================================

function setMqttStatus(text, online) {
  if (!mqttStatus) {
    return;
  }

  mqttStatus.textContent = "MQTT: " + text;

  mqttStatus.classList.remove("online", "offline");

  mqttStatus.classList.add(online ? "online" : "offline");
}

// =====================================================
// CONECTAR MQTT
// =====================================================

function connectMQTT() {
  if (mqttClient && mqttClient.connected) {
    return;
  }

  setMqttStatus("conectando...", false);

  const clientId =
    "WEB_GESTOS_" +
    Date.now() +
    "_" +
    Math.random().toString(16).substring(2, 8);

  // -------------------------------------------------
  // WSS
  // -------------------------------------------------

  const url = `wss://${MQTT_HOST}:${MQTT_PORT}${MQTT_PATH}`;

  console.log("Conectando ao HiveMQ:", url);

  try {
    mqttClient = mqtt.connect(url, {
      clientId: clientId,

      username: MQTT_USERNAME,

      password: MQTT_PASSWORD,

      clean: true,

      connectTimeout: 10000,

      reconnectPeriod: 3000,

      keepalive: 30,
    });

    // =============================================
    // CONECTADO
    // =============================================

    mqttClient.on("connect", () => {
      console.log("HiveMQ conectado!");

      setMqttStatus("conectado", true);

      if (connectMqttButton) {
        connectMqttButton.textContent = "✓ MQTT conectado";
      }
    });

    // =============================================
    // RECONEXÃO
    // =============================================

    mqttClient.on("reconnect", () => {
      console.log("Reconectando ao HiveMQ...");

      setMqttStatus("reconectando...", false);
    });

    // =============================================
    // ERRO
    // =============================================

    mqttClient.on("error", (error) => {
      console.error("Erro HiveMQ:", error);

      setMqttStatus("erro", false);
    });

    // =============================================
    // DESCONECTADO
    // =============================================

    mqttClient.on("close", () => {
      console.log("HiveMQ desconectado.");

      setMqttStatus("desconectado", false);

      if (connectMqttButton) {
        connectMqttButton.textContent = "🔌 Conectar MQTT";
      }
    });
  } catch (error) {
    console.error("Erro ao criar cliente MQTT:", error);

    setMqttStatus("erro", false);
  }
}

// =====================================================
// PUBLICAR COMANDO
// =====================================================

function publishCommand(command) {
  if (!mqttClient || !mqttClient.connected) {
    return;
  }

  mqttClient.publish(MQTT_TOPIC, command, {
    qos: 0,
    retain: false,
  });

  console.log("MQTT →", MQTT_TOPIC, command);
}

// =====================================================
// WATCHDOG DO ESP32
// =====================================================
//
// Envia continuamente o último comando.
//
// 250 ms < 1000 ms
//
// Portanto o ESP32 recebe várias mensagens
// antes do timeout de segurança.
// =====================================================

setInterval(() => {
  if (!mqttClient || !mqttClient.connected) {
    return;
  }

  if (emergencyActive) {
    return;
  }

  publishCommand(currentCommand);
}, MQTT_INTERVAL);

// =====================================================
// EMERGÊNCIA
// =====================================================

function publishEmergency() {
  if (!mqttClient || !mqttClient.connected) {
    alert("Conecte ao HiveMQ primeiro.");

    return;
  }

  mqttClient.publish(MQTT_STOP_TOPIC, "STOP", {
    qos: 0,
    retain: false,
  });

  emergencyActive = true;

  setCommand("00000");

  console.warn("EMERGÊNCIA ATIVADA");
}

// =====================================================
// RESET EMERGÊNCIA
// =====================================================

function resetEmergency() {
  if (!mqttClient || !mqttClient.connected) {
    alert("Conecte ao HiveMQ primeiro.");

    return;
  }

  mqttClient.publish(MQTT_STOP_TOPIC, "RESET", {
    qos: 0,
    retain: false,
  });

  emergencyActive = false;

  setCommand("00000");

  console.log("Emergência resetada.");
}

// =====================================================
// ATUALIZAR COMANDO
// =====================================================

function setCommand(value) {
  if (!/^[01]{5}$/.test(value)) {
    return;
  }

  currentCommand = value;

  if (commandElement) {
    commandElement.textContent = value;
  }

  if (messageElement) {
    messageElement.textContent = value;
  }

  // -------------------------------------------------
  // INDICADORES
  // -------------------------------------------------

  for (let i = 0; i < 5; i++) {
    const light = document.getElementById(`finger${i}`);

    if (!light) {
      continue;
    }

    if (value[i] === "1") {
      light.classList.remove("off");

      light.classList.add("on");
    } else {
      light.classList.remove("on");

      light.classList.add("off");
    }
  }

  // -------------------------------------------------
  // ATUALIZAR INTERTRAVAMENTO
  // -------------------------------------------------
  //
  // Posição 1 = Garra
  // Posição 3 = Inspecionador
  //
  // -------------------------------------------------

  atualizarIntertravamentoUI(value[1] === "1", value[3] === "1");
}

// =====================================================
// CÂMERA
// =====================================================

async function startCameraFunction() {
  try {
    cameraStatus.textContent = "Solicitando câmera...";

    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: {
          ideal: "user",
        },

        width: {
          ideal: 1280,
        },

        height: {
          ideal: 720,
        },
      },

      audio: false,
    });

    video.srcObject = cameraStream;

    // Espera o vídeo carregar

    await new Promise((resolve) => {
      if (video.readyState >= 2) {
        resolve();

        return;
      }

      video.onloadedmetadata = () => {
        resolve();
      };
    });

    await video.play();

    cameraRunning = true;

    // ------------------------------------------------
    // ESCONDE MENSAGEM
    // ------------------------------------------------

    if (cameraMessage) {
      cameraMessage.style.display = "none";
    }

    cameraStatus.textContent = "Câmera ativa — procurando mão";

    startCameraButton.disabled = true;

    stopCameraButton.disabled = false;

    // ------------------------------------------------
    // CANVAS
    // ------------------------------------------------

    canvas.width = video.videoWidth;

    canvas.height = video.videoHeight;

    processingFrame = false;

    processCamera();
  } catch (error) {
    console.error("Erro câmera:", error);

    cameraRunning = false;

    cameraStatus.textContent = "Erro ao acessar câmera";

    if (cameraMessage) {
      cameraMessage.style.display = "flex";
    }

    alert("Não foi possível acessar a câmera.\n\n" + error.message);
  }
}

// =====================================================
// PARAR CÂMERA
// =====================================================

function stopCameraFunction() {
  cameraRunning = false;

  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());

    cameraStream = null;
  }

  video.pause();

  video.srcObject = null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (cameraMessage) {
    cameraMessage.style.display = "flex";
  }

  cameraStatus.textContent = "Câmera parada";

  startCameraButton.disabled = false;

  stopCameraButton.disabled = true;

  detectedCommand = "";

  stableFrames = 0;

  // Estado seguro

  setCommand("00000");
}

// =====================================================
// PROCESSAMENTO DA CÂMERA
// =====================================================

async function processCamera() {
  if (!cameraRunning) {
    return;
  }

  if (
    !processingFrame &&
    video.readyState >= 2 &&
    video.videoWidth > 0 &&
    video.videoHeight > 0
  ) {
    processingFrame = true;

    try {
      await hands.send({
        image: video,
      });
    } catch (error) {
      console.error("Erro MediaPipe:", error);
    } finally {
      processingFrame = false;
    }
  }

  if (cameraRunning) {
    requestAnimationFrame(processCamera);
  }
}

// =====================================================
// DISTÂNCIA
// =====================================================

function distance(a, b) {
  const dx = a.x - b.x;

  const dy = a.y - b.y;

  return Math.sqrt(dx * dx + dy * dy);
}

// =====================================================
// DETECTAR DEDOS
// =====================================================
//
// Ordem:
//
// 0 = Polegar
// 1 = Indicador
// 2 = Médio
// 3 = Anelar
// 4 = Mínimo
//
// =====================================================

function detectFingers(landmarks) {
  const wrist = landmarks[0];

  const palm = distance(landmarks[0], landmarks[9]);

  // -------------------------------------------------
  // INDICADOR
  // -------------------------------------------------

  const indicador =
    landmarks[8].y < landmarks[6].y &&
    distance(landmarks[8], wrist) > distance(landmarks[6], wrist) * 1.05;

  // -------------------------------------------------
  // MÉDIO
  // -------------------------------------------------

  const medio =
    landmarks[12].y < landmarks[10].y &&
    distance(landmarks[12], wrist) > distance(landmarks[10], wrist) * 1.05;

  // -------------------------------------------------
  // ANELAR
  // -------------------------------------------------

  const anelar =
    landmarks[16].y < landmarks[14].y &&
    distance(landmarks[16], wrist) > distance(landmarks[14], wrist) * 1.05;

  // -------------------------------------------------
  // MÍNIMO
  // -------------------------------------------------

  const minimo =
    landmarks[20].y < landmarks[18].y &&
    distance(landmarks[20], wrist) > distance(landmarks[18], wrist) * 1.03;

  // -------------------------------------------------
  // POLEGAR
  // -------------------------------------------------

  const thumbTip = landmarks[4];

  const thumbIP = landmarks[3];

  const thumbMCP = landmarks[2];

  const thumbTipDistance = distance(thumbTip, wrist);

  const thumbIPDistance = distance(thumbIP, wrist);

  const thumbMCPDistance = distance(thumbMCP, wrist);

  const thumb =
    thumbTipDistance > thumbIPDistance * 1.08 &&
    thumbTipDistance > thumbMCPDistance * 1.25 &&
    distance(thumbTip, landmarks[5]) > palm * 0.65;

  return [thumb, indicador, medio, anelar, minimo];
}

// =====================================================
// DEDOS → 5 BITS
// =====================================================

function fingersToCommand(fingers) {
  return fingers.map((finger) => (finger ? "1" : "0")).join("");
}

// =====================================================
// ESTABILIZAÇÃO
// =====================================================

function processStableCommand(value) {
  if (value === detectedCommand) {
    stableFrames++;
  } else {
    detectedCommand = value;

    stableFrames = 1;
  }

  if (stableFrames >= STABILITY_FRAMES) {
    if (value !== currentCommand) {
      setCommand(value);

      console.log("Novo comando:", value);
    }
  }
}

// =====================================================
// MEDIAPIPE
// =====================================================

const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});

hands.setOptions({
  maxNumHands: 1,

  modelComplexity: 1,

  minDetectionConfidence: 0.6,

  minTrackingConfidence: 0.6,
});

// =====================================================
// RESULTADOS MEDIAPIPE
// =====================================================

hands.onResults((results) => {
  // ------------------------------------------------
  // LIMPA CANVAS
  // ------------------------------------------------

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ------------------------------------------------
  // SEM MÃO
  // ------------------------------------------------

  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    cameraStatus.textContent = "Câmera ativa — mão não detectada";

    return;
  }

  cameraStatus.textContent = "Câmera ativa — mão detectada";

  const landmarks = results.multiHandLandmarks[0];

  // ------------------------------------------------
  // DESENHAR MÃO
  // ------------------------------------------------

  if (typeof drawConnectors === "function") {
    drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
      color: "#22c55e",

      lineWidth: 4,
    });
  }

  if (typeof drawLandmarks === "function") {
    drawLandmarks(ctx, landmarks, {
      color: "#60a5fa",

      lineWidth: 2,

      radius: 5,
    });
  }

  // ------------------------------------------------
  // DEDOS
  // ------------------------------------------------

  const fingers = detectFingers(landmarks);

  const command = fingersToCommand(fingers);

  console.log("Dedos:", fingers, "→", command);

  if (emergencyActive) {
    return;
  }

  processStableCommand(command);
});

// =====================================================
// BOTÕES
// =====================================================

if (startCameraButton) {
  startCameraButton.addEventListener("click", startCameraFunction);
}

if (stopCameraButton) {
  stopCameraButton.addEventListener("click", stopCameraFunction);
}

if (connectMqttButton) {
  connectMqttButton.addEventListener("click", connectMQTT);
}

if (emergencyButton) {
  emergencyButton.addEventListener("click", publishEmergency);
}

if (resetButton) {
  resetButton.addEventListener("click", resetEmergency);
}

// =====================================================
// INICIALIZAÇÃO
// =====================================================

setCommand("00000");

setMqttStatus("desconectado", false);

console.log("Sistema iniciado.");

console.log("MediaPipe:", typeof Hands !== "undefined" ? "OK" : "ERRO");

console.log("MQTT.js:", typeof mqtt !== "undefined" ? "OK" : "ERRO");

// Não conectamos automaticamente.
// O usuário pode pressionar o botão MQTT.
