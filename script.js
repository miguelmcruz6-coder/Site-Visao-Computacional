// =====================================================
// CONTROLE POR GESTOS
// Visão computacional + MQTT + ESP32
// =====================================================

// =====================================================
// MQTT
// =====================================================

const MQTT_HOST = "broker.hivemq.com";

// HiveMQ MQTT over WebSocket
const MQTT_PORT = 8884;

const MQTT_PATH = "/mqtt";

const MQTT_TOPIC = "automacao/maquina/dedos";

const MQTT_STOP_TOPIC = "automacao/maquina/emergencia";

// =====================================================
// CONFIGURAÇÕES
// =====================================================

// Envia o último comando a cada 250 ms.
// O ESP32 possui timeout de 1000 ms.
const MQTT_INTERVAL = 250;

// Número de frames consecutivos necessários
// para aceitar uma nova leitura.
const STABILITY_FRAMES = 2;

// =====================================================
// ELEMENTOS HTML
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

let emergencyActive = false;

// Último comando confirmado
let currentCommand = "00000";

// Última leitura detectada
let detectedCommand = "00000";

// Quantidade de frames iguais
let stableFrames = 0;

// =====================================================
// MQTT - STATUS
// =====================================================

function setMqttStatus(text, online) {
  mqttStatus.textContent = "MQTT: " + text;

  mqttStatus.classList.remove("online", "offline");

  mqttStatus.classList.add(online ? "online" : "offline");
}

// =====================================================
// MQTT - CONEXÃO
// =====================================================

function connectMQTT() {
  if (mqttClient && mqttClient.connected) {
    return;
  }

  setMqttStatus("conectando...", false);

  const clientId =
    "WEB_GESTOS_" + Date.now() + "_" + Math.random().toString(16).substring(2);

  const url = `wss://${MQTT_HOST}:${MQTT_PORT}${MQTT_PATH}`;

  console.log("Conectando ao:", url);

  mqttClient = mqtt.connect(url, {
    clientId: clientId,

    clean: true,

    connectTimeout: 10000,

    reconnectPeriod: 3000,

    keepalive: 30,
  });

  // -------------------------------------------------
  // CONECTADO
  // -------------------------------------------------

  mqttClient.on("connect", () => {
    console.log("MQTT conectado!");

    setMqttStatus("conectado", true);

    connectMqttButton.textContent = "✓ MQTT conectado";

    // Se estiver em emergência,
    // não envia comando de dedos.
    if (emergencyActive) {
      publishEmergency();
    }
  });

  // -------------------------------------------------
  // RECONEXÃO
  // -------------------------------------------------

  mqttClient.on("reconnect", () => {
    console.log("Reconectando MQTT...");

    setMqttStatus("reconectando...", false);

    connectMqttButton.textContent = "🔌 Reconectando...";
  });

  // -------------------------------------------------
  // ERRO
  // -------------------------------------------------

  mqttClient.on("error", (error) => {
    console.error("Erro MQTT:", error);

    setMqttStatus("erro", false);
  });

  // -------------------------------------------------
  // DESCONECTADO
  // -------------------------------------------------

  mqttClient.on("close", () => {
    console.log("MQTT desconectado.");

    setMqttStatus("desconectado", false);

    connectMqttButton.textContent = "🔌 Conectar MQTT";
  });
}

// =====================================================
// MQTT - PUBLICAR
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
// ENVIO PERIÓDICO
// =====================================================
//
// O ESP32 desliga as saídas depois de 1000 ms
// sem receber mensagem.
//
// Portanto enviamos a cada 250 ms.
//
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
    alert("Conecte ao MQTT antes de ativar a emergência.");

    return;
  }

  mqttClient.publish(MQTT_STOP_TOPIC, "STOP", {
    qos: 0,
    retain: false,
  });

  emergencyActive = true;

  // Mostra tudo desligado
  setCommand("00000");

  console.log("!!!!!!!!!!!!!!!!!!!!!!!!");

  console.log("EMERGÊNCIA → STOP");

  console.log("!!!!!!!!!!!!!!!!!!!!!!!!");
}

// =====================================================
// RESET EMERGÊNCIA
// =====================================================

function resetEmergency() {
  if (!mqttClient || !mqttClient.connected) {
    alert("Conecte ao MQTT antes de resetar a emergência.");

    return;
  }

  mqttClient.publish(MQTT_STOP_TOPIC, "RESET", {
    qos: 0,
    retain: false,
  });

  emergencyActive = false;

  // Mantém tudo desligado até a próxima
  // detecção válida da mão.
  setCommand("00000");

  console.log("Emergência resetada.");
}

// =====================================================
// INTERFACE - COMANDO
// =====================================================

function setCommand(value) {
  if (!/^[01]{5}$/.test(value)) {
    return;
  }

  currentCommand = value;

  commandElement.textContent = value;

  messageElement.textContent = value;

  // Atualiza os cinco indicadores
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

    await video.play();

    cameraRunning = true;

    cameraStatus.textContent = "Câmera ativa";

    cameraMessage.style.display = "none";

    startCameraButton.disabled = true;

    stopCameraButton.disabled = false;

    console.log("Câmera iniciada.");

    // Inicia o processamento
    processCamera();
  } catch (error) {
    console.error("Erro ao acessar câmera:", error);

    cameraStatus.textContent = "Erro na câmera";

    cameraMessage.style.display = "flex";

    alert(
      "Não foi possível acessar a câmera.\n\n" +
        "Verifique se o navegador possui permissão " +
        "para utilizar a câmera."
    );
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

  video.srcObject = null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  cameraStatus.textContent = "Câmera parada";

  cameraMessage.style.display = "flex";

  startCameraButton.disabled = false;

  stopCameraButton.disabled = true;

  // Segurança:
  // ao parar a câmera, zeramos o comando.
  setCommand("00000");

  console.log("Câmera parada.");
}

// =====================================================
// PROCESSAMENTO DA CÂMERA
// =====================================================

async function processCamera() {
  if (!cameraRunning) {
    return;
  }

  if (video.readyState >= 2) {
    canvas.width = video.videoWidth;

    canvas.height = video.videoHeight;

    try {
      await hands.send({
        image: video,
      });
    } catch (error) {
      console.error("Erro no MediaPipe:", error);
    }
  }

  if (cameraRunning) {
    requestAnimationFrame(processCamera);
  }
}

// =====================================================
// DETECÇÃO DOS DEDOS
// =====================================================
//
// MediaPipe fornece 21 pontos:
//
// 0  = punho
// 1  = base do polegar
// 2  = polegar
// 3  = polegar
// 4  = ponta do polegar
//
// 5  = base indicador
// 6  = articulação
// 7  = articulação
// 8  = ponta indicador
//
// 9  = base médio
// 10 = articulação
// 11 = articulação
// 12 = ponta médio
//
// 13 = base anelar
// 14 = articulação
// 15 = articulação
// 16 = ponta anelar
//
// 17 = base mínimo
// 18 = articulação
// 19 = articulação
// 20 = ponta mínimo
//
// =====================================================

// -----------------------------------------------------
// DISTÂNCIA ENTRE DOIS PONTOS
// -----------------------------------------------------

function distance(a, b) {
  const dx = a.x - b.x;

  const dy = a.y - b.y;

  return Math.sqrt(dx * dx + dy * dy);
}

// -----------------------------------------------------
// DETECTAR DEDOS
// -----------------------------------------------------

function detectFingers(landmarks, handedness) {
  // -------------------------------------------------
  // DEDOS VERTICAIS
  // -------------------------------------------------
  //
  // Para indicador, médio, anelar e mínimo,
  // comparamos a ponta com a articulação PIP.
  //
  // Como Y cresce para baixo:
  //
  // ponta.y < articulação.y
  //
  // significa dedo levantado.
  // -------------------------------------------------

  const indicador = landmarks[8].y < landmarks[6].y;

  const medio = landmarks[12].y < landmarks[10].y;

  const anelar = landmarks[16].y < landmarks[14].y;

  const minimo = landmarks[20].y < landmarks[18].y;

  // -------------------------------------------------
  // POLEGAR
  // -------------------------------------------------
  //
  // O polegar é melhor analisado pela distância
  // entre a ponta e a palma.
  //
  // Também usamos a direção horizontal.
  //
  // Isso permite trabalhar com mão esquerda/direita.
  // -------------------------------------------------

  const thumbTip = landmarks[4];

  const thumbIP = landmarks[3];

  const indexBase = landmarks[5];

  const thumbDistance = distance(thumbTip, indexBase);

  const palmSize = distance(landmarks[0], landmarks[9]);

  // Evita considerar o polegar levantado
  // quando ele está muito próximo da palma.

  const thumbExtended = thumbDistance > palmSize * 0.75;

  // -------------------------------------------------
  // RESULTADO
  // -------------------------------------------------
  //
  // Ordem EXATA esperada pelo ESP32:
  //
  // [0] Polegar
  // [1] Indicador
  // [2] Médio
  // [3] Anelar
  // [4] Mínimo
  // -------------------------------------------------

  return [thumbExtended, indicador, medio, anelar, minimo];
}

// =====================================================
// TRANSFORMAR BOOLEANOS EM 5 BITS
// =====================================================

function fingersToCommand(fingers) {
  return fingers.map((finger) => (finger ? "1" : "0")).join("");
}

// =====================================================
// ESTABILIZAÇÃO
// =====================================================
//
// Evita que pequenas oscilações da visão computacional
// façam o comando ficar alternando rapidamente.
//
// =====================================================

function processStableCommand(command) {
  if (command === detectedCommand) {
    stableFrames++;
  } else {
    detectedCommand = command;

    stableFrames = 1;
  }

  if (stableFrames >= STABILITY_FRAMES && command !== currentCommand) {
    setCommand(command);

    console.log("Novo comando:", command);
  }
}

// =====================================================
// RESULTADOS DO MEDIAPIPE
// =====================================================

const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});

hands.setOptions({
  maxNumHands: 1,

  modelComplexity: 1,

  minDetectionConfidence: 0.65,

  minTrackingConfidence: 0.65,
});

hands.onResults((results) => {
  // ------------------------------------------------
  // LIMPA CANVAS
  // ------------------------------------------------

  if (canvas.width && canvas.height) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // ------------------------------------------------
  // NENHUMA MÃO
  // ------------------------------------------------

  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    cameraStatus.textContent = "Câmera ativa — mão não detectada";

    // Não desligamos imediatamente.
    // O último comando continua sendo enviado
    // pelo intervalo MQTT.
    return;
  }

  cameraStatus.textContent = "Câmera ativa — mão detectada";

  // ------------------------------------------------
  // PRIMEIRA MÃO
  // ------------------------------------------------

  const landmarks = results.multiHandLandmarks[0];

  // ------------------------------------------------
  // DESENHAR CONEXÕES
  // ------------------------------------------------

  if (typeof drawConnectors === "function") {
    drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
      color: "#22c55e",
      lineWidth: 4,
    });
  }

  // ------------------------------------------------
  // DESENHAR PONTOS
  // ------------------------------------------------

  if (typeof drawLandmarks === "function") {
    drawLandmarks(ctx, landmarks, {
      color: "#60a5fa",
      lineWidth: 2,
      radius: 5,
    });
  }

  // ------------------------------------------------
  // IDENTIFICAR MÃO
  // ------------------------------------------------

  let handedness = null;

  if (results.multiHandedness && results.multiHandedness.length > 0) {
    handedness = results.multiHandedness[0].label;
  }

  // ------------------------------------------------
  // DETECTAR DEDOS
  // ------------------------------------------------

  const fingers = detectFingers(landmarks, handedness);

  // ------------------------------------------------
  // CONVERTER PARA 5 BITS
  // ------------------------------------------------

  const command = fingersToCommand(fingers);

  console.log("Mão:", handedness, "Dedos:", fingers, "Comando:", command);

  // ------------------------------------------------
  // EMERGÊNCIA
  // ------------------------------------------------

  if (emergencyActive) {
    return;
  }

  // ------------------------------------------------
  // ESTABILIZAR
  // ------------------------------------------------

  processStableCommand(command);
});

// =====================================================
// EVENTOS
// =====================================================

startCameraButton.addEventListener("click", startCameraFunction);

stopCameraButton.addEventListener("click", stopCameraFunction);

connectMqttButton.addEventListener("click", connectMQTT);

emergencyButton.addEventListener("click", publishEmergency);

resetButton.addEventListener("click", resetEmergency);

// =====================================================
// ESTADO INICIAL
// =====================================================

setCommand("00000");

setMqttStatus("desconectado", false);

// =====================================================
// CONECTA MQTT AUTOMATICAMENTE
// =====================================================
//
// O botão continua disponível, mas tentamos conectar
// automaticamente quando a página é aberta.
//
// =====================================================

connectMQTT();
