# Minecraft Bot Programming Assignment

This project implements a Minecraft bot using a combination of C++ and JavaScript. The C++ part handles the pathfinding algorithm (A*), state machine, and decision making, while the JavaScript part interfaces with Minecraft using Mineflayer.

## Prerequisites

- Minecraft Java Edition Server (1.19)
- Node.js (v14 or higher)
- C++ Compiler (C++17 compatible)
- CMake (3.10 or higher)
- nlohmann-json library


## Setup Instructions

### Using CLion and WebStorm (Recommended)

#### C++ Setup (CLion)
1. Open CLion
2. File -> Open -> Select the project's root directory
3. CLion should automatically detect the CMakeLists.txt
4. Install dependencies:
   ```bash
   # macOS
   brew install nlohmann-json

   # Ubuntu
   sudo apt-get install nlohmann-json3-dev

   # Windows (vcpkg)
   vcpkg install nlohmann-json:x64-windows
   ```
5. Build the project using CLion's build button

#### JavaScript Setup (WebStorm)
1. Open WebStorm
2. File -> Open -> Select the JS directory
3. Open terminal in WebStorm and run:
   ```bash
   npm install mineflayer prismarine-viewer
   ```

### Generic Setup (Command Line)

#### C++ Setup
1. Create a build directory:
   ```bash
   cd C++
   mkdir build
   cd build
   ```

2. Build the project:
   ```bash
   cmake ..
   make
   ```

#### JavaScript Setup
1. Install dependencies:
   ```bash
   cd JS
   npm install
   ```

## Running the Project

1. Start your Minecraft server (1.19) on localhost:25565

2. Start the JavaScript bot:
   - In WebStorm: Right click on bot.js -> Run
   - Command line:
     ```bash
     cd JS
     node bot.js
     ```

3. Start the C++ program:
   - In CLion: Run the "minecraft_bot" configuration
   - Command line:
     ```bash
     cd C++/build
     ./minecraft_bot
     ```


## Common Issues

1. **Connection Refused**: Make sure your Minecraft server is running
2. **JSON Parse Error**: Check the format of commands being sent
3. **Build Errors**: Ensure all dependencies are installed
4. **Bot Not Responding**: Check both processes are running and communicating

