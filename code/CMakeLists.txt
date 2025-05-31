cmake_minimum_required(VERSION 3.10)
project(Pathfinder)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Source files
set(SOURCES
        main.cpp
        fsm.cpp
        fsm.h
        pathfinder.cpp
        pathfinder.h
        jason_helpers.cpp
        json_helpers.h
        bot_io.cpp
)

# Include nlohmann/json (assumes system-installed version)
find_package(nlohmann_json 3.2.0 REQUIRED)

add_executable(pathfinder ${SOURCES})
target_link_libraries(pathfinder PRIVATE nlohmann_json::nlohmann_json)
