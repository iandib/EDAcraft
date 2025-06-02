/**
 * @brief FSM that handles bot behaviour
 *
 * @author Agustín Galdeman
 * @author
 * @author
 *
 * @copyright Copyright (c) 2025
 *
 */

#pragma once
#include <nlohmann/json.hpp>
#include "pathfinder.h"

// Target coordinates constants
const int TARGET_X = -791;
const int TARGET_Y = 103;
const int TARGET_Z = 152;

class FSM {
public:
    // Constructor: initializes FSM state and origin
    FSM();

    // Returns the next action to send to the bot as a JSON command
    nlohmann::json nextAction();

    // Processes bot's reply to update FSM state
    void handleBotFeedback(const nlohmann::json& msg);

    // Optionally update the bot's origin position
    void setOrigin(int x, int y, int z);

private:

    // Internal FSM states: modify this code to make your bot accomplish tasks.
    enum class State {
        Idle,
        RequestPosition,        // Ask the bot for its current position
        CalculatePath,          // Calculate path using A* algorithm
        MoveToNextPosition,     // Move to next position in path
        CheckBlockAhead,        // Check what block is blocking the path
        DigBlockAhead,          // Dig the blocking block
        RecalculatePath,        // Recalculate path due to obstacles
        ExploreRandomly,        // Explore randomly when stuck (new state)
        Done,                   // Task complete
    } state;

    // PathFinder instance for A* algorithm
    PathFinder pathfinder;

    // Origin and current coordinates
    int originX, originY, originZ;
    int currentX, currentY, currentZ;
    
    // Target coordinates
    Position3D targetPos;
    
    // Current path information
    Position3D nextPos;
    std::string currentDirection;
    
    // Position of block we're trying to dig
    int digX, digY, digZ;
    
    // Counter to track number of steps taken
    int stepCount;
    
    // Exploration state variables
    std::string explorationDirection;
    int explorationSteps;
    int maxExplorationSteps;
    
    // Control flags
    bool pathCalculated;
    bool positionReceived;
    int recalculationAttempts;
    
    // Helper functions
    void changeDirection();
    void changeExplorationDirection();
    std::string calculateDirection(const Position3D& from, const Position3D& to);
    bool isAtTarget() const;
    void updateWorldCache(const Position3D& pos, const std::string& blockName);
};