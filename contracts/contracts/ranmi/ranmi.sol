// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract RanmiGame is ReentrancyGuard {
    enum Outcome { PlayerWins, PlayerLoses }
    enum GameStatus { Pending, Ready, Settled }

    struct Game {
        address player;
        uint256 bet;
        GameStatus status;
    }

    struct GameData {
        uint8[5] numbers;
        uint8 winningIndex;
    }

    address public immutable i_owner;
    address public trustedRelayer;
    uint256 public minBet;
    uint256 public maxBet;
    uint256 public gameCounter;

    uint256 public constant PLAYER_PAYOUT_BPS = 48000;
    uint256 public constant BPS_DIVISOR = 10000;

    mapping(uint256 => Game) public games;
    mapping(uint256 => GameData) private results;

    event GameStarted(uint256 indexed id, address indexed player, uint256 bet);
    event GameReady(uint256 indexed id, uint8[5] numbers);
    event GameResult(uint256 indexed id, address indexed player, Outcome outcome, uint8 guessIndex, uint8 winningIndex, uint256 prize);
    event RelayerUpdated(address indexed newRelayer);

    modifier onlyOwner() {
        require(msg.sender == i_owner, "RanmiGame: Not the owner");
        _;
    }

    constructor(address _rel) {
        i_owner = msg.sender;
        trustedRelayer = _rel; 
        minBet = 0.00001 ether;
        maxBet = 0.5 ether;
    }

    function play() external payable nonReentrant {
        require(msg.value >= minBet && msg.value <= maxBet, "Bet is out of range");
        uint256 id = ++gameCounter;
        games[id] = Game({
            player: msg.sender,
            bet: msg.value,
            status: GameStatus.Pending
        });
        emit GameStarted(id, msg.sender, msg.value);
    }

    function deliverNumbers(uint256 id, uint8[5] calldata _numbers, uint8 _winningIndex) external nonReentrant {
        require(msg.sender == trustedRelayer, "Only the relayer can deliver numbers");
        Game storage g = games[id];
        require(g.status == GameStatus.Pending, "Game not pending");
        
        g.status = GameStatus.Ready;
        results[id] = GameData({ numbers: _numbers, winningIndex: _winningIndex });
        
        emit GameReady(id, _numbers);
    }

    function makeGuess(uint256 id, uint8 guessIndex) external nonReentrant {
        Game storage g = games[id];
        require(g.player == msg.sender, "Not your game");
        require(g.status == GameStatus.Ready, "Game not ready for guessing");
        require(guessIndex < 5, "Guess index must be 0-4");
        
        g.status = GameStatus.Settled;
        
        GameData memory res = results[id];
        bool won = (guessIndex == res.winningIndex);
        uint256 prize = 0;
        
        if (won) {
            prize = (g.bet * PLAYER_PAYOUT_BPS) / BPS_DIVISOR;
            _safeTransfer(g.player, prize);
            emit GameResult(id, g.player, Outcome.PlayerWins, guessIndex, res.winningIndex, prize);
        } else {
            emit GameResult(id, g.player, Outcome.PlayerLoses, guessIndex, res.winningIndex, 0);
        }

        delete games[id];
        delete results[id];
    }
    
    function setTrustedRelayer(address _newRelayer) external onlyOwner {
        require(_newRelayer != address(0), "Cannot set relayer to zero address");
        trustedRelayer = _newRelayer;
        emit RelayerUpdated(_newRelayer);
    }


    // helper function for testnet.. will remove on full prod
    function withdraw() external onlyOwner {
        uint256 bal = address(this).balance;
        _safeTransfer(msg.sender, bal);
    }

    function _safeTransfer(address to, uint256 amt) internal {
        (bool ok, ) = to.call{value: amt}("");
        require(ok, "Transfer failed");
    }
    
    receive() external payable {}
}
