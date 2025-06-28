# EDAoogle

## Integrantes del grupo y contribución al trabajo de cada integrante

* Luciano Cordero:
Diseñó la lógica inicial en ```mkindex.cpp``` para crear el índice de búsqueda, implementando las funciones ```removeHtmlTags()``` y ```extractWords()``` para procesar documentos HTML. Utilizó ```CommandLineParser.h``` para el manejo de argumentos de línea de comandos y std::filesystem para el recorrido recursivo de directorios. Estableció la estructura inicial de la base de datos SQLite con las tablas documents, words y word_document. En ```HttpRequestHandler.cpp``` implementó la lógica inicial de la función ```search()```, configurando las consultas SQL básicas para recuperar documentos relevantes.

* Ian Dib:
Optimizó el rendimiento de ```mkindex.cpp``` implementando transaction wrapping con BEGIN TRANSACTION y COMMIT, word caching mediante unordered_map para evitar consultas repetidas, y configuración de SQLite pragmas (journal_mode, synchronous, cache_size, temp_store) para acelerar el procesamiento del índice. Adicionalmente, implementó el soporte para los operadores AND/OR añadiendo la tabla virtual FTS5 documents_fts, desarrollando las funciones ```parseQuery()``` y ```buildFTSQuery()``` para analizar consultas complejas, y creando ```searchFTS()``` y ```searchTraditional()``` para cambiar automáticamente entre búsqueda por operadores y búsqueda tradicional según la entrada.
Completó la implementación del motor de búsqueda en ```HttpRequestHandler.cpp```, desarrollando la función ```search()``` con consultas SQL dinámicas, procesamiento de múltiples palabras clave, ordenamiento por relevancia y medición de tiempo de búsqueda. Modificó ```handleRequest()``` para integrar la funcionalidad de búsqueda con la interfaz web. 


## Parte 1: Creación del índice de búsqueda

El índice de búsqueda, implementado en ```mkindex.cpp```, procesa documentos HTML y genera una base de datos SQLite optimizada para búsquedas rápidas. El sistema utiliza dos enfoques complementarios: un índice tradicional y una tabla virtual FTS5 para búsquedas avanzadas.

El índice tradicional consta de tres tablas principales. La tabla documents almacena información básica de cada página web. La tabla words mantiene un registro único de todas las palabras encontradas en el corpus, evitando duplicación y optimizando el espacio. La tabla word_document implementa una relación many-to-many entre palabras y documentos, registrando la frecuencia de aparición de cada palabra en cada documento para calcular la relevancia de los resultados.

Para búsquedas avanzadas con operadores booleanos, se implementó la tabla virtual documents_fts utilizando FTS5 de SQLite. Esta tabla almacena el contenido completo de cada documento (path, title, content) y permite búsquedas complejas con operadores AND, OR y expresiones anidadas, utilizando el algoritmo BM25 para calcular la relevancia.

La función ```removeHtmlTags()``` elimina todas las etiquetas HTML del contenido, identificando su inicio y fin mediante los caracteres < y >, a fin de conservar únicamente el texto plano visible para el usuario. La función ```extractWords()``` procesa el texto plano resultante, normalizando las palabras mediante conversión a minúsculas y eliminación de caracteres no alfanuméricos. Solo se indexan palabras con al menos dos caracteres para evitar ruido en los resultados de búsqueda.

Para manejar eficientemente el gran volumen de datos, se implementaron algunas optimizaciones. El transaction wrapping agrupa todas las operaciones de inserción en una sola transacción, reduciendo el tiempo de procesamiento al minimizar las operaciones de escritura al disco. El word caching utiliza un unordered_map para almacenar en memoria los IDs de palabras ya procesadas, evitando consultas repetidas a la base de datos. Los SQLite pragmas configuran el motor de base de datos para máximo rendimiento: journal_mode = WAL permite lecturas concurrentes, synchronous = NORMAL balancea seguridad y velocidad, cache_size = 10000 aumenta la memoria disponible, y temp_store = MEMORY utiliza RAM para operaciones temporales.

Para generar el índice de búsqueda, se debe compilar el target mkindex y ejecutarlo especificando la ruta de la carpeta www:
```mkindex -h ../../www```

## Parte 2: Implementación del motor de búsqueda

El motor de búsqueda implementado en ```HttpRequestHandler.h``` y ```.cpp``` proporciona búsquedas relevantes a través de una interfaz web, soportando tanto búsquedas tradicionales como búsquedas avanzadas con operadores booleanos.

El sistema utiliza dos enfoques de búsqueda según la complejidad de la entrada:

*Búsqueda tradicional* con ```searchTraditional()```: Para consultas simples sin operadores, utiliza el índice basado en palabras con lógica OR implícita. Procesa las consultas normalizando el texto de entrada mediante conversión a minúsculas y extracción de palabras válidas. Las consultas SQL se construyen dinámicamente para buscar documentos que contengan cualquiera de las palabras especificadas, sumando las frecuencias para crear un score de relevancia. Como criterio de desempate, se utiliza el orden alfabético del título del documento.

*Búsqueda FTS* con ```searchFTS()```: Para consultas complejas con operadores AND/OR, utiliza la tabla virtual FTS5. La función ```parseQuery()``` detecta automáticamente la presencia de operadores booleanos en la consulta, mientras que ```buildFTSQuery()``` convierte la consulta al formato requerido por FTS5.

La función ```search()``` analiza la entrada para determinar automáticamente si debe usar búsqueda tradicional o FTS, y la procesa eliminando caracteres no alfanuméricos y filtrando términos con menos de dos caracteres. 

Para proteger el sistema contra ataques de inyección SQL, todas las consultas utilizan prepared statements con parámetros vinculados (sqlite3_bind_text). Esta técnica separa completamente la estructura de la consulta SQL de los datos proporcionados por el usuario, impidiendo que código malicioso sea interpretado como comandos SQL ejecutables.

La función ```handleRequest()``` incluye medición precisa del tiempo de búsqueda utilizando std::chrono::high_resolution_clock. Los tiempos se muestran en la interfaz web con precisión de microsegundos, permitiendo evaluar el rendimiento del motor de búsqueda.

Para ejecutar el servidor en http://localhost:8000, siempre que el archivo index.db ya exista en el directorio de trabajo, hay que compilar el target edahttpd y ejecutarlo especificando la ruta de la carpeta www:
```edahttp -h ../../www```

## Bonus points

- Se implementó la búsqueda mediante operadores aprovechando FTS5 de SQLite para soporte nativo de operadores booleanos AND/OR, con detección automática del tipo de entrada para distinguir entre búsqueda tradicional y búsqueda FTS.