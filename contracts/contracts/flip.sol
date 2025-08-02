// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FlipGame is ReentrancyGuard, Ownable {
    address public trustedRelayer;

    uint256 public minBet;
    uint256 public maxBet;
    uint256 public requestTimeout;

    uint256 public constant PLAYER_PAYOUT_BPS = 19200;
    uint256 public constant HOUSE_FEE_BPS     = 500;
    uint256 public constant ADMIN_FEE_BPS     = 300;
    uint256 public constant BPS_DIVISOR       = 10000;

    uint256 public houseFees;
    uint256 public adminFees;
    uint256 public totalOutstandingBets;
    uint256 public gameCounter;

    struct PlayerBet {
        address player;
        uint256 amount;
        uint8 choice;
        uint256 timestamp;
    }

    mapping(uint256 => PlayerBet) public activeGames;

    event FlipInitiated(uint256 indexed gameId, address indexed player, uint256 amount, uint8 choice);
    event FlipSettled(uint256 indexed gameId, address indexed player, bool won, uint256 payout);
    event BetReclaimed(uint256 indexed gameId, address indexed player, uint256 amount);
    event AdminFeesWithdrawn(address indexed admin, uint256 amount);

    constructor(address _initialOwner) Ownable(_initialOwner) {
        trustedRelayer = _initialOwner;
        minBet = 0.0001 ether;
        maxBet = 1 ether;
        requestTimeout = 15 minutes;
    }

    function flip(uint8 _choice) external payable nonReentrant {
        require(_choice == 0 || _choice == 1, "Choice must be 0 or 1");
        require(msg.value >= minBet && msg.value <= maxBet, "Bet out of range");

        totalOutstandingBets += msg.value;
        uint256 gameId = ++gameCounter;

        activeGames[gameId] = PlayerBet({
            player: msg.sender,
            amount: msg.value,
            choice: _choice,
            timestamp: block.timestamp
        });

        emit FlipInitiated(gameId, msg.sender, msg.value, _choice);
    }

    function settleFlip(uint256 gameId, uint256 randomNumber) external nonReentrant {
        require(msg.sender == trustedRelayer, "Only the relayer can settle flips");
        PlayerBet memory bet = activeGames[gameId];
        require(bet.player != address(0), "Game not found or already settled");

        delete activeGames[gameId];
        totalOutstandingBets -= bet.amount;

        bool won = (uint8(randomNumber % 2) == bet.choice);
        uint256 payout = 0;

        uint256 totalFee = (bet.amount * (HOUSE_FEE_BPS + ADMIN_FEE_BPS)) / BPS_DIVISOR;
        uint256 housePortion = (bet.amount * HOUSE_FEE_BPS) / BPS_DIVISOR;
        uint256 adminPortion = totalFee - housePortion;

        houseFees += housePortion;
        adminFees += adminPortion;

        if (won) {
            payout = (bet.amount * PLAYER_PAYOUT_BPS) / BPS_DIVISOR;
            _safeTransfer(bet.player, payout);
        }

        emit FlipSettled(gameId, bet.player, won, payout);
    }

    function reclaimBet(uint256 gameId) external nonReentrant {
        PlayerBet memory bet = activeGames[gameId];
        require(bet.player == msg.sender, "Not your bet");
        require(block.timestamp > bet.timestamp + requestTimeout, "Too early to reclaim");

        delete activeGames[gameId];
        totalOutstandingBets -= bet.amount;

        _safeTransfer(msg.sender, bet.amount);
        emit BetReclaimed(gameId, msg.sender, bet.amount);
    }

    function withdrawAdminFees() external onlyOwner nonReentrant {
        uint256 amt = adminFees;
        require(amt > 0, "No fees available");
        adminFees = 0;
        _safeTransfer(owner(), amt);
        emit AdminFeesWithdrawn(owner(), amt);
    }

    function getHouseBalance() external view returns (uint256) {
        return (address(this).balance - adminFees) - totalOutstandingBets;
    }

    function setTrustedRelayer(address _newRelayer) external onlyOwner {
        trustedRelayer = _newRelayer;
    }

    function setBetLimits(uint256 _minBet, uint256 _maxBet) external onlyOwner {
        require(_minBet > 0 && _minBet < _maxBet, "Invalid bet limits");
        minBet = _minBet;
        maxBet = _maxBet;
    }

    function setRequestTimeout(uint256 _timeout) external onlyOwner {
        requestTimeout = _timeout;
    }
    
    function _safeTransfer(address to, uint256 amount) internal {
        (bool sent, ) = to.call{value: amount}("");
        require(sent, "Transfer failed");
    }

    receive() external payable {}
}