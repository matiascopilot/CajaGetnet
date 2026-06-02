import { SerialPort } from 'serialport';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';

/**
 * Returns "DD-MM-YYYY HH:MM:SS" in local time.
 * This is the exact date-time format the PAX terminal expects.
 * 
 * @param {Date} date - Date object to format
 * @returns {string} - Formatted date string
 */
export function formatPOSDate(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${p(date.getDate())}-${p(date.getMonth() + 1)}-${date.getFullYear()} ` +
    `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`
  );
}

/**
 * Signs message payload using SHA-256 and returns a JSON payload
 * containing the serialized data and the uppercase Hex signature,
 * matching the Getnet POS communication protocol.
 * 
 * @param {Object} data - The payload to sign
 * @returns {string} - The signed JSON string
 */
export function signMessage(data) {
  const jsonSerialized = JSON.stringify(data);
  const sign = crypto
    .createHash('sha256')
    .update(jsonSerialized)
    .digest('hex')
    .toUpperCase();
  return JSON.stringify({
    JsonSerialized: jsonSerialized,
    Sign: sign
  });
}

/**
 * Logger factory for customizable level verbosity.
 * 
 * @param {string} level - 'debug' | 'info' | 'warn' | 'error' | 'none'
 */
export function createLogger(level = 'info') {
  const levels = { debug: 0, info: 1, warn: 2, error: 3, none: 4 };
  const current = levels[level] !== undefined ? levels[level] : 1;
  return {
    debug: (...args) => { if (current <= 0) console.log('[DEBUG]', ...args); },
    info: (...args) => { if (current <= 1) console.info('[INFO]', ...args); },
    warn: (...args) => { if (current <= 2) console.warn('[WARN]', ...args); },
    error: (...args) => { if (current <= 3) console.error('[ERROR]', ...args); }
  };
}

/**
 * Evaluates whether a serial port matches the profile of a PAX terminal.
 * 
 * Blacklists ADB, Diagnostics, Modem, and generic Android USB interfaces.
 * Matches official PAX VID (0x2FB8 / 12216).
 * 
 * @param {Object} port - Serial port info object from SerialPort.list()
 * @returns {Object} - { candidate: boolean, priority: number, reason: string }
 */
export function isPaxCandidate(port) {
  const vid = (port.vendorId || '').toLowerCase();
  const pid = (port.productId || '').toLowerCase();
  const manufacturer = (port.manufacturer || '').toLowerCase();
  const friendlyName = (port.friendlyName || '').toLowerCase();
  const pnpId = (port.pnpId || '').toLowerCase();

  // Diagnostics, ADB, Modems, or generic systems should be discarded.
  const blacklistKeywords = [
    'diag',
    'diagnostic',
    'modem',
    'adb',
    'daemon',
    'debug',
    'google',
    'android',
    'link'
  ];

  const matchesBlacklist = blacklistKeywords.some(keyword => 
    manufacturer.includes(keyword) || 
    friendlyName.includes(keyword) || 
    pnpId.includes(keyword)
  );

  if (matchesBlacklist) {
    return { candidate: false, priority: -1, reason: 'Matches blacklist keyword' };
  }

  // Official PAX Vendor ID (Hex: 2FB8, Dec: 12216)
  const isPaxVid = (vid === '2fb8' || vid === '12216');
  
  if (isPaxVid) {
    return { candidate: true, priority: 2, reason: 'PAX Vendor ID matched' };
  }

  // Case-insensitive name match
  if (friendlyName.includes('pax') || manufacturer.includes('pax')) {
    return { candidate: true, priority: 1, reason: 'PAX text matched in name/manufacturer' };
  }

  // Generic serial port
  return { candidate: true, priority: 0, reason: 'Generic serial port' };
}

/**
 * Probes a specific COM port by opening it, writing a signed Poll frame,
 * and waiting for a valid JSON response within the timeout.
 * 
 * @param {string} path - The COM port path (e.g. 'COM5')
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {Object} logger - Custom logger
 * @returns {Promise<Object>} - Probe result
 */
export async function probePort(path, timeoutMs = 2000, logger = createLogger('info')) {
  return new Promise((resolve) => {
    logger.info(`[Prober] Intentando abrir puerto: ${path}`);
    const port = new SerialPort({
      path,
      baudRate: 115200,
      autoOpen: false
    });

    let timeoutTimer = null;
    let resolved = false;
    const startTime = Date.now();

    function cleanUp() {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      return new Promise((resolveClose) => {
        if (port.isOpen) {
          port.close((err) => {
            if (err) logger.error(`[Prober] Error al cerrar ${path}: ${err.message}`);
            // Wait 200ms to allow OS to release the handle
            setTimeout(resolveClose, 200);
          });
        } else {
          resolveClose();
        }
      });
    }

    async function handleResolve(result) {
      if (resolved) return;
      resolved = true;
      await cleanUp();
      resolve(result);
    }

    port.open((err) => {
      if (err) {
        logger.warn(`[Prober] No se pudo abrir ${path}: ${err.message}`);
        return resolve({ success: false, path, error: err.message });
      }

      logger.info(`[Prober] Puerto ${path} abierto. Enviando trama de prueba (Poll)...`);

      let buffer = '';
      
      port.on('data', (chunk) => {
        const str = chunk.toString('utf8');
        buffer += str;
        logger.debug(`[Prober] ${path} <- Recibido: ${str}`);

        // Try extracting JSON using bracket matching
        let openBrackets = 0;
        let startIdx = -1;
        for (let i = 0; i < buffer.length; i++) {
          if (buffer[i] === '{') {
            if (openBrackets === 0) startIdx = i;
            openBrackets++;
          } else if (buffer[i] === '}') {
            openBrackets--;
            if (openBrackets === 0 && startIdx !== -1) {
              const potentialJson = buffer.substring(startIdx, i + 1);
              try {
                const parsed = JSON.parse(potentialJson);
                logger.debug(`[Prober] ${path} -> JSON parsed:`, parsed);
                
                // Validate if it is an ACK {"Received": true} or a Poll response
                const isAck = parsed.Received === true;
                const isPollResponse = parsed.JsonSerialized && parsed.JsonSerialized.includes('"Command":106');
                const isAlternativePoll = parsed.Command === 106;

                if (isAck || isPollResponse || isAlternativePoll) {
                  const elapsed = Date.now() - startTime;
                  logger.info(`[Prober] ¡Puerto correcto detectado en ${path}! Respuesta recibida en ${elapsed}ms.`);
                  return handleResolve({ success: true, path, responseTimeMs: elapsed, response: parsed });
                }
              } catch (e) {
                // Keep buffering if JSON is invalid or incomplete
              }
            }
          }
        }
      });

      port.on('error', (err) => {
        logger.error(`[Prober] Error en puerto ${path}: ${err.message}`);
        handleResolve({ success: false, path, error: err.message });
      });

      // Write signed Poll (Command 106)
      const pollFrame = signMessage({
        Command: 106,
        DateTime: formatPOSDate(new Date())
      });

      logger.debug(`[Prober] ${path} -> Escribiendo: ${pollFrame}`);
      port.write(pollFrame, (err) => {
        if (err) {
          logger.error(`[Prober] Error al escribir en ${path}: ${err.message}`);
          handleResolve({ success: false, path, error: err.message });
        }
      });
    });

    timeoutTimer = setTimeout(() => {
      logger.warn(`[Prober] Timeout alcanzado para ${path} después de ${timeoutMs}ms.`);
      handleResolve({ success: false, path, error: 'Timeout' });
    }, timeoutMs);
  });
}

/**
 * Scans, filters, and probes all candidate COM ports to automatically select the active PAX port.
 * 
 * @param {Object} options - Scan configuration options
 * @returns {Promise<Object|null>} - Info about the selected port or null
 */
export async function detectPaxPort(options = {}) {
  const {
    timeoutMs = 2000,
    onlyPax = true,
    logger = createLogger('info')
  } = options;

  logger.info('[Detector] Iniciando detección automática de puertos COM para PAX A920Pro...');

  let ports;
  try {
    ports = await SerialPort.list();
  } catch (err) {
    logger.error(`[Detector] Error al listar puertos seriales: ${err.message}`);
    return null;
  }

  if (!ports || ports.length === 0) {
    logger.warn('[Detector] No se encontraron puertos seriales disponibles.');
    return null;
  }

  logger.info(`[Detector] Encontrados ${ports.length} puertos seriales en el sistema.`);
  
  const candidates = [];
  for (const port of ports) {
    const classification = isPaxCandidate(port);
    logger.debug(`[Detector] Analizando ${port.path}:`, {
      friendlyName: port.friendlyName,
      manufacturer: port.manufacturer,
      vendorId: port.vendorId,
      productId: port.productId,
      pnpId: port.pnpId,
      classification
    });

    if (classification.candidate) {
      if (onlyPax && classification.priority === 0) {
        logger.debug(`[Detector] Descartando ${port.path} (Puerto genérico, flag onlyPax = true).`);
        continue;
      }
      candidates.push({
        port,
        priority: classification.priority,
        reason: classification.reason
      });
    } else {
      logger.info(`[Detector] Excluyendo ${port.path} (${classification.reason}).`);
    }
  }

  // Sort: prioritize strong PAX match -> name match -> generic port
  candidates.sort((a, b) => b.priority - a.priority);

  if (candidates.length === 0) {
    logger.warn('[Detector] No hay candidatos válidos para probar.');
    return null;
  }

  logger.info(`[Detector] Candidatos a probar (ordenados por prioridad):`);
  candidates.forEach((c, index) => {
    logger.info(`  ${index + 1}. ${c.port.path} (Prioridad: ${c.priority}, Razón: ${c.reason}, Desc: ${c.port.friendlyName || c.port.manufacturer || 'N/A'})`);
  });

  // Probe candidates sequentially to avoid conflicts
  for (const candidate of candidates) {
    const result = await probePort(candidate.port.path, timeoutMs, logger);
    if (result.success) {
      logger.info(`[Detector] ¡Éxito! El puerto ${result.path} es el correcto.`);
      return {
        path: result.path,
        responseTimeMs: result.responseTimeMs,
        portInfo: candidate.port,
        response: result.response
      };
    }
  }

  logger.warn('[Detector] No se pudo encontrar ningún puerto COM que respondiera a la trama de prueba.');
  return null;
}

/**
 * Reusable Connection Manager wrapping the auto-detection and reconnection flow.
 */
export class PaxConnectionManager {
  constructor(options = {}) {
    this.options = {
      baudRate: 115200,
      probeTimeoutMs: 2000,
      autoReconnect: true,
      reconnectIntervalMs: 5000,
      onlyPax: true,
      logger: createLogger('info'),
      ...options
    };
    this.portPath = null;
    this.port = null;
    this.isConnected = false;
    this.logger = this.options.logger;
    this.buffer = '';
    this.reconnectTimer = null;
    this.onDataCallbacks = new Set();
    this.onCloseCallbacks = new Set();
    this.onErrorCallbacks = new Set();
  }

  /**
   * Connect to a COM port. If no path is provided, performs auto-detection.
   */
  async connect(path = null) {
    if (this.isConnected) {
      this.logger.warn('[Manager] Ya conectado o en proceso de conexión.');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (!path) {
      this.logger.info('[Manager] Iniciando detección automática del puerto...');
      const detected = await detectPaxPort({
        timeoutMs: this.options.probeTimeoutMs,
        onlyPax: this.options.onlyPax,
        logger: this.logger
      });

      if (!detected) {
        this.logger.error('[Manager] Auto-detección fallida. No se detectó terminal PAX.');
        this._scheduleReconnect();
        throw new Error('Auto-detección fallida.');
      }
      this.portPath = detected.path;
    } else {
      this.portPath = path;
    }

    this.logger.info(`[Manager] Conectando al puerto ${this.portPath}...`);
    this.port = new SerialPort({
      path: this.portPath,
      baudRate: this.options.baudRate,
      autoOpen: false
    });

    return new Promise((resolve, reject) => {
      this.port.open((err) => {
        if (err) {
          this.logger.error(`[Manager] Error al abrir el puerto ${this.portPath}: ${err.message}`);
          this.isConnected = false;
          this._scheduleReconnect();
          reject(err);
          return;
        }

        this.isConnected = true;
        this.logger.info(`[Manager] Conectado exitosamente a ${this.portPath}.`);
        this.buffer = '';

        this.port.on('data', (chunk) => {
          const str = chunk.toString('utf8');
          this.buffer += str;
          
          let openBrackets = 0;
          let startIdx = -1;
          for (let i = 0; i < this.buffer.length; i++) {
            if (this.buffer[i] === '{') {
              if (openBrackets === 0) startIdx = i;
              openBrackets++;
            } else if (this.buffer[i] === '}') {
              openBrackets--;
              if (openBrackets === 0 && startIdx !== -1) {
                const potentialJson = this.buffer.substring(startIdx, i + 1);
                try {
                  const parsed = JSON.parse(potentialJson);
                  this.logger.debug(`[Manager] <- Recibido JSON parseado:`, parsed);
                  
                  // Auto-acknowledge message reception from the terminal
                  if (parsed.Received === undefined) {
                    this.send({ Received: true }).catch((e) => {
                      this.logger.error('[Manager] Error al enviar Auto-ACK:', e.message);
                    });
                  }

                  // Notify listeners
                  for (const cb of this.onDataCallbacks) {
                    try { cb(parsed); } catch (e) { this.logger.error(e); }
                  }
                  
                  this.buffer = this.buffer.substring(i + 1);
                  startIdx = -1;
                  i = -1;
                } catch (e) {
                  // Keep buffering
                }
              }
            }
          }
        });

        this.port.on('error', (err) => {
          this.logger.error(`[Manager] Error en la conexión: ${err.message}`);
          for (const cb of this.onErrorCallbacks) {
            try { cb(err); } catch (e) { this.logger.error(e); }
          }
          this._handleDisconnect();
        });

        this.port.on('close', () => {
          this.logger.warn(`[Manager] Puerto serial ${this.portPath} fue cerrado.`);
          for (const cb of this.onCloseCallbacks) {
            try { cb(); } catch (e) { this.logger.error(e); }
          }
          this._handleDisconnect();
        });

        resolve();
      });
    });
  }

  /**
   * Writes raw/signed JSON data to the serial port.
   */
  async send(data) {
    if (!this.isConnected || !this.port) {
      throw new Error('No hay conexión activa con el puerto serial.');
    }

    let frame;
    if (data.JsonSerialized && data.Sign) {
      frame = JSON.stringify(data);
    } else {
      frame = signMessage(data);
    }

    return new Promise((resolve, reject) => {
      this.logger.debug(`[Manager] -> Enviando: ${frame}`);
      this.port.write(frame, (err) => {
        if (err) {
          this.logger.error(`[Manager] Error al escribir: ${err.message}`);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Helper that sends a command and waits for its corresponding response command ID.
   */
  async sendCommand(commandData, timeoutMs = 15000) {
    if (!commandData.DateTime) {
      commandData.DateTime = formatPOSDate(new Date());
    }

    return new Promise(async (resolve, reject) => {
      let timeoutTimer = null;
      let dataHandler = null;

      const clean = () => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (dataHandler) this.onDataCallbacks.delete(dataHandler);
      };

      dataHandler = (parsed) => {
        let inner = parsed;
        if (parsed.JsonSerialized) {
          try {
            inner = JSON.parse(parsed.JsonSerialized);
          } catch (_) {}
        }
        if (inner && (inner.Command === commandData.Command || inner.FunctionCode === commandData.Command)) {
          clean();
          resolve(parsed);
        }
      };

      this.onDataCallbacks.add(dataHandler);

      timeoutTimer = setTimeout(() => {
        clean();
        reject(new Error(`Timeout de ${timeoutMs}ms esperando respuesta del comando ${commandData.Command}`));
      }, timeoutMs);

      try {
        await this.send(commandData);
      } catch (err) {
        clean();
        reject(err);
      }
    });
  }

  /**
   * Closes the active serial connection manually.
   */
  async disconnect() {
    this.logger.info('[Manager] Cerrando conexión manualmente...');
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    return new Promise((resolve) => {
      if (this.port && this.port.isOpen) {
        this.port.close(() => {
          this.isConnected = false;
          this.port = null;
          resolve();
        });
      } else {
        this.isConnected = false;
        this.port = null;
        resolve();
      }
    });
  }

  onData(cb) { this.onDataCallbacks.add(cb); }
  onClose(cb) { this.onCloseCallbacks.add(cb); }
  onError(cb) { this.onErrorCallbacks.add(cb); }

  _handleDisconnect() {
    this.isConnected = false;
    this.port = null;
    this._scheduleReconnect();
  }

  _scheduleReconnect() {
    if (!this.options.autoReconnect) return;
    if (this.reconnectTimer) return;

    this.logger.info(`[Manager] Reconectando en ${this.options.reconnectIntervalMs}ms...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((err) => {
        this.logger.error('[Manager] Error en intento de reconexión:', err.message);
      });
    }, this.options.reconnectIntervalMs);
  }
}

// ==========================================
// CLI Direct Execution Block
// ==========================================
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  console.log('\n==================================================');
  console.log('=== PAX A920Pro COM Port Detector CLI Tool ===');
  console.log('==================================================\n');
  
  const logger = createLogger('debug');
  
  detectPaxPort({ timeoutMs: 2500, onlyPax: false, logger })
    .then(async (result) => {
      if (result) {
        console.log('\n==================================================');
        console.log(`¡PUERTO DETECTADO CON ÉXITO! -> ${result.path}`);
        console.log(`Tiempo de respuesta (RTT): ${result.responseTimeMs}ms`);
        console.log(`Manufacturer:   ${result.portInfo.manufacturer || 'N/A'}`);
        console.log(`Friendly Name:  ${result.portInfo.friendlyName || 'N/A'}`);
        console.log(`Vendor ID:      ${result.portInfo.vendorId || 'N/A'}`);
        console.log(`Product ID:     ${result.portInfo.productId || 'N/A'}`);
        console.log(`Serial Number:  ${result.portInfo.serialNumber || 'N/A'}`);
        console.log('==================================================\n');

        console.log('Probando PaxConnectionManager con reconexión automática...');
        const manager = new PaxConnectionManager({
          probeTimeoutMs: 2500,
          onlyPax: false,
          logger: createLogger('info')
        });

        manager.onData((data) => {
          console.log('[CLI Manager] <- Datos recibidos:', data);
        });

        await manager.connect(result.path);

        console.log('Enviando comando Poll (106) de verificación...');
        try {
          const response = await manager.sendCommand({ Command: 106 }, 8000);
          console.log('[CLI Manager] <- Respuesta de verificación OK:', response);
        } catch (err) {
          console.error('[CLI Manager] Error al verificar:', err.message);
        }

        console.log('Cerrando conexión en 3 segundos...');
        setTimeout(async () => {
          await manager.disconnect();
          console.log('Conexión cerrada.');
          process.exit(0);
        }, 3000);
      } else {
        console.log('\n[Resultado] No se detectó ningún terminal PAX activo en los puertos COM.');
        process.exit(0);
      }
    })
    .catch((err) => {
      console.error('Error fatal durante la ejecución:', err);
      process.exit(1);
    });
}
