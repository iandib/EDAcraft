# EDACraft

## Integrantes del grupo y contribución al trabajo de cada integrante

* Luciano Cordero:
Implementó los comandos `step`, `jump`, `position`, `find_block` y `block_at` en `actions.js` para el movimiento básico del bot y detección de bloques, tomando como referencia los comandos en la API de C++ proporcionada como código base para el trabajo práctico. Refactorizó completamente la lógica en `bot.js` para que no espere un código en C++, sino que todo se trabaje directamente en JavaScript, eliminando la dependencia de IPC y simplificando la arquitectura del sistema. Implementó la lógica inicial de la máquina de estados en `behaviors.js`, estableciendo los estados `MOVING_TO_GOAL`, `SEARCHING_CHEST`, `MANAGE_CHEST` y `MINING` con sus respectivos métodos.

* Ian Dib:
Amplió `actions.js` agregando los comandos `openChestAt`, `getChestContents`, `closeChest`, `chat` y `dig_block`, también tomando como referencia los comandos en la API del código base. Modificó el comando `step` para independizarse de la función `pathfinder.goto()` que generaba problemas al intentar que el bot cayera cierta altura. Amplió la lógica de estados en `behaviors.js` para soportar navegación con múltiples objetivos secuenciales y agregó los métodos `sleep()` y `stop()` para agregar delays y detener la ejecución del programa, respectivamente.
Implementó el algoritmo A* en `pathfinder.js`, definiendo objetivos con `setGoal()` en `behaviors.js`. Inicialmente probó un escaneo frontal básico; luego amplió a un análisis 3×3×3 con `performEnvironmentScan()`, `buildPathfindingGrid()` y `updatePathfindingGrid()` para mapear bloqueos. Calculó la ruta óptima con `calculateAStarPath()` (heurística `manhattanDistance()`) y `reconstructPath()`, y gestionó el avance con `getNextMovement()`, `checkImmediateObstacle()`, `isAtGoal()` e `isBotStuck()`.

## Parte 0: Configuración Inicial

La clase `MinecraftBot` en `bot.js` actúa como controlador principal del sistema, gestionando la conexión al servidor usando `BOT_CONFIG` que especifica localhost:25565, usuario 'JSBot', y versión '1.21.4' y un visor 3D usando `prismarine-viewer` en el puerto 3007. El método `start()` establece la conexión y retorna una Promise que resuelve cuando el bot hace spawn exitosamente, con un timeout de 30 segundos para prevenir conexiones colgadas.

El manejo de eventos está implementado en `setupEvents()` que configura listeners para `login`, `spawn`, y `end`, con el método `onSpawn()` inicializando `BotActions` y `NavigationStateMachine` solo cuando `isReady` es false para prevenir inicialización duplicada. El sistema incluye `setupViewer()` que configura la interfaz web de monitoreo con verificación `viewerStarted` para evitar múltiples instancias del visor. La función `main()` implementa manejo de desconexión con `SIGINT` que detiene la máquina de estados y termina la conexión del bot antes de salir del proceso.

## Parte 1: Sistema de Navegación

La clase `BotActions` en `actions.js` proporciona las funciones básicas de movimiento, incluyendo `step()` que utiliza `DIRECTION_MAPPINGS` para convertir direcciones cardinales en desplazamientos vectoriales y rotaciones de orientación, `jump()` que maneja saltos con control temporal de `JUMP_DURATION` milisegundos, y `position()` que devuelve coordenadas enteras usando `Math.floor()` para consistencia con el sistema de grilla discreto.

La clase `AutonomousBot` en `behaviors.js` implementa una FSM que coordina todas las actividades del bot mediante un bucle principal `movementLoop()` que ejecuta cada `MOVEMENT_INTERVAL` milisegundos. El estado principal `MOVING_TO_GOAL` maneja la navegación utilizando una secuencia predefinida de objetivos en `GOAL_SEQUENCE`, que incluye coordenadas específicas para `bridge_start`, `bridge_end`, `checkpoint`, `spawn`, y `chest_location`. La función `executeStateMachine()` procesa las transiciones de estado y `handleMovingToGoal()` gestiona el progreso hacia cada objetivo utilizando `pathfinder.isAtGoal()` para determinar cuándo avanzar al siguiente objetivo en la secuencia.

El método `executeMovement()` traduce las instrucciones del pathfinder en movimientos concretos, diferenciando entre movimientos simples (`move`) y movimientos con salto (`jump_and_move`). Cuando el bot alcanza un objetivo, automáticamente incrementa `currentGoalIndex` y establece el siguiente objetivo usando `pathfinder.setGoal()`, cambiando al estado `SEARCHING_CHEST` una vez completada toda la secuencia de navegación.

El algoritmo A* se implementó en `pathfinder.js` sobre una grilla 2D del plano X–Z que, aun siendo bidimensional, satisface la consigna de funcionar en un entorno cúbico 3D mediante condiciones especiales para saltos y caídas. En un paso posterior se intentó construir una grilla 3D que incorporara la coordenada Y, pero esa versión no llegó a funcionar correctamente, limitación que atribuimos a nuestra limitada experiencia en JavaScript.

La clase `SimplePathfinder` implementa el algoritmo A* utilizando la clase auxiliar `PathNode` para representar nodos en la grilla con costos gCost (distancia desde inicio), hCost (heurística al objetivo) y fCost (costo total). La estructura de datos principal es `grid` (Map) que almacena costos de travesía usando claves "x,z", complementado por `impassableCoords` (Set) para coordenadas bloqueadas y `environmentData` (Map) para información de bloques escaneados.

El método `performEnvironmentScan()` ejecuta análisis 3×3×3 alrededor del bot mediante `scanEnvironment()`, que examina bloques desde el nivel de los pies hasta 2 bloques arriba. La función `reactToEnvironment()` procesa los datos escaneados identificando posiciones impassables: coordenadas con bloques a la altura de la cabeza o combinaciones de bloques en pies y arriba que impiden el paso. La construcción de la grilla se realiza con `buildPathfindingGrid()` para el escaneo inicial y `updatePathfindingGrid()` para actualizaciones incrementales. Ambos métodos asignan costos basados en `BLOCK_COSTS` (agua y lava tienen costo infinito) y el estado de `impassableCoords`.

El núcleo del algoritmo A* en `calculateAStarPath()` utiliza dos conjuntos: `openSet` (array de nodos por evaluar) y `closedSet` (set de nodos evaluados). La heurística `manhattanDistance()` calcula la distancia Manhattan entre coordenadas, y `reconstructPath()` reconstruye la ruta óptima siguiendo los enlaces parent desde el nodo objetivo hasta el inicio. El método `getNextMovement()` traduce la ruta A* en acciones de movimiento, utilizando `checkImmediateObstacle()` para detectar situaciones que requieren salto o recálculo de ruta. El sistema de detección de bloqueo en `isBotStuck()` analiza el historial de posiciones recientes para identificar cuando el bot no progresa, activando movimientos de desbloqueo perpendiculares.

## Parte 2: Interacción con el Mundo

El sistema de detección de bloques está implementado mediante dos funciones principales en `actions.js`. La función `find_block(blockType, maxDistance)` localiza el bloque más cercano del tipo especificado utilizando `bot.findBlock()` con una función de coincidencia y distancia máxima que por defecto es de 16 bloques, devolviendo un objeto con coordenadas x, y, z y nombre del bloque encontrado. La función `block_at(x, y, z)` obtiene información completa de un bloque en coordenadas específicas, incluyendo nombre, tipo, posición y boundingBox, utilizando `bot.blockAt()` con un vector Vec3.

El sistema de manejo de cofres está implementado mediante tres funciones coordinadas en `actions.js`. La función `openChestAt(x, y, z)` establece conexión con cofres utilizando `bot.openChest()` y almacena la referencia en `this.chestWindow` para operaciones posteriores, incluyendo validación de que el bloque existe en las coordenadas especificadas. La función `getChestContents()` extrae el inventario completo del cofre usando `containerItems().map()` y devuelve un array con slot, nombre y cantidad de cada item, mientras que `closeChest()` finaliza la sesión del cofre y limpia la referencia `this.chestWindow`.

En `behaviors.js`, el estado `SEARCHING_CHEST` coordina la búsqueda de cofres mediante `find_block('chest', 16)` y transita al estado `MANAGE_CHEST` cuando encuentra un cofre. El estado `MANAGE_CHEST` ejecuta la secuencia completa de manejo de cofres, incluyendo `bot.lookAt()` para orientación hacia el cofre, apertura usando `openChestAt()`, análisis de contenido con almacenamiento en `this.collectedItems`, y cierre con `closeChest()`. El sistema utiliza `chat()` para reportar los resultados con formato "Items collected: {cantidad}x {nombre}" o "Chest was empty" cuando corresponde.

El sistema de minería está implementado mediante `dig_block(x, y, z)` en `actions.js`, que valida que el bloque puede ser excavado usando `bot.canDigBlock()` antes de ejecutar `bot.dig()`, con manejo de errores para bloques protegidos o inválidos. El estado `MINING` en `behaviors.js` implementa lógica inteligente que utiliza `position()` para obtener la ubicación actual del bot y `block_at()` para analizar bloques adyacentes, específicamente el bloque directamente debajo del bot (y-1). El sistema filtra bloques no minables como `air` y `bedrock`, y después de cada operación de minería exitosa, automáticamente detiene la ejecución del programa.

## Parte 3: Análisis de Implementación y Resultados

El algoritmo A* implementado cumple con las especificaciones requeridas al no utilizar funciones de pathfinding de bibliotecas externas y funcionar efectivamente en un entorno 3D cúbico mediante la combinación de una grilla 2D con condiciones especiales de salto. El sistema de asignación de costos utiliza una heurística de Manhattan admisible y consistente, como se detalló en las secciones anteriores.

La implementación en `pathfinder.js` incluye funciones específicas para reaccionar a obstáculos que verifican si pueden ser saltados o deben marcarse como impasables, cumpliendo el requisito de "considera obstáculos simples como paredes u obstrucciones." Si bien el sistema detecta el pasto como bloque no atravesable, causando que el bot lo salte o evite, esta limitación no impide el funcionamiento general del programa.

Asimismo, el bot considera alturas según las instrucciones "el bot debe saltar hasta 1 bloque y caer hasta 6 para navegar correctamente." La implementación permite saltos de obstáculos cuando es posible en lugar de marcar todo como impasable, y al eliminar la dependencia de `pathfinder.goto()`, el sistema no impone restricciones artificiales en las caídas permitidas.

La principal limitación del programa es que utiliza una grilla 2D con métodos adicionales para manejo 3D en lugar de una grilla 3D nativa. Esta decisión de diseño implica que el bot no detectaría caídas grandes potencialmente peligrosas, lo que podría resultar en navegación no óptima en terrenos con desniveles significativos.

Además, el bot ejecuta cada paso durante intervalos de tiempo fijos en lugar de navegar a coordenadas específicas exactas (por habernos independizado de `pathfinder.goto()`). Esto ocasionalmente resulta en posicionamiento del bot no centrado en un bloque, lo que dificulta la navegación. Como solución, el estado `isBotStuck` fuerza movimientos cuando el bot queda atascado entre bloques, pero no es infalible y su efectividad varía entre ejecuciones (en algunas iteraciones, el bot cumple todos los objetivos navegables sin colisiones, mientras que en otras no logra desatascarse completamente).

### Tareas Completadas

El sistema cumple exitosamente con la siguiente secuencia de objetivos:

1. Navegación con Saltos: Salta obstáculos cuando es posible mientras se dirige a cada objetivo secuencial
2. Navegación al Puente: Va hacia el inicio del camino rodeado de lava
3. Travesía Segura: Cruza el camino rodeado de lava sin caerse
4. Retorno al Spawn: Vuelve a la posición inicial
5. Localización de Cofre: Va hacia el cofre cercano al punto de inicio
6. Gestión de Inventario: Abre el cofre, toma todo su contenido, y lo cierra
7. Reporte de Items: Escribe en el chat los objetos tomados
8. Minería: Mina un bloque de tierra

Durante las pruebas, el cofre no se renderizó correctamente, apareciendo invisible en el visor web. A pesar de haber programado la FSM y los comandos para acercarse al cofre, orientarse hacia él y abrirlo, al momento de ejecutar `openChestAt()` se generó un error de la librería Mineflayer, y las pruebas de escritura del contenido del cofre quedaron inconclusas. Aún así, validamos que al saltear el estado de apertura de cofre, el bot puede proceder directamente al siguiente estado y minar el bloque de tierra debajo de él.

### Tareas No Completadas

Las siguientes tareas no pudieron completarse debido a limitaciones en la arquitectura del programa:

1. Navegación a Coordenadas Específicas: Ve hacia las coordenadas x:-791, y:103, z:152
2. Caída Controlada: Cae a salvo por una caída de 2-5 bloques

Estas coordenadas corresponden al bloque de bedrock en la punta de la montaña del mapa. Sin una grilla 3D nativa, resulta complicado navegar este terreno. El bot intenta recorrer la montaña por el perímetro de su base en lugar de escalar.

### Decisiones de Implementación

La decisión de implementar el sistema completamente en JavaScript, a pesar de conocer el lenguaje pero sin experticia avanzada, resultó contraproducente. Si bien alcanzamos la mayoría de los objetivos planteados, los errores persistentes y las metas parcialmente logradas revelan el costo de nuestra elección: horas de depuración reinventando funcionalidades que ya existían en el código base de C++, una curva de aprendizaje mucho más empinada y un desarrollo menos estable de lo previsto. Esperamos que este balance pueda ser considerado al momento de la evaluación del trabajo práctico.

## Bonus

- Revisamos el mapa completo y encontramos una cueva con antorcha, un templo marino, un templo de jungla y un barco hundido. Creemos que estos son los easter eggs.

No llegamos a implementar la minería avanzada sugerida porque, como explicamos anteriormente, dedicamos gran parte del tiempo a reinventar funcionalidades en JavaScript al no contar con el código base en C++.
