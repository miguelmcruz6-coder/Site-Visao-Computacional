import {
  MQTT_HOST,
  MQTT_PORT,
  MQTT_PATH,
  MQTT_USERNAME,
  MQTT_PASSWORD,
  MQTT_TOPIC,
  MQTT_STOP_TOPIC,
} from "./Data/mqttConfig.js";

/* =====================================================
   ELEMENTOS
===================================================== */

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

/* =====================================================
   VARIÁVEIS
===================================================== */

let stream = null;
let camera = null;
let mqttClient = null;

let dedos = [0, 0, 0, 0, 0];

let ultimoComando = "";

let emergenciaAtiva = false;

/*
   Controle do intertravamento

   dedo 1 = Garra
   dedo 3 = Inspecionador
*/

let garraBloqueada = false;
let inspecionadorBloqueado = false;

let timerGarra = null;
let timerInspecionador = null;

/* =====================================================
   MQTT
===================================================== */

function conectarMQTT() {
  if (mqttClient && mqttClient.connected) {
    console.log("MQTT já está conectado.");
    return;
  }

  console.log("Iniciando conexão MQTT...");

  mqttStatus.textContent = "MQTT conectando...";
  mqttStatus.className = "status offline";

  /*
     HiveMQ WebSocket

     Porta 8884 = WSS
  */

  const url = `wss://${MQTT_HOST}:${MQTT_PORT}${MQTT_PATH}`;

  console.log("URL MQTT:", url);

  mqttClient = mqtt.connect(url, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,

    clean: true,

    reconnectPeriod: 3000,

    connectTimeout: 10000,
  });

  mqttClient.on("connect", () => {
    console.log("MQTT conectado!");

    mqttStatus.textContent = "MQTT conectado";
    mqttStatus.className = "status online";

    connectMqttBtn.textContent = "✅ MQTT conectado";

    /*
       Envia o estado atual assim que conectar
    */

    ultimoComando = "";

    enviarComando();
  });

  mqttClient.on("error", (erro) => {
    console.error("Erro MQTT:", erro);

    mqttStatus.textContent = "Erro MQTT";
    mqttStatus.className = "status offline";
  });

  mqttClient.on("reconnect", () => {
    console.log("Tentando reconectar MQTT...");

    mqttStatus.textContent = "MQTT reconectando...";
    mqttStatus.className = "status offline";
  });

  mqttClient.on("close", () => {
    console.log("MQTT desconectado.");

    mqttStatus.textContent = "MQTT desconectado";
    mqttStatus.className = "status offline";

    connectMqttBtn.textContent = "🔌 Conectar MQTT";
  });
}

/* =====================================================
   ENVIAR COMANDO
===================================================== */

function enviarComando() {
  const comando = dedos.join("");

  /*
     Mostra sempre na interface
  */

  commandDisplay.textContent = comando;
  mqttCommand.textContent = comando;

  /*
     Se MQTT não estiver conectado,
     apenas atualiza a interface.
  */

  if (!mqttClient || !mqttClient.connected) {
    return;
  }

  /*
     Não envia o mesmo comando repetidamente.
  */

  if (comando === ultimoComando) {
    return;
  }

  ultimoComando = comando;

  mqttClient.publish(
    MQTT_TOPIC,
    comando,
    {
      qos: 0,
      retain: false,
    },
    (erro) => {
      if (erro) {
        console.error("Erro ao publicar:", erro);
        return;
      }

      console.log("MQTT enviado:", comando);
    }
  );
}

/* =====================================================
   ATUALIZAR INTERFACE
===================================================== */

function atualizarInterface() {
  for (let i = 0; i < 5; i++) {
    if (dedos[i] === 1) {
      lights[i].classList.add("on");
    } else {
      lights[i].classList.remove("on");
    }
  }

  const comando = dedos.join("");

  commandDisplay.textContent = comando;
  mqttCommand.textContent = comando;
}

/* =====================================================
   INTERTRAVAMENTO - GARRA
===================================================== */

function acionarGarra() {
  if (garraBloqueada) {
    console.log("Garra bloqueada.");
    return;
  }

  console.log("🦾 GARRA acionada.");

  /*
     Desliga imediatamente o Inspecionador
  */

  dedos[3] = 0;

  /*
     Bloqueia o Inspecionador
     durante 2 segundos
  */

  inspecionadorBloqueado = true;

  clearTimeout(timerInspecionador);

  timerInspecionador = setTimeout(() => {
    inspecionadorBloqueado = false;

    console.log("✅ Inspecionador liberado.");
  }, 2000);

  atualizarInterface();

  enviarComando();
}

/* =====================================================
   INTERTRAVAMENTO - INSPECIONADOR
===================================================== */

function acionarInspecionador() {
  if (inspecionadorBloqueado) {
    console.log("Inspecionador bloqueado.");
    return;
  }

  console.log("🔍 INSPECIONADOR acionado.");

  /*
     Desliga imediatamente a Garra
  */

  dedos[1] = 0;

  /*
     Bloqueia a Garra
     durante 2 segundos
  */

  garraBloqueada = true;

  clearTimeout(timerGarra);

  timerGarra = setTimeout(() => {
    garraBloqueada = false;

    console.log("✅ Garra liberada.");
  }, 2000);

  atualizarInterface();

  enviarComando();
}

/* =====================================================
   PROCESSAR DEDOS
===================================================== */

function processarDedos(novosDedos) {
  if (emergenciaAtiva) {
    return;
  }

  const estadoAnterior = [...dedos];

  /*
     -----------------------------------------------
     GARRA
     -----------------------------------------------
  */

  if (estadoAnterior[1] === 0 && novosDedos[1] === 1) {
    if (!garraBloqueada) {
      dedos = [...novosDedos];

      acionarGarra();

      return;
    } else {
      novosDedos[1] = 0;
    }
  }

  /*
     -----------------------------------------------
     INSPECIONADOR
     -----------------------------------------------
  */

  if (estadoAnterior[3] === 0 && novosDedos[3] === 1) {
    if (!inspecionadorBloqueado) {
      dedos = [...novosDedos];

      acionarInspecionador();

      return;
    } else {
      novosDedos[3] = 0;
    }
  }

  /*
     -----------------------------------------------
     ATUALIZA OS DEMAIS DEDOS
     -----------------------------------------------
  */

  dedos = [...novosDedos];

  atualizarInterface();

  enviarComando();
}

/* =====================================================
   DETECTAR DEDOS
===================================================== */

function detectarDedos(landmarks) {
  const resultado = [0, 0, 0, 0, 0];

  /*
     INDICADOR
  */

  if (landmarks[8].y < landmarks[6].y) {
    resultado[1] = 1;
  }

  /*
     MÉDIO
  */

  if (landmarks[12].y < landmarks[10].y) {
    resultado[2] = 1;
  }

  /*
     ANELAR
  */

  if (landmarks[16].y < landmarks[14].y) {
    resultado[3] = 1;
  }

  /*
     MÍNIMO
  */

  if (landmarks[20].y < landmarks[18].y) {
    resultado[4] = 1;
  }

  /*
     POLEGAR

     Para uma mão espelhada/câmera frontal,
     usamos comparação horizontal.
  */

  if (landmarks[4].x < landmarks[3].x) {
    resultado[0] = 1;
  }

  return resultado;
}

/* =====================================================
   MEDIAPIPE
===================================================== */

const hands = new Hands({
  locateFile: (arquivo) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${arquivo}`;
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

  /*
     Ajusta canvas
  */

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  /*
     Nenhuma mão detectada
  */

  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    return;
  }

  /*
     Processa a primeira mão
  */

  const landmarks = results.multiHandLandmarks[0];

  /*
     Desenha conexões
  */

  drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
    color: "#00FF00",
    lineWidth: 3,
  });

  /*
     Desenha pontos
  */

  drawLandmarks(ctx, landmarks, {
    color: "#FF0000",
    lineWidth: 1,
    radius: 3,
  });

  /*
     Detecta dedos
  */

  const resultado = detectarDedos(landmarks);

  processarDedos(resultado);
});

/* =====================================================
   INICIAR CÂMERA
===================================================== */

async function iniciarCamera() {
  try {
    console.log("Solicitando câmera...");

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

    /*
       MediaPipe Camera
    */

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
  } catch (erro) {
    console.error("Erro ao iniciar câmera:", erro);

    cameraStatus.textContent = "Erro ao acessar câmera";

    alert(
      "Não foi possível acessar a câmera.\n\n" +
        "Verifique a permissão do navegador."
    );
  }
}

/* =====================================================
   PARAR CÂMERA
===================================================== */

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

/* =====================================================
   EMERGÊNCIA
===================================================== */

function ativarEmergencia() {
  emergenciaAtiva = true;

  /*
     Zera todos os dedos
  */

  dedos = [0, 0, 0, 0, 0];

  atualizarInterface();

  /*
     Envia comando de emergência
  */

  if (mqttClient && mqttClient.connected) {
    mqttClient.publish(MQTT_STOP_TOPIC, "STOP", {
      qos: 1,
      retain: false,
    });

    console.log("🚨 EMERGÊNCIA enviada via MQTT.");
  }

  emergencyBtn.textContent = "🚨 EMERGÊNCIA ATIVA";
}

function resetarEmergencia() {
  emergenciaAtiva = false;

  emergencyBtn.textContent = "🛑 EMERGÊNCIA";

  ultimoComando = "";

  enviarComando();

  console.log("↻ Emergência resetada.");
}

/* =====================================================
   EVENTOS
===================================================== */

startCameraBtn.addEventListener("click", iniciarCamera);

stopCameraBtn.addEventListener("click", pararCamera);

connectMqttBtn.addEventListener("click", conectarMQTT);

emergencyBtn.addEventListener("click", ativarEmergencia);

resetEmergencyBtn.addEventListener("click", resetarEmergencia);

/* =====================================================
   INICIALIZAÇÃO
===================================================== */

atualizarInterface();

console.log("✅ Script carregado corretamente.");
