/** *************************************************************************************
   
    * @file        pathfinder.h
    * @brief       3D pathfinding system using A* algorithm for Minecraft bot navigation
    * @author      Ian A. Dib
    * @author      Luciano S. Cordero
    * @date        2025-06-01
    * @version     1.0

    ************************************************************************************* */


/* **************************************************************************************
    * INCLUDES AND CONFIGURATION *
   ************************************************************************************** */

#ifndef PATHFINDER_H
#define PATHFINDER_H

#pragma once

#include <vector>
#include <queue>
#include <unordered_map>
#include <unordered_set>
#include <cmath>
#include <algorithm>
#include <functional>


/* **************************************************************************************
    * CONSTANTS AND DEFINITIONS *
   ************************************************************************************** */

//* PATHFINDING CONFIGURATION

#define MAX_SEARCH_DISTANCE 100       // Maximum search radius for pathfinding
#define MAX_FALL_DISTANCE 3           // Maximum blocks bot can fall safely
#define MAX_JUMP_HEIGHT 1             // Maximum blocks bot can jump up
#define HEURISTIC_WEIGHT 1.0          // Weight factor for Manhattan heuristic


//* MOVEMENT COSTS

#define COST_HORIZONTAL 1.0           // Cost for horizontal movement
#define COST_VERTICAL_UP 1.5          // Cost for jumping up
#define COST_VERTICAL_DOWN 1.2        // Cost for falling down
#define COST_DIAGONAL 1.414           // Cost for diagonal movement (sqrt(2))


/* **************************************************************************************
    * DATA TYPES AND STRUCTURES *
   ************************************************************************************** */

/**
 * @brief 3D position structure for pathfinding
 */
struct Position3D 
{
    int x, y, z;
    
    Position3D() : x(0), y(0), z(0) {}
    Position3D(int x, int y, int z) : x(x), y(y), z(z) {}
    
    bool operator==(const Position3D& other) const 
    {
        return x == other.x && y == other.y && z == other.z;
    }
    
    bool operator!=(const Position3D& other) const 
    {
        return !(*this == other);
    }
};

/**
 * @brief Hash function for Position3D to use in unordered containers
 */
struct Position3DHash 
{
    std::size_t operator()(const Position3D& pos) const 
    {
        return std::hash<int>()(pos.x) ^ 
               (std::hash<int>()(pos.y) << 1) ^ 
               (std::hash<int>()(pos.z) << 2);
    }
};

/**
 * @brief Node structure for A* algorithm
 */
struct PathNode 
{
    Position3D position;
    double gCost;                     // Cost from start to this node
    double hCost;                     // Heuristic cost from this node to goal
    double fCost;                     // Total cost (g + h)
    Position3D parent;
    bool hasParent;
    
    PathNode() : gCost(0), hCost(0), fCost(0), hasParent(false) {}
    PathNode(Position3D pos) : position(pos), gCost(0), hCost(0), fCost(0), hasParent(false) {}
};

/**
 * @brief Comparator for priority queue (min-heap based on fCost)
 */
struct PathNodeComparator 
{
    bool operator()(const PathNode& a, const PathNode& b) const 
    {
        return a.fCost > b.fCost;
    }
};

/**
 * @brief Block type enumeration for world representation
 */
enum class BlockType 
{
    AIR = 0,                          // Traversable air block
    SOLID = 1,                        // Non-traversable solid block
    LIQUID = 2,                       // Traversable liquid block
    UNKNOWN = 3                       // Unknown/unloaded block
};


/* **************************************************************************************
    * CLASS DECLARATIONS *
   ************************************************************************************** */

/**
 * @brief 3D pathfinding system using A* algorithm
 * @note This class provides complete pathfinding functionality for a Minecraft bot
 *       including obstacle detection, jump/fall mechanics, and path optimization.
 */
class PathFinder 
{
private:

    // World representation and caching
    std::unordered_map<Position3D, BlockType, Position3DHash> worldCache;
    std::vector<Position3D> currentPath;
    int currentPathIndex;
    Position3D currentTarget;
    bool pathCalculated;
    
    // Movement direction vectors for 3D navigation
    static const std::vector<Position3D> movementDirections;
    
    /**
     * @brief Calculate Manhattan distance heuristic between two positions
     * @param from Starting position
     * @param to Target position
     * @return Heuristic distance value
     */
    double calculateHeuristic(const Position3D& from, const Position3D& to) const;
    
    /**
     * @brief Calculate movement cost between two adjacent positions
     * @param from Starting position
     * @param to Target position
     * @return Movement cost value
     */
    double calculateMovementCost(const Position3D& from, const Position3D& to) const;
    
    /**
     * @brief Check if a position is traversable for the bot
     * @param pos Position to check
     * @return true if position can be occupied by bot
     */
    bool isTraversable(const Position3D& pos) const;
    
    /**
     * @brief Check if movement between two positions is valid
     * @param from Starting position
     * @param to Target position
     * @return true if movement is physically possible
     */
    bool isValidMovement(const Position3D& from, const Position3D& to) const;
    
    /**
     * @brief Get all valid neighboring positions for pathfinding
     * @param pos Current position
     * @return Vector of valid neighboring positions
     */
    std::vector<Position3D> getValidNeighbors(const Position3D& pos) const;
    
    /**
     * @brief Reconstruct path from goal to start using parent information
     * @param nodes Map of all processed nodes
     * @param goal Goal position
     * @return Vector representing the complete path
     */
    std::vector<Position3D> reconstructPath(
        const std::unordered_map<Position3D, PathNode, Position3DHash>& nodes,
        const Position3D& goal) const;

public:

    /**
     * @brief Constructor for PathFinder
     */
    PathFinder();
    
    /**
     * @brief Update world cache with block information
     * @param pos Block position
     * @param blockType Type of block at position
     */
    void updateWorldCache(const Position3D& pos, BlockType blockType);
    
    /**
     * @brief Clear the world cache (useful for world changes)
     */
    void clearWorldCache();
    
    /**
     * @brief Calculate path from start to goal using A* algorithm
     * @param start Starting position
     * @param goal Target position
     * @return true if path was found successfully
     */
    bool calculatePath(const Position3D& start, const Position3D& goal);
    
    /**
     * @brief Get the next position in the current path
     * @param currentPos Current bot position
     * @return Next position to move to, or current position if path complete
     */
    Position3D getNextPosition(const Position3D& currentPos);
    
    /**
     * @brief Check if the current path is complete
     * @return true if bot has reached the target
     */
    bool isPathComplete() const;
    
    /**
     * @brief Get the complete calculated path
     * @return Vector of positions representing the full path
     */
    std::vector<Position3D> getCurrentPath() const;
    
    /**
     * @brief Check if path needs recalculation due to obstacles
     * @param currentPos Current bot position
     * @return true if path is blocked and needs recalculation
     */
    bool isPathBlocked(const Position3D& currentPos) const;
    
    /**
     * @brief Reset pathfinding state
     */
    void reset();
};

#endif // PATHFINDER_H