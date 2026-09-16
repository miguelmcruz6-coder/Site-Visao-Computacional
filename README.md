# ESP32 — Controle por Gestos via MQTT / HiveMQ Cloud

Projeto baseado em **ESP32 + PlatformIO + Arduino Framework**, utilizando **MQTT sobre TLS** para comunicação com o **HiveMQ Cloud**.

O ESP32 recebe comandos MQTT contendo o estado de cinco dedos e utiliza esses estados para controlar cinco saídas digitais.

O projeto também possui um tópico independente para **parada de emergência**.

---

## 1. Arquitetura

```text
                    ┌──────────────────────┐
                    │      HiveMQ Cloud     │
                    │                      │
                    │      MQTT / TLS      │
                    │       Port 8883      │
                    └──────────┬───────────┘
                               │
                               │ MQTT
                               │
                    ┌──────────▼───────────┐
                    │         ESP32         │
                    │                      │
                    │  WiFi + MQTT + TLS   │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
           Esteira           Garra          Seletor
              │                │                │
              ▼                ▼                ▼

          Inspecionador      Trava
```

---

# 2. Tecnologias

* ESP32
* PlatformIO
* Arduino Framework
* WiFi
* MQTT
* TLS
* HiveMQ Cloud
* Biblioteca PubSubClient

---

# 3. Estrutura do projeto

Estrutura esperada:

```text
projeto/
│
├── platformio.ini
│
├── src/
│   └── main.cpp
│
├── include/
│
├── lib/
│
└── test/
```

O programa principal fica em:

```text
src/main.cpp
```

A configuração do PlatformIO fica em:

```text
platformio.ini
```

---

# 4. Configuração do PlatformIO

Exemplo de `platformio.ini`:

```ini
[env:esp32dev]

platform = espressif32

board = esp32dev

framework = arduino

monitor_speed = 115200

lib_deps =
    knolleary/PubSubClient
```

> Caso o modelo do ESP32 seja diferente, altere `board` conforme a placa utilizada.

---

# 5. Biblioteca MQTT

O projeto utiliza:

```text
PubSubClient
```

No PlatformIO:

```ini
lib_deps =
    knolleary/PubSubClient
```

O PlatformIO instalará automaticamente a biblioteca durante a compilação.

---

# 6. Configuração WiFi

No `src/main.cpp`:

```cpp
const char* WIFI_SSID =
  "SEU_WIFI";

const char* WIFI_PASSWORD =
  "SUA_SENHA_WIFI";
```

Substitua pelos dados da rede WiFi.

Exemplo:

```cpp
const char* WIFI_SSID =
  "MinhaRede";

const char* WIFI_PASSWORD =
  "MinhaSenha";
```

---

# 7. Configuração HiveMQ Cloud

O projeto utiliza MQTT com TLS na porta:

```text
8883
```

Configure:

```cpp
const char* MQTT_SERVER =
  "SEU_CLUSTER.s1.eu.hivemq.cloud";

const int MQTT_PORT =
  8883;
```

O `MQTT_SERVER` deve conter somente o hostname.

## Correto

```text
abc123.s1.eu.hivemq.cloud
```

## Incorreto

```text
https://abc123.s1.eu.hivemq.cloud
```

```text
mqtt://abc123.s1.eu.hivemq.cloud
```

```text
wss://abc123.s1.eu.hivemq.cloud
```

---

# 8. Credenciais MQTT

Configure o usuário e senha criados no HiveMQ Cloud:

```cpp
const char* MQTT_USER =
  "SEU_USUARIO";

const char* MQTT_PASSWORD =
  "SUA_SENHA";
```

Essas credenciais são independentes das credenciais do WiFi.

---

# 9. TLS

Durante o diagnóstico inicial, o projeto utiliza:

```cpp
espClient.setInsecure();
```

Isso mantém a conexão utilizando TLS, porém desativa a validação do certificado do servidor.

### Importante

Essa configuração é adequada apenas para testes e diagnóstico.

Para uma instalação definitiva, recomenda-se utilizar o certificado CA do HiveMQ e validar o certificado do servidor.

---

# 10. Client ID

O ESP32 gera automaticamente um Client ID baseado no identificador do chip:

```cpp
MQTT_CLIENT_ID =
  "ESP32_MAQUINA_01_" +
  String(
    (uint32_t)
    ESP.getEfuseMac()
  );
```

Exemplo:

```text
ESP32_MAQUINA_01_123456789
```

O objetivo é evitar conflitos entre clientes MQTT.

---

# 11. Tópicos MQTT

O projeto utiliza dois tópicos.

## 11.1 Controle dos dedos

```text
automacao/maquina/dedos
```

Constante:

```cpp
const char* MQTT_TOPIC =
  "automacao/maquina/dedos";
```

Esse tópico recebe uma mensagem de cinco caracteres.

Exemplo:

```text
10101
```

Cada posição representa um dedo.

---

# 12. Formato da mensagem

A mensagem deve possuir exatamente cinco caracteres:

```text
ABCDE
```

onde cada posição deve ser `0` ou `1`.

Mapeamento:

```text
Posição 0 → Polegar
Posição 1 → Indicador
Posição 2 → Médio
Posição 3 → Anelar
Posição 4 → Mínimo
```

Exemplo:

```text
10101
```

Significa:

```text
Polegar   = ON
Indicador = OFF
Médio     = ON
Anelar    = OFF
Mínimo    = ON
```

---

# 13. Saídas digitais

Mapeamento atual:

| Função        | GPIO |
| ------------- | ---: |
| Inspecionador |   18 |
| Garra         |   19 |
| Seletor       |   21 |
| Esteira       |   22 |
| Trava         |   23 |

Configuração no código:

```cpp
const int Inspecionador = 18;
const int Garra = 19;
const int Seletor = 21;
const int Esteira = 22;
const int Trava = 23;
```

---

# 14. Relação entre dedos e saídas

A mensagem MQTT controla as saídas da seguinte maneira:

| Posição | Dedo      | Saída         |
| ------: | --------- | ------------- |
|       0 | Polegar   | Esteira       |
|       1 | Indicador | Garra         |
|       2 | Médio     | Seletor       |
|       3 | Anelar    | Inspecionador |
|       4 | Mínimo    | Trava         |

Portanto:

```text
Mensagem:
10101
```

resulta em:

```text
Esteira       → HIGH
Garra         → LOW
Seletor       → HIGH
Inspecionador → LOW
Trava         → HIGH
```

---

# 15. Parada de emergência

O segundo tópico utilizado é:

```text
automacao/maquina/emergencia
```

Constante:

```cpp
const char* MQTT_STOP_TOPIC =
  "automacao/maquina/emergencia";
```

---

## 15.1 Ativar emergência

Publicar:

```text
STOP
```

ou:

```text
EMERGENCY
```

no tópico:

```text
automacao/maquina/emergencia
```

O ESP32:

1. Ativa o estado de emergência.
2. Desliga todas as saídas.
3. Ignora comandos de dedos.
4. Mantém as saídas desligadas.

---

## 15.2 Resetar emergência

Publicar:

```text
RESET
```

no tópico:

```text
automacao/maquina/emergencia
```

O ESP32:

1. Desativa o estado de emergência.
2. Mantém todas as saídas inicialmente desligadas.
3. Volta a aceitar comandos no tópico dos dedos.

---

# 16. Estado seguro

A função:

```cpp
void desligarTodos()
```

coloca todas as saídas em:

```text
LOW
```

Ou seja:

```cpp
digitalWrite(Inspecionador, LOW);
digitalWrite(Garra, LOW);
digitalWrite(Seletor, LOW);
digitalWrite(Esteira, LOW);
digitalWrite(Trava, LOW);
```

Essa função é utilizada quando:

* o ESP32 inicia;
* ocorre perda de WiFi;
* ocorre perda de MQTT;
* ocorre timeout;
* a emergência é ativada;
* uma mensagem inválida é recebida.

---

# 17. Validação das mensagens

O ESP32 aceita somente mensagens com:

```text
5 caracteres
```

e cada caractere deve ser:

```text
0
```

ou:

```text
1
```

Exemplos válidos:

```text
00000
00001
10101
11111
```

Exemplos inválidos:

```text
101
```

```text
101010
```

```text
10A01
```

```text
ABCDE
```

Quando uma mensagem inválida é recebida, todas as saídas são desligadas.

---

# 18. Watchdog / Timeout MQTT

O projeto possui um timeout configurado atualmente como:

```cpp
const unsigned long TIMEOUT_MQTT =
  1000;
```

O valor está em milissegundos.

Portanto:

```text
1000 ms = 1 segundo
```

Se o ESP32 ficar mais de um segundo sem receber uma mensagem válida de controle, ele executa:

```cpp
desligarTodos();
```

e informa no Monitor Serial:

```text
TIMEOUT MQTT - OUTPUTS OFF
```

## Observação importante

Esse timeout é bastante curto para uma aplicação real.

Durante testes de comunicação, pode ser conveniente aumentar o valor, por exemplo:

```cpp
const unsigned long TIMEOUT_MQTT =
  5000;
```

ou:

```cpp
const unsigned long TIMEOUT_MQTT =
  10000;
```

A escolha definitiva deve considerar os requisitos de segurança da máquina.

---

# 19. Inicialização

Ao ligar o ESP32, o programa executa:

```text
1. Inicialização da porta serial
2. Geração do Client ID
3. Configuração dos GPIOs
4. Desligamento de todas as saídas
5. Conexão WiFi
6. Configuração TLS
7. Configuração MQTT
8. Conexão ao HiveMQ
9. Subscribe no tópico dos dedos
10. Subscribe no tópico de emergência
11. Início do loop principal
```

---

# 20. Monitor Serial

O projeto utiliza:

```cpp
Serial.begin(115200);
```

Portanto, o Monitor Serial do PlatformIO deve utilizar:

```text
115200 baud
```

No `platformio.ini`:

```ini
monitor_speed = 115200
```

---

# 21. Inicialização esperada

Quando tudo estiver funcionando, o Monitor Serial deverá mostrar aproximadamente:

```text
================================
 ESP32 CONTROLE POR GESTOS
 HiveMQ Cloud
================================

Conectando ao WiFi...
.....
WiFi conectado!
IP: 192.168.1.100

Conectando ao HiveMQ Cloud...
Servidor: abc123.s1.eu.hivemq.cloud
Porta: 8883
Usuario: meu_usuario
Client ID: ESP32_MAQUINA_01_123456789

********************************
     HIVEMQ CONECTADO!
********************************

Subscribe dedos: OK
Subscribe emergencia: OK

Aguardando mensagens...
```

---

# 22. Teste manual do MQTT

Depois de o ESP32 mostrar:

```text
HIVEMQ CONECTADO!
```

publique:

### Tópico

```text
automacao/maquina/dedos
```

### Payload

```text
10101
```

O ESP32 deverá mostrar:

```text
================================
MENSAGEM MQTT RECEBIDA!
Topic: automacao/maquina/dedos
Tamanho: 5
Payload: [10101]
Processando: 10101
----------------------------
Polegar: ON
Indicador: OFF
Medio: ON
Anelar: OFF
Minimo: ON
Outputs atualizados.
----------------------------
================================
```

---

# 23. Teste de emergência

Publique:

### Tópico

```text
automacao/maquina/emergencia
```

### Payload

```text
STOP
```

O ESP32 deverá informar:

```text
MENSAGEM MQTT RECEBIDA!
TOPICO DE EMERGENCIA
!!! EMERGENCIA ATIVADA !!!
```

Todas as saídas deverão ser desligadas.

Depois publique:

```text
RESET
```

no mesmo tópico.

O ESP32 deverá informar:

```text
Emergencia resetada.
```

---

# 24. Diagnóstico MQTT

A função:

```cpp
mqttClient.state()
```

retorna códigos de erro do PubSubClient.

Um dos erros observados durante os testes é:

```text
Estado PubSubClient: -1
```

`-1` corresponde a:

```text
MQTT_CONNECTION_TIMEOUT
```

Ou seja, o cliente tentou estabelecer a conexão MQTT, mas não recebeu a resposta esperada dentro do tempo disponível.

Quando isso ocorrer, verificar:

1. WiFi conectado.
2. Hostname do HiveMQ correto.
3. Porta `8883`.
4. Usuário MQTT correto.
5. Senha MQTT correta.
6. TLS configurado.
7. Internet disponível.
8. Cluster HiveMQ ativo.
9. Client ID.
10. Diferenças entre o programa de teste que funciona e o programa principal.

---

# 25. Diferença entre conexão MQTT e recebimento de mensagens

É importante separar os dois problemas.

### Conexão MQTT

Primeiro deve aparecer:

```text
HIVEMQ CONECTADO!
```

### Subscribe

Depois:

```text
Subscribe dedos: OK
Subscribe emergencia: OK
```

### Recebimento

Somente depois de uma publicação no HiveMQ deverá aparecer:

```text
MENSAGEM MQTT RECEBIDA!
```

Portanto:

```text
WiFi
  ↓
MQTT CONNECT
  ↓
SUBSCRIBE
  ↓
MQTT MESSAGE
  ↓
CALLBACK
  ↓
PROCESSAR DEDOS
  ↓
GPIO
```

---

# 26. Programa mínimo de diagnóstico

Antes de testar toda a máquina, recomenda-se testar a comunicação utilizando um programa MQTT mínimo.

O objetivo é confirmar:

```text
ESP32
  ↓
WiFi
  ↓
TLS
  ↓
HiveMQ
  ↓
MQTT
  ↓
Publish
```

Somente depois de confirmar a comunicação deve-se adicionar:

* GPIOs;
* controle dos dedos;
* emergência;
* watchdog;
* lógica da máquina.

Isso facilita identificar a origem de problemas.

---

# 27. Segurança

Este projeto controla saídas físicas que podem estar conectadas a uma máquina.

Por isso:

* Nunca considere uma mensagem MQTT como único mecanismo de segurança.
* A parada de emergência deve possuir mecanismo físico independente quando exigido pela aplicação.
* Os estados das saídas devem ser definidos de forma segura para a máquina.
* O uso de `setInsecure()` deve ser restrito a testes.
* Credenciais MQTT não devem ser publicadas em repositórios públicos.
* O comportamento em perda de WiFi deve ser testado.
* O comportamento em perda de MQTT deve ser testado.
* O comportamento após reinicialização do ESP32 deve ser testado.

---

# 28. Checklist de instalação

Antes do primeiro teste:

```text
[ ] ESP32 conectado ao computador
[ ] Placa correta configurada no PlatformIO
[ ] WiFi configurado
[ ] HiveMQ Cluster criado
[ ] MQTT Server correto
[ ] Porta 8883
[ ] Usuário MQTT criado
[ ] Senha MQTT configurada
[ ] PubSubClient instalada
[ ] platfor
```
