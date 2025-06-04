/**
 * @brief A* pathfinder implementation for bot navigation
 * @author Based on FSM by Agustín Galdeman
 */

#pragma once
#include <nlohmann/json.hpp>
#include <string>
#include <vector>
#include <queue>
#include <unordered_map>
#include <unordered_set>

struct Position3D {
    int x, y, z;
    
    Position3D() : x(0), y(0), z(0) {}
    Position3D(int x, int y, int z) : x(x), y(y), z(z) {}
    
    bool operator==(const Position3D& other) const {
        return x == other.x && y == other.y && z == other.z;
    }
    
    bool operator<(const Position3D& other) const {
        if (x != other.x) return x < other.x;
        if (y != other.y) return y < other.y;
        return z < other.z;
    }
};

// Hash function for Position3D to use in unordered_map
struct Position3DHash {
    std::size_t operator()(const Position3D& pos) const {
        return std::hash<long long>()(((long long)pos.x << 32) | ((long long)pos.z << 16) | pos.y);
    }
};

struct AStarNode {
    Position3D position;
    int gCost;      // Distance from start
    int hCost;      // Heuristic distance to target
    int fCost;      // gCost + hCost
    Position3D parent;
    bool hasParent;
    
    AStarNode() : gCost(0), hCost(0), fCost(0), hasParent(false) {}
    AStarNode(const Position3D& pos) : position(pos), gCost(0), hCost(0), fCost(0), hasParent(false) {}
    
    bool operator>(const AStarNode& other) const {
        return fCost > other.fCost;
    }
};

class PathFinder {
public:
    PathFinder();
    
    // Main interface methods
    nlohmann::json nextAction();
    void handleBotFeedback(const nlohmann::json& msg);
    
    // Set target destination
    void setTarget(const Position3D& target);
    void setTarget(int x, int y, int z);
    
    // Check if pathfinding is complete
    bool isComplete() const;
    
    // Get current position
    Position3D getCurrentPosition() const { return Position3D(currentX, currentY, currentZ); }
    
private:
    enum class State {
        Idle,
        RequestPosition,
        RequestCurrentPosition,
        MoveToTarget,
        CheckObstacle,
        Done
    } state;
    
    // Current bot position
    int currentX, currentY, currentZ;
    
    // Target destination
    Position3D target;
    bool hasTarget;
    
    // A* pathfinding
    std::vector<Position3D> currentPath;
    int currentPathIndex;
    std::unordered_set<Position3D, Position3DHash> knownObstacles;
    bool needsReplan;
    
    // Current movement direction
    std::string currentDirection;
    
    // Obstacle checking
    int obstacleCheckCount; // 0 = lower block, 1 = upper block
    
    // Step counting and limits
    int stepCount;
    static const int MAX_STEPS = 2000; // Increased for longer distances
    
    // Direction management
    std::vector<std::string> directions;
    int currentDirectionIndex;
    
    // A* algorithm methods
    std::vector<Position3D> findPath(const Position3D& start, const Position3D& goal);
    int calculateHeuristic(const Position3D& from, const Position3D& to);
    std::vector<Position3D> getNeighbors(const Position3D& pos);
    std::vector<Position3D> reconstructPath(const std::unordered_map<Position3D, AStarNode, Position3DHash>& allNodes, 
                                       const Position3D& goal);
    bool isValidPosition(const Position3D& pos);
    
    // Helper methods
    void planPath();
    void chooseNextDirection();
    void changeDirection();
    std::string calculateDirectionToNextWaypoint();
    bool isAtTarget() const;
    bool isAtCurrentWaypoint() const;
    void getFrontBlockPosition(int& x, int& y, int& z, bool upperBlock = false);
    int getDistanceToTarget() const;
    void addObstacle(const Position3D& pos);
};