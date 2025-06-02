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

    // Internal FSM states: modify this code to make your bot acomplish tasks.
    enum class State {
        Idle,
        RequestPosition,   // Ask the bot for its current position
        MoveToTarget,      // Move to a new target based on origin
        CheckBlockAhead,   // Check what block is blocking the path
        DigBlockAhead,     // Dig the blocking block
        Done,               // Task complete
    } state;

    // Origin coordinates (used as base reference)
    int originX, originY, originZ;
    
    // Current bot position
    int currentX, currentY, currentZ;
    
    // Target direction we're trying to move
    std::string targetDirection;
    
    // Position of block we're trying to dig
    int digX, digY, digZ;
    
    // Counter to track number of steps taken
    int stepCount;

    // Optional flag if needed later
    bool moved = false;
    
    // Helper function to change direction when blocked
    void changeDirection();
};