#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>

// =====================================================
// WIFI
// =====================================================

const char *WIFI_SSID =
    "FIERGS-CHROMEBOOK";

const char *WIFI_PASSWORD =
    "chromefiergs";

// =====================================================
// HIVE MQ CLOUD
// =====================================================
//
// ATENÇÃO:
// Use exatamente o hostname mostrado em:
//
// HiveMQ Cloud
// -> seu cluster
// -> Overview
// -> Connection Details
//
// Exemplo:
//
// abc123.s1.eu.hivemq.cloud
//
// =====================================================

const char *MQTT_SERVER =
    "9927a23299b84ac78820c07e11c8d448.s1.eu.hivemq.cloud";

const int MQTT_PORT =
    8883;

// =====================================================
// CREDENCIAL EXCLUSIVA DO ESP32
// =====================================================

const char *MQTT_USER =
    "hivemq.webclient.1789562292116";

const char *MQTT_PASSWORD =
    "jpFACDmz$jXzrHghKwz6ftrHACRxOow%";

// =====================================================
// CLIENT ID
// =====================================================
//
// O Client ID precisa ser único.
//
// =====================================================

String MQTT_CLIENT_ID;

// =====================================================
// TÓPICOS
// =====================================================

const char *MQTT_TOPIC =
    "automacao/maquina/dedos";

const char *MQTT_STOP_TOPIC =
    "automacao/maquina/emergencia";

// =====================================================
// OUTPUTS
// =====================================================

const int Inspecionador = 18;

const int Garra = 19;

const int Seletor = 21;

const int Esteira = 22;

const int Trava = 23;

// =====================================================
// SEGURANÇA
// =====================================================

const unsigned long TIMEOUT_MQTT =
    1000;

unsigned long ultimaMensagem =
    0;

bool emergencia =
    false;

// =====================================================
// MQTT
// =====================================================

WiFiClientSecure espClient;

PubSubClient mqttClient(
    espClient);

// =====================================================
// DESLIGAR TUDO
// =====================================================

void desligarTodos()
{
  digitalWrite(
      Inspecionador,
      LOW);

  digitalWrite(
      Garra,
      LOW);

  digitalWrite(
      Seletor,
      LOW);

  digitalWrite(
      Esteira,
      LOW);

  digitalWrite(
      Trava,
      LOW);
}

// =====================================================
// PROCESSAR DEDOS
// =====================================================

void processarDedos(
    String mensagem)
{
  mensagem.trim();

  Serial.print(
      "Processando: ");

  Serial.println(
      mensagem);

  // ---------------------------------------------------
  // EMERGÊNCIA
  // ---------------------------------------------------

  if (emergencia)
  {
    Serial.println(
        "EMERGENCIA ATIVA - comando ignorado");

    desligarTodos();

    return;
  }

  // ---------------------------------------------------
  // VALIDAR TAMANHO
  // ---------------------------------------------------

  if (
      mensagem.length() != 5)
  {
    Serial.println(
        "ERRO: mensagem deve ter 5 caracteres");

    desligarTodos();

    return;
  }

  // ---------------------------------------------------
  // VALIDAR 0/1
  // ---------------------------------------------------

  for (
      int i = 0;
      i < 5;
      i++)
  {
    if (
        mensagem.charAt(i) != '0' &&
        mensagem.charAt(i) != '1')
    {
      Serial.println(
          "ERRO: mensagem contém caractere inválido");

      desligarTodos();

      return;
    }
  }

  // ---------------------------------------------------
  // ATUALIZA WATCHDOG
  // ---------------------------------------------------

  ultimaMensagem =
      millis();

  // ---------------------------------------------------
  // DEDOS
  // ---------------------------------------------------

  bool polegar =
      mensagem.charAt(0) == '1';

  bool indicador =
      mensagem.charAt(1) == '1';

  bool medio =
      mensagem.charAt(2) == '1';

  bool anelar =
      mensagem.charAt(3) == '1';

  bool minimo =
      mensagem.charAt(4) == '1';

  // ---------------------------------------------------
  // DEBUG
  // ---------------------------------------------------

  Serial.println(
      "----------------------------");

  Serial.print(
      "Polegar: ");

  Serial.println(
      polegar
          ? "ON"
          : "OFF");

  Serial.print(
      "Indicador: ");

  Serial.println(
      indicador
          ? "ON"
          : "OFF");

  Serial.print(
      "Medio: ");

  Serial.println(
      medio
          ? "ON"
          : "OFF");

  Serial.print(
      "Anelar: ");

  Serial.println(
      anelar
          ? "ON"
          : "OFF");

  Serial.print(
      "Minimo: ");

  Serial.println(
      minimo
          ? "ON"
          : "OFF");

  // ---------------------------------------------------
  // OUTPUTS
  // ---------------------------------------------------

  digitalWrite(
      Esteira,
      polegar
          ? HIGH
          : LOW);

  digitalWrite(
      Garra,
      indicador
          ? HIGH
          : LOW);

  digitalWrite(
      Seletor,
      medio
          ? HIGH
          : LOW);

  digitalWrite(
      Inspecionador,
      anelar
          ? HIGH
          : LOW);

  digitalWrite(
      Trava,
      minimo
          ? HIGH
          : LOW);

  Serial.println(
      "Outputs atualizados.");

  Serial.println(
      "----------------------------");
}

// =====================================================
// CALLBACK MQTT
// =====================================================

void callback(
    char *topic,
    byte *payload,
    unsigned int length)
{
  Serial.println();
  Serial.println(
      "================================");

  Serial.println(
      "MENSAGEM MQTT RECEBIDA!");

  Serial.print(
      "Topic: ");

  Serial.println(
      topic);

  Serial.print(
      "Tamanho: ");

  Serial.println(
      length);

  String mensagem =
      "";

  for (
      unsigned int i = 0;
      i < length;
      i++)
  {
    mensagem +=
        (char)payload[i];
  }

  Serial.print(
      "Payload: [");

  Serial.print(
      mensagem);

  Serial.println(
      "]");

  // ===================================================
  // EMERGÊNCIA
  // ===================================================

  if (
      strcmp(
          topic,
          MQTT_STOP_TOPIC) == 0)
  {

    Serial.println(
        "TOPICO DE EMERGENCIA");

    if (
        mensagem == "STOP" ||
        mensagem == "EMERGENCY")
    {

      emergencia =
          true;

      desligarTodos();

      Serial.println(
          "!!! EMERGENCIA ATIVADA !!!");
    }

    else if (
        mensagem == "RESET")
    {

      emergencia =
          false;

      ultimaMensagem =
          millis();

      desligarTodos();

      Serial.println(
          "Emergencia resetada.");
    }

    Serial.println(
        "================================");

    return;
  }

  // ===================================================
  // DEDOS
  // ===================================================

  if (
      strcmp(
          topic,
          MQTT_TOPIC) == 0)
  {

    processarDedos(
        mensagem);
  }

  else
  {

    Serial.println(
        "Topic desconhecido!");
  }

  Serial.println(
      "================================");
}

// =====================================================
// WIFI
// =====================================================

void conectarWiFi()
{
  Serial.println();
  Serial.println(
      "Conectando ao WiFi...");

  WiFi.mode(
      WIFI_STA);

  WiFi.begin(
      WIFI_SSID,
      WIFI_PASSWORD);

  int tentativas =
      0;

  while (
      WiFi.status() !=
      WL_CONNECTED)
  {

    delay(
        500);

    Serial.print(
        ".");

    tentativas++;

    if (
        tentativas > 40)
    {

      Serial.println();

      Serial.println(
          "ERRO: WiFi nao conectou.");

      return;
    }
  }

  Serial.println();

  Serial.println(
      "WiFi conectado!");

  Serial.print(
      "IP: ");

  Serial.println(
      WiFi.localIP());
}

// =====================================================
// MQTT
// =====================================================

bool conectarMQTT()
{
  Serial.println();
  Serial.println(
      "Conectando ao HiveMQ Cloud...");

  Serial.print(
      "Servidor: ");

  Serial.println(
      MQTT_SERVER);

  Serial.print(
      "Porta: ");

  Serial.println(
      MQTT_PORT);

  Serial.print(
      "Usuario: ");

  Serial.println(
      MQTT_USER);

  Serial.print(
      "Client ID: ");

  Serial.println(
      MQTT_CLIENT_ID);

  // ---------------------------------------------------
  // CONECTAR
  // ---------------------------------------------------

  bool conectado =
      mqttClient.connect(
          MQTT_CLIENT_ID.c_str(),
          MQTT_USER,
          MQTT_PASSWORD);

  if (
      conectado)
  {

    Serial.println();
    Serial.println(
        "********************************");

    Serial.println(
        "     HIVEMQ CONECTADO!");

    Serial.println(
        "********************************");

    // -------------------------------------------------
    // SUBSCRIBE DEDOS
    // -------------------------------------------------

    bool subDedos =
        mqttClient.subscribe(
            MQTT_TOPIC,
            0);

    Serial.print(
        "Subscribe dedos: ");

    Serial.println(
        subDedos
            ? "OK"
            : "FALHOU");

    // -------------------------------------------------
    // SUBSCRIBE EMERGENCIA
    // -------------------------------------------------

    bool subEmergencia =
        mqttClient.subscribe(
            MQTT_STOP_TOPIC,
            0);

    Serial.print(
        "Subscribe emergencia: ");

    Serial.println(
        subEmergencia
            ? "OK"
            : "FALHOU");

    // -------------------------------------------------
    // TESTE
    // -------------------------------------------------

    Serial.println(
        "Aguardando mensagens...");

    ultimaMensagem =
        millis();

    return true;
  }

  // ===================================================
  // ERRO
  // ===================================================

  Serial.println();
  Serial.println(
      "********************************");

  Serial.println(
      "     FALHA MQTT");

  Serial.print(
      "Estado PubSubClient: ");

  Serial.println(
      mqttClient.state());

  Serial.println(
      "********************************");

  return false;
}

// =====================================================
// SETUP
// =====================================================

void setup()
{
  Serial.begin(
      115200);

  delay(
      1000);

  Serial.println();
  Serial.println(
      "================================");

  Serial.println(
      " ESP32 CONTROLE POR GESTOS");

  Serial.println(
      " HiveMQ Cloud");

  Serial.println(
      "================================");

  // ===================================================
  // CLIENT ID ÚNICO
  // ===================================================

  MQTT_CLIENT_ID =
      "ESP32_MAQUINA_01_" +
      String(
          (uint32_t)
              ESP.getEfuseMac());

  // ===================================================
  // OUTPUTS
  // ===================================================

  pinMode(
      Inspecionador,
      OUTPUT);

  pinMode(
      Garra,
      OUTPUT);

  pinMode(
      Seletor,
      OUTPUT);

  pinMode(
      Esteira,
      OUTPUT);

  pinMode(
      Trava,
      OUTPUT);

  // ===================================================
  // ESTADO SEGURO
  // ===================================================

  desligarTodos();

  emergencia =
      false;

  // ===================================================
  // WIFI
  // ===================================================

  conectarWiFi();

  if (
      WiFi.status() !=
      WL_CONNECTED)
  {

    Serial.println(
        "Sem WiFi. Parando.");

    return;
  }

  // ===================================================
  // TLS
  // ===================================================
  //
  // Mantemos TLS, mas sem validação da CA durante
  // este diagnóstico.
  //
  // Depois podemos colocar o certificado raiz.
  //
  // ===================================================

  espClient.setInsecure();

  // ===================================================
  // MQTT
  // ===================================================

  mqttClient.setServer(
      MQTT_SERVER,
      MQTT_PORT);

  mqttClient.setCallback(
      callback);

  // Aumenta o tamanho do buffer MQTT.
  mqttClient.setBufferSize(
      512);

  // ===================================================
  // CONECTAR
  // ===================================================

  conectarMQTT();

  ultimaMensagem =
      millis();
}

// =====================================================
// LOOP
// =====================================================

void loop()
{
  // ===================================================
  // WIFI
  // ===================================================

  if (
      WiFi.status() !=
      WL_CONNECTED)
  {

    desligarTodos();

    conectarWiFi();
  }

  // ===================================================
  // MQTT
  // ===================================================

  if (
      !mqttClient.connected())
  {

    desligarTodos();

    delay(
        1000);

    conectarMQTT();
  }

  // ===================================================
  // MUITO IMPORTANTE
  // ===================================================
  //
  // Essa chamada processa as mensagens recebidas
  // pelo PubSubClient e dispara callback().
  //
  // ===================================================

  mqttClient.loop();

  // ===================================================
  // TIMEOUT
  // ===================================================

  if (
      !emergencia)
  {

    if (
        millis() -
            ultimaMensagem >
        TIMEOUT_MQTT)
    {

      desligarTodos();

      Serial.println(
          "TIMEOUT MQTT - OUTPUTS OFF");

      // Evita imprimir centenas de vezes
      ultimaMensagem =
          millis();
    }
  }

  // ===================================================
  // EMERGENCIA
  // ===================================================

  if (
      emergencia)
  {

    desligarTodos();
  }

  delay(
      2);
}
