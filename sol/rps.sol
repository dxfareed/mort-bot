// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract RPSGameOnMorph is ReentrancyGuard, Ownable {
    enum Choice { Rock, Paper, Scissor }
    enum Outcome { PlayerWins, ComputerWins, Draw }

    address public trustedRelayer;

    uint256 public minBet;
    uint256 public maxBet;
    uint256 public gameCounter;

    struct PlayerBet {
        address playerAddress;
        Choice choice;
        uint256 betAmount;
    }

    mapping(uint256 => PlayerBet) public activeGames;

    event GamePlayed(uint256 indexed gameId, address indexed player, uint256 betAmount, Choice choice);
    event GameResult(uint256 indexed gameId, address indexed player, Outcome outcome, Choice playerChoice, Choice computerChoice, uint256 prizeAmount);

    constructor(address _initialOwner) Ownable(_initialOwner) {
        trustedRelayer = _initialOwner;
        minBet = 0.00001 ether;
        maxBet = 1 ether;
    }

    function play(Choice _choice) external payable nonReentrant {
        require(uint8(_choice) <= 2, "Choice must be 0, 1, or 2");
        require(msg.value >= minBet && msg.value <= maxBet, "Bet is out of range");

        uint256 gameId = ++gameCounter;

        activeGames[gameId] = PlayerBet({
            playerAddress: msg.sender,
            choice: _choice,
            betAmount: msg.value
        });

        // The relayer bot will listen for this event
        emit GamePlayed(gameId, msg.sender, msg.value, _choice);
    }

    // This function can ONLY be called by the trusted relayer
    function settleGame(uint256 _gameId, uint256 _randomNumber) external nonReentrant {
        require(msg.sender == trustedRelayer, "Only the relayer can settle games");
        PlayerBet memory playerInfo = activeGames[_gameId];
        require(playerInfo.playerAddress != address(0), "Game not found or already settled");

        delete activeGames[_gameId];

        Choice computerChoice = Choice(_randomNumber % 3);
        Outcome gameOutcome = _getOutcome(playerInfo.choice, computerChoice);
        uint256 betAmount = playerInfo.betAmount;
        uint256 prizeAmount = 0;

        if (gameOutcome == Outcome.PlayerWins) {
            // In a real scenario, you'd calculate fees here
            prizeAmount = betAmount * 195 / 100; // Simplified 1.95x payout
            _safeTransfer(playerInfo.playerAddress, prizeAmount);
        } else if (gameOutcome == Outcome.Draw) {
            prizeAmount = betAmount; // Return the original bet
            _safeTransfer(playerInfo.playerAddress, prizeAmount);
        }
        // If the player loses, the house keeps the bet.

        emit GameResult(_gameId, playerInfo.playerAddress, gameOutcome, playerInfo.choice, computerChoice, prizeAmount);
    }

    function _getOutcome(Choice _player, Choice _comp) internal pure returns (Outcome) {
        if (_player == _comp) return Outcome.Draw;
        if ((_player == Choice.Rock && _comp == Choice.Scissor) ||
            (_player == Choice.Paper && _comp == Choice.Rock) ||
            (_player == Choice.Scissor && _comp == Choice.Paper)) {
            return Outcome.PlayerWins;
        }
        return Outcome.ComputerWins;
    }
    
    function setTrustedRelayer(address _newRelayer) external onlyOwner {
        trustedRelayer = _newRelayer;
    }

    function _safeTransfer(address to, uint256 amount) internal {
        (bool sent,) = to.call{value: amount}("");
        require(sent, "Transfer failed");
    }

    //helper function... testnet function will remove on production

    function withdraw() external onlyOwner {
        uint256 bal = address(this).balance;
        _safeTransfer(msg.sender, bal);
    }
    
    receive() external payable {}
}
