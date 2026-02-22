# Integridad

## Introducción

Bienvenido a Point Zero One Digital, un juego de roguelike financiero de 12 minutos. Nuestra infraestructura es arquitectura soberana y está diseñada para ser de producción-grado e implementación-lista. Nunca utilizamos 'any' en TypeScript. Todo el código se ejecuta en modo estricto. Todos los efectos son deterministas.

## Contenido

### Inicio

- **Título**: Bienvenida al juego de Point Zero One Digital
- **Descripción**: Bienvenido a nuestro juego de roguelike financiero de 12 minutos. A continuación, podrás configurar tu personaje y comenzar a jugar.

### Juego

- **Título**: Configuración del personaje
  - **Campo**: Nombre
    - **Tipo**: cadena
    - **Descripción**: El nombre de tu personaje en el juego.
  - **Campo**: Monedas
    - **Tipo**: número entero
    - **Descripción**: La cantidad de monedas que tienes disponibles para iniciar el juego.
- **Título**: Jugar
  - **Campo**: Elección de la estrategia
    - **Tipo**: cadena
    - **Descripción**: Elige una estrategia para jugar al juego. Cada estrategia tiene sus propias ventajas y desventajas.
  - **Campo**: Elección de la inversión
    - **Tipo**: número entero
    - **Descripción**: Elige cuántas monedas quieres invertir en el juego. Recuerda que cada estrategia tiene un costo asociado.
  - **Campo**: Resultado final
    - **Tipo**: número entero
    - **Descripción**: El resultado final de tu partida, incluyendo la cantidad de monedas ganadas o perdidas.
- **Título**: Finalización del juego
  - **Campo**: Reiniciar el juego
    - **Tipo**: booleano
    - **Descripción**: Si deseas jugar de nuevo, selecciona esta opción para reiniciar el juego.

### Resultados

- **Título**: Resultados finales del juego
  - **Campo**: Ranking general
    - **Tipo**: arreglo de objetos
      - **Objeto**: Nombre, Monedas
        - **Descripción**: El ranking general de los jugadores en el juego. Cada objeto contiene el nombre del jugador y la cantidad de monedas que tiene actualmente.
  - **Campo**: Ranking diario
    - **Tipo**: arreglo de objetos
      - **Objeto**: Nombre, Monedas
        - **Descripción**: El ranking diario de los jugadores en el juego. Cada objeto contiene el nombre del jugador y la cantidad de monedas que ha ganado ese día.
