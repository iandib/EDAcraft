/**
 * @brief FSM that handles bot behaviour with A* pathfinding
 *
 * @author Agustín Galdeman
 * @author Enhanced with A* pathfinding
 *
 * @copyright Copyright (c) 2025
 *
 */

#pragma once
#include <nlohmann/json.hpp>
#include "pathfinder.h"

class FSM {
public:
    // Constructor: initializes FSM state and pathfinder
    FSM();

    // Returns the next action to send to the bot as a JSON command
    nlohmann::json nextAction();

    // Processes bot's reply to update FSM state
    void handleBotFeedback(const nlohmann::json& msg);

    // Set target destination for A* pathfinding
    void setTarget(int x, int y, int z);
    void setTarget(const Position3D& target);

    // Optionally update the bot's origin position
    void setOrigin(int x, int y, int z);
    
    // Check if the bot has completed its task
    bool isComplete() const;

private:

    // Internal FSM states: now delegates pathfinding to PathFinder
    enum class State {
        Idle,
        Pathfinding,    // Delegating to A* pathfinder
        Done,           // Task complete
    } state;

    // A* Pathfinder instance
    PathFinder pathfinder;

    // Origin coordinates (used as base reference)
    int originX, originY, originZ;
    
    // Target coordinates
    Position3D target;
    bool hasTarget;
    
    // Step counting for statistics
    int totalSteps;
};