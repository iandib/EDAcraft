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
        RequestPosition,        // Ask the bot for its current position
        RequestCurrentPosition, // Ask for position after failed step
        MoveToTarget,          // Move to a new target based on origin
        ScanForBlocks,         // Scan 10x10x10 area around bot to find blocking blocks
        Done,                  // Task complete
    } state;

    // Origin coordinates (used as base reference)
    int originX, originY, originZ;
    
    // Current bot position
    int currentX, currentY, currentZ;
    
    // Position before the failed step (to calculate blocking block correctly)
    int preStepX, preStepY, preStepZ;
    
    // Target direction we're trying to move
    std::string targetDirection;
    
    // Position of block we're trying to check
    int checkX, checkY, checkZ;
    
    // Variables for systematic scanning
    int scanX, scanY, scanZ;
    int scanStartX, scanStartY, scanStartZ;
    int scanEndX, scanEndY, scanEndZ;
    bool scanningActive;
    
    // Counter to track number of steps taken
    int stepCount;

    // Optional flag if needed later
    bool moved = false;
    
    // Helper function to change direction when blocked
    void changeDirection();
};