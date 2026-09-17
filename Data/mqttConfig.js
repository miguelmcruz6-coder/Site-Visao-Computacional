// =====================================================
// CONFIGURAÇÃO HIVEMQ CLOUD
// =====================================================
//
// Pegue esses dados no:
//
// HiveMQ Cloud
// → seu Cluster
// → Overview
// → Connection Details
//
// =====================================================

const MQTT_HOST = "9927a23299b84ac78820c07e11c8d448.s1.eu.hivemq.cloud";

const MQTT_PORT = 8884;

const MQTT_PATH = "/mqtt";

// -----------------------------------------------------
// CREDENCIAIS
// -----------------------------------------------------
//
// Crie uma credencial específica para o WEB no HiveMQ.
//
// NÃO coloque uma credencial administrativa aqui.
// NÃO use a mesma credencial do ESP32 se o GitHub
// for público.
// -----------------------------------------------------

const MQTT_USERNAME = "hivemq.webclient.1789562292116";

const MQTT_PASSWORD = "jpFACDmz$jXzrHghKwz6ftrHACRxOow%";

// =====================================================
// TÓPICOS
// =====================================================

const MQTT_TOPIC = "automacao/maquina/dedos";

const MQTT_STOP_TOPIC = "automacao/maquina/emergencia";

export{MQTT_HOST, MQTT_PORT, MQTT_PATH, MQTT_USERNAME, MQTT_PASSWORD, MQTT_TOPIC, MQTT_STOP_TOPIC}