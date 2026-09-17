import {
  MQTT_HOST,
  MQTT_PORT,
  MQTT_PATH,
  MQTT_USERNAME,
  MQTT_PASSWORD,
  MQTT_TOPIC,
  MQTT_STOP_TOPIC,
} from "./Data/mqttConfig";

/*
=====================================================
 ELEMENTOS HTML
=====================================================
*/

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const startCameraBtn = document.getElementById("startCamera");
const stopCameraBtn = document.getElementById("stopCamera");

const cameraStatus = document.getElementById("cameraStatus");

const connectMqttBtn = document.getElementById("connectMqtt");
const emergencyBtn = document.getElementById("emergency");
const resetEmergencyBtn = document.getElementById("resetEmergency");

const mqttStatus = document.getElementById("mqttStatus");

const commandDisplay = document.getElementById("commandDisplay");
const mqttCommand = document.getElementById("mqttCommand");

const lights = [
  document.getElementById("light0"),
  document.getElementById("light1"),
  document.getElementById("light2"),
  document.getElementById("light3"),
  document.getElementById("light4"),
];

/*
=====================================================
 ESTADO
=====================================================
*/

let camera = null;
let stream = null;
let mqttClient = null;

let emergencyActive = false;

// Estado atual dos dedos
let fingers = [0, 0, 0, 0, 0];

// Controle do intertravamento
let garraBloqueada = false;
let inspecionadorBloqueado = false;

// Timers de liberação
let garraTimer = null;
let inspecionadorTimer = null;

// Último comando enviado
let lastCommand = "";

/*
=====================================================
 MQTT
=====================================================
*/

function connectMQTT() {
  if (mqttClient && mqttClient.connected) {
    console.log("MQTT já está conectado.");
    return;
  }

  mqttStatus.textContent = "MQTT conectando...";
  mqttStatus.className = "status offline";

  const url = `wss://${MQTT_HOST}:${MQTT_PORT}${MQTT_PATH}`;

  console.log("Conectando ao MQTT:", url);

  mqttClient = mqtt.connect(url, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    clean: true,
    reconnectPeriod: 3000,
  });

  mqttClient.on("connect", () => {
    console.log("MQTT conectado.");

    mqttStatus.textContent = "MQTT conectado";
    mqttStatus.className = "status online";

    connectMqttBtn.textContent = "✅ MQTT conectado";

    enviarComando();
  });

  mqttClient.on("reconnect", () => {
    mqttStatus.textContent = "MQTT reconectando...";
    mqttStatus.className = "status offline";
  });

  mqttClient.on("error", (error) => {
    console.error("Erro MQTT:", error);

    mqttStatus.textContent = "Erro MQTT";
    mqttStatus.className = "status offline";
  });

  mqttClient.on("close", () => {
    console.log("MQTT desconectado.");

    mqttStatus.textContent = "MQTT desconectado";
    mqttStatus.className = "status offline";

    connectMqttBtn.textContent = "🔌 Conectar MQTT";
  });
}

/*
=====================================================
 ENVIO MQTT
=====================================================
*/

function enviarComando() {
  if (!mqttClient || !mqttClient.connected) {
    return;
  }

  const comando = fingers.join("");

  if (comando === lastCommand) {
    return;
  }

  lastCommand = comando;

  mqttClient.publish(MQTT_TOPIC, comando, {
    qos: 0,
    retain: false,
  });

  mqttCommand.textContent = comando;

  console.log("Comando enviado:", comando);
}

/*
=====================================================
 EMERGÊNCIA
=====================================================
*/

function ativarEmergencia() {
  emergencyActive = true;

  const comandoEmergencia = "11111";

  if (mqttClient && mqttClient.connected) {
    mqttClient.publish(MQTT_STOP_TOPIC, comandoEmergencia, {
      qos: 1,
      retain: false,
    });
  }

  console.warn("🚨 EMERGÊNCIA ATIVADA");

  emergencyBtn.textContent = "🚨 EMERGÊNCIA ATIVA";
}

function resetarEmergencia() {
  emergencyActive = false;

  emergencyBtn.textContent = "🛑 EMERGÊNCIA";

  console.log("Emergência resetada.");

  enviarComando();
}

/*
=====================================================
 INTERTRAVAMENTO
=====================================================

Garra = dedo 1
Inspecionador = dedo 3

Quando uma função é acionada:

1. A outra é desligada imediatamente.
2. A outra fica bloqueada.
3. Após 2 segundos, ela pode ser acionada novamente.
=====================================================
*/

function ativarGarra() {
  if (garraBloqueada || emergencyActive) {
    return;
  }

  console.log("🦾 Garra acionada.");

  // Desativa o inspecionador
  fingers[3] = 0;
  atualizarLuzes();

  // Bloqueia o inspecionador
  inspecionadorBloqueado = true;

  clearTimeout(inspecionadorTimer);

  inspecionadorTimer = setTimeout(() => {
    inspecionadorBloqueado = false;

    console.log("✅ Inspecionador liberado após 2 segundos.");

    atualizarComando();
  }, 2000);

  atualizarComando();
}

function ativarInspecionador() {
  if (inspecionadorBloqueado || emergencyActive) {
    return;
  }

  console.log("🔍 Inspecionador acionado.");

  // Desativa a garra
  fingers[1] = 0;
  atualizarLuzes();

  // Bloqueia a garra
  garraBloqueada = true;

  clearTimeout(garraTimer);

  garraTimer = setTimeout(() => {
    garraBloqueada = false;

    console.log("✅ Garra liberada após 2 segundos.");

    atualizarComando();
  }, 2000);

  atualizarComando();
}

/*
=====================================================
 PROCESSAMENTO DO COMANDO
=====================================================
*/

function atualizarComando() {
  if (emergencyActive) {
    return;
  }

  const comando = fingers.join("");

  commandDisplay.textContent = comando;

  enviarComando();
}

/*
=====================================================
 ATUALIZAÇÃO DAS LUZES
=====================================================
*/

function atualizarLuzes() {
  fingers.forEach((value, index) => {
    if (value === 1) {
      lights[index].classList.add("on");
    } else {
      lights[index].classList.remove("on");
    }
  });

  commandDisplay.textContent = fingers.join("");
}

/*
=====================================================
 DETECÇÃO DOS DEDOS
=====================================================
*/

function processarDedos(dedosDetectados) {
  if (emergencyActive) {
    return;
  }

  const novoEstado = [...dedosDetectados];

  /*
  ---------------------------------------------
  GARRA
  ---------------------------------------------
  */

  if (novoEstado[1] === 1) {
    if (garraBloqueada) {
      novoEstado[1] = 0;
    } else if (fingers[1] === 0) {
      fingers = novoEstado;

      ativarGarra();

      return;
    }
  }

  /*
  ---------------------------------------------
  INSPECIONADOR
  ---------------------------------------------
  */

  if (novoEstado[3] === 1) {
    if (inspecionadorBloqueado) {
      novoEstado[3] = 0;
    } else if (fingers[3] === 0) {
      fingers = novoEstado;

      ativarInspecionador();

      return;
    }
  }

  /*
  ---------------------------------------------
  APLICA OS DEMAIS DEDOS
  ---------------------------------------------
  */

  fingers = novoEstado;

  atualizarLuzes();
  atualizarComando();
}

/*
=====================================================
 MEDIA PIPE - MÃOS
=====================================================
*/

const hands = new Hands({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
  },
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});

hands.onResults((results) => {
  if (!video.videoWidth || !video.videoHeight) {
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!results.multiHandLandmarks) {
    return;
  }

  for (const landmarks of results.multiHandLandmarks) {
    drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
      color: "#00FF00",
      lineWidth: 3,
    });

    drawLandmarks(ctx, landmarks, {
      color: "#FF0000",
      lineWidth: 1,
      radius: 3,
    });

    const dedos = detectarDedos(landmarks);

    processarDedos(dedos);
  }
});

/*
=====================================================
 DETECTAR DEDOS

 Retorna:

 [polegar, indicador, medio, anelar, minimo]

 0 = abaixado
 1 = levantado
=====================================================
*/

function detectarDedos(landmarks) {
  const dedos = [0, 0, 0, 0, 0];

  /*
  ---------------------------------------------
  INDICADOR
  ---------------------------------------------
  */

  if (landmarks[8].y < landmarks[6].y) {
    dedos[1] = 1;
  }

  /*
  ---------------------------------------------
  MÉDIO
  ---------------------------------------------
  */

  if (landmarks[12].y < landmarks[10].y) {
    dedos[2] = 1;
  }

  /*
  ---------------------------------------------
  ANELAR
  ---------------------------------------------
  */

  if (landmarks[16].y < landmarks[14].y) {
    dedos[3] = 1;
  }

  /*
  ---------------------------------------------
  MÍNIMO
  ---------------------------------------------
  */

  if (landmarks[20].y < landmarks[18].y) {
    dedos[4] = 1;
  }

  /*
  ---------------------------------------------
  POLEGAR

  Verificação horizontal simples.
  ---------------------------------------------
  */

  if (landmarks[4].x < landmarks[3].x) {
    dedos[0] = 1;
  }

  return dedos;
}

/*
=====================================================
 CÂMERA
=====================================================
*/

async function iniciarCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: {
          ideal: 1280,
        },
        height: {
          ideal: 720,
        },
      },
      audio: false,
    });

    video.srcObject = stream;

    await video.play();

    cameraStatus.textContent = "Câmera funcionando";

    startCameraBtn.disabled = true;
    stopCameraBtn.disabled = false;

    camera = new Camera(video, {
      onFrame: async () => {
        await hands.send({
          image: video,
        });
      },
      width: 1280,
      height: 720,
    });

    camera.start();

    console.log("📷 Câmera iniciada.");
  } catch (error) {
    console.error("Erro ao iniciar câmera:", error);

    cameraStatus.textContent = "Erro ao acessar câmera";
  }
}

function pararCamera() {
  if (camera) {
    camera.stop();
    camera = null;
  }

  if (stream) {
    stream.getTracks().forEach((track) => {
      track.stop();
    });

    stream = null;
  }

  video.srcObject = null;

  cameraStatus.textContent = "Câmera parada";

  startCameraBtn.disabled = false;
  stopCameraBtn.disabled = true;

  console.log("⏹ Câmera parada.");
}

/*
=====================================================
 EVENTOS
=====================================================
*/

startCameraBtn.addEventListener("click", iniciarCamera);

stopCameraBtn.addEventListener("click", pararCamera);

connectMqttBtn.addEventListener("click", connectMQTT);

emergencyBtn.addEventListener("click", ativarEmergencia);

resetEmergencyBtn.addEventListener("click", resetarEmergencia);

/*
=====================================================
 INICIALIZAÇÃO
=====================================================
*/

atualizarLuzes();
atualizarComando();

console.log("Sistema de controle por gestos iniciado.");
