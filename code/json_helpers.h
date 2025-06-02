/**
 * @brief Json helper functions that build the commands used by the bot
 *
 * @author Agustín Galdeman
 * @author Ian A. Dib
 * @author Luciano S. Cordero
 *
 * @copyright Copyright (c) 2025
 *
 */

#pragma once
#include <nlohmann/json.hpp>
#include <string>

/**
 * @brief Create a position request command
 * @return JSON command to request bot position
 */
nlohmann::json createPositionCommand();

/**
 * @brief Create a block_at command to check block type at specific coordinates
 * @param x X coordinate
 * @param y Y coordinate  
 * @param z Z coordinate
 * @return JSON command to check block at position
 */
nlohmann::json createBlockAtCommand(int x, int y, int z);

/**
 * @brief Create a step command to move in a direction
 * @param direction Direction string ("north", "south", "east", "west")
 * @return JSON command to step in direction
 */
nlohmann::json createStepCommand(const std::string& direction);

/**
 * @brief Create a jump command
 * @return JSON command to make bot jump
 */
nlohmann::json createJumpCommand();

/**
 * @brief Validate if a JSON response indicates success
 * @param response JSON response from bot
 * @return true if response indicates success
 */
bool isSuccessResponse(const nlohmann::json& response);

/**
 * @brief Extract position from JSON response
 * @param response JSON response containing position data
 * @param x Reference to store X coordinate
 * @param y Reference to store Y coordinate
 * @param z Reference to store Z coordinate
 * @return true if position was successfully extracted
 */
bool extractPosition(const nlohmann::json& response, int& x, int& y, int& z);

/**
 * @brief Extract block information from block_at response
 * @param response JSON response from block_at command
 * @param blockName Reference to store block name
 * @return true if block info was successfully extracted
 */
bool extractBlockInfo(const nlohmann::json& response, std::string& blockName);