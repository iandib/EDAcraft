/** *************************************************************************************
   
    * @file        pathfinder.cpp
    * @brief       3D pathfinding system using A* algorithm for Minecraft bot navigation
    * @author      Ian A. Dib
    * @author      Luciano S. Cordero
    * @date        2025-06-01
    * @version     1.0

    ************************************************************************************* */


/* **************************************************************************************
    * INCLUDES AND CONFIGURATION *
   ************************************************************************************** */

#include "pathfinder.h"


/* **************************************************************************************
    * CONSTANTS AND STATIC DATA *
   ************************************************************************************** */

//* 3D MOVEMENT DIRECTIONS

// 26 possible movement directions in 3D space (including diagonals and vertical)
const std::vector<Position3D> PathFinder::movementDirections =
{  
    // Horizontal movements (same Y level)
    {1, 0, 0}, {-1, 0, 0}, {0, 0, 1}, {0, 0, -1},           // Cardinal directions
    {1, 0, 1}, {1, 0, -1}, {-1, 0, 1}, {-1, 0, -1},         // Diagonal directions
    
    // Upward movements (Y + 1) - jumping
    {0, 1, 0},                                              // Jump straight up
    {1, 1, 0}, {-1, 1, 0}, {0, 1, 1}, {0, 1, -1},           // Jump with horizontal movement
    {1, 1, 1}, {1, 1, -1}, {-1, 1, 1}, {-1, 1, -1},         // Jump diagonally
    
    // Downward movements (Y - 1) - falling
    {0, -1, 0},                                             // Fall straight down
    {1, -1, 0}, {-1, -1, 0}, {0, -1, 1}, {0, -1, -1},       // Fall with horizontal movement
    {1, -1, 1}, {1, -1, -1}, {-1, -1, 1}, {-1, -1, -1}      // Fall diagonally
};


/* **************************************************************************************
    * CLASS IMPLEMENTATION *
   ************************************************************************************** */

//* CONSTRUCTOR AND INITIALIZATION

PathFinder::PathFinder() : currentPathIndex(0), pathCalculated(false)
{
    currentPath.clear();
    worldCache.clear();
}


//* WORLD CACHE MANAGEMENT

void PathFinder::updateWorldCache(const Position3D& pos, BlockType blockType)
{
    worldCache[pos] = blockType;
}

void PathFinder::clearWorldCache()
{
    worldCache.clear();
}


//* HEURISTIC AND COST CALCULATIONS

double PathFinder::calculateHeuristic(const Position3D& from, const Position3D& to) const
{
    // Manhattan distance with 3D consideration
    int dx = abs(to.x - from.x);
    int dy = abs(to.y - from.y);
    int dz = abs(to.z - from.z);
    
    return HEURISTIC_WEIGHT * (dx + dy + dz);
}

double PathFinder::calculateMovementCost(const Position3D& from, const Position3D& to) const
{
    int dx = abs(to.x - from.x);
    int dy = to.y - from.y;               // Signed for up/down detection
    int dz = abs(to.z - from.z);
    
    // Base cost calculation
    double cost = 0.0;
    
    // Horizontal movement cost
    if (dx + dz == 1)
    {
        cost = COST_HORIZONTAL;           // Cardinal movement
    }

    else if (dx + dz == 2) 
    {
        cost = COST_DIAGONAL;             // Diagonal movement
    }
    
    // Vertical movement cost adjustment
    if (dy > 0)
    {
        cost += COST_VERTICAL_UP * dy;    // Jumping up
    }
    
    else if (dy < 0)
    {
        cost += COST_VERTICAL_DOWN * abs(dy);  // Falling down
    }
    
    return cost;
}


//* TRAVERSABILITY AND MOVEMENT VALIDATION

bool PathFinder::isTraversable(const Position3D& pos) const
{
    // Check if position is in cache
    auto it = worldCache.find(pos);
    if (it != worldCache.end())
    {
        return it->second == BlockType::AIR || it->second == BlockType::LIQUID;
    }
    
    // If not in cache, assume traversable (will be updated by bot feedback)
    return true;
}

bool PathFinder::isValidMovement(const Position3D& from, const Position3D& to) const
{
    int dy = to.y - from.y;
    
    // Check vertical movement limits
    if (dy > MAX_JUMP_HEIGHT) return false;
    if (dy < -MAX_FALL_DISTANCE) return false;
    
    // Check if target position is traversable
    if (!isTraversable(to)) return false;
    
    // For upward movement, check if there's enough headroom (2 blocks high)
    if (dy > 0)
    {
        Position3D headPos = {to.x, to.y + 1, to.z};
        if (!isTraversable(headPos)) return false;
    }
    
    // For horizontal movement, ensure bot can fit (2 blocks high)
    if (dy == 0)
    {
        Position3D headPos = {to.x, to.y + 1, to.z};
        if (!isTraversable(headPos)) return false;
    }
    
    // For downward movement, ensure there's ground support eventually
    if (dy < 0)
    {
        // Check if there's solid ground within falling distance
        Position3D groundCheck = to;
        groundCheck.y -= 1;
        bool foundGround = false;
        
        for (int i = 0; i < MAX_FALL_DISTANCE && !foundGround; i++)
        {
            auto it = worldCache.find(groundCheck);
            if (it != worldCache.end() && it->second == BlockType::SOLID)
            {
                foundGround = true;
            }
            groundCheck.y -= 1;
        }
        
        // If no ground found in cache, assume it's safe (will be verified by bot)
    }
    
    return true;
}

std::vector<Position3D> PathFinder::getValidNeighbors(const Position3D& pos) const
{
    std::vector<Position3D> neighbors;
    
    for (const Position3D& direction : movementDirections)
    {
        Position3D neighbor =
        {
            pos.x + direction.x,
            pos.y + direction.y,
            pos.z + direction.z
        };
        
        if (isValidMovement(pos, neighbor))
        {
            neighbors.push_back(neighbor);
        }
    }
    
    return neighbors;
}


//* PATH RECONSTRUCTION

std::vector<Position3D> PathFinder::reconstructPath(
    const std::unordered_map<Position3D, PathNode, Position3DHash>& nodes,
    const Position3D& goal) const
{
    std::vector<Position3D> path;
    Position3D current = goal;
    
    // Trace back from goal to start
    while (true) {
        path.push_back(current);
        
        auto it = nodes.find(current);
        if (it != nodes.end() && it->second.hasParent) {
            current = it->second.parent;
        } else {
            break;
        }
    }
    
    // Reverse path to get start-to-goal order
    std::reverse(path.begin(), path.end());
    
    // Remove the starting position (bot is already there)
    if (!path.empty())
    {
        path.erase(path.begin());
    }
    
    return path;
}


//* A* PATHFINDING ALGORITHM

bool PathFinder::calculatePath(const Position3D& start, const Position3D& goal)
{
    // Reset previous path
    currentPath.clear();
    currentPathIndex = 0;
    currentTarget = goal;
    pathCalculated = false;
    
    // Priority queue for open nodes (min-heap based on fCost)
    std::priority_queue<PathNode, std::vector<PathNode>, PathNodeComparator> openSet;
    
    // Maps to track all nodes and their states
    std::unordered_map<Position3D, PathNode, Position3DHash> allNodes;
    std::unordered_set<Position3D, Position3DHash> closedSet;
    
    // Initialize start node
    PathNode startNode(start);
    startNode.gCost = 0;
    startNode.hCost = calculateHeuristic(start, goal);
    startNode.fCost = startNode.gCost + startNode.hCost;
    
    openSet.push(startNode);
    allNodes[start] = startNode;
    
    int nodesExplored = 0;
    const int maxNodes = MAX_SEARCH_DISTANCE * MAX_SEARCH_DISTANCE * MAX_SEARCH_DISTANCE;
    
    while (!openSet.empty() && nodesExplored < maxNodes)
    {
        // Get node with lowest fCost
        PathNode current = openSet.top();
        openSet.pop();
        nodesExplored++;
        
        // Skip if already processed
        if (closedSet.find(current.position) != closedSet.end())
        {
            continue;
        }
        
        // Add to closed set
        closedSet.insert(current.position);
        
        // Check if we reached the goal
        if (current.position == goal)
        {
            currentPath = reconstructPath(allNodes, goal);
            pathCalculated = true;
            return true;
        }
        
        // Explore neighbors
        std::vector<Position3D> neighbors = getValidNeighbors(current.position);
        
        for (const Position3D& neighbor : neighbors)
        {
            // Skip if already processed
            if (closedSet.find(neighbor) != closedSet.end())
            {
                continue;
            }
            
            // Calculate tentative gCost
            double tentativeGCost = current.gCost + calculateMovementCost(current.position, neighbor);
            
            // Check if this path to neighbor is better
            auto neighborIt = allNodes.find(neighbor);
            bool isNewNode = (neighborIt == allNodes.end());
            bool isBetterPath = false;
            
            if (isNewNode)
            {
                isBetterPath = true;
            }
            
            else
            {
                isBetterPath = tentativeGCost < neighborIt->second.gCost;
            }
            
            if (isBetterPath)
            {
                PathNode neighborNode(neighbor);
                neighborNode.gCost = tentativeGCost;
                neighborNode.hCost = calculateHeuristic(neighbor, goal);
                neighborNode.fCost = neighborNode.gCost + neighborNode.hCost;
                neighborNode.parent = current.position;
                neighborNode.hasParent = true;
                
                allNodes[neighbor] = neighborNode;
                openSet.push(neighborNode);
            }
        }
    }
    
    // No path found
    return false;
}


//* PATH NAVIGATION

Position3D PathFinder::getNextPosition(const Position3D& currentPos)
{
    if (!pathCalculated || currentPath.empty())
    {
        return currentPos;            // Stay in place if no path
    }
    
    // Check if we're close enough to the current target position
    if (currentPathIndex < currentPath.size()) {
        Position3D targetPos = currentPath[currentPathIndex];
        
        // Calculate distance to current target
        int dx = abs(targetPos.x - currentPos.x);
        int dy = abs(targetPos.y - currentPos.y);
        int dz = abs(targetPos.z - currentPos.z);
        
        // If close enough to current target, advance to next position
        if (dx <= 1 && dy <= 1 && dz <= 1)
        {
            currentPathIndex++;
        }
        
        // Return current target or stay in place if path complete
        if (currentPathIndex < currentPath.size())
        {
            return currentPath[currentPathIndex];
        }
    }
    
    return currentPos;                // Path complete, stay in place
}

bool PathFinder::isPathComplete() const
{
    return !pathCalculated || currentPath.empty() || currentPathIndex >= currentPath.size();
}

std::vector<Position3D> PathFinder::getCurrentPath() const
{
    return currentPath;
}


//* PATH VALIDATION

bool PathFinder::isPathBlocked(const Position3D& currentPos) const
{
    if (!pathCalculated || currentPath.empty())
    {
        return false;
    }
    
    // Check if any position in the remaining path is blocked
    for (int i = currentPathIndex; i < currentPath.size(); i++)
    {
        Position3D pathPos = currentPath[i];
        
        if (!isTraversable(pathPos))
        {
            return true;              // Path is blocked
        }
        
        // Also check headroom
        Position3D headPos = {pathPos.x, pathPos.y + 1, pathPos.z};
        if (!isTraversable(headPos))
        {
            return true;              // Path is blocked
        }
    }
    
    return false;                     // Path is clear
}


//* UTILITY FUNCTIONS

void PathFinder::reset()
{
    currentPath.clear();
    currentPathIndex = 0;
    pathCalculated = false;
    // We don't clear worldCache as it contains valuable information
}