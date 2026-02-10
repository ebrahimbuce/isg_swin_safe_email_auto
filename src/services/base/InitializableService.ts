import { Logger } from '../Logger.js';

/**
 * Resultado de la inicialización de un servicio
 */
export interface InitializationResult {
  success: boolean;
  message?: string;
  details?: Record<string, any>;
}

/**
 * Opciones para el comportamiento de inicialización
 */
export interface InitializationOptions {
  /** Si es true, lanza excepción en caso de error. Si es false, solo loguea el error */
  throwOnError?: boolean;
  /** Si es true, loguea información detallada durante la inicialización */
  verbose?: boolean;
  /** Tiempo máximo de espera para la inicialización (ms) */
  timeout?: number;
}

/**
 * Clase base abstracta para servicios que requieren inicialización
 * Implementa el patrón Lazy Initialization con manejo robusto de errores
 *
 * @example
 * ```typescript
 * class MyService extends InitializableService {
 *   protected async doInitialize(): Promise<InitializationResult> {
 *     // Lógica de inicialización
 *     return { success: true, message: 'Servicio inicializado' };
 *   }
 *
 *   protected getServiceName(): string {
 *     return 'MyService';
 *   }
 * }
 * ```
 */
export abstract class InitializableService {
  private _initialized: boolean = false;
  private _initializing: boolean = false;
  private _initializationPromise: Promise<void> | null = null;
  protected logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Nombre del servicio para logging
   * Debe ser implementado por las clases hijas
   */
  protected abstract getServiceName(): string;

  /**
   * Lógica de inicialización específica del servicio
   * Debe ser implementada por las clases hijas
   */
  protected abstract doInitialize(): Promise<InitializationResult>;

  /**
   * Inicializa el servicio si no está inicializado
   * Maneja la concurrencia para evitar inicializaciones múltiples
   */
  async initialize(options: InitializationOptions = {}): Promise<void> {
    // Si ya está inicializado, retornar inmediatamente
    if (this._initialized) {
      return;
    }

    // Si ya está en proceso de inicialización, esperar a que termine
    if (this._initializing && this._initializationPromise) {
      return this._initializationPromise;
    }

    // Configuración por defecto
    const config: Required<InitializationOptions> = {
      throwOnError: true,
      verbose: true,
      timeout: 30000, // 30 segundos
      ...options,
    };

    // Marcar como en proceso de inicialización
    this._initializing = true;

    // Crear la promesa de inicialización
    this._initializationPromise = this.performInitialization(config);

    return this._initializationPromise;
  }

  /**
   * Ejecuta la inicialización con timeout y manejo de errores
   */
  private async performInitialization(config: Required<InitializationOptions>): Promise<void> {
    const serviceName = this.getServiceName();

    try {
      if (config.verbose) {
        this.logger.info(`Inicializando ${serviceName}...`);
      }

      // Ejecutar inicialización con timeout
      const result = await this.executeWithTimeout(
        () => this.doInitialize(),
        config.timeout,
        `Timeout al inicializar ${serviceName}`
      );

      if (result.success) {
        this._initialized = true;

        if (config.verbose) {
          this.logger.info(
            `✅ ${serviceName} inicializado correctamente${result.message ? ': ' + result.message : ''}`
          );

          // Loguear detalles si existen
          if (result.details) {
            Object.entries(result.details).forEach(([key, value]) => {
              this.logger.info(`   ${key}: ${value}`);
            });
          }
        }
      } else {
        throw new Error(result.message || `Fallo al inicializar ${serviceName}`);
      }
    } catch (error) {
      this._initialized = false;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error(`❌ Error al inicializar ${serviceName}: ${errorMessage}`);

      if (config.throwOnError) {
        throw error;
      }
    } finally {
      this._initializing = false;
      this._initializationPromise = null;
    }
  }

  /**
   * Ejecuta una función con un timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)),
    ]);
  }

  /**
   * Verifica si el servicio está inicializado
   */
  get isInitialized(): boolean {
    return this._initialized;
  }

  /**
   * Verifica si el servicio está en proceso de inicialización
   */
  get isInitializing(): boolean {
    return this._initializing;
  }

  /**
   * Asegura que el servicio esté inicializado antes de usarlo
   * Útil para llamar en métodos públicos
   */
  protected async ensureInitialized(): Promise<void> {
    if (!this._initialized) {
      await this.initialize();
    }
  }

  /**
   * Reinicia el servicio (útil para pruebas o reconexiones)
   */
  async reinitialize(options?: InitializationOptions): Promise<void> {
    this._initialized = false;
    this._initializing = false;
    this._initializationPromise = null;
    await this.initialize(options);
  }

  /**
   * Método de limpieza que puede ser implementado por las clases hijas
   */
  protected async doCleanup(): Promise<void> {
    // Override en clases hijas si es necesario
  }

  /**
   * Limpia los recursos del servicio
   */
  async cleanup(): Promise<void> {
    if (this._initialized) {
      try {
        await this.doCleanup();
        this._initialized = false;
        this.logger.info(`${this.getServiceName()} limpiado`);
      } catch (error) {
        this.logger.error(`Error al limpiar ${this.getServiceName()}:`, error);
      }
    }
  }
}
