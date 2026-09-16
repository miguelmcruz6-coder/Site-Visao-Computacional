// =====================================================
// CONTROLE POR GESTOS
// CÂMERA + MEDIAPIPE HANDS + MQTT
// =====================================================

// =====================================================
// MQTT
// =====================================================

const MQTT_HOST = "broker.hivemq.com";

// ATENÇÃO:
// Esta porta é para WebSocket.
// Se o site estiver no GitHub Pages (HTTPS), o broker
// público pode bloquear a conexão WS sem TLS.
//
// Para teste local, 8000 pode funcionar.
// Para GitHub Pages, veja a observação no final.
const MQTT_PORT = 8000;

const MQTT_PATH = "/mqtt";

const MQTT_TOPIC = "automacao/maquina/dedos";

const MQTT_STOP_TOPIC = "automacao/maquina/emergencia";

// =====================================================
// CONFIGURAÇÕES
// =====================================================

const MQTT_INTERVAL = 250;

// Quantidade de leituras iguais necessárias
// antes de aceitar uma nova posição.
const STABILITY_FRAMES = 3;

// =====================================================
// ELEMENTOS
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
// ESTADO
// =====================================================

let mqttClient = null;

let cameraStream = null;

let cameraRunning = false;

let processingFrame = false;

let emergencyActive = false;

// Comando atualmente utilizado
let currentCommand = "00000";

// Último comando detectado
let detectedCommand = "";

// Número de frames iguais
let stableFrames = 0;

// =====================================================
// MQTT - STATUS
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
// MQTT - CONECTAR
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

  const url = `ws://${MQTT_HOST}:${MQTT_PORT}${MQTT_PATH}`;

  console.log("MQTT:", url);

  try {
    mqttClient = mqtt.connect(url, {
      clientId: clientId,

      clean: true,

      connectTimeout: 10000,

      reconnectPeriod: 3000,

      keepalive: 30,
    });

    mqttClient.on("connect", () => {
      console.log("MQTT conectado!");

      setMqttStatus("conectado", true);

      if (connectMqttButton) {
        connectMqttButton.textContent = "✓ MQTT conectado";
      }
    });

    mqttClient.on("reconnect", () => {
      console.log("MQTT reconectando...");

      setMqttStatus("reconectando...", false);
    });

    mqttClient.on("error", (error) => {
      console.error("Erro MQTT:", error);

      setMqttStatus("erro", false);
    });

    mqttClient.on("close", () => {
      console.log("MQTT desconectado.");

      setMqttStatus("desconectado", false);

      if (connectMqttButton) {
        connectMqttButton.textContent = "🔌 Conectar MQTT";
      }
    });
  } catch (error) {
    console.error("Falha ao criar conexão MQTT:", error);

    setMqttStatus("erro", false);
  }
}

// =====================================================
// MQTT - PUBLICAR COMANDO
// =====================================================

function publishCommand(value) {
  if (!mqttClient || !mqttClient.connected) {
    return;
  }

  mqttClient.publish(MQTT_TOPIC, value, {
    qos: 0,
    retain: false,
  });

  console.log("MQTT →", value);
}

// =====================================================
// ENVIO PERIÓDICO
// =====================================================
//
// O ESP32 possui:
//
// TIMEOUT_MQTT = 1000 ms
//
// Por isso enviamos a cada 250 ms.
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
    alert("Conecte ao MQTT primeiro.");

    return;
  }

  mqttClient.publish(MQTT_STOP_TOPIC, "STOP", {
    qos: 0,
    retain: false,
  });

  emergencyActive = true;

  setCommand("00000");

  console.log("EMERGÊNCIA → STOP");
}

// =====================================================
// RESET
// =====================================================

function resetEmergency() {
  if (!mqttClient || !mqttClient.connected) {
    alert("Conecte ao MQTT primeiro.");

    return;
  }

  mqttClient.publish(MQTT_STOP_TOPIC, "RESET", {
    qos: 0,
    retain: false,
  });

  emergencyActive = false;

  setCommand("00000");

  console.log("EMERGÊNCIA → RESET");
}

// =====================================================
// ATUALIZA INTERFACE
// =====================================================

function setCommand(value) {
  if (typeof value !== "string" || !/^[01]{5}$/.test(value)) {
    return;
  }

  currentCommand = value;

  if (commandElement) {
    commandElement.textContent = value;
  }

  if (messageElement) {
    messageElement.textContent = value;
  }

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
}

// =====================================================
// ESCONDER MENSAGEM DA CÂMERA
// =====================================================

function hideCameraMessage() {
  if (!cameraMessage) {
    return;
  }

  // Primeiro removemos qualquer display
  // definido pelo CSS.
  cameraMessage.style.display = "none";

  cameraMessage.style.visibility = "hidden";

  cameraMessage.style.opacity = "0";
}

// =====================================================
// MOSTRAR MENSAGEM DA CÂMERA
// =====================================================

function showCameraMessage() {
  if (!cameraMessage) {
    return;
  }

  cameraMessage.style.display = "flex";

  cameraMessage.style.visibility = "visible";

  cameraMessage.style.opacity = "1";
}

// =====================================================
// INICIAR CÂMERA
// =====================================================

async function startCameraFunction() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("getUserMedia não está disponível.");
    }

    cameraStatus.textContent = "Solicitando câmera...";

    console.log("Solicitando acesso à câmera...");

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

        frameRate: {
          ideal: 30,
        },
      },

      audio: false,
    });

    console.log("Permissão da câmera concedida.");

    video.srcObject = cameraStream;

    // Espera o navegador realmente carregar
    // as dimensões do vídeo.
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

    console.log("Vídeo iniciado:", video.videoWidth, "x", video.videoHeight);

    // -------------------------------------------------
    // IMPORTANTE:
    // agora que a câmera realmente está ativa,
    // escondemos a mensagem.
    // -------------------------------------------------

    hideCameraMessage();

    cameraRunning = true;

    processingFrame = false;

    cameraStatus.textContent = "Câmera ativa — procurando mão";

    startCameraButton.disabled = true;

    stopCameraButton.disabled = false;

    // Configura o canvas
    canvas.width = video.videoWidth;

    canvas.height = video.videoHeight;

    console.log("Iniciando MediaPipe...");

    // Começa o processamento.
    processCamera();
  } catch (error) {
    console.error("ERRO DA CÂMERA:", error);

    cameraRunning = false;

    cameraStatus.textContent = "Erro ao acessar câmera";

    showCameraMessage();

    let explanation = "Não foi possível acessar a câmera.";

    if (error.name === "NotAllowedError") {
      explanation += "\n\nPermissão da câmera foi negada.";
    } else if (error.name === "NotFoundError") {
      explanation += "\n\nNenhuma câmera foi encontrada.";
    } else if (error.name === "NotReadableError") {
      explanation += "\n\nA câmera está sendo usada por outro aplicativo.";
    } else if (
      location.protocol !== "https:" &&
      location.hostname !== "localhost"
    ) {
      explanation += "\n\nA câmera normalmente exige HTTPS.";
    }

    alert(explanation);
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

  showCameraMessage();

  cameraStatus.textContent = "Câmera parada";

  startCameraButton.disabled = false;

  stopCameraButton.disabled = true;

  detectedCommand = "";

  stableFrames = 0;

  // Ao desligar a câmera,
  // o comando volta para zero.
  setCommand("00000");

  console.log("Câmera parada.");
}

// =====================================================
// LOOP DE PROCESSAMENTO
// =====================================================

async function processCamera() {
  if (!cameraRunning) {
    return;
  }

  // Evita enviar outro frame para o MediaPipe
  // enquanto o anterior ainda está sendo processado.
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
// DISTÂNCIA ENTRE PONTOS
// =====================================================

function distance(a, b) {
  const dx = a.x - b.x;

  const dy = a.y - b.y;

  return Math.sqrt(dx * dx + dy * dy);
}

// =====================================================
// DETECÇÃO DOS DEDOS
// =====================================================
//
// Melhorada para funcionar mesmo quando a mão
// estiver um pouco inclinada.
//
// Resultado:
//
// [polegar, indicador, médio, anelar, mínimo]
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
  //
  // Para o polegar usamos distância da ponta
  // em relação à palma.
  //
  // Isso é mais robusto que simplesmente comparar X.
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
// BOOLEANOS → 5 BITS
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
// MEDIAPIPE HANDS
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
// RESULTADO DA VISÃO COMPUTACIONAL
// =====================================================

hands.onResults((results) => {
  // -------------------------------------------------
  // LIMPA DESENHO ANTERIOR
  // -------------------------------------------------

  if (canvas.width > 0 && canvas.height > 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // -------------------------------------------------
  // NENHUMA MÃO
  // -------------------------------------------------

  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    cameraStatus.textContent = "Câmera ativa — mão não detectada";

    return;
  }

  // -------------------------------------------------
  // MÃO ENCONTRADA
  // -------------------------------------------------

  cameraStatus.textContent = "Câmera ativa — mão detectada";

  const landmarks = results.multiHandLandmarks[0];

  // -------------------------------------------------
  // DESENHAR CONEXÕES
  // -------------------------------------------------

  if (typeof drawConnectors === "function") {
    drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
      color: "#22c55e",
      lineWidth: 4,
    });
  }

  // -------------------------------------------------
  // DESENHAR PONTOS
  // -------------------------------------------------

  if (typeof drawLandmarks === "function") {
    drawLandmarks(ctx, landmarks, {
      color: "#60a5fa",
      lineWidth: 2,
      radius: 5,
    });
  }

  // -------------------------------------------------
  // DETECTAR DEDOS
  // -------------------------------------------------

  const fingers = detectFingers(landmarks);

  // -------------------------------------------------
  // TRANSFORMAR EM 5 BITS
  // -------------------------------------------------

  const value = fingersToCommand(fingers);

  console.log("DEDOS:", fingers, "COMANDO:", value);

  // -------------------------------------------------
  // EMERGÊNCIA
  // -------------------------------------------------

  if (emergencyActive) {
    return;
  }

  // -------------------------------------------------
  // ESTABILIZAR
  // -------------------------------------------------

  processStableCommand(value);
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
// ESTADO INICIAL
// =====================================================

setCommand("00000");

setMqttStatus("desconectado", false);

// =====================================================
// INICIALIZAÇÃO
// =====================================================

console.log("Sistema de controle por gestos iniciado.");

console.log("MediaPipe:", typeof Hands !== "undefined" ? "OK" : "ERRO");

console.log("MQTT:", typeof mqtt !== "undefined" ? "OK" : "ERRO");
