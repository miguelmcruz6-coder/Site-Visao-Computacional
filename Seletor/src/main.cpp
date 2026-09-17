#include "config.h"

// =====================================================
// OUTPUTS
// =====================================================

const int Inspecionador = 18;

const int Garra = 19;

const int Seletor = 21;

const int Esteira = 22;

const int Trava = 23;

// =====================================================
// INTERTRAVAMENTO GARRA / INSPECIONADOR
// =====================================================

const unsigned long TEMPO_INTERTRAVAMENTO = 2000;

// Momento em que cada saída foi desligada
unsigned long momentoDesligamentoGarra = 0;

unsigned long momentoDesligamentoInspecionador = 0;

// Estado atual efetivo das saídas
bool estadoGarra = false;

bool estadoInspecionador = false;

// Estado solicitado pelo MQTT
bool solicitacaoGarra = false;

bool solicitacaoInspecionador = false;

// =====================================================
// SEGURANÇA
// =====================================================

const unsigned long TIMEOUT_MQTT = 1000;

unsigned long ultimaMensagem = 0;

bool emergencia = false;

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

// Atualiza estados
estadoGarra = false;

estadoInspecionador = false;

// IMPORTANTE:
// Quando tudo é desligado por segurança,
// inicia novamente o tempo de intertravamento.

momentoDesligamentoGarra =
    millis();

momentoDesligamentoInspecionador =
    millis();

}

// =====================================================
// ATUALIZAR GARRA / INSPECIONADOR
// =====================================================

void atualizarIntertravamento()
{
unsigned long agora =
millis();

// ===================================================
// EMERGÊNCIA
// ===================================================

if (emergencia)
{
    digitalWrite(
        Garra,
        LOW);

    digitalWrite(
        Inspecionador,
        LOW);

    estadoGarra = false;

    estadoInspecionador = false;

    return;
}

// ===================================================
// DETECTAR DESLIGAMENTO DA GARRA
// ===================================================

if (
    estadoGarra == true &&
    solicitacaoGarra == false)
{
    digitalWrite(
        Garra,
        LOW);

    estadoGarra = false;

    momentoDesligamentoGarra =
        agora;

    Serial.println(
        "GARRA desligada.");
}

// ===================================================
// DETECTAR DESLIGAMENTO DO INSPECIONADOR
// ===================================================

if (
    estadoInspecionador == true &&
    solicitacaoInspecionador == false)
{
    digitalWrite(
        Inspecionador,
        LOW);

    estadoInspecionador = false;

    momentoDesligamentoInspecionador =
        agora;

    Serial.println(
        "INSPECIONADOR desligado.");
}

// ===================================================
// GARRA
// ===================================================

if (
    solicitacaoGarra == true)
{
    // -------------------------------------------------
    // Inspecionador precisa estar desligado
    // -------------------------------------------------

    if (
        estadoInspecionador == true)
    {
        // Não liga a Garra enquanto
        // Inspecionador estiver ligado.

        digitalWrite(
            Garra,
            LOW);

        estadoGarra = false;

        return;
    }

    // -------------------------------------------------
    // Verificar os 2 segundos
    // -------------------------------------------------

    if (
        agora -
            momentoDesligamentoInspecionador >=
        TEMPO_INTERTRAVAMENTO)
    {
        if (
            estadoGarra == false)
        {
            digitalWrite(
                Garra,
                HIGH);

            estadoGarra = true;

            Serial.println(
                "GARRA ligada.");
        }
    }
    else
    {
        digitalWrite(
            Garra,
            LOW);

        estadoGarra = false;
    }
}

// ===================================================
// INSPECIONADOR
// ===================================================

if (
    solicitacaoInspecionador == true)
{
    // -------------------------------------------------
    // Garra precisa estar desligada
    // -------------------------------------------------

    if (
        estadoGarra == true)
    {
        // Não liga o Inspecionador enquanto
        // Garra estiver ligada.

        digitalWrite(
            Inspecionador,
            LOW);

        estadoInspecionador = false;

        return;
    }

    // -------------------------------------------------
    // Verificar os 2 segundos
    // -------------------------------------------------

    if (
        agora -
            momentoDesligamentoGarra >=
        TEMPO_INTERTRAVAMENTO)
    {
        if (
            estadoInspecionador == false)
        {
            digitalWrite(
                Inspecionador,
                HIGH);

            estadoInspecionador = true;

            Serial.println(
                "INSPECIONADOR ligado.");
        }
    }
    else
    {
        digitalWrite(
            Inspecionador,
            LOW);

        estadoInspecionador = false;
    }
}

// ===================================================
// GARANTIA DE SEGURANÇA
// ===================================================

// Nunca permitir os dois ligados ao mesmo tempo.

if (
    estadoGarra == true &&
    estadoInspecionador == true)
{
    Serial.println(
        "ERRO: GARRA E INSPECIONADOR SIMULTANEAMENTE!");

    digitalWrite(
        Garra,
        LOW);

    digitalWrite(
        Inspecionador,
        LOW);

    estadoGarra = false;

    estadoInspecionador = false;

    momentoDesligamentoGarra =
        agora;

    momentoDesligamentoInspecionador =
        agora;
}

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

// ===================================================
// ATUALIZAR SOLICITAÇÕES
// ===================================================

solicitacaoGarra =
    indicador;

solicitacaoInspecionador =
    anelar;

// ===================================================
// OUTPUTS INDEPENDENTES
// ===================================================

digitalWrite(
    Esteira,
    polegar
        ? HIGH
        : LOW);

digitalWrite(
    Seletor,
    medio
        ? HIGH
        : LOW);

digitalWrite(
    Trava,
    minimo
        ? HIGH
        : LOW);

// ===================================================
// INTERTRAVAMENTO
// ===================================================

atualizarIntertravamento();

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

        solicitacaoGarra =
            false;

        solicitacaoInspecionador =
            false;

        desligarTodos();

        Serial.println(
            "!!! EMERENCIA ATIVADA !!!");
    }

    else if (
        mensagem == "RESET")
    {
        emergencia =
            false;

        solicitacaoGarra =
            false;

        solicitacaoInspecionador =
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
// CLIENT ID / CONFIGURAÇÃO
// ===================================================

initConfig();

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

solicitacaoGarra =
    false;

solicitacaoInspecionador =
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

configurarMQTT();

definirCallback(
    callback);

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
// PROCESSAR MQTT
// ===================================================

mqttClient.loop();

// ===================================================
// ATUALIZAR INTERTRAVAMENTO
// ===================================================
//
// Isso é importante:
// mesmo sem receber uma nova mensagem MQTT,
// o sistema verifica se os 2 segundos já passaram.
//
// ===================================================

atualizarIntertravamento();

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

        solicitacaoGarra =
            false;

        solicitacaoInspecionador =
            false;

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
