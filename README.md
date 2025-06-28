# EDACraft

## Integrantes del grupo y contribución al trabajo de cada integrante

* Luciano Cordero:
Implementó la lógica de los comandos básicos en `actions.js` tomando como referencia la implementación para la API de C++ proporcionada por el profesor, adaptando las funciones de movimiento, interacción con bloques y manejo de inventario para el entorno JavaScript. Refactorizó completamente la lógica en `bot.js` para que no espere un código en C++, sino que todo se trabaje directamente en JavaScript, eliminando la dependencia de IPC y simplificando la arquitectura del sistema. Implementó la lógica inicial de la máquina de estados en `behaviors.js`, estableciendo el estado de movimiento como base y definiendo la estructura fundamental del sistema de navegación autónoma. Colaboró en el testing del algoritmo A* en `pathfinder.js` para verificar la correcta implementación de la navegación.

* Ian Dib:
Optimizó y refinó `actions.js` para reducir la complejidad de los comandos utilizando directamente las funciones de la librería Mineflayer como base, mejorando la eficiencia y confiabilidad de las operaciones básicas. Amplió significativamente la lógica de estados en `behaviors.js` para soportar navegación con múltiples objetivos secuenciales, implementando estados adicionales como idle, manejo de cofres, y minería, además de funcionalidades de control como `stop()` para detener la ejecución. Desarrolló completamente el algoritmo A* en `pathfinder.js`, implementando la búsqueda de caminos en un entorno 3D mediante una representación de grilla 2D optimizada.

## Parte 1: Sistema de Navegación

El sistema de navegación constituye el núcleo del bot automatizado, implementando una máquina de estados finitos (FSM) que coordina el movimiento inteligente a través del mundo de Minecraft. El diseño utiliza el algoritmo A* para pathfinding combinado con un sistema de control de estados que gestiona las diferentes fases de navegación.

La clase `AutonomousBot` en `behaviors.js` implementa una FSM que coordina todas las actividades del bot mediante estados claramente definidos. El estado principal `MOVING_TO_GOAL` maneja la navegación entre puntos de interés utilizando una secuencia predefinida de objetivos en `GOAL_SEQUENCE`. La función `executeStateMachine()` procesa continuamente las transiciones de estado, mientras que `handleMovingToGoal()` gestiona el progreso hacia cada objetivo y determina cuándo cambiar a estados especializados como `MINING` o `SEARCHING_CHEST`.

El sistema utiliza `movementLoop()` para mantener la ejecución continua del bot, procesando movimientos cada `MOVEMENT_INTERVAL` milisegundos. La función `executeMovement()` traduce las instrucciones del pathfinder en acciones concretas, diferenciando entre movimientos simples (`move`) y movimientos complejos que requieren salto (`jump_and_move`).

El algoritmo A* está implementado en `pathfinder.js` utilizando una aproximación de grilla 2D que contempla el mundo 3D mediante condiciones especiales para saltos y caídas. Esta decisión de diseño se tomó porque idear una grilla tridimensional completa en JavaScript no era sencillo ni eficiente para las necesidades del proyecto.

[ESPACIO PARA COMPLETAR: Clases y métodos específicos de pathfinder.js - nombres de las funciones principales, estructura de datos utilizada, implementación de la heurística, etc.]

La integración entre el pathfinder y la máquina de estados se realiza través de la clase `SimplePathfinder`, que proporciona métodos como `setGoal()` para establecer destinos, `getNextMovement()` para obtener la siguiente acción requerida, e `isAtGoal()` para verificar si se ha alcanzado el objetivo actual. El método `completeStep()` actualiza el estado interno del pathfinder después de cada movimiento exitoso.

La clase `BotActions` en `actions.js` proporciona las primitivas de movimiento básicas que utiliza la máquina de estados. La función `step()` implementa movimiento direccional utilizando `DIRECTION_MAPPINGS` para convertir direcciones cardinales en desplazamientos vectoriales y rotaciones de orientación. El sistema utiliza `lookAt()` para orientar correctamente el bot antes del movimiento y `setControlState()` para controlar la duración precisa de cada paso.

La función `jump()` maneja los saltos con control temporal mediante `JUMP_DURATION`, permitiendo al bot superar obstáculos de hasta un bloque de altura. El método `position()` proporciona coordenadas enteras precisas para la navegación, utilizando `Math.floor()` para asegurar consistencia con el sistema de grilla discreto del mundo.

## Parte 2: Interacción con el Mundo

El sistema de interacción permite al bot realizar tareas complejas como minería y manejo de inventario, implementando las funcionalidades requeridas para completar los objetivos del proyecto.

La función `find_block()` en `actions.js` implementa búsqueda eficiente de bloques específicos utilizando `bot.findBlock()` con parámetros configurables de distancia máxima (`DEFAULT_SEARCH_DISTANCE`). Esta función devuelve información completa del bloque incluyendo posición y tipo, o `null` si no se encuentra el objetivo.

El método `block_at()` proporciona información detallada de bloques en coordenadas específicas, incluyendo propiedades como `boundingBox` para cálculos de colisión y `type` para identificación precisa. Esta funcionalidad es esencial para la validación de movimientos y la planificación de acciones.

El sistema de manejo de cofres está implementado mediante tres funciones coordinadas en `actions.js`. La función `openChestAt()` establece conexión con cofres utilizando `bot.openChest()` y almacena la referencia en `this.chestWindow` para operaciones posteriores. La validación previa mediante `bot.blockAt()` asegura que el bloque objetivo existe antes de intentar la apertura.

`getChestContents()` extrae información completa del inventario del cofre, utilizando `containerItems()` para obtener arrays de objetos con propiedades `slot`, `name`, y `count`. La función `closeChest()` finaliza la sesión correctamente, liberando recursos y estableciendo `this.chestWindow = null` para evitar referencias inválidas.

En `behaviors.js`, el estado `SEARCHING_CHEST` coordina la búsqueda de cofres mediante `find_block()`, mientras que `MANAGE_CHEST` ejecuta la secuencia completa de apertura, análisis de contenido, recolección de información, y cierre. El sistema almacena los items encontrados en `this.collectedItems` y utiliza `chat()` para reportar los resultados.

La implementación de minería combina detección de bloques válidos con operaciones de excavación seguras. La función `dig_block()` en `actions.js` utiliza `bot.canDigBlock()` para validar que el bloque puede ser excavado antes de ejecutar `bot.dig()`, evitando errores con bloques protegidos o indestructibles.

El estado `MINING` en `behaviors.js` implementa lógica inteligente para seleccionar bloques objetivo. Utiliza `position()` para obtener la ubicación actual del bot y `block_at()` para analizar bloques adyacentes, filtrando automáticamente bloques no válidos como `air` y `bedrock`. Después de cada operación de minería exitosa, el sistema actualiza automáticamente el objetivo de navegación y retorna al estado `MOVING_TO_GOAL`.

La función `chat()` proporciona capacidades de comunicación bidireccional, permitiendo al bot reportar su estado y resultados de operaciones. Esta funcionalidad es especialmente importante para cumplir con los requerimientos de reportar items recolectados del cofre.

El sistema de error handling implementado en todas las funciones de interacción utiliza bloques `try-catch` para capturar excepciones específicas y proporcionar mensajes informativos. Las funciones lanzan `Error` objects con descripciones detalladas para facilitar debugging y monitoreo del comportamiento del bot.